import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Engineer } from '../types';
import { UserPlus, Check, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface DispatchPanelProps {
  orderId: string;
  onSuccess?: () => void;
}

export function DispatchPanel({ orderId, onSuccess }: DispatchPanelProps) {
  const { engineers, dispatchOrder } = useStore();
  const [selectedEngineer, setSelectedEngineer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const availableEngineers = engineers.filter(e => e.status !== 'offline');

  const handleDispatch = async () => {
    if (!selectedEngineer) {
      setError('请选择工程师');
      return;
    }

    const engineer = engineers.find(e => e.id === selectedEngineer);
    if (!engineer) return;

    setLoading(true);
    setError(null);

    const result = dispatchOrder(orderId, selectedEngineer, engineer.name);
    
    setLoading(false);

    if (result.success) {
      setSelectedEngineer(null);
      onSuccess?.();
    } else {
      setError(result.error || '派工失败');
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
      <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-orange-400" />
        派工
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-3 mb-4">
        {availableEngineers.map((engineer) => (
          <button
            key={engineer.id}
            onClick={() => setSelectedEngineer(engineer.id)}
            className={clsx(
              'w-full p-4 rounded-xl border transition-all duration-200 text-left',
              selectedEngineer === engineer.id
                ? 'border-orange-500/50 bg-orange-500/10'
                : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600/50'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">{engineer.name}</div>
                <div className="text-sm text-slate-400 mt-1">
                  工号: {engineer.employeeNo} | 专长: {engineer.expertise}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    'text-xs px-2 py-1 rounded-full',
                    engineer.status === 'available'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  )}
                >
                  {engineer.status === 'available' ? '空闲' : '忙碌'}
                </span>
                {selectedEngineer === engineer.id && (
                  <Check className="w-5 h-5 text-orange-400" />
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={handleDispatch}
        disabled={!selectedEngineer || loading}
        className={clsx(
          'w-full py-3 rounded-xl font-medium transition-all duration-200',
          selectedEngineer && !loading
            ? 'bg-orange-500 hover:bg-orange-600 text-white hover:shadow-lg hover:shadow-orange-500/20'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
        )}
      >
        {loading ? '派工中...' : '确认派工'}
      </button>
    </div>
  );
}
