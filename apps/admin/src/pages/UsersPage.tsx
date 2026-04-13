import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { Plus, Search, X } from 'lucide-react';

export default function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ phone: '', password: '', firstName: '', lastName: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const loadUsers = async () => {
    try {
      const { data } = await api.get(`/users?page=${page}&limit=20`);
      setUsers(data.users);
      setTotal(data.total);
    } catch {}
  };

  useEffect(() => { loadUsers(); }, [page]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.phone.trim()) errs.phone = t('users.phoneRequired');
    else if (form.phone.trim().length < 3) errs.phone = t('users.phoneMin');
    if (!form.password.trim()) errs.password = t('users.passwordRequired');
    else if (form.password.trim().length < 6) errs.password = t('users.passwordMin');
    if (!form.firstName.trim()) errs.firstName = t('users.firstNameRequired');
    if (!form.lastName.trim()) errs.lastName = t('users.lastNameRequired');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;
    setCreating(true);
    try {
      await api.post('/users', {
        phone: form.phone.trim(),
        password: form.password.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      });
      setShowCreate(false);
      setForm({ phone: '', password: '', firstName: '', lastName: '' });
      setErrors({});
      loadUsers();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      if (typeof msg === 'string') setApiError(msg);
      else if (Array.isArray(msg)) setApiError(msg.join(', '));
      else setApiError(t('users.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const filtered = search
    ? users.filter((u) =>
        (u.phone + (u.firstName || '') + (u.lastName || '')).toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('users.title')}</h2>
        <button
          onClick={() => { setShowCreate(true); setErrors({}); setApiError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-black rounded-lg font-semibold hover:bg-[#c4a030]"
        >
          <Plus size={18} /> {t('users.addUser')}
        </button>
      </div>

      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('users.searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2.5 bg-[#1e293b] border border-[#334155] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
        />
      </div>

      <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#334155]">
              <th className="text-left px-6 py-4 text-sm text-gray-400">{t('users.phone')}</th>
              <th className="text-left px-6 py-4 text-sm text-gray-400">{t('users.name')}</th>
              <th className="text-left px-6 py-4 text-sm text-gray-400">{t('users.balance')}</th>
              <th className="text-left px-6 py-4 text-sm text-gray-400">{t('users.status')}</th>
              <th className="text-left px-6 py-4 text-sm text-gray-400">{t('users.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b border-[#334155]/50 hover:bg-white/5">
                <td className="px-6 py-4">{user.phone}</td>
                <td className="px-6 py-4">{user.firstName} {user.lastName}</td>
                <td className="px-6 py-4 text-[#D4AF37] font-semibold">${user.balance?.amount ?? '0'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${user.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {user.isActive ? t('users.active') : t('users.inactive')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <Link to={`/dashboard/users/${user.id}`} className="text-[#D4AF37] hover:underline text-sm">
                    {t('users.viewEdit')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center py-8 text-gray-400">{t('users.noUsers')}</p>}
      </div>

      <div className="flex justify-between items-center mt-4 text-sm text-gray-400">
        <span>{t('users.showing', { count: filtered.length, total: total })}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 bg-[#1e293b] rounded disabled:opacity-30">{t('users.prev')}</button>
          <button disabled={users.length < 20} onClick={() => setPage(page + 1)} className="px-3 py-1 bg-[#1e293b] rounded disabled:opacity-30">{t('users.next')}</button>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155] w-full max-w-md relative">
            <button onClick={() => setShowCreate(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold mb-4">{t('users.createUser')}</h3>

            {apiError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {apiError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('users.phone')} *</label>
                <input
                  value={form.phone}
                  onChange={(e) => { const v = e.target.value.replace(/[^0-9+\-\s]/g, ''); setForm({ ...form, phone: v }); setErrors({ ...errors, phone: '' }); }}
                  placeholder="e.g. +989123456789"
                  type="tel"
                  inputMode="tel"
                  className={`w-full px-4 py-2.5 bg-[#0f172a] border rounded-lg text-white focus:outline-none ${errors.phone ? 'border-red-500' : 'border-[#334155] focus:border-[#D4AF37]'}`}
                />
                {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('users.passwordLabel')}</label>
                <input
                  value={form.password}
                  onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors({ ...errors, password: '' }); }}
                  placeholder={t('users.minChars')}
                  type="password"
                  className={`w-full px-4 py-2.5 bg-[#0f172a] border rounded-lg text-white focus:outline-none ${errors.password ? 'border-red-500' : 'border-[#334155] focus:border-[#D4AF37]'}`}
                />
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('users.firstName')}</label>
                <input
                  value={form.firstName}
                  onChange={(e) => { setForm({ ...form, firstName: e.target.value }); setErrors({ ...errors, firstName: '' }); }}
                  placeholder={t('users.firstName')}
                  className={`w-full px-4 py-2.5 bg-[#0f172a] border rounded-lg text-white focus:outline-none ${errors.firstName ? 'border-red-500' : 'border-[#334155] focus:border-[#D4AF37]'}`}
                />
                {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('users.lastName')}</label>
                <input
                  value={form.lastName}
                  onChange={(e) => { setForm({ ...form, lastName: e.target.value }); setErrors({ ...errors, lastName: '' }); }}
                  placeholder={t('users.lastName')}
                  className={`w-full px-4 py-2.5 bg-[#0f172a] border rounded-lg text-white focus:outline-none ${errors.lastName ? 'border-red-500' : 'border-[#334155] focus:border-[#D4AF37]'}`}
                />
                {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-[#334155] rounded-lg text-gray-300 hover:bg-white/5">
                  {t('users.cancel')}
                </button>
                <button type="submit" disabled={creating} className="flex-1 py-2.5 bg-[#D4AF37] text-black rounded-lg font-semibold hover:bg-[#c4a030] disabled:opacity-50">
                  {creating ? t('users.creating') : t('users.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
