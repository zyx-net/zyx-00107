import { useStore } from '../store/useStore';
import { WorkOrderCard } from './WorkOrderCard';
import { Plus, FileWarning } from 'lucide-react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';

export function WorkOrderList() {
  const { currentRole, selectedOrderId, getRoleOrders, getFilteredOrders, workOrders } = useStore();

  const roleOrders = getRoleOrders();
  const filteredOrders = getFilteredOrders();
  const displayedOrders = filteredOrders.filter(order => 
    roleOrders.some(r => r.id === order.id)
  );

  const showNewButton = currentRole === 'store';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-200">
          工单列表
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({displayedOrders.length} 条)
          </span>
        </h2>
        {showNewButton && (
          <Link
            to="/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            新建报修
          </Link>
        )}
      </div>

      {displayedOrders.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700/50 text-center">
          <FileWarning className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400 mb-2">暂无工单</h3>
          <p className="text-sm text-slate-500">
            {currentRole === 'store' && '点击上方按钮提交新的报修请求'}
            {currentRole === 'dispatch' && '当前没有待派工的工单'}
            {currentRole === 'engineer' && '当前没有需要您处理的工单'}
            {currentRole === 'quality' && '当前没有待回访的工单'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedOrders.map((order) => (
            <WorkOrderCard
              key={order.id}
              order={order}
              isSelected={selectedOrderId === order.id}
              onClick={() => useStore.getState().selectOrder(order.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
