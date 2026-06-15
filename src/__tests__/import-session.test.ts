import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('导入会话中心 - 核心功能测试', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useStore.getState().resetData();
    });
  });

  const createHeaderMapping = (originalHeaders: string[], targetHeaders: string[]): Record<number, number> => {
    const mapping: Record<number, number> = {};
    originalHeaders.forEach((header, index) => {
      const normalizedHeader = header.trim();
      const targetIndex = targetHeaders.findIndex(h => 
        normalizedHeader.includes(h) || h.includes(normalizedHeader)
      );
      if (targetIndex !== -1) {
        mapping[index] = targetIndex;
      }
    });
    return mapping;
  };

  describe('会话创建与持久化', () => {
    it('应该能创建新的导入会话', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号', '工程师'],
        ['朝阳店', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', '', '赵师傅'],
        ['海淀店', '冰箱', '不保鲜', '待派工', '李四', '13800000001', '2024-01-21', '', '钱师傅'],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号', '工程师'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('测试导入.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.fileName).toBe('测试导入.csv');
      expect(session.status).toBe('draft');
      expect(session.statistics.totalRows).toBe(2);
      expect(session.operationLogs.length).toBeGreaterThan(0);
    });

    it('会话应该持久化到 localStorage', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', ''],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('测试.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      
      const storedSessions = localStorage.getItem('repair_import_sessions');
      expect(storedSessions).not.toBeNull();
      
      const sessions = JSON.parse(storedSessions!);
      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe(session.id);
    });

    it('刷新后应该能恢复会话', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      let store = useStore.getState();
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', ''],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('测试.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      const sessionId = session.id;
      
      let sessions = useStore.getState().importSessions;
      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe(sessionId);
      
      act(() => {
        useStore.getState().resetData();
      });
      
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const restoredSessions = useStore.getState().importSessions;
      expect(restoredSessions.length).toBe(1);
      expect(restoredSessions[0].id).toBe(sessionId);
      expect(restoredSessions[0].fileName).toBe('测试.csv');
    });
  });

  describe('跨重启恢复', () => {
    it('会话状态应该完整恢复', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      let store = useStore.getState();
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷1', '待派工', '张三', '13800000000', '2024-01-20', ''],
        ['海淀店', '冰箱', '不保鲜', '待派工', '李四', '13800000001', '2024-01-21', ''],
        ['浦东店', '洗衣机', '不脱水', '待派工', '王五', '13800000002', '2024-01-22', ''],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('多行测试.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      
      act(() => {
        store.autoFillMissingOrderNos(session.id);
      });
      
      act(() => {
        useStore.getState().resetData();
      });
      
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const restoredSession = useStore.getState().importSessions.find(s => s.id === session.id);
      expect(restoredSession).toBeDefined();
      expect(restoredSession?.statistics.autoFixedCount).toBe(3);
      expect(restoredSession?.rowStates.length).toBe(3);
      restoredSession?.rowStates.forEach(row => {
        expect(row.autoGeneratedOrderNo).toBeDefined();
        expect(row.autoGeneratedOrderNo).toMatch(/^WO-\d{4}-\d{4}$/);
      });
    });

    it('操作日志应该完整保留', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      let store = useStore.getState();
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', ''],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('日志测试.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      
      act(() => {
        store.autoFillMissingOrderNos(session.id);
      });
      
      act(() => {
        store.validateSessionAllRows(session.id);
      });
      
      const beforeReset = useStore.getState().getActiveSession();
      const logCountBefore = beforeReset?.operationLogs.length || 0;
      
      act(() => {
        useStore.getState().resetData();
      });
      
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const restoredSession = useStore.getState().importSessions.find(s => s.id === session.id);
      expect(restoredSession?.operationLogs.length).toBe(logCountBefore);
    });
  });

  describe('自动补号功能', () => {
    it('应该为有效行自动生成工单号', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', ''],
        ['海淀店', '冰箱', '不保鲜', '待派工', '李四', '13800000001', '2024-01-21', ''],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('自动补号测试.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      
      act(() => {
        store.autoFillMissingOrderNos(session.id);
      });
      
      const updatedSession = useStore.getState().getActiveSession();
      expect(updatedSession?.statistics.autoFixedCount).toBe(2);
      
      const orderNos = updatedSession?.rowStates.map(r => r.autoGeneratedOrderNo).filter(Boolean);
      expect(orderNos?.length).toBe(2);
      
      const uniqueOrderNos = new Set(orderNos);
      expect(uniqueOrderNos.size).toBe(2);
    });
  });

  describe('部分成功导入', () => {
    it('应该能导入部分有效行', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      let store = useStore.getState();
      const initialOrderCount = store.workOrders.length;
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷A', '待派工', '张三', '13800000000', '2024-01-20', ''],
        ['海淀店', '洗衣机', '不脱水B', '待派工', '王五', '13800000002', '2024-01-22', ''],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('部分导入测试.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      const sessionId = session.id;
      
      act(() => {
        store.autoFillMissingOrderNos(sessionId);
      });
      
      act(() => {
        store.importSessionBatch(sessionId);
      });
      
      const updatedStore = useStore.getState();
      const importedRows = updatedStore.getActiveSession()?.rowStates.filter(r => r.importStatus === 'imported');
      expect(importedRows?.length).toBe(2);
    });

    it('导入后会话状态应该更新', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      let store = useStore.getState();
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', ''],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('状态更新测试.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      const sessionId = session.id;
      
      act(() => {
        store.autoFillMissingOrderNos(sessionId);
      });
      
      act(() => {
        store.importSessionBatch(sessionId);
      });
      
      const updatedSession = useStore.getState().getActiveSession();
      expect(updatedSession?.status).toBe('completed');
      expect(updatedSession?.statistics.importedRows).toBe(1);
    });
  });

  describe('冲突处理', () => {
    it('应该能处理工单号冲突', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      let store = useStore.getState();
      const existingOrder = store.workOrders.find(o => o.orderNo === 'WO-2024-0001');
      expect(existingOrder).toBeDefined();
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', 'WO-2024-0001'],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号', '工程师'];
      const headerMapping: Record<number, number> = {
        0: 0,
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5,
        6: 6,
        7: 7,
      };
      
      const session = store.createImportSession('冲突测试.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      
      expect(session.rowStates.length).toBe(1);
      
      act(() => {
        store.setSessionConflictResolution(session.id, 1, 'overwrite');
      });
      
      const updatedSession = useStore.getState().getActiveSession();
      expect(updatedSession).toBeDefined();
      expect(updatedSession?.rowStates[0]?.conflictResolution).toBe('overwrite');
    });
  });

  describe('会话恢复与续处理', () => {
    it('应该能从暂停状态恢复导入', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      let store = useStore.getState();
      const initialOrderCount = store.workOrders.length;
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调1', '不制冷1', '待派工', '张三', '13800000000', '2024-01-20', ''],
        ['海淀店', '冰箱1', '不保鲜1', '待派工', '李四', '13800000001', '2024-01-21', ''],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('恢复测试.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      const sessionId = session.id;
      
      act(() => {
        store.autoFillMissingOrderNos(sessionId);
      });
      
      act(() => {
        store.importSessionBatch(sessionId, 1, 1);
      });
      
      act(() => {
        store.pauseSession(sessionId);
      });
      
      const pausedSession = useStore.getState().getActiveSession();
      expect(pausedSession?.status).toBe('paused');
      
      act(() => {
        store.resumeSession(sessionId);
      });
      
      const resumedSession = useStore.getState().getActiveSession();
      expect(resumedSession?.status).toBe('completed');
      
      const updatedStore = useStore.getState();
      expect(updatedStore.workOrders.length).toBe(initialOrderCount + 2);
    });

    it('刷新后应该能继续未完成的会话', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      let store = useStore.getState();
      const initialOrderCount = store.workOrders.length;
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调A', '不制冷A', '待派工', '张三', '13800000000', '2024-01-20', ''],
        ['海淀店', '冰箱B', '不保鲜B', '待派工', '李四', '13800000001', '2024-01-21', ''],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('重启续处理测试.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      const sessionId = session.id;
      
      act(() => {
        store.autoFillMissingOrderNos(sessionId);
      });
      
      act(() => {
        store.importSessionBatch(sessionId, 1, 1);
      });
      
      const sessionBeforeReset = useStore.getState().importSessions.find(s => s.id === sessionId);
      expect(sessionBeforeReset?.statistics.importedRows).toBe(1);
      expect(sessionBeforeReset?.status).toBe('in_progress');
      
      const orderCountBeforeReset = useStore.getState().workOrders.length;
      
      act(() => {
        useStore.getState().resetData();
      });
      
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const restoredSession = useStore.getState().importSessions.find(s => s.id === sessionId);
      expect(restoredSession).toBeDefined();
      expect(restoredSession?.statistics.importedRows).toBe(1);
      
      act(() => {
        useStore.getState().resumeSession(sessionId);
      });
      
      const finalSession = useStore.getState().importSessions.find(s => s.id === sessionId);
      expect(finalSession?.statistics.importedRows).toBe(2);
    });
  });

  describe('行级修正', () => {
    it('应该能修正错误行', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', ''],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('行修正测试.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      
      const errorRow = session.rowStates.find(r => r.rowIndex === 1);
      expect(errorRow?.validationStatus).toBe('error');
      
      act(() => {
        store.correctSessionRow(session.id, 1, { '门店名称': '朝阳店' });
      });
      
      const correctedSession = useStore.getState().getActiveSession();
      const correctedRow = correctedSession?.rowStates.find(r => r.rowIndex === 1);
      expect(correctedRow?.validationStatus).toBe('valid');
      expect(correctedRow?.errors.length).toBe(0);
    });
  });

  describe('错误导出', () => {
    it('应该能导出错误行到 CSV', () => {
      const mockCreateObjectURL = vi.fn(() => 'blob:test-url');
      const mockRevokeObjectURL = vi.fn();
      Object.defineProperty(global, 'URL', {
        value: {
          ...global.URL,
          createObjectURL: mockCreateObjectURL,
          revokeObjectURL: mockRevokeObjectURL,
        },
        writable: true,
      });
      
      const mockClick = vi.fn();
      const mockAppendChild = vi.fn(() => ({}));
      const mockRemoveChild = vi.fn();
      
      const originalBody = document.body;
      Object.defineProperty(document, 'body', {
        value: {
          ...originalBody,
          appendChild: mockAppendChild,
          removeChild: mockRemoveChild,
        },
        writable: true,
      });
      
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          return {
            href: '',
            download: '',
            click: mockClick,
            appendChild: mockAppendChild,
            removeChild: mockRemoveChild,
          } as any;
        }
        return originalCreateElement(tag);
      });
      
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      const store = useStore.getState();
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', ''],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('错误导出测试.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      
      expect(() => store.exportSessionErrors(session.id)).not.toThrow();
      
      vi.restoreAllMocks();
      
      Object.defineProperty(document, 'body', {
        value: originalBody,
        writable: true,
      });
    });
  });

  describe('会话列表功能', () => {
    it('应该能获取所有会话', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      let store = useStore.getState();
      
      const csvData1 = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', ''],
      ];
      const originalHeaders = csvData1[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      store.createImportSession('会话1.csv', originalHeaders, csvData1, targetHeaders, headerMapping);
      
      const csvData2 = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['海淀店', '冰箱', '不保鲜', '待派工', '李四', '13800000001', '2024-01-21', ''],
      ];
      
      store.createImportSession('会话2.csv', originalHeaders, csvData2, targetHeaders, headerMapping);
      
      const sessions = store.getImportSessions();
      expect(sessions.length).toBe(2);
    });

    it('应该能删除会话', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      let store = useStore.getState();
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', ''],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('待删除.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      const sessionId = session.id;
      
      expect(store.getImportSessions().length).toBe(1);
      
      act(() => {
        store.deleteImportSession(sessionId);
      });
      
      expect(store.getImportSessions().length).toBe(0);
    });

    it('应该能设置活跃会话', () => {
      act(() => {
        useStore.getState().setRole('dispatch');
      });
      
      let store = useStore.getState();
      
      const csvData = [
        ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'],
        ['朝阳店', '空调', '不制冷', '待派工', '张三', '13800000000', '2024-01-20', ''],
      ];
      const originalHeaders = csvData[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const headerMapping = createHeaderMapping(originalHeaders, targetHeaders);
      
      const session = store.createImportSession('活跃会话测试.csv', originalHeaders, csvData, targetHeaders, headerMapping);
      
      const currentStore = useStore.getState();
      expect(currentStore.activeSessionId).toBe(session.id);
      expect(currentStore.getActiveSession()?.id).toBe(session.id);
      
      act(() => {
        useStore.getState().setActiveSession(null);
      });
      
      expect(useStore.getState().getActiveSession()).toBeNull();
    });
  });
});
