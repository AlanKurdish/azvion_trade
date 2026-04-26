import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { Plus, Pencil, Download, Search, Trash2 } from 'lucide-react';

interface MtSymbol {
  symbol: string;
  description: string;
  digits: number;
}

export default function SymbolsPage() {
  const { t } = useTranslation();
  const [symbols, setSymbols] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', displayName: '', mtSymbol: '',
    lotSize: '', amount: '', amountLabel: '', formula: '', commission: '',
    commissionUser: '', commissionShop: '', isTradable: false,
    isReadOnly: false, categoryId: '' as string,
  });
  const [categories, setCategories] = useState<Array<{ id: string; nameEn: string; nameAr: string; nameCkb: string }>>([]);

  // MT symbols picker
  const [showMtPicker, setShowMtPicker] = useState(false);
  const [mtSymbols, setMtSymbols] = useState<MtSymbol[]>([]);
  const [mtLoading, setMtLoading] = useState(false);
  const [mtSearch, setMtSearch] = useState('');
  const [mtError, setMtError] = useState('');

  const loadSymbols = async () => {
    const { data } = await api.get('/symbols/all');
    setSymbols(data);
  };

  const loadCategories = async () => {
    try {
      const { data } = await api.get('/symbol-categories/all');
      setCategories(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => { loadSymbols(); loadCategories(); }, []);

  const loadMtSymbols = async () => {
    setMtLoading(true);
    setMtError('');
    try {
      const { data } = await api.get('/mt/symbols');
      setMtSymbols(data);
    } catch (err: any) {
      setMtError(err.response?.data?.message || 'Failed to load MT symbols. Is the bridge connected?');
    }
    setMtLoading(false);
  };

  const openAddFromMt = () => {
    setShowMtPicker(true);
    setMtSearch('');
    loadMtSymbols();
  };

  const selectMtSymbol = (mt: MtSymbol) => {
    setForm({
      name: mt.symbol,
      displayName: mt.description || mt.symbol,
      mtSymbol: mt.symbol,
      lotSize: '1',
      amount: '1',
      amountLabel: '',
      formula: '',
      commission: '0',
      commissionUser: '0',
      commissionShop: '0',
      isTradable: false,
      isReadOnly: false,
      categoryId: '',
    });
    setShowMtPicker(false);
    setEditing(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      ...form,
      lotSize: parseFloat(form.lotSize),
      amount: parseFloat(form.amount),
      commission: parseFloat(form.commission || '0'),
      commissionUser: parseFloat(form.commissionUser || '0'),
      commissionShop: parseFloat(form.commissionShop || '0'),
      categoryId: form.categoryId || null,
    };
    if (!payload.amountLabel) delete payload.amountLabel;
    if (!payload.formula) delete payload.formula;

    if (editing) {
      const { mtSymbol: _, ...updatePayload } = payload;
      await api.patch(`/symbols/${editing.id}`, updatePayload);
    } else {
      await api.post('/symbols', payload);
    }
    setShowForm(false);
    setEditing(null);
    setForm({ name: '', displayName: '', mtSymbol: '', lotSize: '', amount: '', amountLabel: '', formula: '', commission: '', commissionUser: '', commissionShop: '', isTradable: false, isReadOnly: false, categoryId: '' });
    loadSymbols();
  };

  const startEdit = (sym: any) => {
    setEditing(sym);
    setForm({
      name: sym.name, displayName: sym.displayName, mtSymbol: sym.mtSymbol,
      lotSize: String(sym.lotSize), amount: String(sym.amount), amountLabel: sym.amountLabel || '',
      formula: sym.formula || '', commission: String(sym.commission),
      commissionUser: String(sym.commissionUser ?? '0'),
      commissionShop: String(sym.commissionShop ?? '0'),
      isTradable: sym.isTradable,
      isReadOnly: !!sym.isReadOnly, categoryId: sym.categoryId || '',
    });
    setShowForm(true);
  };

  const toggleTradable = async (sym: any) => {
    await api.patch(`/symbols/${sym.id}`, { isTradable: !sym.isTradable });
    loadSymbols();
  };

  const deleteSymbol = async (sym: any) => {
    if (!confirm(t('symbols.deleteConfirm', { name: sym.displayName, symbol: sym.mtSymbol }))) return;
    try {
      await api.delete(`/symbols/${sym.id}`);
      loadSymbols();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete symbol');
    }
  };

  const filteredMt = mtSearch
    ? mtSymbols.filter((s) =>
        (s.symbol + s.description).toLowerCase().includes(mtSearch.toLowerCase())
      )
    : mtSymbols;

  // Symbols already added (to show a badge)
  const addedMtSymbols = new Set(symbols.map((s) => s.mtSymbol));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('symbols.title')}</h2>
        <div className="flex gap-3">
          <button onClick={openAddFromMt} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
            <Download size={18} /> {t('symbols.importMt5')}
          </button>
          <button onClick={() => { setEditing(null); setForm({ name: '', displayName: '', mtSymbol: '', lotSize: '', amount: '', amountLabel: '', formula: '', commission: '', commissionUser: '', commissionShop: '', isTradable: false, isReadOnly: false, categoryId: '' }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-black rounded-lg font-semibold">
            <Plus size={18} /> {t('symbols.addManual')}
          </button>
        </div>
      </div>

      <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#334155]">
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('symbols.name')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('symbols.mtSymbol')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('symbols.lotSize')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('symbols.amount')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('symbols.formula')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">User Comm.</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">Shop Comm.</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('symbols.category')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('symbols.tradable')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('symbols.readOnly')}</th>
              <th className="text-left px-6 py-3 text-sm text-gray-400">{t('symbols.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {symbols.map((sym) => (
              <tr key={sym.id} className="border-b border-[#334155]/50 hover:bg-white/5">
                <td className="px-6 py-3 font-semibold">{sym.displayName}</td>
                <td className="px-6 py-3 text-gray-400">{sym.mtSymbol}</td>
                <td className="px-6 py-3">{sym.lotSize}</td>
                <td className="px-6 py-3">{sym.amount}{sym.amountLabel && <span className="text-gray-400 text-xs ms-1">({sym.amountLabel})</span>}</td>
                <td className="px-6 py-3 text-gray-400 text-sm font-mono">{sym.formula || '—'}</td>
                <td className="px-6 py-3 text-blue-400">${Number(sym.commissionUser ?? sym.commission ?? 0).toFixed(2)}</td>
                <td className="px-6 py-3 text-purple-400">${Number(sym.commissionShop ?? sym.commission ?? 0).toFixed(2)}</td>
                <td className="px-6 py-3 text-gray-400 text-sm">
                  {sym.category ? sym.category.nameEn : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-6 py-3">
                  <button onClick={() => toggleTradable(sym)} className={`w-10 h-5 rounded-full transition-colors ${sym.isTradable ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <span className={`block w-4 h-4 bg-white rounded-full transform transition-transform ${sym.isTradable ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                <td className="px-6 py-3">
                  {sym.isReadOnly ? (
                    <span className="inline-block px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">{t('symbols.readOnly')}</span>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </td>
                <td className="px-6 py-3 flex gap-3">
                  <button onClick={() => startEdit(sym)} className="text-[#D4AF37] hover:underline">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => deleteSymbol(sym)} className="text-red-400 hover:text-red-300">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {symbols.length === 0 && (
              <tr><td colSpan={11} className="text-center py-8 text-gray-400">{t('symbols.noSymbols')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MT5 Symbol Picker Modal */}
      {showMtPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155] w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">{t('symbols.importTitle')}</h3>
              <button onClick={() => setShowMtPicker(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>

            {mtError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {mtError}
              </div>
            )}

            <div className="mb-4 relative">
              <Search size={18} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={mtSearch}
                onChange={(e) => setMtSearch(e.target.value)}
                placeholder={t('symbols.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
                autoFocus
              />
            </div>

            {mtLoading ? (
              <div className="flex-1 flex items-center justify-center py-10">
                <div className="text-gray-400">{t('symbols.loadingMt5')}</div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-[#1e293b]">
                    <tr className="border-b border-[#334155]">
                      <th className="text-left px-4 py-2 text-sm text-gray-400">{t('symbols.symbol')}</th>
                      <th className="text-left px-4 py-2 text-sm text-gray-400">{t('symbols.description')}</th>
                      <th className="text-left px-4 py-2 text-sm text-gray-400">{t('symbols.digits')}</th>
                      <th className="text-left px-4 py-2 text-sm text-gray-400"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMt.map((mt) => (
                      <tr key={mt.symbol} className="border-b border-[#334155]/30 hover:bg-white/5">
                        <td className="px-4 py-2.5 font-semibold">{mt.symbol}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-sm">{mt.description}</td>
                        <td className="px-4 py-2.5 text-gray-400">{mt.digits}</td>
                        <td className="px-4 py-2.5 text-right flex items-center gap-2 justify-end">
                          {addedMtSymbols.has(mt.symbol) && (
                            <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">{t('symbols.added')}</span>
                          )}
                          <button
                            onClick={() => selectMtSymbol(mt)}
                            className="text-sm px-3 py-1 bg-[#D4AF37] text-black rounded font-semibold hover:bg-[#c4a030]"
                          >
                            {t('symbols.select')}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredMt.length === 0 && !mtLoading && (
                      <tr><td colSpan={4} className="text-center py-6 text-gray-400">
                        {mtSymbols.length === 0 ? t('symbols.noSymbolsAvailable') : t('symbols.noMatch')}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 text-xs text-gray-500">
              {t('symbols.symbolsAvailable', { count: mtSymbols.length })}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Symbol Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155] w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">{editing ? t('symbols.editTitle') : t('symbols.configureTitle')}</h3>
            {!editing && form.mtSymbol && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm">
                {t('symbols.importedInfo', { symbol: form.mtSymbol })}
              </div>
            )}
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('symbols.namePlaceholder')} className="px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white" required />
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder={t('symbols.displayNamePlaceholder')} className="px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white" required />
              <input value={form.mtSymbol} onChange={(e) => setForm({ ...form, mtSymbol: e.target.value })} placeholder={t('symbols.mtSymbolPlaceholder')} className="px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white read-only:opacity-60" readOnly={!!editing || (!!form.mtSymbol && !editing)} required />
              <input value={form.lotSize} onChange={(e) => setForm({ ...form, lotSize: e.target.value })} placeholder={t('symbols.lotSizePlaceholder')} type="number" step="0.01" className="px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white" required />
              <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={t('symbols.amountPlaceholder')} type="number" className="px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white" required />
              <input value={form.amountLabel} onChange={(e) => setForm({ ...form, amountLabel: e.target.value })} placeholder={t('symbols.amountLabelPlaceholder')} className="px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white" />
              <input value={form.formula} onChange={(e) => setForm({ ...form, formula: e.target.value })} placeholder={t('symbols.formulaPlaceholder')} className="col-span-2 px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white font-mono" />
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-blue-400 mb-1">User Commission ($)</label>
                  <input value={form.commissionUser} onChange={(e) => setForm({ ...form, commissionUser: e.target.value })} placeholder="e.g. 25" type="number" step="0.01" className="w-full px-3 py-2 bg-[#0f172a] border border-blue-500/30 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-xs text-purple-400 mb-1">Shop Commission ($)</label>
                  <input value={form.commissionShop} onChange={(e) => setForm({ ...form, commissionShop: e.target.value })} placeholder="e.g. 15" type="number" step="0.01" className="w-full px-3 py-2 bg-[#0f172a] border border-purple-500/30 rounded-lg text-white" />
                </div>
                <p className="col-span-2 text-[10px] text-gray-500 -mt-2">Per-role commissions. The legacy field below is kept as a fallback when both are 0.</p>
              </div>
              <input value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} placeholder={`Legacy fallback ${t('symbols.commissionPlaceholder')}`} type="number" step="0.01" className="px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white text-sm" />
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white"
              >
                <option value="">{t('symbols.noCategory')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.nameEn}</option>
                ))}
              </select>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isTradable} onChange={(e) => setForm({ ...form, isTradable: e.target.checked })} className="w-4 h-4" />
                <span>{t('symbols.tradable')}</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isReadOnly} onChange={(e) => setForm({ ...form, isReadOnly: e.target.checked })} className="w-4 h-4" />
                <span>{t('symbols.readOnly')}</span>
              </label>
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 py-2.5 border border-[#334155] rounded-lg">{t('symbols.cancel')}</button>
                <button type="submit" className="flex-1 py-2.5 bg-[#D4AF37] text-black rounded-lg font-semibold">{editing ? t('symbols.update') : t('symbols.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
