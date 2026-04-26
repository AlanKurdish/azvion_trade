import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { CreditCard, Pencil, Plus, Trash2, X, Lock } from 'lucide-react';

interface DebitCardRow {
  id: string;
  nameEn: string;
  nameAr: string;
  nameCkb: string;
  percentage: string;
  price: string;
  durationHours: number;
  isActive: boolean;
  _count?: { purchases: number };
}

const empty = {
  nameEn: '', nameAr: '', nameCkb: '',
  percentage: '', price: '', durationHours: '', isActive: true,
};

export default function DebitCardsPage() {
  const { t } = useTranslation();
  const [cards, setCards] = useState<DebitCardRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DebitCardRow | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/debit-cards/admin/all');
      setCards(data);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setError('');
    setShowForm(true);
  };

  const openEdit = (card: DebitCardRow) => {
    setEditing(card);
    setForm({
      nameEn: card.nameEn,
      nameAr: card.nameAr,
      nameCkb: card.nameCkb,
      percentage: String(card.percentage),
      price: String(card.price),
      durationHours: String(card.durationHours),
      isActive: card.isActive,
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      nameEn: form.nameEn.trim(),
      nameAr: form.nameAr.trim(),
      nameCkb: form.nameCkb.trim(),
      percentage: parseFloat(form.percentage),
      price: parseFloat(form.price),
      durationHours: parseInt(form.durationHours, 10),
      isActive: form.isActive,
    };
    if (!payload.nameEn || !payload.nameAr || !payload.nameCkb) {
      return setError(t('debitCards.validNamesRequired'));
    }
    if (!isFinite(payload.percentage) || payload.percentage <= 0) {
      return setError(t('debitCards.validPercent'));
    }
    if (!isFinite(payload.price) || payload.price < 0) {
      return setError(t('debitCards.validPrice'));
    }
    if (!Number.isFinite(payload.durationHours) || payload.durationHours < 1) {
      return setError(t('debitCards.validDuration'));
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/debit-cards/${editing.id}`, payload);
      } else {
        await api.post('/debit-cards', payload);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || t('debitCards.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (card: DebitCardRow) => {
    if (!confirm(t('debitCards.confirmDelete', { name: card.nameEn }))) return;
    try {
      await api.delete(`/debit-cards/${card.id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || t('debitCards.deleteFailed'));
    }
  };

  const toggleActive = async (card: DebitCardRow) => {
    try {
      await api.patch(`/debit-cards/${card.id}`, { isActive: !card.isActive });
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || t('debitCards.updateFailed'));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="text-[#D4AF37]" size={26} /> {t('debitCards.title')}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {t('debitCards.subtitle')}
          </p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-black rounded-lg font-semibold">
          <Plus size={18} /> {t('debitCards.newCard')}
        </button>
      </div>

      <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#334155]">
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('debitCards.nameEn')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('debitCards.nameAr')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('debitCards.nameCkb')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('debitCards.percent')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('debitCards.price')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('debitCards.duration')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('debitCards.purchases')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('debitCards.status')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('debitCards.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => {
              const purchases = c._count?.purchases ?? 0;
              const hasPurchases = purchases > 0;
              return (
                <tr key={c.id} className="border-b border-[#334155]/50 hover:bg-white/5">
                  <td className="px-6 py-3 font-semibold">{c.nameEn}</td>
                  <td className="px-6 py-3 text-gray-300">{c.nameAr}</td>
                  <td className="px-6 py-3 text-gray-300">{c.nameCkb}</td>
                  <td className="px-6 py-3 text-[#D4AF37] font-semibold">{Number(c.percentage)}%</td>
                  <td className="px-6 py-3 text-green-400">${Number(c.price).toFixed(2)}</td>
                  <td className="px-6 py-3 text-gray-300">{c.durationHours}h</td>
                  <td className="px-6 py-3 text-gray-300">{purchases}</td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => toggleActive(c)}
                      title={c.isActive ? t('debitCards.disableTooltip') : t('debitCards.enableTooltip')}
                      className={`w-10 h-5 rounded-full transition-colors ${c.isActive ? 'bg-green-500' : 'bg-gray-600'}`}
                    >
                      <span className={`block w-4 h-4 bg-white rounded-full transform transition-transform ${c.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEdit(c)} className="text-[#D4AF37] hover:underline" title={t('debitCards.edit')}><Pencil size={16} /></button>
                      {hasPurchases ? (
                        <button
                          disabled
                          title={t('debitCards.lockTooltip', { count: purchases })}
                          className="text-gray-600 cursor-not-allowed"
                        >
                          <Lock size={16} />
                        </button>
                      ) : (
                        <button onClick={() => handleDelete(c)} className="text-red-400" title={t('debitCards.delete')}><Trash2 size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {cards.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">{t('debitCards.noCards')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155] w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">{editing ? t('debitCards.editCard') : t('debitCards.createCard')}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
            )}
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('debitCards.nameEnFull')}</label>
                  <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded text-sm text-white" placeholder={t('debitCards.namePlaceholder')} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('debitCards.nameArFull')}</label>
                  <input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('debitCards.nameCkbFull')}</label>
                  <input value={form.nameCkb} onChange={(e) => setForm({ ...form, nameCkb: e.target.value })} className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded text-sm text-white" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('debitCards.percentLabel')}</label>
                  <input value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} type="number" step="0.01" className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded text-sm text-white" placeholder="25" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('debitCards.priceLabel')}</label>
                  <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" step="0.01" className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded text-sm text-white" placeholder="25" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('debitCards.durationLabel')}</label>
                  <input value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: e.target.value })} type="number" min="1" className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded text-sm text-white" placeholder="24" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                {t('debitCards.activeVisible')}
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-[#334155] rounded-lg text-gray-300">{t('debitCards.cancel')}</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-[#D4AF37] text-black rounded-lg font-semibold disabled:opacity-50">
                  {saving ? t('debitCards.saving') : editing ? t('debitCards.save') : t('debitCards.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
