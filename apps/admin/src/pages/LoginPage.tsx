import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth-store';
import { isRtl } from '../i18n';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login, isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    document.documentElement.dir = isRtl(i18n.language) ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(phone, password);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || t('login.loginFailed'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="w-full max-w-md p-8 bg-[#1e293b] rounded-2xl border border-[#334155]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#D4AF37]">{t('brand')}</h1>
          <p className="text-gray-400 mt-2">{t('adminPanel')}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('login.phone')}</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-[#0f172a] border border-[#334155] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              placeholder={t('login.phonePlaceholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('login.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#0f172a] border border-[#334155] rounded-lg text-white focus:outline-none focus:border-[#D4AF37]"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[#D4AF37] text-black font-semibold rounded-lg hover:bg-[#c4a030] disabled:opacity-50 transition-colors"
          >
            {isLoading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
