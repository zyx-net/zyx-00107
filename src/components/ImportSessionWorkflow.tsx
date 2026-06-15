import { useStore } from '../store/useStore';
import { SessionRowState, ImportSession, Role } from '../types';
import { 
  X, 
  CheckCircle, 
  AlertCircle,
  Download,
  RefreshCw,
  Play,
  Pause,
  Zap,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  Filter,
  History,
  Clock,
  Hash,
  AlertTriangle,
  FileSpreadsheet,
  Lock,
  Unlock,
  Layers,
  SkipForward,
  RotateCcw,
  CheckCheck,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect, useMemo } from 'react';

interface ImportSessionWorkflowProps {
  sessionId: string;
  onClose: () => void;
}

const TARGET_HEADERS = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号', '工程师'];
const STATUS_OPTIONS = ['待派工', '已派工', '维修中', '待回访', '已完成', '已撤销'];

const ROLE_LABELS: Record<Role, string> = {
  store: '门店',
  dispatch: '调度',
  engineer: '工程师',
  quality: '质检',
  admin: '管理员',
};

export function ImportSessionWorkflow({ sessionId, onClose }: ImportSessionWorkflowProps) {
  const { 
    getActiveSession,
    validateSessionAllRows,
    autoFillMissingOrderNos,
    importSessionBatch,
    resumeSession,
    pauseSession,
    exportSessionErrors,
    correctSessionRow,
    setSessionConflictResolution,
    clearSessionErrors,
    lockSession,
    unlockSession,
    checkSessionPermission,
    addTimelineEntry,
    stores,
    engineers,
    currentRole,
  } = useStore();

  const [showFilters, setShowFilters] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showValid, setShowValid] = useState(true);
  const [showWarning, setShowWarning] = useState(true);
  const [showError, setShowError] = useState(true);
  const [showPending, setShowPending] = useState(true);
  const [showImported, setShowImported] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchStart, setBatchStart] = useState(1);
  const [batchEnd, setBatchEnd] = useState(50);

  const handleBatchStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    const maxRows = session?.progress.totalRows || 1;
    setBatchStart(Math.max(1, Math.min(maxRows, value) || 1));
  };

  const handleBatchEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    const maxRows = session?.progress.totalRows || batchStart;
    setBatchEnd(Math.max(batchStart, Math.min(maxRows, value) || batchStart));
  };

  const session = getActiveSession();
  const canWrite = session ? checkSessionPermission(session.id, 'write') : false;
  const canAdmin = session ? checkSessionPermission(session.id, 'admin') : false;

  useEffect(() => {
    if (session) {
      validateSessionAllRows(session.id);
    }
  }, [sessionId]);

  const filteredRows = useMemo(() => {
    if (!session) return [];
    
    return session.rowStates.filter(row => {
      if (!showPending && row.importStatus === 'pending') return false;
      if (!showImported && row.importStatus === 'imported') return false;
      
      if (row.validationStatus === 'valid' && !showValid) return false;
      if (row.validationStatus === 'warning' && !showWarning) return false;
      if (row.validationStatus === 'error' && !showError) return false;
      
      if (searchKeyword) {
        const data = row.correctedData || row.originalData;
        const searchLower = searchKeyword.toLowerCase();
        return Object.values(data).some(v => 
          String(v).toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
  }, [session, showValid, showWarning, showError, showPending, showImported, searchKeyword]);

  const stats = useMemo(() => {
    if (!session) return { valid: 0, warning: 0, error: 0, imported: 0, pending: 0, failed: 0 };
    
    return {
      valid: session.statistics.validRows,
      warning: session.statistics.warningRows,
      error: session.statistics.errorRows,
      imported: session.statistics.importedRows,
      pending: session.statistics.pendingRows,
      failed: session.statistics.failedRows,
      autoFixed: session.statistics.autoFixedCount,
    };
  }, [session]);

  const handleAutoFill = () => {
    if (session && canWrite) {
      autoFillMissingOrderNos(session.id);
      addTimelineEntry(session.id, '自动补号', `自动为待处理行生成工单号`, undefined, stats.pending);
    }
  };

  const handleImportBatch = async () => {
    if (!session || importing || !canWrite) return;
    
    setImporting(true);
    
    try {
      const result = importSessionBatch(session.id);
      
      if (result.conflicts.length > 0) {
        addTimelineEntry(session.id, '冲突检测', `检测到 ${result.conflicts.length} 个未解决冲突`, undefined, result.conflicts.length);
      }
      
      if (result.successCount > 0) {
        addTimelineEntry(session.id, '批次导入', `成功导入 ${result.successCount} 条记录`, undefined, result.successCount);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleCustomBatchImport = async () => {
    if (!session || importing || !canWrite) return;
    
    setImporting(true);
    
    try {
      const result = importSessionBatch(session.id, batchStart, batchEnd);
      
      if (result.successCount > 0) {
        addTimelineEntry(session.id, '分批导入', `导入第 ${batchStart}-${batchEnd} 行，成功 ${result.successCount} 条`, undefined, result.successCount);
      }
    } finally {
      setImporting(false);
      setShowBatchModal(false);
    }
  };

  const handleResume = async () => {
    if (!session || importing || !canWrite) return;
    
    setImporting(true);
    
    try {
      resumeSession(session.id);
      addTimelineEntry(session.id, '恢复执行', '从上次中断位置继续导入');
    } finally {
      setImporting(false);
    }
  };

  const handlePause = () => {
    if (session && canWrite) {
      pauseSession(session.id);
      addTimelineEntry(session.id, '暂停执行', '暂停导入会话');
    }
  };

  const handleExportErrors = () => {
    if (session) {
      exportSessionErrors(session.id);
      addTimelineEntry(session.id, '导出错误', `导出 ${stats.error + stats.failed} 条错误记录`);
    }
  };

  const handleRecheckAll = () => {
    if (session) {
      validateSessionAllRows(session.id);
      addTimelineEntry(session.id, '重新验证', '重新验证所有行数据');
    }
  };

  const handleClearErrors = () => {
    if (!session) return;
    
    const errorRows = session.rowStates
      .filter(r => r.validationStatus === 'error')
      .map(r => r.rowIndex);
    
    if (errorRows.length > 0) {
      clearSessionErrors(session.id, errorRows);
      addTimelineEntry(session.id, '清理错误', `清理 ${errorRows.length} 行错误标记`);
    }
  };

  const handleLock = () => {
    if (session && canAdmin) {
      lockSession(session.id);
      addTimelineEntry(session.id, '锁定会话', '锁定会话防止其他用户操作');
    }
  };

  const handleUnlock = () => {
    if (session && canAdmin) {
      unlockSession(session.id);
      addTimelineEntry(session.id, '解锁会话', '解锁会话允许操作');
    }
  };

  const handleSkipToNextBatch = () => {
    if (!session) return;
    
    const nextStart = session.progress.currentBatchEnd + 1;
    const nextEnd = Math.min(nextStart + session.progress.batchSize - 1, session.progress.totalRows);
    
    setBatchStart(nextStart);
    setBatchEnd(nextEnd);
  };

  const toggleRowExpand = (rowIndex: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowIndex)) {
      newExpanded.delete(rowIndex);
    } else {
      newExpanded.add(rowIndex);
    }
    setExpandedRows(newExpanded);
  };

  const handleCellEdit = (rowIndex: number, field: string, currentValue: string) => {
    setEditingCell({ rowIndex, field });
    setEditValue(currentValue);
  };

  const handleCellSave = () => {
    if (editingCell && session && canWrite) {
      correctSessionRow(session.id, editingCell.rowIndex, { [editingCell.field]: editValue });
      addTimelineEntry(session.id, '修正数据', `修正第 ${editingCell.rowIndex} 行 ${editingCell.field}`, editingCell.rowIndex);
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleClearEditing = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleRecheckRow = (rowIndex: number) => {
    if (!session) return;
    
    const row = session.rowStates.find(r => r.rowIndex === rowIndex);
    if (row) {
      const data = row.correctedData || row.originalData;
      correctSessionRow(session.id, rowIndex, data);
    }
  };

  const handleConflictDecision = (rowIndex: number, resolution: 'skip' | 'overwrite' | 'new') => {
    if (session && canWrite) {
      setSessionConflictResolution(session.id, rowIndex, resolution);
      addTimelineEntry(session.id, '冲突处理', `第 ${rowIndex} 行冲突决策: ${resolution === 'skip' ? '跳过' : resolution === 'overwrite' ? '覆盖' : '新建'}`, rowIndex);
    }
  };

  const handleResolveAllConflicts = (resolution: 'skip' | 'overwrite' | 'new') => {
    if (!session || !canWrite) return;
    
    const conflictRows = session.rowStates.filter(r => 
      r.errors.some(e => e.type === 'ORDER_EXISTS' || e.type === 'DUPLICATE_ORDER_NO') &&
      !r.conflictResolution
    );
    
    conflictRows.forEach(row => {
      setSessionConflictResolution(session.id, row.rowIndex, resolution);
    });
    
    addTimelineEntry(session.id, '批量冲突处理', `批量处理 ${conflictRows.length} 个冲突，策略: ${resolution === 'skip' ? '跳过' : resolution === 'overwrite' ? '覆盖' : '新建'}`, undefined, conflictRows.length);
  };

  if (!session) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800/95 rounded-2xl border border-slate-700/50 p-8 text-center">
          <p className="text-slate-400">会话不存在或已被删除</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg">
            返回
          </button>
        </div>
      </div>
    );
  }

  const hasUnresolvedConflicts = session.conflictSummary.unresolved > 0;
  const hasErrors = stats.error > 0;
  const hasPending = stats.pending > 0;
  const hasImported = stats.imported > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/95 rounded-2xl border border-slate-700/50 w-full max-w-7xl max-h-[95vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-100">导入会话详情</h2>
                  {session.isLocked && (
                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      已锁定
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                  <span>{session.fileName}</span>
                  <span>•</span>
                  <span>操作员: {session.operator}</span>
                  <span>•</span>
                  <span>角色: {ROLE_LABELS[session.role]}</span>
                  <span>•</span>
                  <span>创建时间: {new Date(session.createdAt).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canAdmin && (
                <button
                  onClick={session.isLocked ? handleUnlock : handleLock}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    session.isLocked 
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                      : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  )}
                  title={session.isLocked ? '解锁会话' : '锁定会话'}
                >
                  {session.isLocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </button>
              )}
              <button
                onClick={() => setShowLogs(!showLogs)}
                className={clsx(
                  'p-2 rounded-lg transition-colors',
                  showLogs ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-slate-700/50 text-slate-400'
                )}
                title="操作日志"
              >
                <History className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {showLogs && (
          <div className="border-b border-slate-700/50 bg-slate-900/50 max-h-64 overflow-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">操作日志</h3>
              <div className="space-y-2">
                {session.operationLogs.slice().reverse().map(log => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <Clock className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-slate-300">{log.details}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(log.timestamp).toLocaleString('zh-CN')} 
                        {log.rowIndex && ` - 第${log.rowIndex}行`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 shrink-0">
          <div className="grid grid-cols-7 gap-4 mb-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400">有效</span>
              </div>
              <div className="text-2xl font-bold text-green-400">{stats.valid}</div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-yellow-400">警告</span>
              </div>
              <div className="text-2xl font-bold text-yellow-400">{stats.warning}</div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">错误</span>
              </div>
              <div className="text-2xl font-bold text-red-400">{stats.error}</div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-400">待处理</span>
              </div>
              <div className="text-2xl font-bold text-blue-400">{stats.pending}</div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">已导入</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400">{stats.imported}</div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-purple-400">自动补号</span>
              </div>
              <div className="text-2xl font-bold text-purple-400">{stats.autoFixed}</div>
            </div>
            <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">批次进度</span>
              </div>
              <div className="text-2xl font-bold text-slate-400">
                {session.progress.processedRows}/{session.progress.totalRows}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 w-48"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={clsx(
                  'p-2 rounded-lg transition-colors',
                  showFilters ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                )}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRecheckAll}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                重新验证
              </button>
              <button
                onClick={handleAutoFill}
                disabled={stats.pending === 0 || !canWrite}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  stats.pending === 0 || !canWrite
                    ? 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                    : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400'
                )}
              >
                <Zap className="w-4 h-4" />
                自动补号
              </button>
              <button
                onClick={handleExportErrors}
                disabled={stats.error === 0 && stats.failed === 0}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  stats.error === 0 && stats.failed === 0
                    ? 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                    : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                )}
              >
                <Download className="w-4 h-4" />
                导出错误
              </button>
              <button
                onClick={() => setShowBatchModal(true)}
                disabled={stats.pending === 0 || !canWrite}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  stats.pending === 0 || !canWrite
                    ? 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                    : 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400'
                )}
              >
                <SkipForward className="w-4 h-4" />
                分批导入
              </button>
              {session.status === 'in_progress' ? (
                <button
                  onClick={handlePause}
                  disabled={importing || !canWrite}
                  className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  暂停
                </button>
              ) : (
                <button
                  onClick={hasUnresolvedConflicts ? handleResume : handleImportBatch}
                  disabled={stats.pending === 0 || importing || !canWrite}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    stats.pending === 0 || importing || !canWrite
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  )}
                >
                  <Play className="w-4 h-4" />
                  {importing ? '导入中...' : (hasUnresolvedConflicts ? '继续处理' : '导入批次')}
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showValid}
                    onChange={(e) => setShowValid(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
                  />
                  显示有效行
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWarning}
                    onChange={(e) => setShowWarning(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-yellow-500 focus:ring-yellow-500"
                  />
                  显示警告行
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showError}
                    onChange={(e) => setShowError(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500"
                  />
                  显示错误行
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPending}
                    onChange={(e) => setShowPending(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  显示待处理
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showImported}
                    onChange={(e) => setShowImported(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  显示已导入
                </label>
              </div>
            </div>
          )}
        </div>

        {(hasUnresolvedConflicts || hasErrors) && (
          <div className="p-4 bg-yellow-500/10 border-b border-yellow-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {hasUnresolvedConflicts && (
                  <div className="flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">存在 {session.conflictSummary.unresolved} 个未解决的冲突</span>
                  </div>
                )}
                {hasErrors && hasUnresolvedConflicts && <span className="text-slate-500">|</span>}
                {hasErrors && (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">存在 {stats.error} 个错误行</span>
                  </div>
                )}
              </div>
              {hasUnresolvedConflicts && canWrite && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResolveAllConflicts('skip')}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                  >
                    全部跳过
                  </button>
                  <button
                    onClick={() => handleResolveAllConflicts('overwrite')}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                  >
                    全部覆盖
                  </button>
                  <button
                    onClick={() => handleResolveAllConflicts('new')}
                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    全部新建
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {filteredRows.map(row => (
              <SessionRowCard
                key={row.rowIndex}
                row={row}
                isExpanded={expandedRows.has(row.rowIndex)}
                onToggleExpand={() => toggleRowExpand(row.rowIndex)}
                editingCell={editingCell}
                editValue={editValue}
                onCellEdit={handleCellEdit}
                onCellSave={handleCellSave}
                onEditValueChange={setEditValue}
                onClearEditing={handleClearEditing}
                onRowRecheck={() => handleRecheckRow(row.rowIndex)}
                onConflictDecision={(resolution) => handleConflictDecision(row.rowIndex, resolution)}
                session={session}
                stores={stores}
                engineers={engineers}
                canWrite={canWrite}
              />
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-700/50 bg-slate-800/50 shrink-0">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <div className="flex items-center gap-4">
              <span>会话自动保存，刷新页面后可继续处理</span>
              <span className="text-slate-500">|</span>
              <span>当前状态: {session.status === 'draft' ? '草稿' : 
                               session.status === 'in_progress' ? '进行中' :
                               session.status === 'paused' ? '已暂停' :
                               session.status === 'partially_completed' ? '部分完成' :
                               session.status === 'completed' ? '已完成' : '失败'}</span>
            </div>
            <div className="flex items-center gap-4">
              <span>批次大小: {session.progress.batchSize} 行</span>
              <span>当前批次: {session.progress.currentBatchStart}-{session.progress.currentBatchEnd}</span>
              {hasImported && hasPending && (
                <button
                  onClick={handleResume}
                  disabled={!canWrite}
                  className={clsx(
                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors',
                    !canWrite ? 'bg-slate-700/30 text-slate-500' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                  )}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  继续导入剩余
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showBatchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60 p-4">
          <div className="bg-slate-800/95 rounded-xl border border-slate-700/50 w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-4">分批导入设置</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">起始行号</label>
                <input
                  type="number"
                  min="1"
                  max={session.progress.totalRows}
                  value={batchStart}
                  onChange={handleBatchStartChange}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">结束行号</label>
                <input
                  type="number"
                  min={batchStart}
                  max={session.progress.totalRows}
                  value={batchEnd}
                  onChange={handleBatchEndChange}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSkipToNextBatch}
                  className="flex-1 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                  下一批次
                </button>
                <button
                  onClick={() => {
                    setBatchStart(session.progress.currentBatchStart);
                    setBatchEnd(session.progress.currentBatchEnd);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                  当前批次
                </button>
              </div>

              <div className="p-3 bg-slate-900/50 rounded-lg text-sm text-slate-400">
                将导入第 <span className="text-blue-400 font-medium">{batchStart}</span> - <span className="text-blue-400 font-medium">{batchEnd}</span> 行，共 <span className="text-green-400 font-medium">{batchEnd - batchStart + 1}</span> 行
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowBatchModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCustomBatchImport}
                disabled={importing}
                className={clsx(
                  'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  importing ? 'bg-slate-600 text-slate-400' : 'bg-green-500 hover:bg-green-600 text-white'
                )}
              >
                {importing ? '导入中...' : '开始导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SessionRowCardProps {
  row: SessionRowState;
  isExpanded: boolean;
  onToggleExpand: () => void;
  editingCell: { rowIndex: number; field: string } | null;
  editValue: string;
  onCellEdit: (rowIndex: number, field: string, value: string) => void;
  onCellSave: () => void;
  onEditValueChange: (value: string) => void;
  onClearEditing: () => void;
  onRowRecheck: () => void;
  onConflictDecision: (resolution: 'skip' | 'overwrite' | 'new') => void;
  session: ImportSession;
  stores: any[];
  engineers: any[];
  canWrite: boolean;
}

function SessionRowCard({
  row,
  isExpanded,
  onToggleExpand,
  editingCell,
  editValue,
  onCellEdit,
  onCellSave,
  onEditValueChange,
  onClearEditing,
  onRowRecheck,
  onConflictDecision,
  session,
  stores,
  engineers,
  canWrite,
}: SessionRowCardProps) {
  const data = row.correctedData || row.originalData;

  const getStatusColor = () => {
    if (row.importStatus === 'imported') return 'border-emerald-500/30 bg-emerald-500/5';
    switch (row.validationStatus) {
      case 'valid': return 'border-green-500/30 bg-green-500/5';
      case 'warning': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'error': return 'border-red-500/30 bg-red-500/5';
      default: return 'border-slate-700/50';
    }
  };

  const getStatusIcon = () => {
    if (row.importStatus === 'imported') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    switch (row.validationStatus) {
      case 'valid': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return null;
    }
  };

  const hasConflict = row.errors.some(e => e.type === 'ORDER_EXISTS' || e.type === 'DUPLICATE_ORDER_NO');

  return (
    <div className={clsx('border rounded-xl overflow-hidden transition-colors', getStatusColor())}>
      <div 
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-700/20"
        onClick={onToggleExpand}
      >
        <button className="p-1 hover:bg-slate-600/50 rounded">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>

        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium text-slate-300">第{row.rowIndex}行</span>
          {row.importStatus === 'imported' && (
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs">
              已导入
            </span>
          )}
          {row.importStatus === 'failed' && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">
              导入失败
            </span>
          )}
        </div>

        <div className="flex-1 flex items-center gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-1">
            <span className="text-slate-500">门店:</span>
            <span className="text-slate-300">{data['门店名称'] || '-'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">设备:</span>
            <span className="text-slate-300">{data['设备类型'] || '-'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">工单号:</span>
            <span className="text-slate-300">
              {data['工单号'] || row.autoGeneratedOrderNo || (
                <span className="text-blue-400 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> 待生成
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">状态:</span>
            <span className="text-slate-300">{data['状态'] || '待派工'}</span>
          </div>
        </div>

        {hasConflict && !row.conflictResolution && (
          <div className="flex items-center gap-1 text-xs text-yellow-400">
            <AlertTriangle className="w-3 h-3" />
            未解决冲突
          </div>
        )}

        {row.errors.length > 0 && !hasConflict && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="w-3 h-3" />
            {row.errors[0].message}
          </div>
        )}

        {canWrite && (
          <button
            onClick={(e) => { e.stopPropagation(); onRowRecheck(); }}
            className="p-1.5 hover:bg-slate-600/50 rounded text-slate-400 hover:text-blue-400"
            title="重新验证此行"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-slate-700/30 p-4 bg-slate-800/30">
          {hasConflict && (
            <div className="mb-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <div className="text-sm text-yellow-400 mb-2">工单号冲突处理</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onConflictDecision('skip')}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm transition-colors',
                    row.conflictResolution === 'skip'
                      ? 'bg-yellow-500 text-slate-900'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  )}
                >
                  跳过
                </button>
                <button
                  onClick={() => onConflictDecision('overwrite')}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm transition-colors',
                    row.conflictResolution === 'overwrite'
                      ? 'bg-yellow-500 text-slate-900'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  )}
                >
                  覆盖
                </button>
                <button
                  onClick={() => onConflictDecision('new')}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm transition-colors',
                    row.conflictResolution === 'new'
                      ? 'bg-yellow-500 text-slate-900'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  )}
                >
                  新建
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TARGET_HEADERS.map(field => {
              const isEditing = editingCell?.rowIndex === row.rowIndex && editingCell?.field === field;
              const currentValue = data[field] || '';
              
              return (
                <div key={field} className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">{field}</label>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      {field === '状态' ? (
                        <select
                          value={editValue}
                          onChange={(e) => onEditValueChange(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700/50 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                          autoFocus
                        >
                          <option value="">请选择状态</option>
                          {STATUS_OPTIONS.map(status => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      ) : field === '门店名称' ? (
                        <select
                          value={editValue}
                          onChange={(e) => onEditValueChange(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700/50 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                          autoFocus
                        >
                          <option value="">请选择门店</option>
                          {stores.map(store => (
                            <option key={store.id} value={store.name}>{store.name}</option>
                          ))}
                        </select>
                      ) : field === '工程师' ? (
                        <select
                          value={editValue}
                          onChange={(e) => onEditValueChange(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700/50 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                          autoFocus
                        >
                          <option value="">不指定工程师</option>
                          {engineers.map(engineer => (
                            <option key={engineer.id} value={engineer.name}>{engineer.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field === '联系电话' ? 'tel' : 'text'}
                          value={editValue}
                          onChange={(e) => onEditValueChange(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700/50 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                          autoFocus
                        />
                      )}
                      <button
                        onClick={onCellSave}
                        className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-green-400"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={onClearEditing}
                        className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-slate-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      className={clsx(
                        'flex items-center gap-2 px-3 py-2 bg-slate-900/50 border rounded-lg cursor-pointer hover:border-slate-600/50 transition-colors group',
                        canWrite ? 'hover:border-slate-600/50' : 'cursor-default',
                        row.validationStatus === 'error' ? 'border-red-500/30' : 'border-slate-700/30'
                      )}
                      onClick={() => canWrite && onCellEdit(row.rowIndex, field, currentValue)}
                    >
                      <span className={clsx(
                        'flex-1 text-sm',
                        currentValue ? 'text-slate-200' : 'text-slate-500 italic'
                      )}>
                        {currentValue || (field === '期望上门时间' ? '必填' : '-')}
                      </span>
                      {field === '工单号' && !currentValue && !row.autoGeneratedOrderNo && (
                        <Hash className="w-3.5 h-3.5 text-blue-400" />
                      )}
                      {field === '工单号' && row.autoGeneratedOrderNo && (
                        <span className="text-xs text-blue-400">自动生成</span>
                      )}
                      {canWrite && (
                        <span className="text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          点击编辑
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {row.errors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700/30">
              <div className="text-xs font-medium text-slate-400 mb-2">问题列表：</div>
              <div className="space-y-1">
                {row.errors.map((error, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <AlertCircle className={clsx(
                      'w-3.5 h-3.5 mt-0.5 shrink-0',
                      error.type.startsWith('MISSING') || error.type === 'INVALID_STORE' 
                        ? 'text-red-400' 
                        : 'text-yellow-400'
                    )} />
                    <span className="text-slate-300">
                      <span className="text-slate-400">{error.field}:</span> {error.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {row.autoGeneratedOrderNo && (
            <div className="mt-4 pt-4 border-t border-slate-700/30">
              <div className="text-xs font-medium text-blue-400 mb-1">自动生成工单号：</div>
              <div className="text-sm text-blue-300 font-mono">{row.autoGeneratedOrderNo}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}