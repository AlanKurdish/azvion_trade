import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { io, Socket } from 'socket.io-client';
import api from '../lib/api';
import { RefreshCw, TrendingUp, TrendingDown, X, Activity, Wifi, WifiOff, Plus, XCircle } from 'lucide-react';
import Mt5BalanceWidget from '../components/Mt5BalanceWidget';

interface LivePrice {
  symbol: string;
  bid: number;
  ask: number;
  time?: number;
}

/** Smart price formatting based on magnitude */
function formatPrice(price: number): string {
  if (price === 0) return '0';
  const abs = Math.abs(price);
  if (abs >= 1000) return price.toFixed(2);
  if (abs >= 10) return price.toFixed(3);
  if (abs >= 1) return price.toFixed(4);
  return price.toFixed(5);
}

export default function TradesPage() {
  const { t } = useTranslation();
  const [symbols, setSymbols] = useState<any[]>([]);
  const [mtPositions, setMtPositions] = useState<any[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, LivePrice>>({});
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [activeTab, setActiveTab] = useState<'symbols' | 'openTrades' | 'mtPositions'>('symbols');

  // Open trades state
  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [livePnl, setLivePnl] = useState<Record<string, any>>({});
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);

  // Open trade modal
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedSymbolId, setSelectedSymbolId] = useState('');
  const [openingTrade, setOpeningTrade] = useState(false);

  const loadSymbols = useCallback(async () => {
    try {
      const { data } = await api.get('/symbols/all');
      setSymbols(data.filter((s: any) => s.isTradable));
    } catch {}
  }, []);

  const loadMtPositions = useCallback(async () => {
    try {
      const { data } = await api.get('/mt/positions');
      setMtPositions(data);
    } catch {}
  }, []);

  const loadOpenTrades = useCallback(async () => {
    try {
      const { data } = await api.get('/trades/all?status=OPEN&limit=100');
      setOpenTrades(data.trades);
    } catch {}
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data.users || data);
    } catch {}
  }, []);

  // Socket.IO connection
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    const socket = io('http://localhost:3000/ws', {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setWsConnected(true));
    socket.on('disconnect', () => setWsConnected(false));
    socket.on('authenticated', (data: { success: boolean }) => {
      if (!data.success) socket.disconnect();
    });

    socket.on('admin:prices', (prices: LivePrice[]) => {
      setLivePrices((prev) => {
        const next = { ...prev };
        for (const p of prices) next[p.symbol] = p;
        return next;
      });
    });

    socket.on('admin:mt:positions', (positions: any[]) => {
      setMtPositions(positions);
    });

    socket.on('admin:trade:pnl', (pnlData: any) => {
      setLivePnl((prev) => ({ ...prev, [pnlData.tradeId]: pnlData }));
    });

    socket.on('admin:trade:opened', () => { loadOpenTrades(); loadUsers(); });
    socket.on('admin:trade:closed', (trade: any) => {
      setLivePnl((prev) => { const n = { ...prev }; delete n[trade.id]; return n; });
      loadOpenTrades();
      loadUsers();
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [loadOpenTrades]);

  useEffect(() => { loadSymbols(); loadMtPositions(); loadOpenTrades(); }, []);

  const getSymbolPrice = (mtSymbol: string) => livePrices[mtSymbol];

  const handleOpenTrade = async () => {
    if (!selectedUserId || !selectedSymbolId) return;
    setOpeningTrade(true);
    try {
      await api.post('/trades/admin/open', { userId: selectedUserId, symbolId: selectedSymbolId });
      setShowOpenModal(false);
      setSelectedUserId('');
      setSelectedSymbolId('');
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || t('trades.openFailed'));
    } finally {
      setOpeningTrade(false);
    }
  };

  const handleCloseTrade = async (tradeId: string) => {
    if (!confirm(t('trades.confirmClose'))) return;
    setClosingTradeId(tradeId);
    try {
      await api.post(`/trades/admin/${tradeId}/close`);
    } catch (err: any) {
      alert(err.response?.data?.message || t('trades.closeFailed'));
    } finally {
      setClosingTradeId(null);
    }
  };

  const tabs = [
    { key: 'symbols', label: t('trades.livePrices'), count: symbols.length },
    { key: 'openTrades', label: t('trades.openTradesTab'), count: openTrades.length },
    { key: 'mtPositions', label: t('trades.mtPositions'), count: mtPositions.length },
  ] as const;

  return (
    <div>
      {/* MT5 Balance Widget */}
      <div className="mb-4 max-w-sm ms-auto">
        <Mt5BalanceWidget />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{t('trades.title')}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className={`flex items-center gap-1 text-xs ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
              {wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {wsConnected ? t('trades.liveStreaming') : t('trades.disconnected')}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { loadUsers(); setShowOpenModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#c5a030]"
          >
            <Plus size={16} /> {t('trades.openTrade')}
          </button>
          <button onClick={() => { loadMtPositions(); loadSymbols(); loadOpenTrades(); }} className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-gray-300 hover:text-white">
            <RefreshCw size={16} /> {t('trades.refresh')}
          </button>
        </div>
      </div>

      {/* Open Trade Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowOpenModal(false)}>
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">{t('trades.openTradeForUser')}</h3>
              <button onClick={() => setShowOpenModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('trades.selectUser')}</label>
                <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="w-full px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white">
                  <option value="">{t('trades.chooseUser')}</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.phone} — Balance: ${Number(u.balance?.amount ?? 0).toFixed(2)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('trades.selectSymbol')}</label>
                <select value={selectedSymbolId} onChange={(e) => setSelectedSymbolId(e.target.value)} className="w-full px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white">
                  <option value="">{t('trades.chooseSymbol')}</option>
                  {symbols.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.displayName} — ${s.price} (Lot: {s.lotSize}, Comm: ${s.commission})</option>
                  ))}
                </select>
              </div>
              {selectedUserId && selectedSymbolId && (() => {
                const sym = symbols.find((s: any) => s.id === selectedSymbolId);
                const user = users.find((u: any) => u.id === selectedUserId);
                const totalCost = sym ? Number(sym.price) + Number(sym.commission) : 0;
                const userBal = Number(user?.balance?.amount ?? 0);
                const canAfford = userBal >= totalCost;
                return (
                  <div className={`p-3 rounded-lg text-sm ${canAfford ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                    <div className="flex justify-between"><span className="text-gray-400">{t('trades.totalCost')}</span><span className="font-semibold">${totalCost.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">{t('trades.userBalance')}</span><span className="font-semibold">${userBal.toFixed(2)}</span></div>
                    {!canAfford && <p className="text-red-400 text-xs mt-1">{t('trades.insufficientBalance')}</p>}
                  </div>
                );
              })()}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowOpenModal(false)} className="flex-1 px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-gray-300 hover:text-white">{t('trades.cancel')}</button>
              <button onClick={handleOpenTrade} disabled={!selectedUserId || !selectedSymbolId || openingTrade} className="flex-1 px-4 py-2 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#c5a030] disabled:opacity-50">
                {openingTrade ? t('trades.opening') : t('trades.openTrade')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#1e293b] p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-[#D4AF37] text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label} {tab.count > 0 && <span className="ml-1 opacity-70">({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Live Prices Tab */}
      {activeTab === 'symbols' && (
        <div>
          {symbols.length === 0 ? (
            <p className="text-center py-12 text-gray-400">{t('trades.noSymbols')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {symbols.map((sym) => {
                const price = getSymbolPrice(sym.mtSymbol);
                return (
                  <div key={sym.id} className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold">{sym.displayName}</h3>
                        <span className="text-xs text-gray-400">{sym.mtSymbol}</span>
                      </div>
                      {price ? <Activity size={16} className="text-green-400 animate-pulse" /> : <Activity size={16} className="text-gray-600" />}
                    </div>
                    {price ? (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-[#0f172a] rounded-lg p-3 text-center">
                          <span className="text-xs text-gray-400 block">{t('trades.bid')}</span>
                          <span className="text-lg font-bold text-red-400">{formatPrice(price.bid)}</span>
                        </div>
                        <div className="bg-[#0f172a] rounded-lg p-3 text-center">
                          <span className="text-xs text-gray-400 block">{t('trades.ask')}</span>
                          <span className="text-lg font-bold text-green-400">{formatPrice(price.ask)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#0f172a] rounded-lg p-4 text-center mb-4 text-gray-500">{t('trades.waitingPrice')}</div>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
                      <div><span className="block">{t('trades.lot')}</span><span className="text-white font-semibold">{sym.lotSize}</span></div>
                      <div><span className="block">{t('trades.price')}</span><span className="text-[#D4AF37] font-semibold">${sym.price}</span></div>
                      <div><span className="block">{t('trades.commission')}</span><span className="text-white font-semibold">${sym.commission}</span></div>
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      {t('trades.spread')}: {price ? formatPrice(price.ask - price.bid) : '-'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Open Trades Tab */}
      {activeTab === 'openTrades' && (
        <div>
          {openTrades.length === 0 ? (
            <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-12 text-center text-gray-400">
              {t('trades.noTrades')}
            </div>
          ) : (
            <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left px-4 py-3 text-xs text-gray-400">{t('trades.user')}</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400">{t('trades.symbol')}</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400">{t('trades.type')}</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400">{t('trades.lot')}</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400">{t('trades.openPrice')}</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400">{t('trades.current')}</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400">{t('trades.pnl')}</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400">{t('trades.mtOrder')}</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400">{t('trades.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {openTrades.map((tr) => {
                    const pnl = livePnl[tr.id];
                    const currentPrice = pnl?.currentPrice ?? null;
                    const pnlValue = pnl?.mtProfit ?? null;

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
                        <td className="px-4 py-3">${formatPrice(parseFloat(tr.openPrice))}</td>
                        <td className="px-4 py-3">
                          {currentPrice ? (
                            <span className="text-[#D4AF37] font-mono">${formatPrice(Number(currentPrice))}</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {pnlValue !== null ? (
                            <span className={`font-semibold font-mono ${pnlValue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {pnlValue >= 0 ? '+' : ''}${Number(pnlValue).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{tr.mtOrderId || '-'}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleCloseTrade(tr.id)}
                            disabled={closingTradeId === tr.id}
                            className="flex items-center gap-1 px-3 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30 disabled:opacity-50"
                          >
                            {closingTradeId === tr.id ? t('trades.closing') : <><XCircle size={12} /> {t('trades.close')}</>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MT5 Positions Tab */}
      {activeTab === 'mtPositions' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">{t('trades.openPositions', { count: mtPositions.length })}</span>
            <button onClick={loadMtPositions} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
              <RefreshCw size={14} /> {t('trades.refresh')}
            </button>
          </div>
          {mtPositions.length === 0 ? (
            <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-12 text-center text-gray-400">
              {t('trades.noPositions')}
            </div>
          ) : (
            <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left px-5 py-3 text-xs text-gray-400">{t('trades.ticket')}</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400">{t('trades.symbol')}</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400">{t('trades.type')}</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400">{t('trades.volume')}</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400">{t('trades.openPrice')}</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400">{t('trades.current')}</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400">{t('trades.profit')}</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400">{t('trades.swap')}</th>
                  </tr>
                </thead>
                <tbody>
                  {mtPositions.map((p: any) => (
                    <tr key={p.ticket} className="border-b border-[#334155]/50 hover:bg-white/5">
                      <td className="px-5 py-3 font-mono text-sm">{p.ticket}</td>
                      <td className="px-5 py-3 font-semibold">{p.symbol}</td>
                      <td className="px-5 py-3">
                        <span className={`flex items-center gap-1 ${p.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                          {p.type === 'BUY' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {p.type}
                        </span>
                      </td>
                      <td className="px-5 py-3">{p.volume}</td>
                      <td className="px-5 py-3">${p.open_price}</td>
                      <td className="px-5 py-3 font-mono text-[#D4AF37]">${p.current_price != null ? formatPrice(p.current_price) : '-'}</td>
                      <td className="px-5 py-3">
                        <span className={`font-semibold ${p.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {p.profit >= 0 ? '+' : ''}${p.profit?.toFixed?.(2) ?? p.profit}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-400">${p.swap?.toFixed?.(2) ?? '0.00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
