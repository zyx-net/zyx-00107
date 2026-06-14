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
});
