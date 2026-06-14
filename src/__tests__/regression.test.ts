import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';
import { act } from '@testing-library/react';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('门店报修派工工作台 - 回归测试', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useStore.getState().resetData();
    });
  });

  describe('权限校验', () => {
    it('门店角色直接调用 dispatchOrder 应该失败', () => {
      act(() => {
        useStore.getState().setRole('store');
      });
      
      const store = useStore.getState();
      expect(store.currentRole).toBe('store');
      
      const pendingOrder = store.workOrders.find(o => o.status === '待派工');
      expect(pendingOrder).toBeDefined();
      
      if (pendingOrder) {
        const result = store.dispatchOrder(
          pendingOrder.id,
          'ENG001',
          '赵师傅',
          pendingOrder.version
        );
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('权限不足');
        expect(result.error).toContain('只有调度角色才能进行派工操作');
        
        const unchangedOrder = useStore.getState().workOrders.find(o => o.id === pendingOrder.id);
        expect(unchangedOrder?.status).toBe('待派工');
        expect(unchangedOrder?.engineerId).toBeNull();
      }
    });

    it('工程师角色直接调用 dispatchOrder 应该失败', () => {
      act(() => {
        useStore.getState().setRole('engineer');
      });
      
      const store = useStore.getState();
      expect(store.currentRole).toBe('engineer');
      
      const pendingOrder = store.workOrders.find(o => o.status === '待派工');
      expect(pendingOrder).toBeDefined();
      
      if (pendingOrder) {
        const result = store.dispatchOrder(
          pendingOrder.id,
          'ENG001',
          '赵师傅',
          pendingOrder.version
        );
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('权限不足');
      }
    });

    it('质检角色直接调用 dispatchOrder 应该失败', () => {
      act(() => {
        useStore.getState().setRole('quality');
      });
      
      const store = useStore.getState();
      expect(store.currentRole).toBe('quality');
      
      const pendingOrder = store.workOrders.find(o => o.status === '待派工');
      expect(pendingOrder).toBeDefined();
      
      if (pendingOrder) {
        const result = store.dispatchOrder(
          pendingOrder.id,
          'ENG001',
          '赵师傅',
          pendingOrder.version
        );
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('权限不足');
      }
    });

    it('调度角色正常派工应该成功', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      expect(store.currentRole).toBe('dispatch');
      
      const pendingOrder = store.workOrders.find(o => o.status === '待派工');
      expect(pendingOrder).toBeDefined();
      
      if (pendingOrder) {
        const result = store.dispatchOrder(
          pendingOrder.id,
          'ENG001',
          '赵师傅',
          pendingOrder.version
        );
        
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        
        const updatedOrder = useStore.getState().workOrders.find(o => o.id === pendingOrder.id);
        expect(updatedOrder?.status).toBe('已派工');
        expect(updatedOrder?.engineerId).toBe('ENG001');
        expect(updatedOrder?.engineerName).toBe('赵师傅');
        expect(updatedOrder?.version).toBe(pendingOrder.version + 1);
        
        const timeline = useStore.getState().timelineMap[pendingOrder.id];
        const dispatchTimeline = timeline?.find(t => t.action === '派工');
        expect(dispatchTimeline).toBeDefined();
        expect(dispatchTimeline?.description).toContain('赵师傅');
      }
    });
  });

  describe('并发抢派控制', () => {
    it('同版本抢派只有第一次成功，第二次因状态变化失败', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      
      const pendingOrder = store.workOrders.find(o => o.status === '待派工');
      expect(pendingOrder).toBeDefined();
      
      if (pendingOrder) {
        const originalVersion = pendingOrder.version;
        
        const result1 = store.dispatchOrder(
          pendingOrder.id,
          'ENG001',
          '赵师傅',
          originalVersion
        );
        expect(result1.success).toBe(true);
        
        const result2 = useStore.getState().dispatchOrder(
          pendingOrder.id,
          'ENG002',
          '钱师傅',
          originalVersion
        );
        expect(result2.success).toBe(false);
        expect(result2.error).toContain('已被其他调度派工');
        
        const finalOrder = useStore.getState().workOrders.find(o => o.id === pendingOrder.id);
        expect(finalOrder?.engineerId).toBe('ENG001');
        expect(finalOrder?.engineerName).toBe('赵师傅');
      }
    });

    it('状态变化后再次派工应该失败', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      
      const pendingOrder = store.workOrders.find(o => o.status === '待派工');
      expect(pendingOrder).toBeDefined();
      
      if (pendingOrder) {
        const result1 = store.dispatchOrder(
          pendingOrder.id,
          'ENG001',
          '赵师傅',
          pendingOrder.version
        );
        expect(result1.success).toBe(true);
        
        const updatedOrder = useStore.getState().workOrders.find(o => o.id === pendingOrder.id);
        
        const result2 = useStore.getState().dispatchOrder(
          pendingOrder.id,
          'ENG002',
          '钱师傅',
          updatedOrder!.version
        );
        expect(result2.success).toBe(false);
        expect(result2.error).toContain('已被其他调度派工');
      }
    });
  });

  describe('撤销重开功能', () => {
    it('撤销工单可以不填原因', () => {
      act(() => {
        useStore.getState().setRole('store');
      });
      
      const store = useStore.getState();
      
      const pendingOrder = store.workOrders.find(o => o.status === '待派工');
      expect(pendingOrder).toBeDefined();
      
      if (pendingOrder) {
        const result = store.cancelOrder(pendingOrder.id, '测试撤销');
        expect(result.success).toBe(true);
        
        const cancelledOrder = useStore.getState().workOrders.find(o => o.id === pendingOrder.id);
        expect(cancelledOrder?.status).toBe('已撤销');
      }
    });

    it('重开已撤销工单必须填写原因', () => {
      act(() => {
        useStore.getState().setRole('store');
      });
      
      const store = useStore.getState();
      
      const cancelledOrder = store.workOrders.find(o => o.status === '已撤销');
      expect(cancelledOrder).toBeDefined();
      
      if (cancelledOrder) {
        const result = store.reopenOrder(cancelledOrder.id, '');
        expect(result.success).toBe(false);
        expect(result.error).toContain('必须填写原因');
      }
    });

    it('重开已撤销工单成功', () => {
      act(() => {
        useStore.getState().setRole('store');
      });
      
      const store = useStore.getState();
      
      const cancelledOrder = store.workOrders.find(o => o.status === '已撤销');
      expect(cancelledOrder).toBeDefined();
      
      if (cancelledOrder) {
        const result = store.reopenOrder(cancelledOrder.id, '客户重新报修');
        expect(result.success).toBe(true);
        
        const reopenedOrder = useStore.getState().workOrders.find(o => o.id === cancelledOrder.id);
        expect(reopenedOrder?.status).toBe('待派工');
        expect(reopenedOrder?.engineerId).toBeNull();
        
        const timeline = useStore.getState().timelineMap[cancelledOrder.id];
        const reopenTimeline = timeline?.find(t => t.action === '重开');
        expect(reopenTimeline).toBeDefined();
        expect(reopenTimeline?.description).toContain('客户重新报修');
      }
    });
  });

  describe('数据持久化', () => {
    it('派工后数据应该持久化到 localStorage', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      
      const pendingOrder = store.workOrders.find(o => o.status === '待派工');
      expect(pendingOrder).toBeDefined();
      
      if (pendingOrder) {
        store.dispatchOrder(
          pendingOrder.id,
          'ENG001',
          '赵师傅',
          pendingOrder.version
        );
        
        const stored = localStorage.getItem('repair_work_orders');
        expect(stored).not.toBeNull();
        
        const parsed = JSON.parse(stored!);
        const storedOrder = parsed.find((o: any) => o.id === pendingOrder.id);
        expect(storedOrder.status).toBe('已派工');
        expect(storedOrder.engineerId).toBe('ENG001');
      }
    });

    it('角色选择应该持久化到 localStorage', () => {
      act(() => {
        useStore.getState().setRole('engineer');
      });
      
      const stored = localStorage.getItem('repair_current_role');
      expect(stored).toBe('engineer');
    });
  });

  describe('批量导入功能', () => {
    it('只有调度角色能执行批量导入', () => {
      act(() => {
        useStore.getState().setRole('store');
      });
      
      const store = useStore.getState();
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', ''],
      ];
      
      const result = store.importOrders(csvData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('权限不足');
      expect(result.error).toContain('只有调度角色才能执行批量导入');
    });

    it('调度角色可以成功导入有效数据', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      const initialCount = store.workOrders.length;
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', ''],
      ];
      
      const result = store.importOrders(csvData);
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.successCount).toBe(1);
      expect(result.result!.failureCount).toBe(0);
      
      const updatedStore = useStore.getState();
      expect(updatedStore.workOrders.length).toBe(initialCount + 1);
      
      const newOrder = updatedStore.workOrders.find(o => 
        o.equipment === '空调' && o.description === '不制冷'
      );
      expect(newOrder).toBeDefined();
      expect(newOrder?.contactName).toBe('张三');
      expect(newOrder?.contactPhone).toBe('13800000000');
      expect(newOrder?.expectedVisitTime).toBe('2024-01-20');
      expect(newOrder?.storeId).toBe('STORE001');
      
      const timeline = updatedStore.timelineMap[newOrder!.id];
      expect(timeline).toBeDefined();
      const importTimeline = timeline?.find(t => t.action === '创建工单');
      expect(importTimeline).toBeDefined();
      expect(importTimeline?.description).toContain('批量导入');
    });

    it('缺少必填字段应该返回错误', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', ''],
      ];
      
      const result = store.importOrders(csvData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('阻断性错误');
      
      const { errors } = store.validateImportData(csvData);
      expect(errors.length).toBeGreaterThan(0);
      const storeError = errors.find(e => e.field === '门店名称');
      expect(storeError).toBeDefined();
      expect(storeError?.type).toBe('MISSING_STORE');
    });

    it('工单号重复应该返回错误', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调1', '不制冷1', '待派工', '张三', '13800000000', '2024-01-20', 'WO-2024-9999'],
        ['朝阳店', '空调2', '不制冷2', '待派工', '李四', '13800000001', '2024-01-21', 'WO-2024-9999'],
      ];
      
      const result = store.importOrders(csvData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('阻断性错误');
      
      const { errors } = store.validateImportData(csvData);
      const duplicateError = errors.find(e => e.type === 'DUPLICATE_ORDER_NO');
      expect(duplicateError).toBeDefined();
    });

    it('已存在的工单号应该返回警告', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      const existingOrder = store.workOrders.find(o => o.orderNo === 'WO-2024-0001');
      expect(existingOrder).toBeDefined();
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '新空调', '新故障', '待派工', '王五', '13800000000', '2024-01-20', 'WO-2024-0001'],
      ];
      
      const result = store.importOrders(csvData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('已存在的工单号');
      
      const { errors } = store.validateImportData(csvData);
      const existsError = errors.find(e => e.type === 'ORDER_EXISTS');
      expect(existsError).toBeDefined();
      expect(existsError?.message).toContain('WO-2024-0001');
      expect(existsError?.message).toContain('覆盖原工单');
    });

    it('导入后应该写入时间线', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '新设备', '测试导入', '待派工', '测试员', '13800000000', '2024-01-20', ''],
      ];
      
      const result = store.importOrders(csvData);
      expect(result.success).toBe(true);
      
      const updatedStore = useStore.getState();
      const newOrder = updatedStore.workOrders.find(o => o.description === '测试导入');
      expect(newOrder).toBeDefined();
      
      const timeline = updatedStore.timelineMap[newOrder!.id];
      expect(timeline).toBeDefined();
      expect(timeline!.length).toBeGreaterThan(0);
      
      const importTimeline = timeline?.find(t => t.description.includes('批量导入'));
      expect(importTimeline).toBeDefined();
      expect(importTimeline?.operator).toBe('调度');
      expect(importTimeline?.role).toBe('dispatch');
    });

    it('导入结果应该持久化', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '设备A', '描述A', '待派工', '甲', '13800000000', '2024-01-20', ''],
      ];
      
      store.importOrders(csvData);
      
      const storedImports = localStorage.getItem('repair_imports');
      expect(storedImports).not.toBeNull();
      
      const imports = JSON.parse(storedImports!);
      expect(imports.length).toBeGreaterThan(0);
      expect(imports[0].successCount).toBe(1);
    });

    it('刷新后导入历史应该保留', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      
      const csvData1 = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '设备X', '描述X', '待派工', '乙', '13800000000', '2024-01-20', ''],
      ];
      
      act(() => {
        store.importOrders(csvData1);
      });
      
      const afterFirstImport = useStore.getState().imports.length;
      expect(afterFirstImport).toBe(1);
      
      const csvData2 = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['海淀店', '设备Y', '描述Y', '待派工', '丙', '13800000001', '2024-01-21', ''],
      ];
      
      act(() => {
        store.importOrders(csvData2);
      });
      
      const afterSecondImport = useStore.getState().imports.length;
      expect(afterSecondImport).toBe(2);
    });

    it('缺少期望上门时间应该在预检阶段拦截', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      const initialCount = store.workOrders.length;
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷', '待派工', '张三', '13800000000', '', ''],
      ];
      
      const result = store.importOrders(csvData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('阻断性错误');
      
      const { errors } = store.validateImportData(csvData);
      const visitTimeError = errors.find(e => e.type === 'MISSING_VISIT_TIME');
      expect(visitTimeError).toBeDefined();
      expect(visitTimeError?.field).toBe('期望上门时间');
      
      const afterImport = useStore.getState().workOrders.length;
      expect(afterImport).toBe(initialCount);
    });

    it('状态值不在允许范围内应该在预检阶段拦截', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      const initialCount = store.workOrders.length;
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷', '无效状态', '张三', '13800000000', '2024-01-20', ''],
      ];
      
      const result = store.importOrders(csvData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('阻断性错误');
      
      const { errors } = store.validateImportData(csvData);
      const statusError = errors.find(e => e.type === 'INVALID_STATUS');
      expect(statusError).toBeDefined();
      expect(statusError?.field).toBe('状态');
      expect(statusError?.message).toContain('无效状态');
      
      const afterImport = useStore.getState().workOrders.length;
      expect(afterImport).toBe(initialCount);
    });

    it('多行空工单号应该生成不同编号', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      const initialCount = store.workOrders.length;
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调1', '不制冷1', '待派工', '张三', '13800000000', '2024-01-20', ''],
        ['海淀店', '空调2', '不制冷2', '待派工', '李四', '13800000001', '2024-01-21', ''],
        ['浦东店', '空调3', '不制冷3', '待派工', '王五', '13800000002', '2024-01-22', ''],
      ];
      
      const result = store.importOrders(csvData);
      expect(result.success).toBe(true);
      expect(result.result!.successCount).toBe(3);
      
      const updatedStore = useStore.getState();
      expect(updatedStore.workOrders.length).toBe(initialCount + 3);
      
      const newOrders = updatedStore.workOrders.filter(o => 
        o.description === '不制冷1' || o.description === '不制冷2' || o.description === '不制冷3'
      );
      expect(newOrders.length).toBe(3);
      
      const orderNos = newOrders.map(o => o.orderNo);
      const uniqueOrderNos = new Set(orderNos);
      expect(uniqueOrderNos.size).toBe(3);
      
      orderNos.forEach(orderNo => {
        expect(orderNo).toMatch(/^WO-\d{4}-\d{4}$/);
      });
    });

    it('合法导入后工单列表和详情应该正确', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      const initialCount = store.workOrders.length;
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '测试设备', '测试故障描述', '待派工', '测试联系人', '13900000000', '2024-02-15', ''],
      ];
      
      const result = store.importOrders(csvData);
      expect(result.success).toBe(true);
      
      const updatedStore = useStore.getState();
      expect(updatedStore.workOrders.length).toBe(initialCount + 1);
      
      const newOrder = updatedStore.workOrders.find(o => o.description === '测试故障描述');
      expect(newOrder).toBeDefined();
      expect(newOrder?.equipment).toBe('测试设备');
      expect(newOrder?.contactName).toBe('测试联系人');
      expect(newOrder?.contactPhone).toBe('13900000000');
      expect(newOrder?.expectedVisitTime).toBe('2024-02-15');
      expect(newOrder?.status).toBe('待派工');
      expect(newOrder?.storeId).toBe('STORE001');
      
      const timeline = updatedStore.timelineMap[newOrder!.id];
      expect(timeline).toBeDefined();
      expect(timeline!.length).toBeGreaterThan(0);
    });
  });

  describe('导出功能', () => {
    it('导出应该保存筛选条件快照', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
        useStore.getState().setFilters({ 
          status: '待派工',
          dateRange: { start: '2024-01-01', end: '2024-01-31' },
          keyword: '测试'
        });
      });
      
      const store = useStore.getState();
      const orders = store.getFilteredOrders();
      
      act(() => {
        store.exportOrders(orders, '测试导出');
      });
      
      const exports = useStore.getState().exports;
      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].filterSnapshot).toBeDefined();
      expect(exports[0].filterSnapshot.status).toBe('待派工');
      expect(exports[0].filterSnapshot.keyword).toBe('测试');
    });

    it('导出后刷新应该保留导出记录', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      
      act(() => {
        store.exportOrders(store.getFilteredOrders(), '第一次导出');
      });
      
      act(() => {
        store.exportOrders(store.getFilteredOrders(), '第二次导出');
      });
      
      const afterTwoExports = useStore.getState().exports.length;
      expect(afterTwoExports).toBe(2);
      
      act(() => {
        store.resetData();
      });
      
      const afterReset = useStore.getState().exports.length;
      expect(afterReset).toBe(0);
      
      act(() => {
        store.exportOrders(store.getFilteredOrders(), '重置后导出');
      });
      
      const afterNewExport = useStore.getState().exports.length;
      expect(afterNewExport).toBe(1);
    });
  });

  describe('跨刷新状态保留', () => {
    it('新创建的工单在未重置数据前应该保留', () => {
      act(() => {
        useStore.getState().setRole('store');
      });
      
      const store = useStore.getState();
      const initialCount = store.workOrders.length;
      
      act(() => {
        store.createOrder('STORE001', '新设备', '新故障', '联系人', '13800000000', '2024-01-25');
      });
      
      const afterCreate = useStore.getState().workOrders.length;
      expect(afterCreate).toBe(initialCount + 1);
      
      const newOrder = useStore.getState().workOrders.find(o => o.description === '新故障');
      expect(newOrder).toBeDefined();
      expect(newOrder?.contactName).toBe('联系人');
    });

    it('筛选条件在未重置数据前应该保留', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
        useStore.getState().setFilters({
          status: '维修中',
          dateRange: { start: '2024-01-01', end: null },
          keyword: '冷柜'
        });
      });
      
      const beforeRefresh = useStore.getState().filters;
      expect(beforeRefresh.status).toBe('维修中');
      expect(beforeRefresh.keyword).toBe('冷柜');
      
      act(() => {
        useStore.getState().setFilters({
          status: '已完成',
          dateRange: { start: null, end: null },
          keyword: '空调'
        });
      });
      
      const afterChange = useStore.getState().filters;
      expect(afterChange.status).toBe('已完成');
      expect(afterChange.keyword).toBe('空调');
    });
  });
});
