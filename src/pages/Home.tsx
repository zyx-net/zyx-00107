import { RoleSwitcher } from "../components/RoleSwitcher";
import { StatisticsCards } from "../components/StatisticsCards";
import { FilterPanel } from "../components/FilterPanel";
import { WorkOrderList } from "../components/WorkOrderList";
import { WorkOrderDetail } from "../components/WorkOrderDetail";
import { useStore } from "../store/useStore";
import { Settings, Download, RotateCcw } from "lucide-react";
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function Home() {
  const { resetData, getFilteredOrders, stores, exportOrders } = useStore();

  const handleExport = () => {
    const orders = getFilteredOrders();
    const timestamp = new Date().toLocaleString('zh-CN').replace(/[/:]/g, '-');
    const name = `工单导出_${timestamp}`;
    
    const headers = [
      '工单号',
      '门店',
      '设备类型',
      '故障描述',
      '状态',
      '工程师',
      '维修记录',
      '回访评价',
      '回访备注',
      '创建时间',
      '更新时间'
    ];

    const escapeCsvField = (field: string | null | undefined): string => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = orders.map(order => {
      const store = stores.find(s => s.id === order.storeId);
      return [
        escapeCsvField(order.orderNo),
        escapeCsvField(store?.name || ''),
        escapeCsvField(order.equipment),
        escapeCsvField(order.description),
        escapeCsvField(order.status),
        escapeCsvField(order.engineerName || ''),
        escapeCsvField(order.repairRecord || ''),
        escapeCsvField(order.reviewRating || ''),
        escapeCsvField(order.reviewRemark || ''),
        escapeCsvField(format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })),
        escapeCsvField(format(new Date(order.updatedAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    exportOrders(orders, name);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-xl">🔧</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-100">门店报修派工工作台</h1>
                  <p className="text-xs text-slate-500">维修服务全流程管理</p>
                </div>
              </div>
              <RoleSwitcher />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-xl font-medium transition-all duration-200 border border-slate-700/50 hover:border-slate-600/50"
              >
                <Download className="w-4 h-4" />
                导出CSV
              </button>
              <button
                onClick={resetData}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 rounded-xl transition-all duration-200 border border-slate-700/50 hover:border-slate-600/50"
                title="重置演示数据"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <StatisticsCards />
        <FilterPanel />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-1">
            <WorkOrderList />
          </div>
          <div className="lg:col-span-1">
            <WorkOrderDetail />
          </div>
        </div>
      </div>
    </div>
  );
}
