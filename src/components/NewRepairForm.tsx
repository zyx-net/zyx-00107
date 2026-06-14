import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Plus, Store, AlertCircle, Check, User, Phone, Calendar } from 'lucide-react';
import { clsx } from 'clsx';

export function NewRepairForm() {
  const navigate = useNavigate();
  const { stores, createOrder } = useStore();
  const [storeId, setStoreId] = useState('');
  const [equipment, setEquipment] = useState('');
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [expectedVisitTime, setExpectedVisitTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = () => {
    if (!storeId) {
      setError('请选择门店');
      return;
    }
    if (!equipment.trim()) {
      setError('请填写设备类型');
      return;
    }
    if (!description.trim()) {
      setError('请填写故障描述');
      return;
    }

    const order = createOrder(
      storeId, 
      equipment.trim(), 
      description.trim(),
      contactName.trim() || undefined,
      contactPhone.trim() || undefined,
      expectedVisitTime || undefined
    );
    setSuccess(true);
    
    setTimeout(() => {
      navigate('/');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="mb-8 text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-2"
        >
          ← 返回工作台
        </button>

        <div className="bg-slate-800/50 rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
              <Plus className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">新建报修</h1>
              <p className="text-sm text-slate-400 mt-1">提交设备故障报修请求</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">提交失败</div>
                <div className="text-sm mt-1">{error}</div>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-400">
              <Check className="w-5 h-5" />
              <div>
                <div className="font-medium">提交成功</div>
                <div className="text-sm mt-1">正在跳转...</div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                门店选择
              </label>
              <div className="grid grid-cols-1 gap-3">
                {stores.map((store) => (
                  <button
                    key={store.id}
                    onClick={() => {
                      setStoreId(store.id);
                      if (!contactName) setContactName(store.contact);
                      if (!contactPhone) setContactPhone(store.phone);
                    }}
                    className={clsx(
                      'p-4 rounded-xl border text-left transition-all duration-200',
                      storeId === store.id
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : 'border-slate-700/50 hover:border-slate-600/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Store className={clsx(
                        'w-5 h-5',
                        storeId === store.id ? 'text-blue-400' : 'text-slate-500'
                      )} />
                      <div>
                        <div className="font-medium text-slate-200">{store.name}</div>
                        <div className="text-sm text-slate-400 mt-1">
                          {store.address}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          联系人: {store.contact} | {store.phone}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                设备类型
              </label>
              <input
                type="text"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="例如: 中央空调、冷柜、收银机等"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                故障描述
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="请详细描述故障现象，例如: 设备不制冷、显示异常代码、发出异响等..."
                className="w-full h-32 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  <span className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    联系人
                  </span>
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="联系人姓名"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  <span className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    联系电话
                  </span>
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="联系电话"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  期望上门时间
                </span>
              </label>
              <input
                type="date"
                value={expectedVisitTime}
                onChange={(e) => setExpectedVisitTime(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={success}
              className={clsx(
                'w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200',
                !success
                  ? 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/20'
                  : 'bg-emerald-500 text-white'
              )}
            >
              {success ? '提交成功 ✓' : '提交报修'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
