import { WorkOrder, Timeline, FilterState, Role, ExportResult } from '../types';

const STORAGE_KEYS = {
  WORK_ORDERS: 'repair_work_orders',
  TIMELINES: 'repair_timelines',
  CURRENT_ROLE: 'repair_current_role',
  FILTERS: 'repair_filters',
  EXPORTS: 'repair_exports',
} as const;

export const storage = {
  getWorkOrders(): WorkOrder[] {
    const data = localStorage.getItem(STORAGE_KEYS.WORK_ORDERS);
    return data ? JSON.parse(data) : [];
  },

  setWorkOrders(orders: WorkOrder[]): void {
    localStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(orders));
  },

  getTimelines(): Record<string, Timeline[]> {
    const data = localStorage.getItem(STORAGE_KEYS.TIMELINES);
    return data ? JSON.parse(data) : {};
  },

  setTimelines(timelines: Record<string, Timeline[]>): void {
    localStorage.setItem(STORAGE_KEYS.TIMELINES, JSON.stringify(timelines));
  },

  getCurrentRole(): Role {
    const role = localStorage.getItem(STORAGE_KEYS.CURRENT_ROLE);
    return (role as Role) || 'store';
  },

  setCurrentRole(role: Role): void {
    localStorage.setItem(STORAGE_KEYS.CURRENT_ROLE, role);
  },

  getFilters(): FilterState {
    const data = localStorage.getItem(STORAGE_KEYS.FILTERS);
    return data ? JSON.parse(data) : {
      status: '全部',
      dateRange: { start: null, end: null },
      keyword: '',
    };
  },

  setFilters(filters: FilterState): void {
    localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters));
  },

  getExports(): ExportResult[] {
    const data = localStorage.getItem(STORAGE_KEYS.EXPORTS);
    return data ? JSON.parse(data) : [];
  },

  setExports(exports: ExportResult[]): void {
    localStorage.setItem(STORAGE_KEYS.EXPORTS, JSON.stringify(exports));
  },

  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  },
};
