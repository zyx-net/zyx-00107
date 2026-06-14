import { Timeline as TimelineType } from '../types';
import { roleNames, roleColors } from '../data/initialData';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { 
  Plus, 
  UserPlus, 
  CheckCircle, 
  Wrench, 
  Send, 
  RotateCcw, 
  ThumbsUp, 
  ThumbsDown,
  XCircle
} from 'lucide-react';
import { clsx } from 'clsx';

interface TimelineProps {
  items: TimelineType[];
}

const actionIcons: Record<string, React.ReactNode> = {
  '创建工单': <Plus className="w-4 h-4" />,
  '派工': <UserPlus className="w-4 h-4" />,
  '接单': <CheckCircle className="w-4 h-4" />,
  '开始维修': <Wrench className="w-4 h-4" />,
  '完工提交': <Send className="w-4 h-4" />,
  '退回': <RotateCcw className="w-4 h-4" />,
  '回访通过': <ThumbsUp className="w-4 h-4" />,
  '回访不通过': <ThumbsDown className="w-4 h-4" />,
  '撤销': <XCircle className="w-4 h-4" />,
};

const actionColors: Record<string, string> = {
  '创建工单': '#3498db',
  '派工': '#e67e22',
  '接单': '#27ae60',
  '开始维修': '#27ae60',
  '完工提交': '#27ae60',
  '退回': '#ef4444',
  '回访通过': '#10b981',
  '回访不通过': '#f59e0b',
  '撤销': '#6b7280',
};

export function Timeline({ items }: TimelineProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        暂无操作记录
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700/50" />
      
      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="relative pl-10 animate-fadeIn"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div
              className="absolute left-2 w-4 h-4 rounded-full border-2 border-slate-800 flex items-center justify-center"
              style={{ backgroundColor: actionColors[item.action] || '#6b7280' }}
            >
              <div className="text-white">
                {actionIcons[item.action] || <Plus className="w-3 h-3" />}
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span 
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ 
                      backgroundColor: `${actionColors[item.action] || '#6b7280'}20`,
                      color: actionColors[item.action] || '#6b7280'
                    }}
                  >
                    {item.action}
                  </span>
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ 
                      backgroundColor: `${roleColors[item.role] || '#6b7280'}20`,
                      color: roleColors[item.role] || '#6b7280'
                    }}
                  >
                    {roleNames[item.role]}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {format(new Date(item.createdAt), 'MM-dd HH:mm', { locale: zhCN })}
                </span>
              </div>

              <p className="text-sm text-slate-300">{item.description}</p>
              
              <div className="mt-2 text-xs text-slate-500">
                操作人: {item.operator}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
