import { useStore } from '../store/useStore';
import { ImportSession, ImportSessionStatus } from '../types';
import { 
  X, 
  FolderOpen, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Trash2,
  Play,
  Pause,
  RotateCcw,
  Upload,
  FileSpreadsheet,
  History,
  BarChart3,
  ChevronRight,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect, useMemo } from 'react';

interface ImportSessionCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWorkflow: (sessionId: string) => void;
}

const STATUS_CONFIG: Record<ImportSessionStatus, { color: string; bgColor: string; label: string; icon: typeof CheckCircle }> = {
  draft: { color: 'text-slate-400', bgColor: 'bg-slate-500/20', label: '草稿', icon: FileSpreadsheet },
  in_progress: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: '进行中', icon: Loader2 },
  paused: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: '已暂停', icon: Pause },
  partially_completed: { color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: '部分完成', icon: AlertTriangle },
  completed: { color: 'text-green-400', bgColor: 'bg-green-500/20', label: '已完成', icon: CheckCircle },
  failed: { color: 'text-red-400', bgColor: 'bg-red-500/20', label: '失败', icon: AlertCircle },
};

export function ImportSessionCenter({ isOpen, onClose, onOpenWorkflow }: ImportSessionCenterProps) {
  const { 
    importSessions, 
    activeSessionId, 
    setActiveSession,
    deleteImportSession,
    resumeSession,
    pauseSession,
  } = useStore();

  const [selectedTab, setSelectedTab] = useState<'active' | 'completed' | 'all'>('active');

  const filteredSessions = useMemo(() => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    switch (selectedTab) {
      case 'active':
        return importSessions.filter(s => 
          ['draft', 'in_progress', 'paused', 'partially_completed'].includes(s.status)
        );
      case 'completed':
        return importSessions.filter(s => 
          s.status === 'completed'
        );
      case 'all':
      default:
        return importSessions;
    }
  }, [importSessions, selectedTab]);

  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => 
      new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
    );
  }, [filteredSessions]);

  const stats = useMemo(() => {
    return {
      total: importSessions.length,
      active: importSessions.filter(s => ['draft', 'in_progress', 'paused'].includes(s.status)).length,
      completed: importSessions.filter(s => s.status === 'completed').length,
      totalImported: importSessions.reduce((sum, s) => sum + s.statistics.importedRows, 0),
      totalFailed: importSessions.reduce((sum, s) => sum + s.statistics.failedRows, 0),
    };
  }, [importSessions]);

  const handleResumeSession = (sessionId: string) => {
    resumeSession(sessionId);
  };

  const handlePauseSession = (sessionId: string) => {
    pauseSession(sessionId);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (confirm('确定要删除此导入会话吗？')) {
      deleteImportSession(sessionId);
    }
  };

  const handleOpenSession = (session: ImportSession) => {
    setActiveSession(session.id);
    onOpenWorkflow(session.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/95 rounded-2xl border border-slate-700/50 w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">导入会话中心</h2>
                <p className="text-sm text-slate-400">管理所有导入会话，随时恢复处理进度</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 shrink-0">
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-slate-900/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">总会话数</span>
              </div>
              <div className="text-2xl font-bold text-slate-100">{stats.total}</div>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-slate-400">进行中</span>
              </div>
              <div className="text-2xl font-bold text-blue-400">{stats.active}</div>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-slate-400">已完成</span>
              </div>
              <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-slate-400">已导入</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400">{stats.totalImported}</div>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-slate-400">失败</span>
              </div>
              <div className="text-2xl font-bold text-red-400">{stats.totalFailed}</div>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedTab('active')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedTab === 'active'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              )}
            >
              进行中 ({importSessions.filter(s => ['draft', 'in_progress', 'paused', 'partially_completed'].includes(s.status)).length})
            </button>
            <button
              onClick={() => setSelectedTab('completed')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedTab === 'completed'
                  ? 'bg-green-500/20 text-green-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              )}
            >
              已完成 ({importSessions.filter(s => s.status === 'completed').length})
            </button>
            <button
              onClick={() => setSelectedTab('all')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedTab === 'all'
                  ? 'bg-slate-600/50 text-slate-200'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              )}
            >
              全部 ({importSessions.length})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {sortedSessions.length === 0 ? (
            <div className="text-center py-16">
              <FolderOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">暂无导入会话</p>
              <p className="text-sm text-slate-500">上传CSV文件开始新的导入会话</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedSessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onOpen={() => handleOpenSession(session)}
                  onResume={() => handleResumeSession(session.id)}
                  onPause={() => handlePauseSession(session.id)}
                  onDelete={() => handleDeleteSession(session.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SessionCardProps {
  session: ImportSession;
  isActive: boolean;
  onOpen: () => void;
  onResume: () => void;
  onPause: () => void;
  onDelete: () => void;
}

function SessionCard({ session, isActive, onOpen, onResume, onPause, onDelete }: SessionCardProps) {
  const statusConfig = STATUS_CONFIG[session.status];
  const StatusIcon = statusConfig.icon;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const progressPercent = session.statistics.totalRows > 0 
    ? Math.round((session.statistics.importedRows / session.statistics.totalRows) * 100)
    : 0;

  return (
    <div 
      className={clsx(
        'bg-slate-900/50 rounded-xl p-4 border transition-all cursor-pointer hover:border-slate-600/50',
        isActive ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-700/30'
      )}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h3 className="font-medium text-slate-200 mb-0.5">{session.fileName}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{session.statistics.totalRows} 行数据</span>
              <span>•</span>
              <span>操作员: {session.operator}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx('px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5', statusConfig.bgColor, statusConfig.color)}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusConfig.label}
          </span>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span>导入进度</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={clsx(
              'h-full rounded-full transition-all',
              session.status === 'completed' ? 'bg-green-500' : 
              session.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-3 text-xs">
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-slate-500 mb-0.5">有效</div>
          <div className="text-green-400 font-medium">{session.statistics.validRows}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-slate-500 mb-0.5">警告</div>
          <div className="text-yellow-400 font-medium">{session.statistics.warningRows}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-slate-500 mb-0.5">错误</div>
          <div className="text-red-400 font-medium">{session.statistics.errorRows}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-slate-500 mb-0.5">已导入</div>
          <div className="text-emerald-400 font-medium">{session.statistics.importedRows}</div>
        </div>
      </div>

      {session.conflictSummary.totalConflicts > 0 && (
        <div className="mb-3 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <div className="flex items-center gap-2 text-xs text-yellow-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              存在 {session.conflictSummary.totalConflicts} 个冲突
              ({session.conflictSummary.resolved} 已解决, {session.conflictSummary.unresolved} 未解决)
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>最后访问: {formatDate(session.lastAccessedAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          {session.status === 'in_progress' && (
            <button
              onClick={(e) => { e.stopPropagation(); onPause(); }}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-yellow-400 transition-colors"
              title="暂停"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          {['draft', 'paused', 'partially_completed'].includes(session.status) && (
            <button
              onClick={(e) => { e.stopPropagation(); onResume(); }}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
              title="继续"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
            title="打开"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
