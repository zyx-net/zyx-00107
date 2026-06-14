import { useStore } from '../store/useStore';
import { statusColors, roleNames, roleColors } from '../data/initialData';
import { Clock, AlertCircle, CheckCircle, XCircle, Activity } from 'lucide-react';
import { clsx } from 'clsx';

const statusConfig = [
  { status: '待派工', icon: AlertCircle, key: 'pending' },
  { status: '维修中', icon: Activity, key: 'inProgress' },
  { status: '待回访', icon: Clock, key: 'pendingReview' },
  { status: '已完成', icon: CheckCircle, key: 'completed' },
];

export function StatisticsCards() {
  const { workOrders, currentRole } = useStore();

  const counts = {
    pending: workOrders.filter(o => o.status === '待派工').length,
    inProgress: workOrders.filter(o => o.status === '维修中').length,
    pendingReview: workOrders.filter(o => o.status === '待回访').length,
    completed: workOrders.filter(o => o.status === '已完成').length,
    total: workOrders.length,
    cancelled: workOrders.filter(o => o.status === '已撤销').length,
  };

  const roleColor = roleColors[currentRole];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {statusConfig.map(({ status, icon: Icon, key }) => (
        <div
          key={key}
          className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-200 hover:shadow-lg hover:shadow-slate-900/50"
        >
          <div className="flex items-center justify-between mb-3">
            <span 
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ 
                backgroundColor: `${statusColors[status]}20`,
                color: statusColors[status]
              }}
            >
              {status}
            </span>
            <Icon 
              className="w-5 h-5" 
              style={{ color: statusColors[status] }} 
            />
          </div>
          <div 
            className="text-3xl font-bold"
            style={{ color: statusColors[status] }}
          >
            {counts[key as keyof typeof counts]}
          </div>
        </div>
      ))}

      <div
        className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-200 hover:shadow-lg hover:shadow-slate-900/50"
        style={{ borderColor: `${roleColor}30` }}
      >
        <div className="flex items-center justify-between mb-3">
          <span 
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ 
              backgroundColor: `${roleColor}20`,
              color: roleColor
            }}
          >
            {roleNames[currentRole]}
          </span>
          <XCircle className="w-5 h-5 text-slate-500" />
        </div>
        <div className="text-3xl font-bold text-slate-400">
          {counts.cancelled}
        </div>
      </div>
    </div>
  );
}
