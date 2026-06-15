import { useState, useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { ImportSession, ImportSessionStatus, Role } from '../types';
import { 
  Upload, 
  FolderOpen, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Trash2,
  Play,
  Pause,
  RotateCcw,
  FileSpreadsheet,
  History,
  BarChart3,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Users,
  Lock,
  Unlock,
  Filter,
  Search,
  Plus,
  X,
  Download,
  RefreshCw,
  Zap,
  Eye,
} from 'lucide-react';
import { clsx } from 'clsx';

const STATUS_CONFIG: Record<ImportSessionStatus, { color: string; bgColor: string; label: string; icon: typeof CheckCircle }> = {
  draft: { color: 'text-slate-400', bgColor: 'bg-slate-500/20', label: '草稿', icon: FileSpreadsheet },
  in_progress: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: '进行中', icon: Loader2 },
  paused: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: '已暂停', icon: Pause },
  partially_completed: { color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: '部分完成', icon: AlertTriangle },
  completed: { color: 'text-green-400', bgColor: 'bg-green-500/20', label: '已完成', icon: CheckCircle },
  failed: { color: 'text-red-400', bgColor: 'bg-red-500/20', label: '失败', icon: AlertCircle },
};

const ROLE_LABELS: Record<Role, string> = {
  store: '门店',
  dispatch: '调度',
  engineer: '工程师',
  quality: '质检',
  admin: '管理员',
};

interface ImportWorkbenchProps {
  onBack?: () => void;
}

