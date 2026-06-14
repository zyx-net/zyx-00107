import { useState } from 'react';
import { useStore } from '../store/useStore';
import { ClipboardCheck, ThumbsUp, ThumbsDown, AlertCircle, Check } from 'lucide-react';
import { clsx } from 'clsx';

interface ReviewFormProps {
  orderId: string;
  onSuccess?: () => void;
}

export function ReviewForm({ orderId, onSuccess }: ReviewFormProps) {
  const { reviewOrder } = useStore();
  const [rating, setRating] = useState<'满意' | '基本满意' | '不满意' | null>(null);
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!rating) {
      setError('请选择评价');
      return;
    }

    if (!remark.trim()) {
      setError('请填写回访备注');
      return;
    }

    setLoading(true);
    setError(null);

    const result = reviewOrder(orderId, rating, remark);
    
    setLoading(false);

    if (result.success) {
      onSuccess?.();
    } else {
      setError(result.error || '回访失败');
    }
  };

  const ratingOptions: { value: '满意' | '基本满意' | '不满意'; icon: React.ReactNode; color: string; bgColor: string }[] = [
    { 
      value: '满意', 
      icon: <ThumbsUp className="w-5 h-5" />, 
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500'
    },
    { 
      value: '基本满意', 
      icon: <Check className="w-5 h-5" />, 
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500'
    },
    { 
      value: '不满意', 
      icon: <ThumbsDown className="w-5 h-5" />, 
      color: 'text-red-400',
      bgColor: 'bg-red-500'
    },
  ];

  return (
    <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
      <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <ClipboardCheck className="w-5 h-5 text-purple-400" />
        回访评价
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          客户评价
        </label>
        <div className="grid grid-cols-3 gap-3">
          {ratingOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setRating(option.value)}
              className={clsx(
                'p-4 rounded-xl border transition-all duration-200 flex flex-col items-center gap-2',
                rating === option.value
                  ? `${option.bgColor}/20 border-${option.color.split('-')[1]}-500/50`
                  : 'border-slate-700/50 hover:border-slate-600/50'
              )}
              style={{
                borderColor: rating === option.value ? option.color : undefined,
                backgroundColor: rating === option.value ? `${option.color}15` : undefined,
              }}
            >
              <span className={option.color}>{option.icon}</span>
              <span 
                className="text-sm font-medium"
                style={{ color: rating === option.value ? option.color : '#9ca3af' }}
              >
                {option.value}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          回访备注
        </label>
        <textarea
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="请记录回访过程、客户反馈等问题..."
          className="w-full h-32 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!rating || !remark.trim() || loading}
        className={clsx(
          'w-full py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2',
          rating && remark.trim() && !loading
            ? 'bg-purple-500 hover:bg-purple-600 text-white hover:shadow-lg hover:shadow-purple-500/20'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
        )}
      >
        {rating && remark.trim() && !loading && (
          rating === '满意' ? <ThumbsUp className="w-4 h-4" /> : 
          rating === '基本满意' ? <Check className="w-4 h-4" /> :
          <ThumbsDown className="w-4 h-4" />
        )}
        {loading ? '提交中...' : '确认回访'}
      </button>
    </div>
  );
}
