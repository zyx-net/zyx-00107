import { useStore } from '../store/useStore';
import { FileSpreadsheet, CheckCircle, AlertTriangle, Clock, User } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function ImportHistory() {
  const { imports } = useStore();

  if (imports.length === 0) {
    return null;
  }

  const latestImport = imports[imports.length - 1];

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileSpreadsheet className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-medium text-slate-200">最近导入</h3>
      </div>
      
      <div className="space-y-3">
        <div className={clsx(
          'p-3 rounded-lg border',
          latestImport.failureCount === 0
            ? 'bg-green-500/10 border-green-500/20'
            : latestImport.successCount > 0
              ? 'bg-yellow-500/10 border-yellow-500/20'
              : 'bg-red-500/10 border-red-500/20'
        )}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {latestImport.failureCount === 0 ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
              )}
              <span className="text-sm font-medium text-slate-200">
                {latestImport.successCount} 成功
                {latestImport.failureCount > 0 && (
                  <span className="text-yellow-400">，{latestImport.failureCount} 失败</span>
                )}
              </span>
            </div>
            <span className="text-xs text-slate-400">
              {latestImport.totalCount} 条总计
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {latestImport.operator}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(latestImport.createdAt), 'MM-dd HH:mm', { locale: zhCN })}
            </div>
          </div>

          {latestImport.errors.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-700/30">
              <div className="text-xs text-slate-400 space-y-1">
                {latestImport.errors.slice(0, 3).map((err, idx) => (
                  <div key={idx} className="flex items-start gap-1">
                    <span className="text-slate-500">第{err.row}行:</span>
                    <span className="text-yellow-400">{err.message}</span>
                  </div>
                ))}
                {latestImport.errors.length > 3 && (
                  <div className="text-yellow-400">
                    ...还有 {latestImport.errors.length - 3} 条错误
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {imports.length > 1 && (
          <div className="text-xs text-slate-500 text-center">
            共 {imports.length} 次导入记录
          </div>
        )}
      </div>
    </div>
  );
}