export default function ImportWorkbench({ onBack }: ImportWorkbenchProps) {
  const { 
    importSessions, 
    createImportSession, 
    deleteImportSession,
    resumeSession,
    pauseSession,
    setActiveSession,
    lockSession,
    unlockSession,
    checkSessionPermission,
    currentRole,
    stores,
    engineers,
  } = useStore();

  const [selectedTab, setSelectedTab] = useState<'active' | 'completed' | 'all'>('active');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ImportSessionStatus | 'all'>('all');
  const [showTimeline, setShowTimeline] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ImportSession | null>(null);
  const [uploading, setUploading] = useState(false);

  const filteredSessions = useMemo(() => {
    let sessions = [...importSessions];
    
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      sessions = sessions.filter(s => 
        s.fileName.toLowerCase().includes(keyword) ||
        s.operator.toLowerCase().includes(keyword)
      );
    }
    
    if (filterStatus !== 'all') {
      sessions = sessions.filter(s => s.status === filterStatus);
    }

    switch (selectedTab) {
      case 'active':
        return sessions.filter(s => 
          ['draft', 'in_progress', 'paused', 'partially_completed'].includes(s.status)
        );
      case 'completed':
        return sessions.filter(s => s.status === 'completed');
      default:
        return sessions;
    }
  }, [importSessions, selectedTab, searchKeyword, filterStatus]);

  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => 
      new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
    );
  }, [filteredSessions]);

  const stats = useMemo(() => {
    return {
      total: importSessions.length,
      active: importSessions.filter(s => ['draft', 'in_progress', 'paused', 'partially_completed'].includes(s.status)).length,
      completed: importSessions.filter(s => s.status === 'completed').length,
      locked: importSessions.filter(s => s.isLocked).length,
      totalImported: importSessions.reduce((sum, s) => sum + s.statistics.importedRows, 0),
      totalFailed: importSessions.reduce((sum, s) => sum + s.statistics.failedRows, 0),
      totalProcessed: importSessions.reduce((sum, s) => sum + s.progress.processedRows, 0),
      totalRows: importSessions.reduce((sum, s) => sum + s.statistics.totalRows, 0),
    };
  }, [importSessions]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const csvData = text.split('\n').map(row => {
          const parts: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"' && row[i + 1] === '"') {
              current += '"';
              i++;
            } else if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              parts.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          parts.push(current);
          
          return parts.map(p => p.trim());
        }).filter(row => row.some(cell => cell.length > 0));

        if (csvData.length < 2) {
          alert('CSV文件至少需要包含表头和一行数据');
          return;
        }

        const originalHeaders = csvData[0];
        const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号', '工程师'];
        
        const headerMapping: Record<number, number> = {};
        originalHeaders.forEach((header, index) => {
          const normalizedHeader = header.trim();
          const targetIndex = targetHeaders.findIndex(h => 
            normalizedHeader.includes(h) || h.includes(normalizedHeader)
          );
          if (targetIndex !== -1) {
            headerMapping[index] = targetIndex;
          }
        });

        const session = createImportSession(file.name, originalHeaders, csvData, targetHeaders, headerMapping);
        setSelectedSession(session);
        setShowTimeline(true);

      } catch (error) {
        console.error('解析CSV失败:', error);
        alert('解析CSV文件失败，请检查文件格式');
      } finally {
        setUploading(false);
      }
    };

    reader.readAsText(file, 'UTF-8');
  }, [createImportSession]);

  const handleResumeSession = (sessionId: string) => {
    if (!checkSessionPermission(sessionId, 'write')) {
      alert('权限不足');
      return;
    }
    resumeSession(sessionId);
  };

  const handlePauseSession = (sessionId: string) => {
    if (!checkSessionPermission(sessionId, 'write')) {
      alert('权限不足');
      return;
    }
    pauseSession(sessionId);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (!checkSessionPermission(sessionId, 'admin')) {
      alert('权限不足');
      return;
    }
    if (confirm('确定要删除此导入会话吗？此操作不可恢复。')) {
      deleteImportSession(sessionId);
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
        setShowTimeline(false);
      }
    }
  };

  const handleLockSession = (sessionId: string) => {
    if (!checkSessionPermission(sessionId, 'admin')) {
      alert('权限不足');
      return;
    }
    lockSession(sessionId);
  };

  const handleUnlockSession = (sessionId: string) => {
    if (!checkSessionPermission(sessionId, 'admin')) {
      alert('权限不足');
      return;
    }
    unlockSession(sessionId);
  };

  const handleOpenSession = (session: ImportSession) => {
    if (!checkSessionPermission(session.id, 'read')) {
      alert('权限不足');
      return;
    }
    setActiveSession(session.id);
    setSelectedSession(session);
    setShowTimeline(true);
  };

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

  const progressPercent = (session: ImportSession) => {
    return session.statistics.totalRows > 0 
      ? Math.round((session.statistics.importedRows / session.statistics.totalRows) * 100)
      : 0;
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Upload className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">导入作业台</h1>
                <p className="text-sm text-slate-400">批量导入工单管理中心</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索会话..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 w-64"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                showFilters ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-slate-700/50 text-slate-400'
              )}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {showFilters && (
        <div className="bg-slate-800/50 border-b border-slate-700/50 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ImportSessionStatus | 'all')}
              className="px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
            >
              <option value="all">全部状态</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">总会话数</span>
            </div>
            <div className="text-2xl font-bold text-slate-100">{stats.total}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-slate-400">进行中</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">{stats.active}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm text-slate-400">已完成</span>
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-slate-400">已锁定</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">{stats.locked}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-slate-400">已导入工单</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">{stats.totalImported}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-slate-400">失败工单</span>
            </div>
            <div className="text-2xl font-bold text-red-400">{stats.totalFailed}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-slate-400">处理进度</span>
            </div>
            <div className="text-2xl font-bold text-purple-400">
              {stats.totalProcessed}/{stats.totalRows}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-slate-400">当前角色</span>
            </div>
            <div className="text-2xl font-bold text-cyan-400">{ROLE_LABELS[currentRole]}</div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700/30 overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
            <div className="flex items-center justify-between">
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
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium cursor-pointer transition-colors">
                <Plus className="w-4 h-4" />
                {uploading ? '上传中...' : '上传CSV文件'}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="p-4">
            {sortedSessions.length === 0 ? (
              <div className="text-center py-16">
                <FolderOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-2">暂无导入会话</p>
                <p className="text-sm text-slate-500">点击上方按钮上传CSV文件开始新的导入会话</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedSessions.map(session => {
                  const statusConfig = STATUS_CONFIG[session.status];
                  const StatusIcon = statusConfig.icon;
                  const canWrite = checkSessionPermission(session.id, 'write');
                  const canAdmin = checkSessionPermission(session.id, 'admin');

                  return (
                    <div 
                      key={session.id}
                      className={clsx(
                        'bg-slate-900/50 rounded-xl p-4 border transition-all',
                        selectedSession?.id === session.id 
                          ? 'border-blue-500/50 ring-1 ring-blue-500/20' 
                          : 'border-slate-700/30 hover:border-slate-600/50',
                        session.isLocked && !canAdmin ? 'opacity-60' : ''
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            session.isLocked ? 'bg-yellow-500/20' : 'bg-slate-800'
                          )}>
                            {session.isLocked ? (
                              <Lock className="w-5 h-5 text-yellow-400" />
                            ) : (
                              <FileSpreadsheet className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-slate-200">{session.fileName}</h3>
                              <span className={clsx('px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5', statusConfig.bgColor, statusConfig.color)}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusConfig.label}
                              </span>
                              {session.isLocked && (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-yellow-500/20 text-yellow-400">
                                  已锁定
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                              <span>{session.statistics.totalRows} 行数据</span>
                              <span>•</span>
                              <span>操作员: {session.operator}</span>
                              <span>•</span>
                              <span>角色: {ROLE_LABELS[session.role]}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {canAdmin && (
                            <button
                              onClick={() => session.isLocked ? handleUnlockSession(session.id) : handleLockSession(session.id)}
                              className={clsx(
                                'p-1.5 rounded-lg text-slate-400 transition-colors',
                                session.isLocked 
                                  ? 'hover:bg-slate-700 hover:text-green-400' 
                                  : 'hover:bg-slate-700 hover:text-yellow-400'
                              )}
                              title={session.isLocked ? '解锁会话' : '锁定会话'}
                            >
                              {session.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenSession(session)}
                            disabled={session.isLocked && !canAdmin}
                            className={clsx(
                              'p-1.5 rounded-lg text-slate-400 transition-colors',
                              session.isLocked && !canAdmin 
                                ? 'opacity-50 cursor-not-allowed' 
                                : 'hover:bg-slate-700 hover:text-blue-400'
                            )}
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                            title="删除会话"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                          <span>导入进度</span>
                          <span>{progressPercent(session)}%</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={clsx(
                              'h-full rounded-full transition-all',
                              session.status === 'completed' ? 'bg-green-500' : 
                              session.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                            )}
                            style={{ width: `${progressPercent(session)}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-3 mb-3 text-xs">
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
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-slate-500 mb-0.5">待处理</div>
                          <div className="text-blue-400 font-medium">{session.statistics.pendingRows}</div>
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
                          {canWrite && session.status === 'in_progress' && (
                            <button
                              onClick={() => handlePauseSession(session.id)}
                              className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs font-medium transition-colors"
                            >
                              <Pause className="w-3.5 h-3.5 inline mr-1" />
                              暂停
                            </button>
                          )}
                          {canWrite && ['draft', 'paused', 'partially_completed'].includes(session.status) && (
                            <button
                              onClick={() => handleResumeSession(session.id)}
                              className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-medium transition-colors"
                            >
                              <Play className="w-3.5 h-3.5 inline mr-1" />
                              继续
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {showTimeline && selectedSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/95 rounded-2xl border border-slate-700/50 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-700/50 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <History className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">操作时间线</h2>
                    <p className="text-sm text-slate-400">{selectedSession.fileName}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowTimeline(false); setSelectedSession(null); }}
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {selectedSession.timeline.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">暂无操作记录</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-700" />
                  <div className="space-y-6">
                    {selectedSession.timeline.slice().reverse().map((entry, index) => (
                      <div key={entry.id} className="relative flex gap-4">
                        <div className="relative z-10 w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shrink-0">
                          {index === 0 ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : (
                            <Clock className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-slate-200">{entry.action}</h4>
                              <p className="text-sm text-slate-400 mt-1">{entry.details}</p>
                            </div>
                            <span className="text-xs text-slate-500 whitespace-nowrap">
                              {new Date(entry.timestamp).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span>操作员: {entry.operator}</span>
                            <span>角色: {ROLE_LABELS[entry.role]}</span>
                            {entry.rowIndex && <span>涉及行: {entry.rowIndex}</span>}
                            {entry.affectedCount && <span>影响: {entry.affectedCount} 行</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}