import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { Users, TrendingUp, DollarSign, Activity } from 'lucide-react';

export default function DashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    api.get('/trades/all?limit=1').then(({ data }) => {
      setStats({ totalTrades: data.total });
    });
    api.get('/users?limit=1').then(({ data }) => {
      setUserCount(data.total);
    });
  }, []);

  const cards = [
    { label: t('dashboard.totalUsers'), value: userCount, icon: Users, color: 'text-blue-400' },
    { label: t('dashboard.totalTrades'), value: stats?.totalTrades ?? 0, icon: TrendingUp, color: 'text-green-400' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('dashboard.title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-[#1e293b] p-6 rounded-xl border border-[#334155]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm">{card.label}</span>
              <card.icon size={20} className={card.color} />
            </div>
            <p className="text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
