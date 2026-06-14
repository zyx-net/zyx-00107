import { create } from 'zustand';
import { 
  AppState, 
  Role, 
  WorkOrder, 
  Timeline, 
  FilterState, 
  WorkOrderStatus,
  TimelineAction,
  ExportResult,
  ImportResult,
  ImportError,
  ImportErrorType 
} from '../types';
import { 
  initialWorkOrders, 
  initialStores, 
  initialEngineers, 
  initialTimelines,
  roleNames 
} from '../data/initialData';
import { storage } from '../utils/storage';

interface AppActions {
  setRole: (role: Role) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  selectOrder: (orderId: string | null) => void;
  dispatchOrder: (orderId: string, engineerId: string, engineerName: string, expectedVersion: number) => { success: boolean; error?: string };
  acceptOrder: (orderId: string) => { success: boolean; error?: string };
  updateRepairRecord: (orderId: string, record: string) => void;
  submitComplete: (orderId: string) => { success: boolean; error?: string };
  reviewOrder: (orderId: string, rating: '满意' | '基本满意' | '不满意', remark: string) => { success: boolean; error?: string };
  cancelOrder: (orderId: string, reason: string) => { success: boolean; error?: string };
  reopenOrder: (orderId: string, reason: string) => { success: boolean; error?: string };
  createOrder: (storeId: string, equipment: string, description: string, contactName?: string, contactPhone?: string, expectedVisitTime?: string) => WorkOrder;
  exportOrders: (orders: WorkOrder[], name: string) => ExportResult;
  getFilteredOrders: () => WorkOrder[];
  getRoleOrders: () => WorkOrder[];
  resetData: () => void;
  importOrders: (csvData: string[][]) => { success: boolean; result?: ImportResult; error?: string };
  validateImportData: (csvData: string[][]) => { valid: boolean; errors: ImportError[]; validOrders: Partial<WorkOrder>[] };
  getImports: () => ImportResult[];
}

const generateId = () => Math.random().toString(36).substring(2, 15);
const generateOrderNo = (orders: WorkOrder[]) => {
  const year = new Date().getFullYear();
  const count = orders.length + 1;
  return `WO-${year}-${String(count).padStart(4, '0')}`;
};

const addTimeline = (
  timelines: Record<string, Timeline[]>,
  workOrderId: string,
  action: TimelineAction,
  description: string,
  role: Role
): Record<string, Timeline[]> => {
  const timeline: Timeline = {
    id: generateId(),
    workOrderId,
    action,
    description,
    operator: roleNames[role],
    role,
    createdAt: new Date().toISOString(),
  };

  return {
    ...timelines,
    [workOrderId]: [...(timelines[workOrderId] || []), timeline],
  };
};

