import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Wrench, Send, AlertCircle, Check } from 'lucide-react';
import { clsx } from 'clsx';

interface RepairFormProps {
  orderId: string;
  currentRecord: string | null;
  status: string;
  onSuccess?: () => void;
}

export function RepairForm({ orderId, currentRecord, status, onSuccess }: RepairFormProps) {
  const { updateRepairRecord, submitComplete } = useStore();
  const [record, setRecord] = useState(currentRecord || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canEdit = status === '维修中' || status === '已派工';
  const canSubmit = status === '维修中' && record.trim().length > 0;

  const handleSave = () => {
    if (!canEdit) return;
    updateRepairRecord(orderId, record);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  const handleSubmitComplete = () => {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    const result = submitComplete(orderId);
    
    setLoading(false);

    if (result.success) {
      onSuccess?.();
    } else {
      setError(result.error || '提交失败');
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
      <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <Wrench className="w-5 h-5 text-emerald-400" />
        维修记录
      </h3>

      {status !== '维修中' && status !== '已派工' && (
        <div className="mb-4 p-3 bg-slate-700/30 rounded-xl text-sm text-slate-400">
          当前状态不允许修改维修记录
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <textarea
        value={record}
        onChange={(e) => setRecord(e.target.value)}
        placeholder="请详细描述维修过程、更换的配件、检测结果等..."
        disabled={!canEdit}
        className={clsx(
          'w-full h-40 p-4 bg-slate-900/50 border rounded-xl text-slate-200 placeholder-slate-500 resize-none transition-all',
          canEdit
            ? 'border-slate-700/50 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20'
            : 'border-slate-700/30 cursor-not-allowed'
        )}
      />

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={!canEdit}
          className={clsx(
            'flex-1 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2',
            canEdit
              ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
          )}
        >
          {success ? <Check className="w-4 h-4 text-emerald-400" /> : null}
          {success ? '已保存' : '保存记录'}
        </button>

        <button
          onClick={handleSubmitComplete}
          disabled={!canSubmit || loading}
          className={clsx(
            'flex-1 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2',
            canSubmit && !loading
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-lg hover:shadow-emerald-500/20'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          )}
        >
          <Send className="w-4 h-4" />
          {loading ? '提交中...' : '提交完工'}
        </button>
      </div>
    </div>
  );
}
