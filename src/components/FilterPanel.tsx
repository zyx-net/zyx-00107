import { useStore } from '../store/useStore';
import { WorkOrderStatus } from '../types';
import { Search, Filter, X } from 'lucide-react';
import { clsx } from 'clsx';

const statuses: (WorkOrderStatus | '全部')[] = [
  '全部',
  '待派工',
  '已派工',
  '维修中',
  '待回访',
  '已完成',
  '已撤销',
];

export function FilterPanel() {
  const { filters, setFilters } = useStore();

  return (
    <div className="bg-slate-800/50 rounded-2xl p-4 mb-6 border border-slate-700/50">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="搜索工单号、设备、故障描述..."
            value={filters.keyword}
            onChange={(e) => setFilters({ keyword: e.target.value })}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all"
          />
          {filters.keyword && (
            <button
              onClick={() => setFilters({ keyword: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-500" />
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setFilters({ status })}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                filters.status === status
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              )}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={filters.dateRange.start || ''}
            onChange={(e) => setFilters({ dateRange: { ...filters.dateRange, start: e.target.value || null } })}
            className="px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-300 text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all"
          />
          <span className="text-slate-500">至</span>
          <input
            type="date"
            value={filters.dateRange.end || ''}
            onChange={(e) => setFilters({ dateRange: { ...filters.dateRange, end: e.target.value || null } })}
            className="px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-300 text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all"
          />
          {(filters.dateRange.start || filters.dateRange.end) && (
            <button
              onClick={() => setFilters({ dateRange: { start: null, end: null } })}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
