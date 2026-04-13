import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { io, Socket } from 'socket.io-client';
import api from '../lib/api';
import { TrendingUp, TrendingDown, RefreshCw, Search, XCircle, X, Calendar } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

/** Smart price formatting based on magnitude */
function formatPrice(price: number): string {
  if (price === 0) return '0';
  const abs = Math.abs(price);
  if (abs >= 1000) return price.toFixed(2);
  if (abs >= 10) return price.toFixed(3);
  if (abs >= 1) return price.toFixed(4);
  return price.toFixed(5);
}

export default function TradeHistoryPage() {
  const { t } = useTranslation();
  const [trades, setTrades] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // Users for dropdown
  const [users, setUsers] = useState<any[]>([]);

  // Live P&L from WS
  const [livePnl, setLivePnl] = useState<Record<string, any>>({});
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data.users || data);
    } catch {}
  }, []);

  const toISODate = (d: Date | null) => d ? d.toISOString().split('T')[0] : '';

  const loadTrades = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      if (userFilter) params.set('userId', userFilter);
      if (fromDate) params.set('fromDate', toISODate(fromDate));
      if (toDate) params.set('toDate', toISODate(toDate));
      const { data } = await api.get(`/trades/all?${params}`);
      setTrades(data.trades);
      setTotal(data.total);
    } catch {}
  }, [page, statusFilter, userFilter, fromDate, toDate]);

  // Socket.IO for live P&L + trade events
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    const socket: Socket = io('http://localhost:3000/ws', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('admin:trade:pnl', (pnlData: any) => {
      setLivePnl((prev) => ({ ...prev, [pnlData.tradeId]: pnlData }));
    });

    socket.on('admin:trade:opened', () => { loadTrades(); loadUsers(); });
    socket.on('admin:trade:closed', (trade: any) => {
      setLivePnl((prev) => {
        const next = { ...prev };
        delete next[trade.id];
        return next;
      });
      loadTrades();
      loadUsers();
    });

    return () => { socket.disconnect(); };
  }, [loadTrades]);

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { loadTrades(); }, [page, statusFilter, userFilter, fromDate, toDate]);

  const handleCloseTrade = async (tradeId: string) => {
    if (!confirm(t('history.confirmClose'))) return;
    setClosingTradeId(tradeId);
    try {
      await api.post(`/trades/admin/${tradeId}/close`);
    } catch (err: any) {
      alert(err.response?.data?.message || t('history.closeFailed'));
    } finally {
      setClosingTradeId(null);
    }
  };

  const clearFilters = () => {
    setStatusFilter('');
    setUserFilter('');
    setFromDate(null);
    setToDate(null);
    setPage(1);
  };

  const hasFilters = statusFilter || userFilter || fromDate || toDate;
  const totalPages = Math.ceil(total / limit);

  const getUserLabel = (u: any) =>
    u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.phone;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{t('history.title')}</h2>
          <p className="text-sm text-gray-400 mt-1">{t('history.subtitle', { count: total })}</p>
        </div>
        <button onClick={loadTrades} className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-gray-300 hover:text-white">
          <RefreshCw size={16} /> {t('history.refresh')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Search size={16} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-300">{t('history.filters')}</span>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 ms-auto text-xs text-red-400 hover:text-red-300">
              <X size={12} /> {t('history.clearFilters')}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* User filter */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('history.filterUser')}</label>
            <select
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white text-sm"
            >
              <option value="">{t('history.allUsers')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{getUserLabel(u)}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('history.filterStatus')}</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white text-sm"
            >
              <option value="">{t('history.allStatus')}</option>
              <option value="OPEN">{t('history.open')}</option>
              <option value="CLOSED">{t('history.closed')}</option>
            </select>
          </div>

          {/* From date */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('history.fromDate')}</label>
            <div className="relative">
              <DatePicker
                selected={fromDate}
                onChange={(date: Date | null) => { setFromDate(date); setPage(1); }}
                selectsStart
                startDate={fromDate}
                endDate={toDate}
                maxDate={toDate || undefined}
                placeholderText={t('history.selectDate')}
                dateFormat="yyyy-MM-dd"
                isClearable
                className="w-full px-3 py-2 ps-9 bg-[#0f172a] border border-[#334155] rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#D4AF37] focus:outline-none"
                calendarClassName="dark-calendar"
                popperPlacement="bottom-start"
              />
              <Calendar size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* To date */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('history.toDate')}</label>
            <div className="relative">
              <DatePicker
                selected={toDate}
                onChange={(date: Date | null) => { setToDate(date); setPage(1); }}
                selectsEnd
                startDate={fromDate}
                endDate={toDate}
                minDate={fromDate || undefined}
                placeholderText={t('history.selectDate')}
                dateFormat="yyyy-MM-dd"
                isClearable
                className="w-full px-3 py-2 ps-9 bg-[#0f172a] border border-[#334155] rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#D4AF37] focus:outline-none"
                calendarClassName="dark-calendar"
                popperPlacement="bottom-start"
              />
              <Calendar size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Trades Table */}
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#334155]">
              <th className="text-left px-4 py-3 text-xs text-gray-400">{t('history.user')}</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400">{t('history.symbol')}</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400">{t('history.type')}</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400">{t('history.lot')}</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400">{t('history.openPrice')}</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400">{t('history.currentClose')}</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400">{t('history.pnl')}</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400">{t('history.commission')}</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400">{t('history.mtOrder')}</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400">{t('history.status')}</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400">{t('history.date')}</th>
              <th className="text-left px-4 py-3 text-xs text-gray-400">{t('history.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((tr) => {
              const pnl = livePnl[tr.id];
              const pnlValue = pnl?.mtProfit ?? null;
              // Show formula prices (customerPrice/customerClosePrice), not MT5 prices
              const formulaOpenPrice = tr.customerPrice ? parseFloat(tr.customerPrice) : parseFloat(tr.openPrice);
              const formulaClosePrice = tr.customerClosePrice ? parseFloat(tr.customerClosePrice) : (tr.closePrice ? parseFloat(tr.closePrice) : null);

              return (
                <tr key={tr.id} className="border-b border-[#334155]/50 hover:bg-white/5">
                  <td className="px-4 py-3 text-sm">{tr.user?.firstName || tr.user?.phone}</td>
                  <td className="px-4 py-3 font-semibold">{tr.symbol?.displayName}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 ${tr.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                      {tr.type === 'BUY' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {tr.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">{tr.lotSize}</td>
                  <td className="px-4 py-3">${formatPrice(formulaOpenPrice)}</td>
                  <td className="px-4 py-3">
                    {tr.status === 'CLOSED' && formulaClosePrice != null ? (
                      <span>${formatPrice(formulaClosePrice)}</span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tr.status === 'CLOSED' && tr.profitLoss != null ? (
                      <span className={`font-semibold ${parseFloat(tr.profitLoss) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {parseFloat(tr.profitLoss) >= 0 ? '+' : ''}${parseFloat(tr.profitLoss).toFixed(2)}
                      </span>
                    ) : pnlValue !== null ? (
                      <span className={`font-semibold font-mono ${pnlValue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pnlValue >= 0 ? '+' : ''}${Number(pnlValue).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">${parseFloat(tr.commission || '0').toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{tr.mtOrderId || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      tr.status === 'OPEN' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {tr.status === 'OPEN' ? t('history.open') : t('history.closed')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(tr.createdAt).toLocaleDateString()}<br />
                    <span className="text-gray-500">{new Date(tr.createdAt).toLocaleTimeString()}</span>
                  </td>
                  <td className="px-4 py-3">
                    {tr.status === 'OPEN' && (
                      <button
                        onClick={() => handleCloseTrade(tr.id)}
                        disabled={closingTradeId === tr.id}
                        className="flex items-center gap-1 px-3 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30 disabled:opacity-50"
                      >
                        {closingTradeId === tr.id ? t('history.closing') : <><XCircle size={12} /> {t('history.close')}</>}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {trades.length === 0 && <p className="text-center py-8 text-gray-400">{t('history.noTrades')}</p>}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4 text-sm text-gray-400">
        <span>{t('history.page', { page, total: totalPages || 1 })}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 bg-[#1e293b] border border-[#334155] rounded disabled:opacity-30">{t('history.prev')}</button>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 bg-[#1e293b] border border-[#334155] rounded disabled:opacity-30">{t('history.next')}</button>
        </div>
      </div>
    </div>
  );
}
