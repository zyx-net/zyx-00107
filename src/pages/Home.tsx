import { RoleSwitcher } from "../components/RoleSwitcher";
import { StatisticsCards } from "../components/StatisticsCards";
import { FilterPanel } from "../components/FilterPanel";
import { WorkOrderList } from "../components/WorkOrderList";
import { WorkOrderDetail } from "../components/WorkOrderDetail";
import { useStore } from "../store/useStore";
import { Settings, Download, RotateCcw } from "lucide-react";

export default function Home() {
  const { selectedOrderId, resetData, exports, getFilteredOrders, exportOrders } = useStore();

  const handleExport = () => {
    const orders = getFilteredOrders();
    const timestamp = new Date().toLocaleString('zh-CN');
    const name = `工单导出_${timestamp}`;
    const result = exportOrders(orders, name);
    
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
                导出
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
