import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { Plus, Pencil, Trash2, X, Layers } from 'lucide-react';

interface Category {
  id: string;
  nameEn: string;
  nameAr: string;
  nameCkb: string;
  order: number;
  isActive: boolean;
  _count?: { symbols: number };
}

const emptyForm = {
  nameEn: '',
  nameAr: '',
  nameCkb: '',
  order: 0,
  isActive: true,
};

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCategories = async () => {
    try {
      const { data } = await api.get('/symbol-categories/all');
      setCategories(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, order: categories.length });
    setError('');
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      nameEn: cat.nameEn,
      nameAr: cat.nameAr,
      nameCkb: cat.nameCkb,
      order: cat.order,
      isActive: cat.isActive,
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.patch(`/symbol-categories/${editing.id}`, form);
      } else {
        await api.post('/symbol-categories', form);
      }
      setShowForm(false);
      loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(t('categories.confirmDelete', { name: cat.nameEn }))) return;
    try {
      await api.delete(`/symbol-categories/${cat.id}`);
      loadCategories();
    } catch {
      // ignore
    }
  };

  const toggleActive = async (cat: Category) => {
    try {
      await api.patch(`/symbol-categories/${cat.id}`, { isActive: !cat.isActive });
      loadCategories();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('categories.title')}</h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#c5a030]"
        >
          <Plus size={16} /> {t('categories.addCategory')}
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-12 text-center text-gray-400">
          <Layers size={40} className="mx-auto mb-3 text-gray-600" />
          {t('categories.noCategories')}
        </div>
      ) : (
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="text-left px-6 py-3 text-sm text-gray-400">#</th>
                <th className="text-left px-6 py-3 text-sm text-gray-400">{t('categories.nameEn')}</th>
                <th className="text-left px-6 py-3 text-sm text-gray-400">{t('categories.nameAr')}</th>
                <th className="text-left px-6 py-3 text-sm text-gray-400">{t('categories.nameCkb')}</th>
                <th className="text-left px-6 py-3 text-sm text-gray-400">{t('categories.symbols')}</th>
                <th className="text-left px-6 py-3 text-sm text-gray-400">{t('categories.status')}</th>
                <th className="text-left px-6 py-3 text-sm text-gray-400">{t('categories.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-[#334155]/50 hover:bg-white/5">
                  <td className="px-6 py-3 text-gray-400">{cat.order}</td>
                  <td className="px-6 py-3 font-semibold">{cat.nameEn}</td>
                  <td className="px-6 py-3" dir="rtl">{cat.nameAr}</td>
                  <td className="px-6 py-3" dir="rtl">{cat.nameCkb}</td>
                  <td className="px-6 py-3 text-gray-400">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded text-xs">
                      <Layers size={12} /> {cat._count?.symbols ?? 0}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => toggleActive(cat)}
                      className={`w-10 h-5 rounded-full transition-colors ${cat.isActive ? 'bg-green-500' : 'bg-gray-600'}`}
                    >
                      <span
                        className={`block w-4 h-4 bg-white rounded-full transform transition-transform ${cat.isActive ? 'translate-x-5' : 'translate-x-0.5'}`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(cat)} className="text-[#D4AF37] hover:opacity-80">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(cat)} className="text-red-400 hover:text-red-300">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div
            className="bg-[#1e293b] rounded-xl border border-[#334155] p-6 w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">
                {editing ? t('categories.editCategory') : t('categories.addCategory')}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('categories.nameEn')}</label>
                <input
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white"
                  placeholder="Forex"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('categories.nameAr')}</label>
                <input
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white"
                  placeholder="عملات"
                  dir="rtl"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('categories.nameCkb')}</label>
                <input
                  value={form.nameCkb}
                  onChange={(e) => setForm({ ...form, nameCkb: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white"
                  placeholder="دراوەکان"
                  dir="rtl"
                  required
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">{t('categories.order')}</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-white"
                  />
                </div>
                <div className="flex-1 flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="w-4 h-4 rounded border-[#334155] accent-[#D4AF37]"
                    />
                    <span className="text-sm text-gray-300">{t('categories.active')}</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-gray-300 hover:text-white"
                >
                  {t('categories.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#c5a030] disabled:opacity-50"
                >
                  {saving ? t('categories.saving') : editing ? t('categories.save') : t('categories.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