export const useStore = create<AppState & AppActions>((set, get) => ({
  currentRole: storage.getCurrentRole(),
  workOrders: storage.getWorkOrders().length > 0 ? storage.getWorkOrders() : initialWorkOrders,
  stores: initialStores,
  engineers: initialEngineers,
  filters: storage.getFilters(),
  timelineMap: storage.getTimelines().WO001 ? storage.getTimelines() : initialTimelines,
  exports: storage.getExports(),
  imports: storage.getImports(),
  selectedOrderId: null,

  setRole: (role) => {
    storage.setCurrentRole(role);
    set({ currentRole: role, selectedOrderId: null });
  },

  setFilters: (newFilters) => {
    const filters = { ...get().filters, ...newFilters };
    storage.setFilters(filters);
    set({ filters });
  },

  selectOrder: (orderId) => {
    set({ selectedOrderId: orderId });
  },

  dispatchOrder: (orderId, engineerId, engineerName, expectedVersion) => {
    const state = get();
    
    if (state.currentRole !== 'dispatch') {
      return { success: false, error: '权限不足：只有调度角色才能进行派工操作' };
    }
    
    const order = state.workOrders.find(o => o.id === orderId);
    
    if (!order) {
      return { success: false, error: '工单不存在' };
    }

    if (order.status !== '待派工') {
      return { success: false, error: `派工失败：该工单已被其他调度派工，当前状态: ${order.status}` };
    }

    if (order.version !== expectedVersion) {
      return { success: false, error: `派工失败：工单已被其他操作修改，请刷新后重试（版本冲突）` };
    }

    const updatedOrders = state.workOrders.map(o => 
      o.id === orderId 
        ? { 
            ...o, 
            status: '已派工' as WorkOrderStatus, 
            engineerId, 
            engineerName,
            updatedAt: new Date().toISOString(),
            version: o.version + 1 
          }
        : o
    );

    const updatedTimelines = addTimeline(
      state.timelineMap,
      orderId,
      '派工',
      `分配给${engineerName}处理`,
      state.currentRole
    );

    storage.setWorkOrders(updatedOrders);
    storage.setTimelines(updatedTimelines);
    
    set({ workOrders: updatedOrders, timelineMap: updatedTimelines });
    return { success: true };
  },

  acceptOrder: (orderId) => {
    const state = get();
    const order = state.workOrders.find(o => o.id === orderId);

    if (!order) {
      return { success: false, error: '工单不存在' };
    }

    if (order.status !== '已派工') {
      return { success: false, error: `当前状态不允许接单: ${order.status}` };
    }

    const updatedOrders = state.workOrders.map(o =>
      o.id === orderId
        ? {
            ...o,
            status: '维修中' as WorkOrderStatus,
            updatedAt: new Date().toISOString(),
            version: o.version + 1
          }
        : o
    );

    const updatedTimelines = addTimeline(
      state.timelineMap,
      orderId,
      '接单',
      '工程师已接单',
      state.currentRole
    );

    storage.setWorkOrders(updatedOrders);
    storage.setTimelines(updatedTimelines);

    set({ workOrders: updatedOrders, timelineMap: updatedTimelines });
    return { success: true };
  },

  updateRepairRecord: (orderId, record) => {
    const state = get();
    const updatedOrders = state.workOrders.map(o =>
      o.id === orderId
        ? {
            ...o,
            repairRecord: record,
            updatedAt: new Date().toISOString(),
          }
        : o
    );

    const updatedTimelines = addTimeline(
      state.timelineMap,
      orderId,
      '开始维修',
      record,
      state.currentRole
    );

    storage.setWorkOrders(updatedOrders);
    storage.setTimelines(updatedTimelines);

    set({ workOrders: updatedOrders, timelineMap: updatedTimelines });
  },

  submitComplete: (orderId) => {
    const state = get();
    const order = state.workOrders.find(o => o.id === orderId);

    if (!order) {
      return { success: false, error: '工单不存在' };
    }

    if (order.status !== '维修中') {
      return { success: false, error: `当前状态不允许提交完工: ${order.status}` };
    }

    if (!order.repairRecord) {
      return { success: false, error: '请先填写维修记录' };
    }

    const updatedOrders = state.workOrders.map(o =>
      o.id === orderId
        ? {
            ...o,
            status: '待回访' as WorkOrderStatus,
            updatedAt: new Date().toISOString(),
            version: o.version + 1
          }
        : o
    );

    const updatedTimelines = addTimeline(
      state.timelineMap,
      orderId,
      '完工提交',
      order.repairRecord,
      state.currentRole
    );

    storage.setWorkOrders(updatedOrders);
    storage.setTimelines(updatedTimelines);

    set({ workOrders: updatedOrders, timelineMap: updatedTimelines });
    return { success: true };
  },

  reviewOrder: (orderId, rating, remark) => {
    const state = get();
    const order = state.workOrders.find(o => o.id === orderId);

    if (!order) {
      return { success: false, error: '工单不存在' };
    }

    if (order.status !== '待回访') {
      return { success: false, error: '只有待回访状态的工单才能进行回访' };
    }

    const isPass = rating === '满意' || rating === '基本满意';
    const newStatus = isPass ? '已完成' : '维修中';
    const action: TimelineAction = isPass ? '回访通过' : '回访不通过';

    const updatedOrders = state.workOrders.map(o =>
      o.id === orderId
        ? {
            ...o,
            status: newStatus as WorkOrderStatus,
            reviewRemark: remark,
            reviewRating: rating,
            updatedAt: new Date().toISOString(),
            version: o.version + 1
          }
        : o
    );

    const updatedTimelines = addTimeline(
      state.timelineMap,
      orderId,
      action,
      `评价: ${rating}，备注: ${remark}`,
      state.currentRole
    );

    storage.setWorkOrders(updatedOrders);
    storage.setTimelines(updatedTimelines);

    set({ workOrders: updatedOrders, timelineMap: updatedTimelines });
    return { success: true };
  },

  cancelOrder: (orderId, reason) => {
    const state = get();
    const order = state.workOrders.find(o => o.id === orderId);

    if (!order) {
      return { success: false, error: '工单不存在' };
    }

    if (order.status === '已撤销') {
      return { success: false, error: '该工单已撤销，无法再次操作' };
    }

    if (order.status === '已完成') {
      return { success: false, error: '已完成的工单不能撤销' };
    }

    const updatedOrders = state.workOrders.map(o =>
      o.id === orderId
        ? {
            ...o,
            status: '已撤销' as WorkOrderStatus,
            updatedAt: new Date().toISOString(),
            version: o.version + 1
          }
        : o
    );

    const updatedTimelines = addTimeline(
      state.timelineMap,
      orderId,
      '撤销',
      `撤销原因: ${reason || '未说明'}`,
      state.currentRole
    );

    storage.setWorkOrders(updatedOrders);
    storage.setTimelines(updatedTimelines);

    set({ workOrders: updatedOrders, timelineMap: updatedTimelines });
    return { success: true };
  },

  reopenOrder: (orderId, reason) => {
    const state = get();
    const order = state.workOrders.find(o => o.id === orderId);

    if (!order) {
      return { success: false, error: '工单不存在' };
    }

    if (order.status !== '已撤销') {
      return { success: false, error: '只有已撤销的工单才能重开' };
    }

    if (!reason || reason.trim().length === 0) {
      return { success: false, error: '重开工单必须填写原因' };
    }

    const updatedOrders = state.workOrders.map(o =>
      o.id === orderId
        ? {
            ...o,
            status: '待派工' as WorkOrderStatus,
            engineerId: null,
            engineerName: null,
            repairRecord: null,
            reviewRemark: null,
            reviewRating: null,
            updatedAt: new Date().toISOString(),
            version: o.version + 1
          }
        : o
    );

    const updatedTimelines = addTimeline(
      state.timelineMap,
      orderId,
      '重开',
      `重开原因: ${reason}`,
      state.currentRole
    );

    storage.setWorkOrders(updatedOrders);
    storage.setTimelines(updatedTimelines);

    set({ workOrders: updatedOrders, timelineMap: updatedTimelines });
    return { success: true };
  },

  createOrder: (storeId, equipment, description, contactName, contactPhone, expectedVisitTime) => {
    const state = get();
    const store = state.stores.find(s => s.id === storeId);
    const newOrder: WorkOrder = {
      id: generateId(),
      orderNo: generateOrderNo(state.workOrders),
      storeId,
      equipment,
      description,
      status: '待派工',
      engineerId: null,
      engineerName: null,
      repairRecord: null,
      reviewRemark: null,
      reviewRating: null,
      contactName: contactName || null,
      contactPhone: contactPhone || null,
      expectedVisitTime: expectedVisitTime || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    const updatedOrders = [...state.workOrders, newOrder];
    const updatedTimelines = addTimeline(
      state.timelineMap,
      newOrder.id,
      '创建工单',
      `${store?.name || '门店'}提交报修: ${equipment} - ${description}`,
      'store'
    );

    storage.setWorkOrders(updatedOrders);
    storage.setTimelines(updatedTimelines);

    set({ workOrders: updatedOrders, timelineMap: updatedTimelines });
    return newOrder;
  },

  exportOrders: (orders, name) => {
    const state = get();
    const exportResult: ExportResult = {
      id: generateId(),
      name,
      data: orders,
      createdAt: new Date().toISOString(),
      filterSnapshot: { ...state.filters },
    };

    const updatedExports = [...state.exports, exportResult];
    storage.setExports(updatedExports);
    set({ exports: updatedExports });

    return exportResult;
  },

  getFilteredOrders: () => {
    const { workOrders, filters } = get();
    
    return workOrders.filter(order => {
      if (filters.status !== '全部' && order.status !== filters.status) {
        return false;
      }

      if (filters.dateRange.start) {
        const orderDate = new Date(order.createdAt);
        const startDate = new Date(filters.dateRange.start);
        if (orderDate < startDate) return false;
      }

      if (filters.dateRange.end) {
        const orderDate = new Date(order.createdAt);
        const endDate = new Date(filters.dateRange.end);
        if (orderDate > endDate) return false;
      }

      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        return (
          order.orderNo.toLowerCase().includes(keyword) ||
          order.description.toLowerCase().includes(keyword) ||
          order.equipment.toLowerCase().includes(keyword)
        );
      }

      return true;
    });
  },

  getRoleOrders: () => {
    const { currentRole, workOrders } = get();
    
    switch (currentRole) {
      case 'store':
        return workOrders;
      case 'dispatch':
        return workOrders.filter(o => o.status === '待派工');
      case 'engineer':
        return workOrders.filter(o => 
          o.status === '已派工' || o.status === '维修中' || o.status === '待回访'
        );
      case 'quality':
        return workOrders.filter(o => o.status === '待回访');
      default:
        return workOrders;
    }
  },

  validateImportData: (csvData) => {
    const state = get();
    const errors: ImportError[] = [];
    const validOrders: Partial<WorkOrder>[] = [];
    const seenOrderNos = new Set<string>();
    
    const validStatuses = ['待派工', '已派工', '维修中', '待回访', '已完成', '已撤销'];
    const validStoreIds = new Set(state.stores.map(s => s.id));

    csvData.forEach((row, index) => {
      if (index === 0) return;
      
      const rowNum = index + 1;
      const storeName = row[0]?.trim() || '';
      const equipment = row[1]?.trim() || '';
      const description = row[2]?.trim() || '';
      const status = row[3]?.trim() || '';
      const contactName = row[4]?.trim() || '';
      const contactPhone = row[5]?.trim() || '';
      const expectedVisitTime = row[6]?.trim() || '';
      const orderNo = row[7]?.trim() || '';

      const originalData: Record<string, string> = {
        '门店名称': storeName,
        '设备类型': equipment,
        '故障描述': description,
        '状态': status,
        '联系人': contactName,
        '联系电话': contactPhone,
        '期望上门时间': expectedVisitTime,
        '工单号': orderNo,
      };

      if (!storeName) {
        errors.push({
          row: rowNum,
          field: '门店名称',
          type: 'MISSING_STORE',
          message: '门店名称不能为空',
          originalData,
        });
      } else {
        const store = state.stores.find(s => s.name === storeName);
        if (!store) {
          errors.push({
            row: rowNum,
            field: '门店名称',
            type: 'INVALID_STORE',
            message: `门店"${storeName}"不存在`,
            originalData,
          });
        }
      }

      if (!equipment) {
        errors.push({
          row: rowNum,
          field: '设备类型',
          type: 'MISSING_EQUIPMENT',
          message: '设备类型不能为空',
          originalData,
        });
      }

      if (!description) {
        errors.push({
          row: rowNum,
          field: '故障描述',
          type: 'MISSING_DESCRIPTION',
          message: '故障描述不能为空',
          originalData,
        });
      }

      if (!contactName) {
        errors.push({
          row: rowNum,
          field: '联系人',
          type: 'MISSING_CONTACT',
          message: '联系人不能为空',
          originalData,
        });
      }

      if (!expectedVisitTime) {
        errors.push({
          row: rowNum,
          field: '期望上门时间',
          type: 'MISSING_VISIT_TIME',
          message: '期望上门时间不能为空',
          originalData,
        });
      } else {
        const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/;
        if (!dateRegex.test(expectedVisitTime)) {
          errors.push({
            row: rowNum,
            field: '期望上门时间',
            type: 'INVALID_DATE_FORMAT',
            message: `期望上门时间格式不正确，应为"YYYY-MM-DD"或"YYYY-MM-DD HH:mm"`,
            originalData,
          });
        }
      }

      if (status && !validStatuses.includes(status)) {
        errors.push({
          row: rowNum,
          field: '状态',
          type: 'INVALID_STATUS',
          message: `状态"${status}"无效，可选值: ${validStatuses.join('、')}`,
          originalData,
        });
      }

      if (orderNo) {
        if (seenOrderNos.has(orderNo)) {
          errors.push({
            row: rowNum,
            field: '工单号',
            type: 'DUPLICATE_ORDER_NO',
            message: `工单号"${orderNo}"在CSV文件中重复`,
            originalData,
          });
        } else if (state.workOrders.some(o => o.orderNo === orderNo)) {
          errors.push({
            row: rowNum,
            field: '工单号',
            type: 'ORDER_EXISTS',
            message: `工单号"${orderNo}"已存在，导入会覆盖原工单`,
            originalData,
          });
        } else {
          seenOrderNos.add(orderNo);
        }
      }
    });

    if (errors.length === 0) {
      const generatedOrderNos = new Set<string>();
      const allOrderNos = new Set(state.workOrders.map(o => o.orderNo));
      
      csvData.forEach((row, index) => {
        if (index === 0) return;
        
        const storeName = row[0]?.trim() || '';
        const equipment = row[1]?.trim() || '';
        const description = row[2]?.trim() || '';
        const status = (row[3]?.trim() || '待派工') as WorkOrderStatus;
        const contactName = row[4]?.trim() || '';
        const contactPhone = row[5]?.trim() || '';
        const expectedVisitTime = row[6]?.trim() || '';
        const orderNo = row[7]?.trim() || '';

        const store = state.stores.find(s => s.name === storeName);
        
        let finalOrderNo = orderNo;
        if (!finalOrderNo) {
          const year = new Date().getFullYear();
          let count = state.workOrders.length + generatedOrderNos.size + 1;
          finalOrderNo = `WO-${year}-${String(count).padStart(4, '0')}`;
          
          while (allOrderNos.has(finalOrderNo) || generatedOrderNos.has(finalOrderNo)) {
            count++;
            finalOrderNo = `WO-${year}-${String(count).padStart(4, '0')}`;
          }
          generatedOrderNos.add(finalOrderNo);
          allOrderNos.add(finalOrderNo);
        }
        
        validOrders.push({
          storeId: store?.id || '',
          equipment,
          description,
          status: status as WorkOrderStatus,
          contactName,
          contactPhone,
          expectedVisitTime,
          orderNo: finalOrderNo,
        });
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      validOrders,
    };
  },

  importOrders: (csvData) => {
    const state = get();
    
    if (state.currentRole !== 'dispatch') {
      return { success: false, error: '权限不足：只有调度角色才能执行批量导入' };
    }

    const { valid, errors, validOrders } = get().validateImportData(csvData);

    const blockingErrors = errors.filter(e => 
      e.type === 'MISSING_STORE' || 
      e.type === 'MISSING_EQUIPMENT' || 
      e.type === 'MISSING_DESCRIPTION' ||
      e.type === 'MISSING_CONTACT' ||
      e.type === 'MISSING_VISIT_TIME' ||
      e.type === 'INVALID_STORE' ||
      e.type === 'INVALID_DATE_FORMAT' ||
      e.type === 'INVALID_STATUS' ||
      e.type === 'DUPLICATE_ORDER_NO'
    );

    if (blockingErrors.length > 0) {
      return { success: false, error: `存在${blockingErrors.length}个阻断性错误，无法导入` };
    }

    const overwriteErrors = errors.filter(e => e.type === 'ORDER_EXISTS');
    if (overwriteErrors.length > 0) {
      return { success: false, error: `存在${overwriteErrors.length}个已存在的工单号，导入会覆盖原工单` };
    }

    const now = new Date().toISOString();
    const newOrders: WorkOrder[] = validOrders.map(order => {
      const existingOrder = state.workOrders.find(o => o.orderNo === order.orderNo);
      const store = state.stores.find(s => s.id === order.storeId);
      
      return {
        id: existingOrder?.id || generateId(),
        orderNo: order.orderNo!,
        storeId: order.storeId!,
        equipment: order.equipment!,
        description: order.description!,
        status: order.status!,
        engineerId: existingOrder?.engineerId || null,
        engineerName: existingOrder?.engineerName || null,
        repairRecord: existingOrder?.repairRecord || null,
        reviewRemark: existingOrder?.reviewRemark || null,
        reviewRating: existingOrder?.reviewRating || null,
        contactName: order.contactName,
        contactPhone: order.contactPhone,
        expectedVisitTime: order.expectedVisitTime,
        createdAt: existingOrder?.createdAt || now,
        updatedAt: now,
        version: (existingOrder?.version || 0) + 1,
      };
    });

    const updatedWorkOrders = state.workOrders.filter(
      o => !newOrders.some(n => n.orderNo === o.orderNo)
    ).concat(newOrders);

    let updatedTimelines = { ...state.timelineMap };
    newOrders.forEach(order => {
      const existingOrder = state.workOrders.find(o => o.orderNo === order.orderNo);
      if (!existingOrder) {
        const store = state.stores.find(s => s.id === order.storeId);
        updatedTimelines = addTimeline(
          updatedTimelines,
          order.id,
          '创建工单',
          `批量导入: ${store?.name || '门店'}提交报修: ${order.equipment} - ${order.description}`,
          'dispatch'
        );
      } else {
        updatedTimelines = addTimeline(
          updatedTimelines,
          order.id,
          '创建工单',
          `批量导入更新: ${order.equipment} - ${order.description}`,
          'dispatch'
        );
      }
    });

    const importResult: ImportResult = {
      id: generateId(),
      successCount: validOrders.length,
      failureCount: errors.length,
      totalCount: csvData.length - 1,
      errors,
      createdAt: now,
      operator: roleNames[state.currentRole],
    };

    storage.setWorkOrders(updatedWorkOrders);
    storage.setTimelines(updatedTimelines);
    
    const updatedImports = [...state.imports, importResult];
    storage.setImports(updatedImports);

    set({ 
      workOrders: updatedWorkOrders, 
      timelineMap: updatedTimelines,
      imports: updatedImports,
    });

    return { success: true, result: importResult };
  },

  getImports: () => {
    return get().imports;
  },

  resetData: () => {
    storage.clearAll();
    set({
      currentRole: 'store',
      workOrders: initialWorkOrders,
      stores: initialStores,
      engineers: initialEngineers,
      timelineMap: initialTimelines,
      filters: {
        status: '全部',
        dateRange: { start: null, end: null },
        keyword: '',
      },
      exports: [],
      imports: [],
      selectedOrderId: null,
    });
  },
}));
