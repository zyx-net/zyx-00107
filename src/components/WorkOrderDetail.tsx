import { useStore } from '../store/useStore';
import { statusColors, roleNames, roleColors } from '../data/initialData';
import { Timeline } from './Timeline';
import { DispatchPanel } from './DispatchPanel';
import { RepairForm } from './RepairForm';
import { ReviewForm } from './ReviewForm';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { 
  X, 
  MapPin, 
  Phone, 
  User, 
  Calendar, 
  Wrench,
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Check
} from 'lucide-react';
import { clsx } from 'clsx';
import { useState } from 'react';

export function WorkOrderDetail() {
  const { 
    currentRole, 
    selectedOrderId, 
    workOrders, 
    stores, 
    timelineMap, 
    selectOrder,
    acceptOrder,
    cancelOrder,
  } = useStore();

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!selectedOrderId) {
    return (
      <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700/50 text-center">
        <Wrench className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-400 mb-2">选择工单查看详情</h3>
        <p className="text-sm text-slate-500">从左侧列表选择一个工单</p>
      </div>
    );
  }

  const order = workOrders.find(o => o.id === selectedOrderId);
  if (!order) {
    return (
      <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700/50 text-center">
        <AlertTriangle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-400 mb-2">工单不存在</h3>
      </div>
    );
  }

  const store = stores.find(s => s.id === order.storeId);
  const timelines = timelineMap[order.id] || [];

  const handleAccept = () => {
    const result = acceptOrder(order.id);
    if (!result.success) {
      setError(result.error || '接单失败');
    }
  };

  const handleCancel = () => {
    const result = cancelOrder(order.id);
    if (!result.success) {
      setError(result.error || '撤销失败');
    }
    setShowCancelConfirm(false);
  };

  const canDispatch = currentRole === 'dispatch' && order.status === '待派工';
  const canAccept = currentRole === 'engineer' && order.status === '已派工';
  const canReview = currentRole === 'quality' && order.status === '待回访';
  const canCancel = 
    (currentRole === 'store' && (order.status === '待派工' || order.status === '已派工')) ||
    (currentRole === 'engineer' && order.status === '已派工');
  const canRepair = currentRole === 'engineer' && (order.status === '维修中' || order.status === '已派工');

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
      <div className="p-5 border-b border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-slate-800/80 to-slate-800/40">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">{order.orderNo}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span 
                className="text-sm px-3 py-1 rounded-full font-medium"
                style={{ 
                  backgroundColor: `${statusColors[order.status]}20`,
                  color: statusColors[order.status]
                }}
              >
                {order.status}
              </span>
              <span 
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ 
                  backgroundColor: `${roleColors[currentRole]}20`,
                  color: roleColors[currentRole]
                }}
              >
                {roleNames[currentRole]}视角
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => selectOrder(null)}
          className="p-2 hover:bg-slate-700/50 rounded-xl transition-colors text-slate-400 hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mx-5 mt-5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="p-5 space-y-5 max-h-[calc(100vh-280px)] overflow-y-auto">
        <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/30">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">基本信息</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-500 mt-1" />
              <div>
                <div className="text-xs text-slate-500">门店</div>
                <div className="text-slate-200 font-medium">{store?.name || '未知门店'}</div>
                <div className="text-xs text-slate-500 mt-1">{store?.address}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-slate-500 mt-1" />
              <div>
                <div className="text-xs text-slate-500">联系电话</div>
                <div className="text-slate-200 font-medium">{store?.phone || '-'}</div>
                <div className="text-xs text-slate-500 mt-1">{store?.contact}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Wrench className="w-4 h-4 text-slate-500 mt-1" />
              <div>
                <div className="text-xs text-slate-500">设备类型</div>
                <div className="text-slate-200 font-medium">{order.equipment}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-slate-500 mt-1" />
              <div>
                <div className="text-xs text-slate-500">创建时间</div>
                <div className="text-slate-200 font-medium">
                  {format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700/30">
            <div className="text-xs text-slate-500 mb-2">故障描述</div>
            <p className="text-slate-300 leading-relaxed">{order.description}</p>
          </div>
        </div>

        {order.engineerId && (
          <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/30">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">派工信息</h3>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-slate-200 font-medium">{order.engineerName}</div>
                <div className="text-xs text-slate-500 mt-1">
                  最后更新: {format(new Date(order.updatedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                </div>
              </div>
            </div>
          </div>
        )}

        {order.repairRecord && (
          <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/30">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">维修记录</h3>
            <p className="text-slate-300 leading-relaxed">{order.repairRecord}</p>
          </div>
        )}

        {order.reviewRemark && (
          <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/30">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">回访备注</h3>
            <div className="flex items-center gap-3 mb-3">
              <span 
                className={clsx(
                  'text-sm px-3 py-1 rounded-full font-medium',
                  order.reviewRating === '满意' && 'bg-emerald-500/20 text-emerald-400',
                  order.reviewRating === '基本满意' && 'bg-yellow-500/20 text-yellow-400',
                  order.reviewRating === '不满意' && 'bg-red-500/20 text-red-400'
                )}
              >
                {order.reviewRating}
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">{order.reviewRemark}</p>
          </div>
        )}

        {canDispatch && <DispatchPanel orderId={order.id} />}
        
        {canRepair && (
          <RepairForm 
            orderId={order.id} 
            currentRecord={order.repairRecord}
            status={order.status}
          />
        )}
        
        {canReview && <ReviewForm orderId={order.id} />}

        <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/30">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">操作历史</h3>
          <Timeline items={timelines} />
        </div>
      </div>

      <div className="p-5 border-t border-slate-700/50 flex items-center gap-3 bg-gradient-to-r from-slate-800/40 to-slate-800/80">
        {canAccept && (
          <button
            onClick={handleAccept}
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            接单
          </button>
        )}
        
        {canCancel && !showCancelConfirm && (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2"
          >
            <XCircle className="w-5 h-5" />
            撤销工单
          </button>
        )}

        {showCancelConfirm && (
          <>
            <button
              onClick={handleCancel}
              className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              确认撤销
            </button>
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-medium transition-all duration-200"
            >
              取消
            </button>
          </>
        )}
      </div>
    </div>
  );
}
