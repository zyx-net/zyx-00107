import { useStore } from '../store/useStore';
import { RowValidationResult } from '../types';
import { 
  X, 
  AlertTriangle, 
  CheckCircle, 
  Download, 
  FileSpreadsheet, 
  Upload,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  Clock,
  Hash,
  User,
  Check,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect, useMemo } from 'react';

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  csvData: string[][];
  fileName: string;
}

const TARGET_HEADERS = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号', '工程师'];
const STATUS_OPTIONS = ['待派工', '已派工', '维修中', '待回访', '已完成', '已撤销'];

export function ImportPreviewModal({ isOpen, onClose, csvData, fileName }: ImportPreviewModalProps) {
  const { 
    createImportDraft, 
    currentImportDraft, 
    updateImportDraft,
    clearImportDraft,
    validateRow,
    validateAllRows,
    correctRow,
    setConflictResolution,
    importPartialOrders,
    workOrders,
    stores,
    engineers
  } = useStore();

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [importResult, setImportResult] = useState<{ 
    success: boolean; 
    result?: any; 
    error?: string 
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (isOpen && csvData.length > 1) {
      const originalHeaders = csvData[0];
      const headerMapping: Record<number, number> = {};
      
      originalHeaders.forEach((header, index) => {
        const normalizedHeader = header.trim();
        const targetIndex = TARGET_HEADERS.findIndex(h => 
          normalizedHeader.includes(h) || h.includes(normalizedHeader)
        );
        if (targetIndex !== -1) {
          headerMapping[index] = targetIndex;
        }
      });

      createImportDraft(
        fileName,
        originalHeaders,
        csvData,
        TARGET_HEADERS,
        headerMapping
      );
    }

    return () => {
      if (!importResult?.success) {
        // 只有导入成功后才清除草稿
      }
    };
  }, [isOpen]);

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
    if (editingCell) {
      correctRow(editingCell.rowIndex, { [editingCell.field]: editValue });
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleRowRecheck = (rowIndex: number) => {
    const rowResultIndex = rowIndex - 1;
    if (currentImportDraft?.rowResults[rowResultIndex]) {
      const currentResult = currentImportDraft.rowResults[rowResultIndex];
      const correctedData = currentResult.correctedData || currentResult.originalData;
      validateRow(rowIndex, correctedData);
    }
  };

  const handleRecheckAll = () => {
    validateAllRows();
  };

  const handleImport = () => {
    if (!currentImportDraft) return;

    const rowsToImport: number[] = [];
    const rowsToSkip: number[] = [];

    currentImportDraft.rowResults.forEach((result, index) => {
      const rowIndex = index + 1;
      if (result.status === 'valid' || result.status === 'warning') {
        rowsToImport.push(rowIndex);
      } else {
        rowsToSkip.push(rowIndex);
      }
    });

    const result = importPartialOrders(rowsToImport, rowsToSkip);
    setImportResult(result);
  };

  const handleImportSelected = () => {
    if (!currentImportDraft) return;

    const rowsToImport: number[] = [];
    const rowsToSkip: number[] = [];

    currentImportDraft.rowResults.forEach((result, index) => {
      const rowIndex = index + 1;
      const isSelected = document.querySelector(`[data-row="${rowIndex}"]`)?.getAttribute('data-selected') === 'true';
      
      if (isSelected) {
        rowsToImport.push(rowIndex);
      } else {
        rowsToSkip.push(rowIndex);
      }
    });

    const result = importPartialOrders(rowsToImport, rowsToSkip);
    setImportResult(result);
  };

  const handleDiscard = () => {
    clearImportDraft();
    onClose();
  };

  const handleDownloadErrors = () => {
    if (!currentImportDraft) return;

    const errorRows = currentImportDraft.rowResults.filter(r => r.status === 'error' || r.status === 'warning');
    const headers = ['行号', '字段', '错误类型', '错误信息', ...TARGET_HEADERS];
    
    const escapeCsvField = (field: string | null | undefined): string => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = errorRows.map(result => {
      const data = result.correctedData || result.originalData;
      const firstError = result.errors[0];
      return [
        String(result.rowIndex),
        escapeCsvField(firstError?.field || ''),
        escapeCsvField(firstError?.type || ''),
        escapeCsvField(firstError?.message || ''),
        ...TARGET_HEADERS.map(h => escapeCsvField(data[h] || '')),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `导入失败明细_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredResults = useMemo(() => {
    if (!currentImportDraft) return [];
    
    const { showValid, showWarning, showError, searchKeyword } = currentImportDraft.filters;
    
    return currentImportDraft.rowResults.filter(result => {
      if (result.status === 'valid' && !showValid) return false;
      if (result.status === 'warning' && !showWarning) return false;
      if (result.status === 'error' && !showError) return false;
      
      if (searchKeyword) {
        const data = result.correctedData || result.originalData;
        const searchLower = searchKeyword.toLowerCase();
        return Object.values(data).some(v => 
          String(v).toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
  }, [currentImportDraft?.rowResults, currentImportDraft?.filters]);

  const stats = useMemo(() => {
    if (!currentImportDraft) return { valid: 0, warning: 0, error: 0 };
    
    return currentImportDraft.rowResults.reduce((acc, result) => {
      acc[result.status]++;
      return acc;
    }, { valid: 0, warning: 0, error: 0 });
  }, [currentImportDraft?.rowResults]);

  const handleClose = () => {
    if (!importResult?.success) {
      // 草稿已自动保存，不用手动保存
    }
    clearImportDraft();
    onClose();
  };

  if (!isOpen) return null;

  if (importResult?.success) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800/95 rounded-2xl border border-slate-700/50 w-full max-w-lg overflow-hidden shadow-2xl">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">导入完成</h3>
            <p className="text-slate-400 mb-6">
              成功导入 <span className="text-green-400 font-semibold">{importResult.result?.successCount || 0}</span> 条工单
              {importResult.result?.skippedCount > 0 && (
                <span className="text-yellow-400">，跳过 {importResult.result.skippedCount} 条</span>
              )}
            </p>
            <div className="bg-slate-900/50 rounded-xl p-4 mb-6 text-left">
              <div className="text-sm text-slate-300 space-y-2">
                {importResult.result?.importedOrderNos?.length > 0 && (
                  <div>
                    <div className="text-slate-400 mb-1">已导入工单号：</div>
                    <div className="flex flex-wrap gap-1">
                      {importResult.result.importedOrderNos.slice(0, 10).map((no: string) => (
                        <span key={no} className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                          {no}
                        </span>
                      ))}
                      {importResult.result.importedOrderNos.length > 10 && (
                        <span className="text-slate-500 text-xs">...等{importResult.result.importedOrderNos.length}条</span>
                      )}
                    </div>
                  </div>
                )}
                {importResult.result?.skippedOrderNos?.length > 0 && (
                  <div>
                    <div className="text-slate-400 mb-1">已跳过：</div>
                    <div className="flex flex-wrap gap-1">
                      {importResult.result.skippedOrderNos.slice(0, 5).map((no: string) => (
                        <span key={no} className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                          {no}
                        </span>
                      ))}
                      {importResult.result.skippedOrderNos.length > 5 && (
                        <span className="text-slate-500 text-xs">...等{importResult.result.skippedOrderNos.length}条</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            >
              完成
            </button>
          </div>
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
                <h2 className="text-xl font-bold text-slate-100">导入预览</h2>
                <p className="text-sm text-slate-400">{fileName}（共 {csvData.length - 1} 条数据）</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-slate-300">有效 <span className="text-green-400 font-medium">{stats.valid}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span className="text-slate-300">警告 <span className="text-yellow-400 font-medium">{stats.warning}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-slate-300">错误 <span className="text-red-400 font-medium">{stats.error}</span></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索..."
                  value={currentImportDraft?.filters.searchKeyword || ''}
                  onChange={(e) => updateImportDraft({ 
                    filters: { 
                      ...currentImportDraft!.filters, 
                      searchKeyword: e.target.value 
                    } 
                  })}
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

              {showFilters && (
                <div className="absolute right-0 top-full mt-2 bg-slate-800 border border-slate-700/50 rounded-xl p-3 shadow-xl z-10">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentImportDraft?.filters.showValid ?? true}
                        onChange={(e) => updateImportDraft({ 
                          filters: { 
                            ...currentImportDraft!.filters, 
                            showValid: e.target.checked 
                          } 
                        })}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                      />
                      显示有效行
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentImportDraft?.filters.showWarning ?? true}
                        onChange={(e) => updateImportDraft({ 
                          filters: { 
                            ...currentImportDraft!.filters, 
                            showWarning: e.target.checked 
                          } 
                        })}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-yellow-500 focus:ring-yellow-500"
                      />
                      显示警告行
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentImportDraft?.filters.showError ?? true}
                        onChange={(e) => updateImportDraft({ 
                          filters: { 
                            ...currentImportDraft!.filters, 
                            showError: e.target.checked 
                          } 
                        })}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500"
                      />
                      显示错误行
                    </label>
                  </div>
                </div>
              )}

              <button
                onClick={handleRecheckAll}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重新验证
              </button>

              <button
                onClick={handleDownloadErrors}
                disabled={stats.error === 0 && stats.warning === 0}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  stats.error === 0 && stats.warning === 0
                    ? 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
                )}
              >
                <Download className="w-4 h-4" />
                导出错误
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {filteredResults.map((result) => (
              <RowCard
                key={result.rowIndex}
                result={result}
                isExpanded={expandedRows.has(result.rowIndex)}
                onToggleExpand={() => toggleRowExpand(result.rowIndex)}
                editingCell={editingCell}
                editValue={editValue}
                onCellEdit={handleCellEdit}
                onCellSave={() => handleCellSave()}
                onEditValueChange={setEditValue}
                onRowRecheck={() => handleRowRecheck(result.rowIndex)}
                headerMapping={currentImportDraft?.headerMapping || {}}
                csvRow={csvData[result.rowIndex]}
                stores={stores}
                engineers={engineers}
              />
            ))}

            {filteredResults.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                没有匹配的数据行
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-700/50 bg-slate-800/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">
              草稿已自动保存，刷新页面后可继续编辑
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDiscard}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
              >
                放弃
              </button>
              <button
                onClick={handleImport}
                disabled={stats.valid === 0 && stats.warning === 0}
                className={clsx(
                  'flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors',
                  stats.valid === 0 && stats.warning === 0
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                )}
              >
                <Upload className="w-4 h-4" />
                {stats.valid === 0 && stats.warning === 0
                  ? '无可导入数据'
                  : `导入 ${stats.valid + stats.warning} 行`
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RowCardProps {
  result: RowValidationResult;
  isExpanded: boolean;
  onToggleExpand: () => void;
  editingCell: { rowIndex: number; field: string } | null;
  editValue: string;
  onCellEdit: (rowIndex: number, field: string, value: string) => void;
  onCellSave: () => void;
  onEditValueChange: (value: string) => void;
  onRowRecheck: () => void;
  headerMapping: Record<number, number>;
  csvRow: string[];
  stores: any[];
  engineers: any[];
}

function RowCard({
  result,
  isExpanded,
  onToggleExpand,
  editingCell,
  editValue,
  onCellEdit,
  onCellSave,
  onEditValueChange,
  onRowRecheck,
  headerMapping,
  csvRow,
  stores,
  engineers
}: RowCardProps) {
  const getMappedValue = (fieldName: string): string => {
    const targetIndex = TARGET_HEADERS.indexOf(fieldName);
    if (targetIndex === -1) return '';
    
    for (const [origIdx, tgtIdx] of Object.entries(headerMapping)) {
      if (tgtIdx === targetIndex) {
        return csvRow[parseInt(origIdx)]?.trim() || '';
      }
    }
    return '';
  };

  const data = result.correctedData || result.originalData;
  
  const getStatusColor = () => {
    switch (result.status) {
      case 'valid': return 'border-green-500/30 bg-green-500/5';
      case 'warning': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'error': return 'border-red-500/30 bg-red-500/5';
      default: return 'border-slate-700/50';
    }
  };

  const getStatusIcon = () => {
    switch (result.status) {
      case 'valid': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return null;
    }
  };

  return (
    <div className={clsx(
      'border rounded-xl overflow-hidden transition-colors',
      getStatusColor()
    )}>
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
          <span className="text-sm font-medium text-slate-300">第{result.rowIndex}行</span>
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
            <span className="text-slate-300">{data['工单号'] || '(自动)'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">状态:</span>
            <span className="text-slate-300">{data['状态'] || '待派工'}</span>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="w-3 h-3" />
            {result.errors[0].message}
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRowRecheck();
          }}
          className="p-1.5 hover:bg-slate-600/50 rounded text-slate-400 hover:text-blue-400"
          title="重新验证此行"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-700/30 p-4 bg-slate-800/30">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TARGET_HEADERS.map((field) => {
              const isEditing = editingCell?.rowIndex === result.rowIndex && editingCell?.field === field;
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
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingCell(null);
                          setEditValue('');
                        }}
                        className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-slate-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 border border-slate-700/30 rounded-lg cursor-pointer hover:border-slate-600/50 transition-colors group"
                      onClick={() => onCellEdit(result.rowIndex, field, currentValue)}
                    >
                      <span className={clsx(
                        'flex-1 text-sm',
                        currentValue ? 'text-slate-200' : 'text-slate-500 italic'
                      )}>
                        {currentValue || (field === '期望上门时间' ? '必填' : '-')}
                      </span>
                      {field === '期望上门时间' && !currentValue && (
                        <Clock className="w-3.5 h-3.5 text-red-400" />
                      )}
                      {field === '工单号' && !currentValue && (
                        <Hash className="w-3.5 h-3.5 text-blue-400" title="将自动生成" />
                      )}
                      {field === '工程师' && !currentValue && (
                        <User className="w-3.5 h-3.5 text-slate-500" />
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

          {result.errors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700/30">
              <div className="text-xs font-medium text-slate-400 mb-2">问题列表：</div>
              <div className="space-y-1">
                {result.errors.map((error, idx) => (
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

          {result.autoFixed && result.autoFixed.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700/30">
              <div className="text-xs font-medium text-slate-400 mb-2">已自动修复：</div>
              <div className="flex flex-wrap gap-1">
                {result.autoFixed.map((fix, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                    {fix}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
