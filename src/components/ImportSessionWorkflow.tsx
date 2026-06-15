import { useStore } from '../store/useStore';
import { SessionRowState, ImportSession } from '../types';
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
  FileSpreadsheet
} from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect, useMemo } from 'react';

interface ImportSessionWorkflowProps {
  sessionId: string;
  onClose: () => void;
}

const TARGET_HEADERS = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号', '工程师'];
const STATUS_OPTIONS = ['待派工', '已派工', '维修中', '待回访', '已完成', '已撤销'];

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
    stores,
    engineers
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

  const session = getActiveSession();

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
    };
  }, [session]);

  const handleAutoFill = () => {
    if (session) {
      autoFillMissingOrderNos(session.id);
    }
  };

  const handleImportBatch = async () => {
    if (!session || importing) return;
    
    setImporting(true);
    
    try {
      const result = importSessionBatch(session.id);
      
      if (result.conflicts.length > 0) {
        alert(`存在 ${result.conflicts.length} 个未解决的冲突，请先处理冲突后再继续导入`);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleResume = async () => {
    if (!session || importing) return;
    
    setImporting(true);
    
    try {
      resumeSession(session.id);
    } finally {
      setImporting(false);
    }
  };

  const handlePause = () => {
    if (session) {
      pauseSession(session.id);
    }
  };

  const handleExportErrors = () => {
    if (session) {
      exportSessionErrors(session.id);
    }
  };

  const handleRecheckAll = () => {
    if (session) {
      validateSessionAllRows(session.id);
    }
  };

  const handleClearErrors = () => {
    if (!session) return;
    
    const errorRows = session.rowStates
      .filter(r => r.validationStatus === 'error')
      .map(r => r.rowIndex);
    
    if (errorRows.length > 0) {
      clearSessionErrors(session.id, errorRows);
    }
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
    if (editingCell && session) {
      correctSessionRow(session.id, editingCell.rowIndex, { [editingCell.field]: editValue });
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

  if (!session) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800/95 rounded-2xl border border-slate-700/50 p-8 text-center">
          <p className="text-slate-400">会话不存在</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg">
            关闭
          </button>
        </div>
      </div>
    );
  }

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
                <h2 className="text-xl font-bold text-slate-100">导入会话详情</h2>
                <p className="text-sm text-slate-400">{session.fileName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
          <div className="grid grid-cols-6 gap-4 mb-4">
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
            <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
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
                <RefreshCw className="w-4 h-4" />
                重新验证
              </button>
              <button
                onClick={handleAutoFill}
                disabled={stats.pending === 0}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  stats.pending === 0
                    ? 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                    : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400'
                )}
              >
                <Zap className="w-4 h-4" />
                自动补号
              </button>
              <button
                onClick={handleExportErrors}
                disabled={stats.error === 0}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  stats.error === 0
                    ? 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
                )}
              >
                <Download className="w-4 h-4" />
                导出错误
              </button>
              {session.status === 'in_progress' ? (
                <button
                  onClick={handlePause}
                  disabled={importing}
                  className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  暂停
                </button>
              ) : (
                <button
                  onClick={handleImportBatch}
                  disabled={stats.pending === 0 || importing}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    stats.pending === 0 || importing
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  )}
                >
                  <Play className="w-4 h-4" />
                  {importing ? '导入中...' : '导入批次'}
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
                session={session}
                stores={stores}
                engineers={engineers}
              />
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-700/50 bg-slate-800/50 shrink-0">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>会话自动保存，刷新页面后可继续处理</span>
            <span>批次大小: {session.progress.batchSize} 行</span>
          </div>
        </div>
      </div>
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
  session: ImportSession;
  stores: any[];
  engineers: any[];
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
  session,
  stores,
  engineers,
}: SessionRowCardProps) {
  const data = row.correctedData || row.originalData;
  const { setSessionConflictResolution } = useStore();

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

  const handleConflictDecision = (resolution: 'skip' | 'overwrite' | 'new') => {
    setSessionConflictResolution(session.id, row.rowIndex, resolution);
  };

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

        {row.importStatus === 'imported' && (
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs">
            已导入
          </span>
        )}

        {row.errors.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="w-3 h-3" />
            {row.errors[0].message}
          </div>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onRowRecheck(); }}
          className="p-1.5 hover:bg-slate-600/50 rounded text-slate-400 hover:text-blue-400"
          title="重新验证此行"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-700/30 p-4 bg-slate-800/30">
          {row.errors.some(e => e.type === 'ORDER_EXISTS') && (
            <div className="mb-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <div className="text-sm text-yellow-400 mb-2">工单号冲突处理</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleConflictDecision('skip')}
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
                  onClick={() => handleConflictDecision('overwrite')}
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
                  onClick={() => handleConflictDecision('new')}
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
                      className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 border border-slate-700/30 rounded-lg cursor-pointer hover:border-slate-600/50 transition-colors group"
                      onClick={() => onCellEdit(row.rowIndex, field, currentValue)}
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
                      <span className="text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        点击编辑
                      </span>
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
