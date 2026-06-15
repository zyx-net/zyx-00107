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
  ImportErrorType,
  ImportDraft,
  RowValidationResult,
  PartialImportResult,
  ImportSession,
  SessionRowState,
  SessionOperationLog,
  SessionStatistics,
  SessionConflictSummary,
  SessionBatchProgress,
  SessionImportResult,
  SessionTimelineEntry,
  PermissionLevel,
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
  resetDemoData: () => void;
  importOrders: (csvData: string[][]) => { success: boolean; result?: ImportResult; error?: string };
  validateImportData: (csvData: string[][]) => { valid: boolean; errors: ImportError[]; validOrders: Partial<WorkOrder>[] };
  getImports: () => ImportResult[];
  createImportDraft: (fileName: string, originalHeaders: string[], csvData: string[][], targetHeaders: string[], headerMapping: Record<number, number>) => ImportDraft;
  updateImportDraft: (draft: Partial<ImportDraft>) => void;
  clearImportDraft: () => void;
  validateRow: (rowIndex: number, correctedData?: Record<string, string>) => RowValidationResult;
  validateAllRows: () => void;
  correctRow: (rowIndex: number, corrections: Record<string, string>) => void;
  setConflictResolution: (rowIndex: number, resolution: 'skip' | 'overwrite' | 'new') => void;
  importPartialOrders: (rowsToImport: number[], rowsToSkip: number[]) => { success: boolean; result?: PartialImportResult; error?: string };
  createImportSession: (fileName: string, originalHeaders: string[], csvData: string[][], targetHeaders: string[], headerMapping: Record<number, number>) => ImportSession;
  getImportSessions: () => ImportSession[];
  getActiveSession: () => ImportSession | null;
  setActiveSession: (sessionId: string | null) => void;
  updateImportSession: (sessionId: string, updates: Partial<ImportSession>) => void;
  deleteImportSession: (sessionId: string) => void;
  validateSessionRow: (sessionId: string, rowIndex: number, correctedData?: Record<string, string>) => SessionRowState;
  validateSessionAllRows: (sessionId: string) => void;
  correctSessionRow: (sessionId: string, rowIndex: number, corrections: Record<string, string>) => void;
  setSessionConflictResolution: (sessionId: string, rowIndex: number, resolution: 'skip' | 'overwrite' | 'new') => void;
  autoFillMissingOrderNos: (sessionId: string) => void;
  importSessionBatch: (sessionId: string, batchStart?: number, batchEnd?: number) => SessionImportResult;
  resumeSession: (sessionId: string) => SessionImportResult;
  pauseSession: (sessionId: string) => void;
  clearSessionErrors: (sessionId: string, rowIndices: number[]) => void;
  exportSessionErrors: (sessionId: string) => void;
  getSessionPermission: (sessionId: string) => PermissionLevel;
  checkSessionPermission: (sessionId: string, requiredLevel: PermissionLevel) => boolean;
  lockSession: (sessionId: string) => boolean;
  unlockSession: (sessionId: string) => void;
  addTimelineEntry: (sessionId: string, action: string, details: string, rowIndex?: number, affectedCount?: number) => void;
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

const createOperationLog = (
  operation: string,
  details: string,
  rowIndex?: number,
  beforeState?: Record<string, any>,
  afterState?: Record<string, any>
): SessionOperationLog => ({
  id: generateId(),
  timestamp: new Date().toISOString(),
  operation,
  details,
  rowIndex,
  beforeState,
  afterState,
});

const createTimelineEntry = (
  action: string,
  details: string,
  role: Role,
  operator: string,
  rowIndex?: number,
  affectedCount?: number
): SessionTimelineEntry => ({
  id: generateId(),
  timestamp: new Date().toISOString(),
  action,
  operator,
  role,
  details,
  rowIndex,
  affectedCount,
});

const getDefaultPermissions = (creatorRole: Role) => {
  const permissions = [];
  
  if (creatorRole === 'admin') {
    permissions.push({ role: 'admin', level: 'admin' as PermissionLevel });
  }
  
  if (creatorRole === 'dispatch' || creatorRole === 'admin') {
    permissions.push({ role: 'dispatch', level: 'write' as PermissionLevel });
  }
  
  permissions.push({ role: creatorRole, level: 'admin' as PermissionLevel });
  
  return permissions;
};

const checkRolePermission = (role: Role, requiredLevel: PermissionLevel): boolean => {
  const levelOrder: Record<Role, PermissionLevel> = {
    admin: 'admin',
    dispatch: 'write',
    quality: 'read',
    engineer: 'read',
    store: 'read',
  };
  
  const currentLevel = levelOrder[role] || 'read';
  const levels: PermissionLevel[] = ['read', 'write', 'admin'];
  
  return levels.indexOf(currentLevel) >= levels.indexOf(requiredLevel);
};

const calculateSessionStatistics = (rowStates: SessionRowState[]): SessionStatistics => {
  return rowStates.reduce((stats, row) => {
    stats.totalRows++;
    switch (row.validationStatus) {
      case 'valid':
        stats.validRows++;
        if (row.importStatus === 'pending') stats.pendingRows++;
        break;
      case 'warning':
        stats.warningRows++;
        if (row.importStatus === 'pending') stats.pendingRows++;
        break;
      case 'error':
        stats.errorRows++;
        if (row.importStatus === 'pending') stats.pendingRows++;
        break;
      case 'pending':
        stats.pendingRows++;
        break;
    }
    switch (row.importStatus) {
      case 'imported':
        stats.importedRows++;
        break;
      case 'skipped':
        stats.skippedRows++;
        break;
      case 'failed':
        stats.failedRows++;
        break;
    }
    if (row.autoGeneratedOrderNo) {
      stats.autoFixedCount++;
    }
    return stats;
  }, {
    totalRows: 0,
    validRows: 0,
    warningRows: 0,
    errorRows: 0,
    pendingRows: 0,
    importedRows: 0,
    skippedRows: 0,
    failedRows: 0,
    autoFixedCount: 0,
  } as SessionStatistics);
};

