import { WorkOrder } from '../types';
import { useStore } from '../store/useStore';
import { statusColors } from '../data/initialData';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronRight, MapPin, Wrench } from 'lucide-react';
import { clsx } from 'clsx';

interface WorkOrderCardProps {
  order: WorkOrder;
  isSelected?: boolean;
  onClick?: () => void;
}

export function WorkOrderCard({ order, isSelected, onClick }: WorkOrderCardProps) {
  const { stores } = useStore();
  const store = stores.find(s => s.id === order.storeId);

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left bg-slate-800/50 rounded-2xl p-5 border transition-all duration-200 hover:shadow-lg hover:shadow-slate-900/50 group',
        isSelected
          ? 'border-blue-500/50 shadow-lg shadow-blue-500/10'
          : 'border-slate-700/50 hover:border-slate-600/50'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span 
            className="text-sm font-semibold px-2.5 py-1 rounded-lg"
            style={{ 
              backgroundColor: `${statusColors[order.status]}20`,
              color: statusColors[order.status]
            }}
          >
            {order.orderNo}
          </span>
          <span 
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ 
              backgroundColor: `${statusColors[order.status]}10`,
              color: statusColors[order.status]
            }}
          >
            {order.status}
          </span>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-slate-300">
          <MapPin className="w-4 h-4 text-slate-500" />
          <span className="font-medium">{store?.name || '未知门店'}</span>
        </div>
        
        <div className="flex items-center gap-2 text-slate-400">
          <Wrench className="w-4 h-4 text-slate-500" />
          <span>{order.equipment}</span>
        </div>

        <p className="text-sm text-slate-400 line-clamp-2 pl-6">
          {order.description}
        </p>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/50">
        <span className="text-xs text-slate-500">
          {format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
        </span>
        {order.engineerName && (
          <span className="text-xs text-emerald-400/80">
            👤 {order.engineerName}
          </span>
        )}
      </div>
    </button>
  );
}
