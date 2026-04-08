import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import api from '../lib/api';
import {
  DollarSign, TrendingUp, TrendingDown, Users, Activity,
  ArrowUpCircle, ArrowDownCircle, Wallet, BarChart3, Trophy,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import Mt5BalanceWidget from '../components/Mt5BalanceWidget';

interface DashboardStats {
  kpis: {
    totalRevenue: number;
    totalPnl: number;
    openTrades: number;
    closedTrades: number;
    activeUsers: number;
    totalUsers: number;
    platformBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
  };
  winRate: number;
  monthlyData: Array<{ month: string; trades: number; revenue: number; pnl: number }>;
  topSymbols: Array<{ name: string; trades: number }>;
  recentTrades: Array<{
    id: string; user: string; symbol: string; type: string;
    status: string; openPrice: number; profitLoss: number | null;
    commission: number; date: string;
  }>;
}

const GOLD = '#D4AF37';
const GREEN = '#22c55e';
const RED = '#ef4444';

function KpiCard({ icon: Icon, label, value, prefix = '', color = 'text-white', trend }: {
  icon: any; label: string; value: string | number; prefix?: string;
  color?: string; trend?: 'up' | 'down' | null;
}) {
  return (
    <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5 hover:border-[#D4AF37]/30 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
          <Icon size={20} className="text-[#D4AF37]" />
        </div>
        {trend === 'up' && <TrendingUp size={16} className="text-green-400" />}
        {trend === 'down' && <TrendingDown size={16} className="text-red-400" />}
      </div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{prefix}{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get('/trades/admin/dashboard-stats');
      setStats(data);
    } catch (e) {
      console.error('Failed to load dashboard stats', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Real-time refresh on trade events
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    const socket = io('http://localhost:3000/ws', { auth: { token }, transports: ['websocket'] });
    socket.on('admin:trade:opened', () => loadStats());
    socket.on('admin:trade:closed', () => loadStats());
    return () => { socket.disconnect(); };
  }, [loadStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-center text-gray-400 py-12">{t('dashboard.loadError')}</p>;
  }

  const { kpis, winRate, monthlyData, topSymbols, recentTrades } = stats;
  const maxSymbolTrades = Math.max(...topSymbols.map((s) => s.trades), 1);
  const pieData = [
    { name: t('dashboard.open'), value: kpis.openTrades },
    { name: t('dashboard.closed'), value: kpis.closedTrades },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>
        <div className="w-72">
          <Mt5BalanceWidget />
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard icon={DollarSign} label={t('dashboard.totalRevenue')} value={kpis.totalRevenue.toFixed(2)} prefix="$" color="text-[#D4AF37]" />
        <KpiCard icon={TrendingUp} label={t('dashboard.totalPnl')} value={Math.abs(kpis.totalPnl).toFixed(2)} prefix={kpis.totalPnl >= 0 ? '+$' : '-$'} color={kpis.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'} trend={kpis.totalPnl >= 0 ? 'up' : 'down'} />
        <KpiCard icon={Activity} label={t('dashboard.openTrades')} value={kpis.openTrades} color="text-blue-400" />
        <KpiCard icon={Users} label={t('dashboard.activeUsers')} value={`${kpis.activeUsers} / ${kpis.totalUsers}`} />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={ArrowUpCircle} label={t('dashboard.totalDeposits')} value={kpis.totalDeposits.toFixed(2)} prefix="$" color="text-green-400" />
        <KpiCard icon={ArrowDownCircle} label={t('dashboard.totalWithdrawals')} value={kpis.totalWithdrawals.toFixed(2)} prefix="$" color="text-red-400" />
        <KpiCard icon={BarChart3} label={t('dashboard.closedTrades')} value={kpis.closedTrades} />
        <KpiCard icon={Wallet} label={t('dashboard.platformBalance')} value={kpis.platformBalance.toFixed(2)} prefix="$" color="text-[#D4AF37]" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Revenue */}
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">{t('dashboard.monthlyRevenue')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94a3b8' }} />
              <Area type="monotone" dataKey="revenue" stroke={GOLD} fill="url(#goldGrad)" strokeWidth={2} name={t('dashboard.revenue')} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly P&L */}
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">{t('dashboard.monthlyPnl')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94a3b8' }} />
              <Bar dataKey="pnl" name={t('dashboard.pnl')} radius={[4, 4, 0, 0]}>
                {monthlyData.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? GREEN : RED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Symbols + Win Rate */}
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">{t('dashboard.topSymbols')}</h3>
          {topSymbols.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">{t('dashboard.noData')}</p>
          ) : (
            <div className="space-y-3">
              {topSymbols.map((sym) => (
                <div key={sym.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300 font-medium">{sym.name}</span>
                    <span className="text-gray-400">{sym.trades} {t('dashboard.trades')}</span>
                  </div>
                  <div className="w-full h-2 bg-[#0f172a] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#e8d48b] transition-all" style={{ width: `${(sym.trades / maxSymbolTrades) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 pt-4 border-t border-[#334155]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400 flex items-center gap-2"><Trophy size={14} className="text-[#D4AF37]" /> {t('dashboard.winRate')}</span>
              <span className="text-lg font-bold text-[#D4AF37]">{winRate}%</span>
            </div>
            <div className="w-full h-3 bg-[#0f172a] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all" style={{ width: `${winRate}%` }} />
            </div>
          </div>
        </div>

        {/* Trade Distribution Pie */}
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">{t('dashboard.tradeDistribution')}</h3>
          {pieData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">{t('dashboard.noData')}</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={[GOLD, '#64748b'][i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ background: [GOLD, '#64748b'][i] }} />
                    <span className="text-gray-400">{d.name}</span>
                    <span className="font-semibold text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="mt-4 pt-4 border-t border-[#334155]">
            <h4 className="text-xs text-gray-400 mb-2">{t('dashboard.monthlyVolume')}</h4>
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={monthlyData}>
                <Bar dataKey="trades" fill={GOLD} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Trades */}
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">{t('dashboard.recentTrades')}</h3>
          {recentTrades.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">{t('dashboard.noData')}</p>
          ) : (
            <div className="space-y-2">
              {recentTrades.map((tr) => (
                <div key={tr.id} className="flex items-center justify-between py-2 border-b border-[#334155]/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tr.type === 'BUY' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      {tr.type === 'BUY' ? <TrendingUp size={14} className="text-green-400" /> : <TrendingDown size={14} className="text-red-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tr.symbol}</p>
                      <p className="text-xs text-gray-500">{tr.user}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    {tr.profitLoss !== null ? (
                      <p className={`text-sm font-semibold ${tr.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tr.profitLoss >= 0 ? '+' : ''}${tr.profitLoss.toFixed(2)}
                      </p>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded ${tr.status === 'OPEN' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {tr.status}
                      </span>
                    )}
                    <p className="text-xs text-gray-500">{new Date(tr.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
