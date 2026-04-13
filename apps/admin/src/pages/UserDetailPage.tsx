import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import {
  ArrowLeft, Save, DollarSign, TrendingUp, TrendingDown,
  History, Edit2, X, Plus, Minus, KeyRound,
} from 'lucide-react';

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [user, setUser] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', isActive: true });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Balance
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceNote, setBalanceNote] = useState('');
  const [balanceError, setBalanceError] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Reset password
  const [showResetPw, setShowResetPw] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [resetPwMsg, setResetPwMsg] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState<'trades' | 'transactions'>('trades');

  const loadUser = async () => {
    try {
      const { data } = await api.get(`/users/${id}`);
      setUser(data);
      setEditForm({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        phone: data.phone || '',
        isActive: data.isActive,
      });
    } catch {
      navigate('/dashboard/users');
    }
  };

  const loadTrades = async () => {
    try {
      const { data } = await api.get(`/trades/user/${id}`);
      setTrades(data.trades || []);
    } catch {}
  };

  const loadTransactions = async () => {
    try {
      const { data } = await api.get(`/balances/${id}/transactions?page=${txPage}&limit=20`);
      setTransactions(data.transactions || []);
      setTxTotal(data.total || 0);
    } catch {}
  };

  useEffect(() => {
    Promise.all([loadUser(), loadTrades(), loadTransactions()]).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadTransactions(); }, [txPage]);

  // Edit
  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!editForm.firstName.trim()) errs.firstName = t('userDetail.required');
    if (!editForm.lastName.trim()) errs.lastName = t('userDetail.required');
    if (!editForm.phone.trim()) errs.phone = t('userDetail.required');
    setEditErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await api.patch(`/users/${id}`, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim(),
        isActive: editForm.isActive,
      });
      await loadUser();
      setEditing(false);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setEditErrors({ api: typeof msg === 'string' ? msg : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  // Balance operations
  const handleBalance = async (type: 'deposit' | 'withdraw') => {
    setBalanceError('');
    const amt = parseFloat(balanceAmount);
    if (!amt || amt <= 0) { setBalanceError('Enter a valid amount'); return; }

    setBalanceLoading(true);
    try {
      await api.post(`/balances/${id}/${type}`, {
        amount: amt,
        note: balanceNote.trim() || `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} by admin`,
      });
      setBalanceAmount('');
      setBalanceNote('');
      setShowDeposit(false);
      setShowWithdraw(false);
      await Promise.all([loadUser(), loadTransactions()]);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setBalanceError(typeof msg === 'string' ? msg : `Failed to ${type}`);
    } finally {
      setBalanceLoading(false);
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'DEPOSIT': return 'text-green-400';
      case 'WITHDRAWAL': return 'text-red-400';
      case 'TRADE_OPEN': return 'text-blue-400';
      case 'TRADE_CLOSE': return 'text-purple-400';
      case 'COMMISSION': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT': return <Plus size={14} />;
      case 'WITHDRAWAL': return <Minus size={14} />;
      case 'TRADE_OPEN': return <TrendingUp size={14} />;
      case 'TRADE_CLOSE': return <TrendingDown size={14} />;
      case 'COMMISSION': return <DollarSign size={14} />;
      default: return <History size={14} />;
    }
  };

  if (loading) return <div className="text-center py-10 text-gray-400">{t('userDetail.loading')}</div>;
  if (!user) return <div className="text-center py-10 text-gray-400">{t('userDetail.notFound')}</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/dashboard/users')} className="p-2 hover:bg-white/5 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold">{user.firstName} {user.lastName}</h2>
          <span className="text-sm text-gray-400">{user.phone}</span>
        </div>
        <span className={`ml-2 px-2 py-1 rounded text-xs ${user.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {user.isActive ? t('userDetail.active') : t('userDetail.inactive')}
        </span>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Profile Card */}
        <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{t('userDetail.profile')}</h3>
            <div className="flex items-center gap-3">
              {!editing && (
                <button onClick={() => { setShowResetPw(true); setNewPassword(''); setResetPwMsg(''); }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                  <KeyRound size={14} /> {t('userDetail.resetPassword')}
                </button>
              )}
              {!editing ? (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-sm text-[#D4AF37] hover:underline">
                  <Edit2 size={14} /> {t('userDetail.edit')}
                </button>
              ) : (
                <button onClick={() => { setEditing(false); setEditErrors({}); }} className="text-gray-400 hover:text-white">
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {editErrors.api && (
            <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-xs">{editErrors.api}</div>
          )}

          {!editing ? (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-400 block text-xs">{t('userDetail.phone')}</span>
                <span>{user.phone}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-xs">{t('userDetail.firstName')}</span>
                <span>{user.firstName || '-'}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-xs">{t('userDetail.lastName')}</span>
                <span>{user.lastName || '-'}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-xs">{t('userDetail.status')}</span>
                <span>{user.isActive ? t('userDetail.active') : t('userDetail.inactive')}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-xs">{t('userDetail.joined')}</span>
                <span>{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400">{t('userDetail.phone')}</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => { const v = e.target.value.replace(/[^0-9+\-\s]/g, ''); setEditForm({ ...editForm, phone: v }); }}
                  type="tel"
                  className={`w-full mt-1 px-3 py-2 bg-[#0f172a] border rounded text-sm text-white ${editErrors.phone ? 'border-red-500' : 'border-[#334155]'}`}
                />
                {editErrors.phone && <p className="text-red-400 text-xs mt-1">{editErrors.phone}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-400">{t('userDetail.firstName')}</label>
                <input
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  className={`w-full mt-1 px-3 py-2 bg-[#0f172a] border rounded text-sm text-white ${editErrors.firstName ? 'border-red-500' : 'border-[#334155]'}`}
                />
                {editErrors.firstName && <p className="text-red-400 text-xs mt-1">{editErrors.firstName}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-400">{t('userDetail.lastName')}</label>
                <input
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  className={`w-full mt-1 px-3 py-2 bg-[#0f172a] border rounded text-sm text-white ${editErrors.lastName ? 'border-red-500' : 'border-[#334155]'}`}
                />
                {editErrors.lastName && <p className="text-red-400 text-xs mt-1">{editErrors.lastName}</p>}
              </div>
              <div>
                <label className="text-xs text-gray-400">{t('userDetail.status')}</label>
                <select
                  value={editForm.isActive ? 'true' : 'false'}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'true' })}
                  className="w-full mt-1 px-3 py-2 bg-[#0f172a] border border-[#334155] rounded text-sm text-white"
                >
                  <option value="true">{t('userDetail.active')}</option>
                  <option value="false">{t('userDetail.inactive')}</option>
                </select>
              </div>
              <button onClick={handleSave} disabled={saving} className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-[#D4AF37] text-black rounded font-semibold text-sm hover:bg-[#c4a030] disabled:opacity-50">
                <Save size={14} /> {saving ? t('userDetail.saving') : t('userDetail.saveChanges')}
              </button>
            </div>
          )}
        </div>

        {/* Balance Card */}
        <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155]">
          <h3 className="text-lg font-semibold mb-4">{t('userDetail.balance')}</h3>
          <div className="text-center mb-6">
            <span className="text-4xl font-bold text-[#D4AF37]">${parseFloat(user.balance?.amount ?? 0).toFixed(2)}</span>
            <p className="text-xs text-gray-400 mt-1">{t('userDetail.availableBalance')}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setShowDeposit(true); setShowWithdraw(false); setBalanceAmount(''); setBalanceNote(''); setBalanceError(''); }}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700"
            >
              <Plus size={16} /> {t('userDetail.deposit')}
            </button>
            <button
              onClick={() => { setShowWithdraw(true); setShowDeposit(false); setBalanceAmount(''); setBalanceNote(''); setBalanceError(''); }}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700"
            >
              <Minus size={16} /> {t('userDetail.withdraw')}
            </button>
          </div>

          {(showDeposit || showWithdraw) && (
            <div className="mt-4 p-4 bg-[#0f172a] rounded-lg border border-[#334155]">
              <h4 className="text-sm font-semibold mb-3">
                {showDeposit ? `💰 ${t('userDetail.depositFunds')}` : `💸 ${t('userDetail.withdrawFunds')}`}
              </h4>
              {balanceError && (
                <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-xs">{balanceError}</div>
              )}
              <input
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder={t('userDetail.amountUsd')}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 bg-[#1e293b] border border-[#334155] rounded text-sm text-white mb-2"
              />
              <input
                type="text"
                value={balanceNote}
                onChange={(e) => setBalanceNote(e.target.value)}
                placeholder={t('userDetail.noteOptional')}
                className="w-full px-3 py-2 bg-[#1e293b] border border-[#334155] rounded text-sm text-white mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDeposit(false); setShowWithdraw(false); }}
                  className="flex-1 py-2 border border-[#334155] rounded text-sm text-gray-300"
                >
                  {t('userDetail.cancel')}
                </button>
                <button
                  onClick={() => handleBalance(showDeposit ? 'deposit' : 'withdraw')}
                  disabled={balanceLoading}
                  className={`flex-1 py-2 rounded font-semibold text-sm text-white disabled:opacity-50 ${showDeposit ? 'bg-green-600' : 'bg-red-600'}`}
                >
                  {balanceLoading ? t('userDetail.processing') : t('userDetail.confirm')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Reset Password Modal */}
        {showResetPw && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowResetPw(false)}>
            <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <KeyRound size={18} className="text-[#D4AF37]" /> {t('userDetail.resetPassword')}
                </h3>
                <button onClick={() => setShowResetPw(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
              </div>
              <p className="text-sm text-gray-400 mb-4">{user?.firstName || user?.phone}</p>
              {resetPwMsg && (
                <div className={`mb-3 p-2 rounded text-sm ${resetPwMsg.includes('success') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {resetPwMsg}
                </div>
              )}
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('userDetail.newPassword')}
                className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white text-sm mb-1"
              />
              <p className="text-xs text-gray-500 mb-4">{t('userDetail.minChars')}</p>
              <div className="flex gap-2">
                <button onClick={() => setShowResetPw(false)} className="flex-1 py-2 border border-[#334155] rounded-lg text-sm text-gray-300">
                  {t('userDetail.cancel')}
                </button>
                <button
                  disabled={newPassword.length < 6 || resetPwLoading}
                  onClick={async () => {
                    setResetPwLoading(true);
                    setResetPwMsg('');
                    try {
                      await api.post(`/users/${id}/reset-password`, { password: newPassword });
                      setResetPwMsg(t('userDetail.passwordResetSuccess'));
                      setNewPassword('');
                    } catch (err: any) {
                      setResetPwMsg(err.response?.data?.message || t('userDetail.passwordResetFailed'));
                    } finally {
                      setResetPwLoading(false);
                    }
                  }}
                  className="flex-1 py-2 bg-[#D4AF37] text-black rounded-lg font-semibold text-sm hover:bg-[#c4a030] disabled:opacity-50"
                >
                  {resetPwLoading ? t('userDetail.processing') : t('userDetail.resetPassword')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Card */}
        <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155]">
          <h3 className="text-lg font-semibold mb-4">{t('userDetail.stats')}</h3>
          <div className="space-y-4">
            <div>
              <span className="text-gray-400 text-xs block">{t('userDetail.totalTrades')}</span>
              <span className="text-2xl font-bold">{trades.length}</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs block">{t('userDetail.openTrades')}</span>
              <span className="text-2xl font-bold text-green-400">{trades.filter((t) => t.status === 'OPEN').length}</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs block">{t('userDetail.totalPnl')}</span>
              {(() => {
                const totalPnl = trades
                  .filter((t) => t.profitLoss != null)
                  .reduce((sum, t) => sum + parseFloat(t.profitLoss), 0);
                return (
                  <span className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                  </span>
                );
              })()}
            </div>
            <div>
              <span className="text-gray-400 text-xs block">{t('userDetail.transactions')}</span>
              <span className="text-2xl font-bold">{txTotal}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-[#1e293b] p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('trades')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'trades' ? 'bg-[#D4AF37] text-black' : 'text-gray-400 hover:text-white'}`}
        >
          {t('userDetail.tradesTab', { count: trades.length })}
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'transactions' ? 'bg-[#D4AF37] text-black' : 'text-gray-400 hover:text-white'}`}
        >
          {t('userDetail.txTab', { count: txTotal })}
        </button>
      </div>

      {/* Trades Tab */}
      {activeTab === 'trades' && (
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.symbol')}</th>
                <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.type')}</th>
                <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.lot')}</th>
                <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.openPrice')}</th>
                <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.closePrice')}</th>
                <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.commission')}</th>
                <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.pnl')}</th>
                <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.mtOrder')}</th>
                <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.status')}</th>
                <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.date')}</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-b border-[#334155]/50 hover:bg-white/5">
                  <td className="px-5 py-3 font-semibold">{t.symbol?.displayName || '-'}</td>
                  <td className="px-5 py-3">
                    <span className={`flex items-center gap-1 ${t.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                      {t.type === 'BUY' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {t.type}
                    </span>
                  </td>
                  <td className="px-5 py-3">{t.lotSize}</td>
                  <td className="px-5 py-3">${parseFloat(t.openPrice).toFixed(2)}</td>
                  <td className="px-5 py-3">{t.closePrice ? `$${parseFloat(t.closePrice).toFixed(2)}` : '-'}</td>
                  <td className="px-5 py-3 text-yellow-400">${parseFloat(t.commission || 0).toFixed(2)}</td>
                  <td className="px-5 py-3">
                    {t.profitLoss != null ? (
                      <span className={`font-semibold ${parseFloat(t.profitLoss) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {parseFloat(t.profitLoss) >= 0 ? '+' : ''}${parseFloat(t.profitLoss).toFixed(2)}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400 font-mono">{t.mtOrderId || '-'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${t.status === 'OPEN' ? 'bg-green-500/20 text-green-400' : t.status === 'CLOSED' ? 'bg-gray-500/20 text-gray-400' : 'bg-red-500/20 text-red-400'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">{new Date(t.openedAt || t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {trades.length === 0 && <p className="text-center py-8 text-gray-400">{t('userDetail.noTrades')}</p>}
        </div>
      )}

      {/* Transaction History Tab */}
      {activeTab === 'transactions' && (
        <div>
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.type')}</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.amount')}</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.note')}</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.tradeId')}</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400">{t('userDetail.date')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-[#334155]/50 hover:bg-white/5">
                    <td className="px-5 py-3">
                      <span className={`flex items-center gap-2 text-sm font-semibold ${getTransactionColor(tx.type)}`}>
                        {getTransactionIcon(tx.type)}
                        {tx.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`font-semibold ${parseFloat(tx.amount) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {parseFloat(tx.amount) >= 0 ? '+' : ''}${parseFloat(tx.amount).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-300">{tx.note || '-'}</td>
                    <td className="px-5 py-3 text-xs text-gray-400 font-mono">{tx.tradeId ? tx.tradeId.slice(0, 8) + '...' : '-'}</td>
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && <p className="text-center py-8 text-gray-400">{t('userDetail.noTransactions')}</p>}
          </div>

          {txTotal > 20 && (
            <div className="flex justify-between items-center mt-4 text-sm text-gray-400">
              <span>{t('userDetail.page', { page: txPage, total: txTotal })}</span>
              <div className="flex gap-2">
                <button disabled={txPage <= 1} onClick={() => setTxPage(txPage - 1)} className="px-3 py-1 bg-[#1e293b] rounded disabled:opacity-30">{t('userDetail.prev')}</button>
                <button disabled={transactions.length < 20} onClick={() => setTxPage(txPage + 1)} className="px-3 py-1 bg-[#1e293b] rounded disabled:opacity-30">{t('userDetail.next')}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