const calculateConflictSummary = (rowStates: SessionRowState[]): SessionConflictSummary => {
  const conflicts = rowStates.filter(row => 
    row.errors.some(e => e.type === 'ORDER_EXISTS' || e.type === 'DUPLICATE_ORDER_NO')
  );
  
  return {
    totalConflicts: conflicts.length,
    resolved: conflicts.filter(row => row.conflictResolution).length,
    unresolved: conflicts.filter(row => !row.conflictResolution).length,
    byType: {
      orderExists: conflicts.filter(row => row.errors.some(e => e.type === 'ORDER_EXISTS')).length,
      duplicateInFile: conflicts.filter(row => row.errors.some(e => e.type === 'DUPLICATE_ORDER_NO')).length,
    },
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
  currentImportDraft: storage.getImportDraft(),
  importSessions: storage.getImportSessions(),
  activeSessionId: storage.getActiveSessionId(),

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
    const sessions = storage.getImportSessions();
    const activeSessionId = storage.getActiveSessionId();
    storage.clearAll();
    storage.setImportSessions(sessions);
    if (activeSessionId) {
      storage.setActiveSessionId(activeSessionId);
    }
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
      currentImportDraft: null,
      importSessions: sessions,
      activeSessionId: activeSessionId,
    });
  },

  resetDemoData: () => {
    const sessions = storage.getImportSessions();
    const activeSessionId = storage.getActiveSessionId();
    storage.setWorkOrders(initialWorkOrders);
    storage.setTimelines(initialTimelines);
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
      currentImportDraft: null,
      importSessions: sessions,
      activeSessionId: activeSessionId,
    });
  },

  createImportDraft: (fileName, originalHeaders, csvData, targetHeaders, headerMapping) => {
    const state = get();
    const draftId = generateId();
    const rowResults: RowValidationResult[] = [];
    
    for (let i = 1; i < csvData.length; i++) {
      const result = get().validateRow(i);
      rowResults.push(result);
    }
    
    const draft: ImportDraft = {
      id: draftId,
      fileName,
      originalHeaders,
      targetHeaders,
      headerMapping,
      csvData,
      rowResults,
      filters: {
        showValid: true,
        showWarning: true,
        showError: true,
        searchKeyword: '',
      },
      conflictResolutions: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    storage.setImportDraft(draft);
    set({ currentImportDraft: draft });
    return draft;
  },

  updateImportDraft: (draftUpdate) => {
    const state = get();
    if (!state.currentImportDraft) return;
    
    const updatedDraft: ImportDraft = {
      ...state.currentImportDraft,
      ...draftUpdate,
      updatedAt: new Date().toISOString(),
    };
    
    storage.setImportDraft(updatedDraft);
    set({ currentImportDraft: updatedDraft });
  },

  clearImportDraft: () => {
    storage.setImportDraft(null);
    set({ currentImportDraft: null });
  },

  validateRow: (rowIndex, correctedData) => {
    const state = get();
    if (!state.currentImportDraft) {
      return {
        rowIndex,
        status: 'error' as const,
        errors: [{ row: rowIndex, field: '', type: 'OTHER' as ImportErrorType, message: '没有导入草稿', originalData: {} }],
        originalData: {},
      };
    }
    
    const csvData = state.currentImportDraft.csvData;
    const headerMapping = state.currentImportDraft.headerMapping;
    const row = csvData[rowIndex];
    
    const getMappedValue = (fieldName: string): string => {
      const targetIndex = state.currentImportDraft!.targetHeaders.indexOf(fieldName);
      if (targetIndex === -1) return '';
      
      for (const [origIdx, tgtIdx] of Object.entries(headerMapping)) {
        if (tgtIdx === targetIndex) {
          return row[parseInt(origIdx)]?.trim() || '';
        }
      }
      return '';
    };
    
    const originalData = {
      '门店名称': getMappedValue('门店名称'),
      '设备类型': getMappedValue('设备类型'),
      '故障描述': getMappedValue('故障描述'),
      '状态': getMappedValue('状态') || '待派工',
      '联系人': getMappedValue('联系人'),
      '联系电话': getMappedValue('联系电话'),
      '期望上门时间': getMappedValue('期望上门时间'),
      '工单号': getMappedValue('工单号'),
      '工程师': getMappedValue('工程师'),
    };
    
    const dataToValidate = correctedData 
      ? { ...originalData, ...correctedData }
      : originalData;
    
    const errors: ImportError[] = [];
    const autoFixed: string[] = [];
    
    const storeName = dataToValidate['门店名称'];
    const equipment = dataToValidate['设备类型'];
    const description = dataToValidate['故障描述'];
    const status = dataToValidate['状态'];
    const contactName = dataToValidate['联系人'];
    const contactPhone = dataToValidate['联系电话'];
    const expectedVisitTime = dataToValidate['期望上门时间'];
    const orderNo = dataToValidate['工单号'];
    const engineerName = dataToValidate['工程师'];
    const allOrderNos = new Set(state.workOrders.map(o => o.orderNo));
    
    if (!storeName) {
      errors.push({ row: rowIndex, field: '门店名称', type: 'MISSING_STORE', message: '门店名称不能为空', originalData: dataToValidate });
    } else {
      const store = state.stores.find(s => s.name === storeName);
      if (!store) {
        errors.push({ row: rowIndex, field: '门店名称', type: 'INVALID_STORE', message: `门店"${storeName}"不存在`, originalData: dataToValidate });
      }
    }
    
    if (!equipment) {
      errors.push({ row: rowIndex, field: '设备类型', type: 'MISSING_EQUIPMENT', message: '设备类型不能为空', originalData: dataToValidate });
    }
    
    if (!description) {
      errors.push({ row: rowIndex, field: '故障描述', type: 'MISSING_DESCRIPTION', message: '故障描述不能为空', originalData: dataToValidate });
    }
    
    if (!contactName) {
      errors.push({ row: rowIndex, field: '联系人', type: 'MISSING_CONTACT', message: '联系人不能为空', originalData: dataToValidate });
    }
    
    if (!expectedVisitTime) {
      errors.push({ row: rowIndex, field: '期望上门时间', type: 'MISSING_VISIT_TIME', message: '期望上门时间不能为空', originalData: dataToValidate });
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/;
      if (!dateRegex.test(expectedVisitTime)) {
        errors.push({ row: rowIndex, field: '期望上门时间', type: 'INVALID_DATE_FORMAT', message: `期望上门时间格式不正确，应为"YYYY-MM-DD"或"YYYY-MM-DD HH:mm"`, originalData: dataToValidate });
      }
    }
    
    const validStatuses = ['待派工', '已派工', '维修中', '待回访', '已完成', '已撤销'];
    if (status && !validStatuses.includes(status)) {
      errors.push({ row: rowIndex, field: '状态', type: 'INVALID_STATUS', message: `状态"${status}"无效，可选值: ${validStatuses.join('、')}`, originalData: dataToValidate });
    }
    
    if (orderNo) {
      if (allOrderNos.has(orderNo)) {
        errors.push({ row: rowIndex, field: '工单号', type: 'DUPLICATE_ORDER_NO', message: `工单号"${orderNo}"已存在`, originalData: dataToValidate });
      }
      
      const csvData = state.currentImportDraft!.csvData;
      let duplicateCount = 0;
      for (let i = 1; i < csvData.length; i++) {
        if (i !== rowIndex) {
          const otherRowHeaderMapping = state.currentImportDraft!.headerMapping;
          const otherRow = csvData[i];
          const getOtherMappedValue = (fieldName: string): string => {
            const targetIndex = state.currentImportDraft!.targetHeaders.indexOf(fieldName);
            if (targetIndex === -1) return '';
            for (const [origIdx, tgtIdx] of Object.entries(otherRowHeaderMapping)) {
              if (tgtIdx === targetIndex) {
                return otherRow[parseInt(origIdx)]?.trim() || '';
              }
            }
            return '';
          };
          const otherOrderNo = getOtherMappedValue('工单号');
          if (otherOrderNo && otherOrderNo === orderNo) {
            duplicateCount++;
          }
        }
      }
      
      if (duplicateCount > 0) {
        errors.push({ row: rowIndex, field: '工单号', type: 'DUPLICATE_ORDER_NO', message: `工单号"${orderNo}"在文件中重复出现${duplicateCount + 1}次`, originalData: dataToValidate });
      }
    } else {
      autoFixed.push('工单号: 将自动生成');
    }
    
    let validationStatus: 'pending' | 'valid' | 'warning' | 'error' = 'valid';
    if (errors.some(e => ['MISSING_STORE', 'MISSING_EQUIPMENT', 'MISSING_DESCRIPTION', 'INVALID_STORE', 'MISSING_CONTACT', 'MISSING_VISIT_TIME', 'INVALID_DATE_FORMAT'].includes(e.type))) {
      validationStatus = 'error';
    } else if (errors.length > 0 || !orderNo) {
      validationStatus = 'warning';
    }
    
    return {
      rowIndex,
      status: validationStatus,
      errors,
      originalData: dataToValidate,
      correctedData: correctedData ? dataToValidate : undefined,
      autoFixed: autoFixed.length > 0 ? autoFixed : undefined,
    };
  },

  validateAllRows: () => {
    const state = get();
    if (!state.currentImportDraft) return;
    
    const newRowResults: RowValidationResult[] = [];
    for (let i = 1; i < state.currentImportDraft.csvData.length; i++) {
      const result = get().validateRow(i);
      newRowResults.push(result);
    }
    
    get().updateImportDraft({ rowResults: newRowResults });
  },

  correctRow: (rowIndex, corrections) => {
    const state = get();
    if (!state.currentImportDraft) return;
    
    const rowResults = [...state.currentImportDraft.rowResults];
    const rowResultIndex = rowIndex - 1;
    
    if (rowResultIndex >= 0 && rowResultIndex < rowResults.length) {
      const currentResult = rowResults[rowResultIndex];
      const correctedData = { ...currentResult.originalData, ...corrections };
      const newResult = get().validateRow(rowIndex, correctedData);
      rowResults[rowResultIndex] = newResult;
      
      get().updateImportDraft({ rowResults });
    }
  },

  setConflictResolution: (rowIndex, resolution) => {
    const state = get();
    if (!state.currentImportDraft) return;
    
    const conflictResolutions = { ...state.currentImportDraft.conflictResolutions, [rowIndex]: resolution };
    get().updateImportDraft({ conflictResolutions });
  },

  importPartialOrders: (rowsToImport, rowsToSkip) => {
    const state = get();
    
    if (state.currentRole !== 'dispatch') {
      return { success: false, error: '权限不足：只有调度角色才能执行批量导入' };
    }
    
    if (!state.currentImportDraft) {
      return { success: false, error: '没有导入草稿' };
    }
    
    const now = new Date().toISOString();
    const newOrders: WorkOrder[] = [];
    const importedOrderNos: string[] = [];
    const skippedOrderNos: string[] = [];
    const allErrors: ImportError[] = [];
    
    const generatedOrderNos = new Set<string>();
    const allOrderNos = new Set(state.workOrders.map(o => o.orderNo));
    
    for (const rowIndex of rowsToImport) {
      const rowResultIndex = rowIndex - 1;
      const rowResult = state.currentImportDraft.rowResults[rowResultIndex];
      
      if (!rowResult || rowResult.status === 'error') {
        allErrors.push(...rowResult?.errors || []);
        skippedOrderNos.push(`行${rowIndex}`);
        continue;
      }
      
      const csvData = state.currentImportDraft.csvData;
      const headerMapping = state.currentImportDraft.headerMapping;
      const row = csvData[rowIndex];
      
      const getMappedValue = (fieldName: string): string => {
        const targetIndex = state.currentImportDraft!.targetHeaders.indexOf(fieldName);
        if (targetIndex === -1) return '';
        
        for (const [origIdx, tgtIdx] of Object.entries(headerMapping)) {
          if (tgtIdx === targetIndex) {
            return row[parseInt(origIdx)]?.trim() || '';
          }
        }
        return '';
      };
      
      const data = rowResult.correctedData || rowResult.originalData;
      const storeName = data['门店名称'];
      const equipment = data['设备类型'];
      const description = data['故障描述'];
      const status = (data['状态'] || '待派工') as WorkOrderStatus;
      const contactName = data['联系人'];
      const contactPhone = data['联系电话'];
      const expectedVisitTime = data['期望上门时间'];
      const orderNo = data['工单号'];
      const engineerName = data['工程师'];
      
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
      }
      
      let engineerId: string | null = null;
      let resolvedEngineerName: string | null = null;
      
      if (engineerName) {
        const engineer = state.engineers.find(e => e.name === engineerName);
        if (engineer) {
          engineerId = engineer.id;
          resolvedEngineerName = engineer.name;
        }
      }
      
      const existingOrder = state.workOrders.find(o => o.orderNo === finalOrderNo);
      const conflictResolution = state.currentImportDraft.conflictResolutions[rowIndex];
      
      if (existingOrder && conflictResolution === 'skip') {
        skippedOrderNos.push(finalOrderNo);
        continue;
      }
      
      const newOrder: WorkOrder = {
        id: existingOrder?.id || generateId(),
        orderNo: finalOrderNo,
        storeId: store?.id || '',
        equipment,
        description,
        status: existingOrder && conflictResolution === 'overwrite' ? existingOrder.status : status,
        engineerId: existingOrder?.engineerId || engineerId,
        engineerName: existingOrder?.engineerName || resolvedEngineerName,
        repairRecord: existingOrder?.repairRecord || null,
        reviewRemark: existingOrder?.reviewRemark || null,
        reviewRating: existingOrder?.reviewRating || null,
        contactName,
        contactPhone,
        expectedVisitTime,
        createdAt: existingOrder?.createdAt || now,
        updatedAt: now,
        version: (existingOrder?.version || 0) + 1,
      };
      
      newOrders.push(newOrder);
      importedOrderNos.push(finalOrderNo);
    }
    
    for (const rowIndex of rowsToSkip) {
      const csvData = state.currentImportDraft.csvData;
      const row = csvData[rowIndex];
      const headerMapping = state.currentImportDraft.headerMapping;
      
      const getMappedValue = (fieldName: string): string => {
        const targetIndex = state.currentImportDraft!.targetHeaders.indexOf(fieldName);
        if (targetIndex === -1) return '';
        
        for (const [origIdx, tgtIdx] of Object.entries(headerMapping)) {
          if (tgtIdx === targetIndex) {
            return row[parseInt(origIdx)]?.trim() || '';
          }
        }
        return '';
      };
      
      const orderNo = getMappedValue('工单号');
      if (orderNo) {
        skippedOrderNos.push(orderNo);
      }
    }
    
    const updatedWorkOrders = state.workOrders.filter(
      o => !newOrders.some(n => n.orderNo === o.orderNo)
    ).concat(newOrders);
    
    let updatedTimelines = { ...state.timelineMap };
    newOrders.forEach(order => {
      const existingOrder = state.workOrders.find(o => o.orderNo === order.orderNo);
      const store = state.stores.find(s => s.id === order.storeId);
      
      if (!existingOrder) {
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
    
    const importResult: PartialImportResult = {
      successCount: newOrders.length,
      skippedCount: skippedOrderNos.length,
      failureCount: allErrors.length,
      totalRows: rowsToImport.length + rowsToSkip.length,
      importedOrderNos,
      skippedOrderNos,
      errors: allErrors,
    };
    
    const fullImportResult: ImportResult = {
      id: generateId(),
      successCount: newOrders.length,
      failureCount: skippedOrderNos.length + allErrors.length,
      totalCount: rowsToImport.length + rowsToSkip.length,
      errors: allErrors,
      createdAt: now,
      operator: roleNames[state.currentRole],
    };
    
    const updatedImports = [...state.imports, fullImportResult];
    storage.setImports(updatedImports);
    storage.setWorkOrders(updatedWorkOrders);
    storage.setTimelines(updatedTimelines);
    
    get().clearImportDraft();
    
    set({ 
      workOrders: updatedWorkOrders, 
      timelineMap: updatedTimelines,
      imports: updatedImports,
    });
    
    return { success: true, result: importResult };
  },

  createImportSession: (fileName, originalHeaders, csvData, targetHeaders, headerMapping) => {
    const state = get();
    
    if (!checkRolePermission(state.currentRole, 'write')) {
      throw new Error('权限不足：只有调度或管理员角色才能创建导入会话');
    }
    
    const sessionId = generateId();
    const now = new Date().toISOString();
    
    const tempSession: ImportSession = {
      id: sessionId,
      fileName,
      status: 'draft',
      originalHeaders,
      targetHeaders,
      headerMapping,
      csvData,
      rowStates: [],
      statistics: {
        totalRows: csvData.length - 1,
        validRows: 0,
        warningRows: 0,
        errorRows: 0,
        pendingRows: csvData.length - 1,
        importedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        autoFixedCount: 0,
      },
      conflictSummary: {
        totalConflicts: 0,
        resolved: 0,
        unresolved: 0,
        byType: {
          orderExists: 0,
          duplicateInFile: 0,
        },
      },
      progress: {
        totalRows: csvData.length - 1,
        processedRows: 0,
        currentBatchStart: 1,
        currentBatchEnd: Math.min(csvData.length - 1, 50),
        batchSize: 50,
      },
      operationLogs: [
        createOperationLog('创建会话', `创建导入会话: ${fileName}`),
      ],
      timeline: [
        createTimelineEntry('创建会话', `创建导入会话: ${fileName}`, state.currentRole, roleNames[state.currentRole], undefined, csvData.length - 1),
      ],
      currentStep: 'validation',
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      operator: roleNames[state.currentRole],
      role: state.currentRole,
      permissions: getDefaultPermissions(state.currentRole),
      isLocked: false,
    };
    
    const updatedSessions = [...state.importSessions, tempSession];
    storage.setImportSessions(updatedSessions);
    storage.setActiveSessionId(sessionId);
    set({ importSessions: updatedSessions, activeSessionId: sessionId });
    
    const rowStates: SessionRowState[] = [];
    for (let i = 1; i < csvData.length; i++) {
      const rowState = get().validateSessionRow(sessionId, i);
      rowStates.push(rowState);
    }
    
    const session: ImportSession = {
      ...tempSession,
      rowStates,
      statistics: calculateSessionStatistics(rowStates),
      conflictSummary: calculateConflictSummary(rowStates),
    };
    
    const finalSessions = [...updatedSessions.map(s => s.id === sessionId ? session : s)];
    storage.setImportSessions(finalSessions);
    set({ importSessions: finalSessions });
    
    return session;
  },

  getImportSessions: () => {
    return get().importSessions;
  },

  getActiveSession: () => {
    const state = get();
    if (!state.activeSessionId) return null;
    return state.importSessions.find(s => s.id === state.activeSessionId) || null;
  },

  setActiveSession: (sessionId) => {
    const state = get();
    storage.setActiveSessionId(sessionId);
    
    if (sessionId) {
      const session = state.importSessions.find(s => s.id === sessionId);
      if (session) {
        const updatedSessions = state.importSessions.map(s => 
          s.id === sessionId 
            ? { ...s, lastAccessedAt: new Date().toISOString() }
            : s
        );
        storage.setImportSessions(updatedSessions);
        set({ activeSessionId: sessionId, importSessions: updatedSessions });
      }
    } else {
      set({ activeSessionId: null });
    }
  },

  updateImportSession: (sessionId, updates) => {
    const state = get();
    const updatedSessions = state.importSessions.map(s => 
      s.id === sessionId 
        ? { ...s, ...updates, updatedAt: new Date().toISOString() }
        : s
    );
    storage.setImportSessions(updatedSessions);
    set({ importSessions: updatedSessions });
  },

  deleteImportSession: (sessionId) => {
    const state = get();
    const updatedSessions = state.importSessions.filter(s => s.id !== sessionId);
    storage.setImportSessions(updatedSessions);
    
    if (state.activeSessionId === sessionId) {
      storage.setActiveSessionId(null);
      set({ importSessions: updatedSessions, activeSessionId: null });
    } else {
      set({ importSessions: updatedSessions });
    }
  },

  validateSessionRow: (sessionId, rowIndex, correctedData) => {
    const state = get();
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) {
      return {
        rowIndex,
        originalData: {},
        validationStatus: 'error' as const,
        errors: [{ row: rowIndex, field: '', type: 'OTHER' as ImportErrorType, message: '会话不存在', originalData: {} }],
        importStatus: 'pending' as const,
      };
    }
    
    const csvData = session.csvData;
    const headerMapping = session.headerMapping;
    const row = csvData[rowIndex];
    
    const getMappedValue = (fieldName: string): string => {
      const targetIndex = session.targetHeaders.indexOf(fieldName);
      if (targetIndex === -1) return '';
      
      for (const [origIdx, tgtIdx] of Object.entries(headerMapping)) {
        if (tgtIdx === targetIndex) {
          return row[parseInt(origIdx)]?.trim() || '';
        }
      }
      return '';
    };
    
    const existingRowState = session.rowStates.find(r => r.rowIndex === rowIndex);
    const originalData = {
      '门店名称': getMappedValue('门店名称'),
      '设备类型': getMappedValue('设备类型'),
      '故障描述': getMappedValue('故障描述'),
      '状态': getMappedValue('状态') || '待派工',
      '联系人': getMappedValue('联系人'),
      '联系电话': getMappedValue('联系电话'),
      '期望上门时间': getMappedValue('期望上门时间'),
      '工单号': getMappedValue('工单号'),
      '工程师': getMappedValue('工程师'),
    };
    
    const dataToValidate = correctedData 
      ? { ...originalData, ...correctedData }
      : existingRowState?.correctedData 
        ? { ...originalData, ...existingRowState.correctedData }
        : originalData;
    
    const errors: ImportError[] = [];
    const storeName = dataToValidate['门店名称'];
    const equipment = dataToValidate['设备类型'];
    const description = dataToValidate['故障描述'];
    const status = dataToValidate['状态'];
    const contactName = dataToValidate['联系人'];
    const expectedVisitTime = dataToValidate['期望上门时间'];
    const orderNo = dataToValidate['工单号'];
    const allOrderNos = new Set(state.workOrders.map(o => o.orderNo));
    
    if (!storeName) {
      errors.push({ row: rowIndex, field: '门店名称', type: 'MISSING_STORE', message: '门店名称不能为空', originalData: dataToValidate });
    } else {
      const store = state.stores.find(s => s.name === storeName);
      if (!store) {
        errors.push({ row: rowIndex, field: '门店名称', type: 'INVALID_STORE', message: `门店"${storeName}"不存在`, originalData: dataToValidate });
      }
    }
    
    if (!equipment) {
      errors.push({ row: rowIndex, field: '设备类型', type: 'MISSING_EQUIPMENT', message: '设备类型不能为空', originalData: dataToValidate });
    }
    
    if (!description) {
      errors.push({ row: rowIndex, field: '故障描述', type: 'MISSING_DESCRIPTION', message: '故障描述不能为空', originalData: dataToValidate });
    }
    
    if (!contactName) {
      errors.push({ row: rowIndex, field: '联系人', type: 'MISSING_CONTACT', message: '联系人不能为空', originalData: dataToValidate });
    }
    
    if (!expectedVisitTime) {
      errors.push({ row: rowIndex, field: '期望上门时间', type: 'MISSING_VISIT_TIME', message: '期望上门时间不能为空', originalData: dataToValidate });
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/;
      if (!dateRegex.test(expectedVisitTime)) {
        errors.push({ row: rowIndex, field: '期望上门时间', type: 'INVALID_DATE_FORMAT', message: `期望上门时间格式不正确，应为"YYYY-MM-DD"或"YYYY-MM-DD HH:mm"`, originalData: dataToValidate });
      }
    }
    
    const validStatuses = ['待派工', '已派工', '维修中', '待回访', '已完成', '已撤销'];
    if (status && !validStatuses.includes(status)) {
      errors.push({ row: rowIndex, field: '状态', type: 'INVALID_STATUS', message: `状态"${status}"无效，可选值: ${validStatuses.join('、')}`, originalData: dataToValidate });
    }
    
    if (orderNo) {
      if (allOrderNos.has(orderNo) && !existingRowState?.conflictResolution) {
        errors.push({ row: rowIndex, field: '工单号', type: 'ORDER_EXISTS', message: `工单号"${orderNo}"已存在`, originalData: dataToValidate });
      }
      
      let duplicateCount = 0;
      for (let i = 1; i < csvData.length; i++) {
        if (i !== rowIndex) {
          const otherRow = csvData[i];
          const getOtherMappedValue = (fieldName: string): string => {
            const targetIndex = session.targetHeaders.indexOf(fieldName);
            if (targetIndex === -1) return '';
            for (const [origIdx, tgtIdx] of Object.entries(headerMapping)) {
              if (tgtIdx === targetIndex) {
                return otherRow[parseInt(origIdx)]?.trim() || '';
              }
            }
            return '';
          };
          const otherOrderNo = getOtherMappedValue('工单号');
          if (otherOrderNo && otherOrderNo === orderNo) {
            duplicateCount++;
          }
        }
      }
      
      if (duplicateCount > 0) {
        errors.push({ row: rowIndex, field: '工单号', type: 'DUPLICATE_ORDER_NO', message: `工单号"${orderNo}"在文件中重复出现${duplicateCount + 1}次`, originalData: dataToValidate });
      }
    }
    
    let validationStatus: 'pending' | 'valid' | 'warning' | 'error' = 'valid';
    if (errors.some(e => ['MISSING_STORE', 'MISSING_EQUIPMENT', 'MISSING_DESCRIPTION', 'INVALID_STORE', 'MISSING_CONTACT', 'MISSING_VISIT_TIME', 'INVALID_DATE_FORMAT'].includes(e.type))) {
      validationStatus = 'error';
    } else if (errors.length > 0) {
      validationStatus = 'warning';
    }
    
    return {
      rowIndex,
      originalData: dataToValidate,
      correctedData: correctedData ? dataToValidate : existingRowState?.correctedData,
      autoGeneratedOrderNo: existingRowState?.autoGeneratedOrderNo,
      validationStatus,
      errors,
      conflictResolution: existingRowState?.conflictResolution,
      importStatus: existingRowState?.importStatus || 'pending',
      importedOrderNo: existingRowState?.importedOrderNo,
      importedOrderId: existingRowState?.importedOrderId,
      importedAt: existingRowState?.importedAt,
      lastError: existingRowState?.lastError,
    };
  },

  validateSessionAllRows: (sessionId) => {
    const state = get();
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const newRowStates: SessionRowState[] = [];
    for (let i = 1; i < session.csvData.length; i++) {
      const rowState = get().validateSessionRow(sessionId, i);
      newRowStates.push(rowState);
    }
    
    const operationLog = createOperationLog(
      '重新验证',
      `对所有${newRowStates.length}行数据进行了重新验证`
    );
    
    get().updateImportSession(sessionId, {
      rowStates: newRowStates,
      statistics: calculateSessionStatistics(newRowStates),
      conflictSummary: calculateConflictSummary(newRowStates),
      operationLogs: [...session.operationLogs, operationLog],
    });
  },

  correctSessionRow: (sessionId, rowIndex, corrections) => {
    const state = get();
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const existingRowState = session.rowStates.find(r => r.rowIndex === rowIndex);
    const beforeState = { ...existingRowState };
    
    const correctedData = { ...(existingRowState?.correctedData || existingRowState?.originalData || {}), ...corrections };
    const newRowState = get().validateSessionRow(sessionId, rowIndex, correctedData);
    
    const newRowStates = session.rowStates.map(r => 
      r.rowIndex === rowIndex ? newRowState : r
    );
    
    const operationLog = createOperationLog(
      '修正数据',
      `修正第${rowIndex}行: ${Object.keys(corrections).join(', ')}`,
      rowIndex,
      beforeState,
      newRowState
    );
    
    get().updateImportSession(sessionId, {
      rowStates: newRowStates,
      statistics: calculateSessionStatistics(newRowStates),
      conflictSummary: calculateConflictSummary(newRowStates),
      operationLogs: [...session.operationLogs, operationLog],
    });
  },

  setSessionConflictResolution: (sessionId, rowIndex, resolution) => {
    const state = get();
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const existingRowState = session.rowStates.find(r => r.rowIndex === rowIndex);
    const beforeState = { ...existingRowState };
    
    const newRowStates = session.rowStates.map(r => {
      if (r.rowIndex === rowIndex) {
        const filteredErrors = r.errors.filter(e => e.type !== 'ORDER_EXISTS');
        let newValidationStatus = r.validationStatus;
        
        if (filteredErrors.length === 0) {
          newValidationStatus = 'valid';
        } else if (!filteredErrors.some(e => 
          ['MISSING_STORE', 'MISSING_EQUIPMENT', 'MISSING_DESCRIPTION', 'INVALID_STORE', 'MISSING_CONTACT', 'MISSING_VISIT_TIME', 'INVALID_DATE_FORMAT'].includes(e.type)
        )) {
          newValidationStatus = 'warning';
        }
        
        return {
          ...r,
          conflictResolution: resolution,
          errors: filteredErrors,
          validationStatus: newValidationStatus,
          importStatus: r.importStatus === 'failed' ? 'pending' as const : r.importStatus,
        };
      }
      return r;
    });
    
    const operationLog = createOperationLog(
      '冲突决策',
      `第${rowIndex}行冲突决策: ${resolution === 'skip' ? '跳过' : resolution === 'overwrite' ? '覆盖' : '新建'}`,
      rowIndex,
      beforeState,
      { conflictResolution: resolution }
    );
    
    get().updateImportSession(sessionId, {
      rowStates: newRowStates,
      statistics: calculateSessionStatistics(newRowStates),
      conflictSummary: calculateConflictSummary(newRowStates),
      operationLogs: [...session.operationLogs, operationLog],
    });
  },

  autoFillMissingOrderNos: (sessionId) => {
    const state = get();
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const allOrderNos = new Set(state.workOrders.map(o => o.orderNo));
    const generatedOrderNos = new Set<string>();
    
    const newRowStates = session.rowStates.map(row => {
      if (row.importStatus !== 'pending') return row;
      
      const data = row.correctedData || row.originalData;
      if (data['工单号']) return row;
      
      if (row.validationStatus === 'error') return row;
      
      const year = new Date().getFullYear();
      let count = state.workOrders.length + generatedOrderNos.size + 1;
      let finalOrderNo = `WO-${year}-${String(count).padStart(4, '0')}`;
      
      while (allOrderNos.has(finalOrderNo) || generatedOrderNos.has(finalOrderNo)) {
        count++;
        finalOrderNo = `WO-${year}-${String(count).padStart(4, '0')}`;
      }
      
      generatedOrderNos.add(finalOrderNo);
      
      const updatedRow: SessionRowState = {
        ...row,
        autoGeneratedOrderNo: finalOrderNo,
      };
      
      const revalidatedRow = get().validateSessionRow(sessionId, row.rowIndex, {
        ...data,
        '工单号': finalOrderNo,
      });
      
      return {
        ...revalidatedRow,
        autoGeneratedOrderNo: finalOrderNo,
      };
    });
    
    const autoFixedCount = newRowStates.filter(r => r.autoGeneratedOrderNo && !session.rowStates.find(s => s.rowIndex === r.rowIndex)?.autoGeneratedOrderNo).length;
    
    const operationLog = createOperationLog(
      '自动补号',
      `自动为${autoFixedCount}行生成了工单号`
    );
    
    get().updateImportSession(sessionId, {
      rowStates: newRowStates,
      statistics: calculateSessionStatistics(newRowStates),
      operationLogs: [...session.operationLogs, operationLog],
    });
  },

  importSessionBatch: (sessionId, batchStart, batchEnd) => {
    const state = get();
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) {
      return { sessionId, successCount: 0, failedCount: 0, skippedCount: 0, importedOrderIds: [], importedOrderNos: [], errors: [], conflicts: [], operationLogs: [] };
    }
    
    if (state.currentRole !== 'dispatch') {
      return { sessionId, successCount: 0, failedCount: 0, skippedCount: 0, importedOrderIds: [], importedOrderNos: [], errors: [], conflicts: [], operationLogs: [] };
    }
    
    let start = batchStart ?? session.progress.currentBatchStart;
    let end = batchEnd ?? session.progress.currentBatchEnd;
    
    if (start > end) {
      start = 1;
      end = session.progress.totalRows;
    }
    
    const now = new Date().toISOString();
    
    const newOrders: WorkOrder[] = [];
    const importedOrderIds: string[] = [];
    const importedOrderNos: string[] = [];
    const errors: ImportError[] = [];
    const conflicts: { rowIndex: number; orderNo: string; resolution: 'skip' | 'overwrite' | 'new' }[] = [];
    const operationLogs: SessionOperationLog[] = [];
    
    const pendingRows = session.rowStates.filter(r => 
      r.rowIndex >= start && 
      r.rowIndex <= end && 
      r.importStatus === 'pending'
    );
    
    const errorRows = session.rowStates.filter(r =>
      r.rowIndex >= start &&
      r.rowIndex <= end &&
      r.importStatus === 'pending' &&
      r.validationStatus === 'error'
    );
    
    errorRows.forEach(row => {
      errors.push({
        row: row.rowIndex,
        field: '',
        type: 'VALIDATION_ERROR',
        message: '数据验证失败',
        originalData: row.originalData,
      });
    });
    
    const processableRows = pendingRows.filter(r => 
      r.validationStatus === 'valid' || r.validationStatus === 'warning'
    );
    
    for (const row of processableRows) {
      const data = row.correctedData || row.originalData;
      const storeName = data['门店名称'];
      const store = state.stores.find(s => s.name === storeName);
      
      let finalOrderNo = data['工单号'] || row.autoGeneratedOrderNo;
      
      if (!finalOrderNo) {
        errors.push({
          row: row.rowIndex,
          field: '工单号',
          type: 'MISSING_ORDER_NO',
          message: '缺少工单号且未自动生成',
          originalData: data,
        });
        continue;
      }
      
      const existingOrder = state.workOrders.find(o => o.orderNo === finalOrderNo);
      
      if (existingOrder && !row.conflictResolution) {
        conflicts.push({ rowIndex: row.rowIndex, orderNo: finalOrderNo, resolution: 'new' });
        continue;
      }
      
      if (existingOrder && row.conflictResolution === 'skip') {
        operationLogs.push(createOperationLog('跳过', `第${row.rowIndex}行工单${finalOrderNo}已存在，选择跳过`, row.rowIndex));
        continue;
      }
      
      const newOrder: WorkOrder = {
        id: existingOrder?.id || generateId(),
        orderNo: finalOrderNo,
        storeId: store?.id || '',
        equipment: data['设备类型'],
        description: data['故障描述'],
        status: (existingOrder && row.conflictResolution === 'overwrite' ? existingOrder.status : (data['状态'] || '待派工')) as WorkOrderStatus,
        engineerId: existingOrder?.engineerId || null,
        engineerName: existingOrder?.engineerName || null,
        repairRecord: existingOrder?.repairRecord || null,
        reviewRemark: existingOrder?.reviewRemark || null,
        reviewRating: existingOrder?.reviewRating || null,
        contactName: data['联系人'] || null,
        contactPhone: data['联系电话'] || null,
        expectedVisitTime: data['期望上门时间'] || null,
        createdAt: existingOrder?.createdAt || now,
        updatedAt: now,
        version: (existingOrder?.version || 0) + 1,
      };
      
      newOrders.push(newOrder);
      importedOrderIds.push(newOrder.id);
      importedOrderNos.push(newOrder.orderNo);
      
      operationLogs.push(createOperationLog(
        '导入',
        `第${row.rowIndex}行导入成功: ${finalOrderNo}`,
        row.rowIndex
      ));
    }
    
    const updatedWorkOrders = state.workOrders.filter(
      o => !newOrders.some(n => n.orderNo === o.orderNo)
    ).concat(newOrders);
    
    let updatedTimelines = { ...state.timelineMap };
    newOrders.forEach(order => {
      const existingOrder = state.workOrders.find(o => o.orderNo === order.orderNo);
      const store = state.stores.find(s => s.id === order.storeId);
      
      if (!existingOrder) {
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
    
    const newRowStates = session.rowStates.map(r => {
      if (r.rowIndex >= start && r.rowIndex <= end) {
        if (importedOrderNos.includes(r.correctedData?.['工单号'] || r.originalData['工单号'] || r.autoGeneratedOrderNo)) {
          return { ...r, importStatus: 'imported' as const, importedAt: now };
        }
        if (conflicts.some(c => c.rowIndex === r.rowIndex)) {
          return r;
        }
        if (errors.some(e => e.row === r.rowIndex)) {
          return { ...r, importStatus: 'failed' as const, lastError: errors.find(e => e.row === r.rowIndex)?.message };
        }
      }
      return r;
    });
    
    const allOperationLogs = [...session.operationLogs, ...operationLogs];
    
    const newProgress: SessionBatchProgress = {
      ...session.progress,
      processedRows: session.rowStates.filter(r => r.importStatus === 'imported' || r.importStatus === 'skipped' || r.importStatus === 'failed').length,
      currentBatchStart: end + 1,
      currentBatchEnd: Math.min(end + session.progress.batchSize, session.csvData.length - 1),
    };
    
    const hasMoreToProcess = newRowStates.some(r => r.importStatus === 'pending');
    const newStatus = !hasMoreToProcess ? 'completed' : 
      (newRowStates.some(r => r.importStatus === 'imported') ? 'in_progress' : session.status);
    
    get().updateImportSession(sessionId, {
      rowStates: newRowStates,
      statistics: calculateSessionStatistics(newRowStates),
      conflictSummary: calculateConflictSummary(newRowStates),
      progress: newProgress,
      status: newStatus,
      operationLogs: allOperationLogs,
      completedAt: !hasMoreToProcess ? now : undefined,
    });
    
    storage.setWorkOrders(updatedWorkOrders);
    storage.setTimelines(updatedTimelines);
    
    set({ workOrders: updatedWorkOrders, timelineMap: updatedTimelines });
    
    return {
      sessionId,
      successCount: newOrders.length,
      failedCount: errors.length,
      skippedCount: session.rowStates.filter(r => r.rowIndex >= start && r.rowIndex <= end && r.importStatus === 'skipped').length,
      importedOrderIds,
      importedOrderNos,
      errors,
      conflicts,
      operationLogs,
    };
  },

  resumeSession: (sessionId) => {
    const state = get();
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) {
      return { sessionId, successCount: 0, failedCount: 0, skippedCount: 0, importedOrderIds: [], importedOrderNos: [], errors: [], conflicts: [], operationLogs: [] };
    }
    
    get().updateImportSession(sessionId, { status: 'in_progress' });
    
    return get().importSessionBatch(sessionId);
  },

  pauseSession: (sessionId) => {
    get().updateImportSession(sessionId, { status: 'paused' });
  },

  clearSessionErrors: (sessionId, rowIndices) => {
    const state = get();
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const newRowStates = session.rowStates.map(r => {
      if (rowIndices.includes(r.rowIndex)) {
        const data = r.correctedData || r.originalData;
        return get().validateSessionRow(sessionId, r.rowIndex, data);
      }
      return r;
    });
    
    const operationLog = createOperationLog(
      '清理错误',
      `重新验证了${rowIndices.length}行数据`
    );
    
    get().updateImportSession(sessionId, {
      rowStates: newRowStates,
      statistics: calculateSessionStatistics(newRowStates),
      conflictSummary: calculateConflictSummary(newRowStates),
      operationLogs: [...session.operationLogs, operationLog],
    });
  },

  exportSessionErrors: (sessionId) => {
    const state = get();
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const errorRows = session.rowStates.filter(r => 
      r.validationStatus === 'error' || r.importStatus === 'failed'
    );
    
    const headers = ['行号', '状态', '错误类型', '错误信息', ...session.targetHeaders];
    
    const escapeCsvField = (field: string | null | undefined): string => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    const rows = errorRows.map(row => {
      const data = row.correctedData || row.originalData;
      const firstError = row.errors[0];
      return [
        String(row.rowIndex),
        escapeCsvField(row.validationStatus === 'error' ? '验证失败' : '导入失败'),
        escapeCsvField(firstError?.type || ''),
        escapeCsvField(firstError?.message || row.lastError || ''),
        ...session.targetHeaders.map(h => escapeCsvField(data[h] || '')),
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `导入失败明细_${session.fileName}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  getSessionPermission: (sessionId) => {
    const state = get();
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) return 'read';
    
    const permission = session.permissions.find(p => p.role === state.currentRole);
    if (permission) return permission.level;
    
    return checkRolePermission(state.currentRole, 'admin') ? 'admin' : 'read';
  },

  checkSessionPermission: (sessionId, requiredLevel) => {
    const state = get();
    
    if (state.currentRole === 'admin') return true;
    
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) return false;
    
    const permission = session.permissions.find(p => p.role === state.currentRole);
    if (permission) {
      const levels: PermissionLevel[] = ['read', 'write', 'admin'];
      return levels.indexOf(permission.level) >= levels.indexOf(requiredLevel);
    }
    
    return checkRolePermission(state.currentRole, requiredLevel);
  },

  lockSession: (sessionId) => {
    const state = get();
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) return false;
    
    if (!checkRolePermission(state.currentRole, 'write')) {
      return false;
    }
    
    const now = new Date().getTime();
    if (session.isLocked && session.lockExpiresAt) {
      const lockExpires = new Date(session.lockExpiresAt).getTime();
      if (now < lockExpires) {
        return false;
      }
    }
    
    const lockExpiresAt = new Date(now + 30 * 60 * 1000).toISOString();
    
    get().updateImportSession(sessionId, { 
      isLocked: true, 
      lockExpiresAt,
      updatedAt: new Date().toISOString(),
    });
    
    return true;
  },

  unlockSession: (sessionId) => {
    const state = get();
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    if (!checkRolePermission(state.currentRole, 'admin')) {
      return;
    }
    
    get().updateImportSession(sessionId, { 
      isLocked: false, 
      lockExpiresAt: undefined,
      updatedAt: new Date().toISOString(),
    });
  },

  addTimelineEntry: (sessionId, action, details, rowIndex, affectedCount) => {
    const state = get();
    const session = state.importSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const newEntry = createTimelineEntry(
      action, 
      details, 
      state.currentRole, 
      roleNames[state.currentRole], 
      rowIndex, 
      affectedCount
    );
    
    get().updateImportSession(sessionId, {
      timeline: [...session.timeline, newEntry],
    });
  },
}));
