import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { Wifi, WifiOff } from 'lucide-react';

interface Mt5Status {
  connected: boolean;
  login: string | null;
  brokerServer: string | null;
  balance: number | null;
  equity: number | null;
}

export default function Mt5BalanceWidget() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Mt5Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setPrevBalance] = useState<number | null>(null);
  const timerRef = useRef<any>(null);

  const load = async () => {
    try {
      const { data } = await api.get('/mt/status');
      setStatus((prev) => {
        if (prev?.balance != null) setPrevBalance(prev.balance);
        return data;
      });
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 3000);
    return () => clearInterval(timerRef.current);
  }, []);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl border border-[#334155] p-4 animate-pulse">
        <div className="h-16" />
      </div>
    );
  }

  if (!status || !status.connected) {
    return (
      <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl border border-red-500/30 p-4">
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <WifiOff size={16} />
          <span>{t('mt5Widget.disconnected')}</span>
        </div>
      </div>
    );
  }

  const floatingPnl = status.balance != null && status.equity != null
    ? status.equity - status.balance
    : 0;

  return (
    <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl border border-[#D4AF37]/30 p-4 relative overflow-hidden">
      {/* Gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-400 font-medium">{t('mt5Widget.title')}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{status.login}</span>
          <Wifi size={12} className="text-green-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Balance */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{t('mt5Widget.balance')}</p>
          <p className="text-lg font-bold text-white font-mono">
            ${status.balance?.toFixed(2)}
          </p>
        </div>

        {/* Equity */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{t('mt5Widget.equity')}</p>
          <p className={`text-lg font-bold font-mono ${
            floatingPnl >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            ${status.equity?.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Floating P&L */}
      {floatingPnl !== 0 && (
        <div className="mt-2 pt-2 border-t border-[#334155]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{t('mt5Widget.floatingPnl')}</span>
            <span className={`text-sm font-semibold font-mono ${
              floatingPnl >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {floatingPnl >= 0 ? '+' : ''}{floatingPnl.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
