export type Role = 'store' | 'dispatch' | 'engineer' | 'quality';

export type WorkOrderStatus = 
  | '待派工'
  | '已派工'
  | '维修中'
  | '待回访'
  | '已完成'
  | '已撤销';

export type TimelineAction =
  | '创建工单'
  | '派工'
  | '接单'
  | '开始维修'
  | '完工提交'
  | '退回'
  | '回访通过'
  | '回访不通过'
  | '撤销'
  | '重开';

export interface Store {
  id: string;
  name: string;
  address: string;
  contact: string;
  phone: string;
}

export interface Engineer {
  id: string;
  name: string;
  employeeNo: string;
  expertise: string;
  status: 'available' | 'busy' | 'offline';
}

export interface WorkOrder {
  id: string;
  orderNo: string;
  storeId: string;
  equipment: string;
  description: string;
  status: WorkOrderStatus;
  engineerId: string | null;
  engineerName: string | null;
  repairRecord: string | null;
  reviewRemark: string | null;
  reviewRating: '满意' | '基本满意' | '不满意' | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Timeline {
  id: string;
  workOrderId: string;
  action: TimelineAction;
  description: string;
  operator: string;
  role: Role;
  createdAt: string;
}

export interface FilterState {
  status: WorkOrderStatus | '全部';
  dateRange: {
    start: string | null;
    end: string | null;
  };
  keyword: string;
}

export interface ExportResult {
  id: string;
  name: string;
  data: WorkOrder[];
  createdAt: string;
}

export interface AppState {
  currentRole: Role;
  workOrders: WorkOrder[];
  stores: Store[];
  engineers: Engineer[];
  filters: FilterState;
  timelineMap: Record<string, Timeline[]>;
  exports: ExportResult[];
  selectedOrderId: string | null;
}
