import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { Activity, Clock } from 'lucide-react';

interface Row {
  id: string;
  user: { id: string; phone: string; firstName?: string | null; lastName?: string | null; role: string };
  debitCard: { nameEn: string; percentage: string };
  pricePaid: string;
  percentage: string;
  bonusAmount: string;
  durationHours: number;
  purchasedAt: string;
  expiresAt: string;
}

function fmtRemaining(expiresAt: string, expiredLabel: string) {
  const end = new Date(expiresAt).getTime();
  const ms = end - Date.now();
  if (ms <= 0) return expiredLabel;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function ActiveDebitsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [, setTick] = useState(0);

  const load = async () => {
    try {
      const { data } = await api.get('/debit-cards/admin/active');
      setRows(data);
    } catch {}
  };

  useEffect(() => {
    load();
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    const refresh = setInterval(load, 60_000);
    return () => { clearInterval(id); clearInterval(refresh); };
  }, []);

  const expiredLabel = t('activeDebits.expired');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="text-[#D4AF37]" size={26} /> {t('activeDebits.title')}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {t('activeDebits.subtitle')}
          </p>
        </div>
        <button onClick={load} className="px-4 py-2 border border-[#334155] rounded-lg text-sm text-gray-300 hover:bg-white/5">
          {t('activeDebits.refresh')}
        </button>
      </div>

      <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#334155]">
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('activeDebits.user')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('activeDebits.role')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('activeDebits.card')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('activeDebits.boost')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('activeDebits.bonus')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('activeDebits.paid')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('activeDebits.bought')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('activeDebits.expires')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('activeDebits.remaining')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const remaining = fmtRemaining(r.expiresAt, expiredLabel);
              const isLow = remaining !== expiredLabel && (new Date(r.expiresAt).getTime() - Date.now()) < 60 * 60 * 1000;
              return (
                <tr key={r.id} className="border-b border-[#334155]/50 hover:bg-white/5">
                  <td className="px-6 py-3">
                    <div className="font-semibold">{r.user.firstName} {r.user.lastName}</div>
                    <div className="text-xs text-gray-400">{r.user.phone}</div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.user.role === 'SHOP' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {r.user.role}
                    </span>
                  </td>
                  <td className="px-6 py-3">{r.debitCard.nameEn}</td>
                  <td className="px-6 py-3 text-[#D4AF37] font-semibold">{Number(r.percentage)}%</td>
                  <td className="px-6 py-3 text-green-400 font-semibold">${Number(r.bonusAmount).toFixed(2)}</td>
                  <td className="px-6 py-3">${Number(r.pricePaid).toFixed(2)}</td>
                  <td className="px-6 py-3 text-xs text-gray-400">{new Date(r.purchasedAt).toLocaleString()}</td>
                  <td className="px-6 py-3 text-xs text-gray-400">{new Date(r.expiresAt).toLocaleString()}</td>
                  <td className="px-6 py-3">
                    <span className={`flex items-center gap-1 text-sm font-semibold ${isLow ? 'text-amber-400' : 'text-green-400'}`}>
                      <Clock size={14} /> {remaining}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">{t('activeDebits.noActive')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
