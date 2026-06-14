import { useStore } from '../store/useStore';
import { ImportError } from '../types';
import { X, AlertTriangle, CheckCircle, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { clsx } from 'clsx';
import { useState } from 'react';

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  csvData: string[][];
  fileName: string;
}

export function ImportPreviewModal({ isOpen, onClose, csvData, fileName }: ImportPreviewModalProps) {
  const { validateImportData, importOrders } = useStore();
  const [importResult, setImportResult] = useState<{ success: boolean; result?: any; error?: string } | null>(null);

  if (!isOpen) return null;

  const { valid, errors, validOrders } = validateImportData(csvData);
  const dataRows = csvData.slice(1);
  const blockingErrors = errors.filter(e => 
    e.type === 'MISSING_STORE' || 
    e.type === 'MISSING_EQUIPMENT' || 
    e.type === 'MISSING_DESCRIPTION' ||
    e.type === 'INVALID_STORE' ||
    e.type === 'INVALID_DATE_FORMAT' ||
    e.type === 'DUPLICATE_ORDER_NO'
  );
  const warningErrors = errors.filter(e => e.type === 'ORDER_EXISTS');
  const softErrors = errors.filter(e => 
    e.type === 'MISSING_CONTACT' || 
    e.type === 'MISSING_VISIT_TIME' ||
    e.type === 'INVALID_STATUS'
  );

  const handleConfirmImport = () => {
    const result = importOrders(csvData);
    setImportResult(result);
  };

  const handleDownloadErrors = () => {
    const headers = ['行号', '字段', '错误类型', '错误信息', '门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
    
    const escapeCsvField = (field: string | null | undefined): string => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = errors.map(err => [
      String(err.row),
      escapeCsvField(err.field),
      escapeCsvField(err.type),
      escapeCsvField(err.message),
      escapeCsvField(err.originalData['门店名称']),
      escapeCsvField(err.originalData['设备类型']),
      escapeCsvField(err.originalData['故障描述']),
      escapeCsvField(err.originalData['状态']),
      escapeCsvField(err.originalData['联系人']),
      escapeCsvField(err.originalData['联系电话']),
      escapeCsvField(err.originalData['期望上门时间']),
      escapeCsvField(err.originalData['工单号']),
    ].join(','));

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

  const handleClose = () => {
    setImportResult(null);
    onClose();
  };

  const getErrorIcon = (type: ImportError['type']) => {
    switch (type) {
      case 'MISSING_STORE':
      case 'MISSING_EQUIPMENT':
      case 'MISSING_DESCRIPTION':
      case 'INVALID_STORE':
      case 'INVALID_DATE_FORMAT':
      case 'DUPLICATE_ORDER_NO':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'ORDER_EXISTS':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    }
  };

  const getErrorTypeLabel = (type: ImportError['type']) => {
    const labels: Record<string, string> = {
      'MISSING_STORE': '缺少门店',
      'MISSING_EQUIPMENT': '缺少设备',
      'MISSING_DESCRIPTION': '缺少描述',
      'MISSING_CONTACT': '缺少联系人',
      'MISSING_VISIT_TIME': '缺少上门时间',
      'INVALID_STATUS': '状态无效',
      'DUPLICATE_ORDER_NO': '工单号重复',
      'ORDER_EXISTS': '工单已存在',
      'INVALID_STORE': '门店无效',
      'INVALID_DATE_FORMAT': '日期格式错误',
      'OTHER': '其他错误',
    };
    return labels[type] || type;
  };

  const getErrorColor = (type: ImportError['type']) => {
    switch (type) {
      case 'MISSING_STORE':
      case 'MISSING_EQUIPMENT':
      case 'MISSING_DESCRIPTION':
      case 'INVALID_STORE':
      case 'INVALID_DATE_FORMAT':
      case 'DUPLICATE_ORDER_NO':
        return 'bg-red-500/10 border-red-500/20';
      case 'ORDER_EXISTS':
        return 'bg-yellow-500/10 border-yellow-500/20';
      default:
        return 'bg-orange-500/10 border-orange-500/20';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/95 rounded-2xl border border-slate-700/50 w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">导入预览</h2>
                <p className="text-sm text-slate-400">{fileName}（共 {dataRows.length} 条数据）</p>
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

        {importResult ? (
          <div className="p-8 max-w-lg mx-auto text-center">
            {importResult.success ? (
              <>
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-100 mb-2">导入成功</h3>
                <p className="text-slate-400 mb-6">
                  成功导入 <span className="text-green-400 font-semibold">{importResult.result?.successCount || 0}</span> 条工单
                  {importResult.result?.failureCount > 0 && (
                    <span>，<span className="text-yellow-400">{importResult.result.failureCount}</span> 条失败</span>
                  )}
                </p>
                <button
                  onClick={handleClose}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
                >
                  完成
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-100 mb-2">导入失败</h3>
                <p className="text-slate-400 mb-2">{importResult.error}</p>
                {blockingErrors.length > 0 && (
                  <p className="text-sm text-slate-500 mb-6">阻断性错误：{blockingErrors.length} 个</p>
                )}
                {warningErrors.length > 0 && (
                  <p className="text-sm text-yellow-500 mb-6">覆盖警告：{warningErrors.length} 个</p>
                )}
                <button
                  onClick={handleClose}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-medium transition-colors"
                >
                  关闭
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {blockingErrors.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <h3 className="text-lg font-semibold text-red-400">
                      阻断性错误（{blockingErrors.length} 个）
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {blockingErrors.map((err, idx) => (
                      <div key={idx} className={clsx('p-3 rounded-lg border', getErrorColor(err.type))}>
                        <div className="flex items-start gap-3">
                          {getErrorIcon(err.type)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-400">第 {err.row} 行</span>
                              <span className="text-red-400 font-medium">{err.field}</span>
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-xs">
                                {getErrorTypeLabel(err.type)}
                              </span>
                            </div>
                            <p className="text-slate-300 mt-1">{err.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {warningErrors.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-semibold text-yellow-400">
                      工单覆盖警告（{warningErrors.length} 个）
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {warningErrors.map((err, idx) => (
                      <div key={idx} className={clsx('p-3 rounded-lg border', getErrorColor(err.type))}>
                        <div className="flex items-start gap-3">
                          {getErrorIcon(err.type)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-400">第 {err.row} 行</span>
                              <span className="text-yellow-400 font-medium">{err.field}</span>
                              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-xs">
                                {getErrorTypeLabel(err.type)}
                              </span>
                            </div>
                            <p className="text-slate-300 mt-1">{err.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {softErrors.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                    <h3 className="text-lg font-semibold text-orange-400">
                      提示性错误（{softErrors.length} 个，将使用默认值）
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {softErrors.map((err, idx) => (
                      <div key={idx} className={clsx('p-3 rounded-lg border', getErrorColor(err.type))}>
                        <div className="flex items-start gap-3">
                          {getErrorIcon(err.type)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-400">第 {err.row} 行</span>
                              <span className="text-orange-400 font-medium">{err.field}</span>
                              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded text-xs">
                                {getErrorTypeLabel(err.type)}
                              </span>
                            </div>
                            <p className="text-slate-300 mt-1">{err.message}，将自动填充默认值</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {valid && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <h3 className="text-lg font-semibold text-green-400">
                      验证通过（{validOrders.length} 条）
                    </h3>
                  </div>
                  <p className="text-slate-400">所有数据验证通过，可以导入</p>
                </div>
              )}

              <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="p-3 border-b border-slate-700/50 bg-slate-800/50">
                  <h4 className="text-sm font-medium text-slate-300">数据预览</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800/50">
                        <th className="px-4 py-2 text-left text-slate-400 font-medium">行号</th>
                        <th className="px-4 py-2 text-left text-slate-400 font-medium">门店名称</th>
                        <th className="px-4 py-2 text-left text-slate-400 font-medium">设备类型</th>
                        <th className="px-4 py-2 text-left text-slate-400 font-medium">故障描述</th>
                        <th className="px-4 py-2 text-left text-slate-400 font-medium">状态</th>
                        <th className="px-4 py-2 text-left text-slate-400 font-medium">联系人</th>
                        <th className="px-4 py-2 text-left text-slate-400 font-medium">联系电话</th>
                        <th className="px-4 py-2 text-left text-slate-400 font-medium">期望上门时间</th>
                        <th className="px-4 py-2 text-left text-slate-400 font-medium">工单号</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataRows.map((row, idx) => {
                        const rowErrors = errors.filter(e => e.row === idx + 2);
                        const hasBlockingError = rowErrors.some(e => 
                          e.type === 'MISSING_STORE' || 
                          e.type === 'MISSING_EQUIPMENT' || 
                          e.type === 'MISSING_DESCRIPTION' ||
                          e.type === 'INVALID_STORE' ||
                          e.type === 'INVALID_DATE_FORMAT' ||
                          e.type === 'DUPLICATE_ORDER_NO'
                        );
                        const hasWarning = rowErrors.some(e => e.type === 'ORDER_EXISTS');
                        
                        return (
                          <tr 
                            key={idx} 
                            className={clsx(
                              'border-t border-slate-700/30',
                              hasBlockingError && 'bg-red-500/5',
                              hasWarning && !hasBlockingError && 'bg-yellow-500/5'
                            )}
                          >
                            <td className="px-4 py-2 text-slate-400">{idx + 2}</td>
                            <td className="px-4 py-2 text-slate-200">{row[0] || '-'}</td>
                            <td className="px-4 py-2 text-slate-200">{row[1] || '-'}</td>
                            <td className="px-4 py-2 text-slate-200 max-w-xs truncate">{row[2] || '-'}</td>
                            <td className="px-4 py-2 text-slate-200">{row[3] || '待派工'}</td>
                            <td className="px-4 py-2 text-slate-200">{row[4] || '-'}</td>
                            <td className="px-4 py-2 text-slate-200">{row[5] || '-'}</td>
                            <td className="px-4 py-2 text-slate-200">{row[6] || '-'}</td>
                            <td className="px-4 py-2 text-slate-200">{row[7] || '(自动生成)'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700/50 bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {errors.length > 0 && (
                    <button
                      onClick={handleDownloadErrors}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      下载失败明细
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClose}
                    className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-medium transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={blockingErrors.length > 0 || warningErrors.length > 0}
                    className={clsx(
                      'flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-colors',
                      blockingErrors.length > 0 || warningErrors.length > 0
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        : valid
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                    )}
                  >
                    <Upload className="w-4 h-4" />
                    {blockingErrors.length > 0 || warningErrors.length > 0
                      ? '存在错误，无法导入'
                      : '确认导入'
                    }
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
