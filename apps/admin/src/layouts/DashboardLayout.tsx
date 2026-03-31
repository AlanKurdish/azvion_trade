import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { LayoutDashboard, Users, TrendingUp, Settings, LogOut, BarChart3, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, isRtl } from '../i18n';
import { useEffect, useState } from 'react';

const navKeys = [
  { to: '/dashboard', icon: LayoutDashboard, key: 'dashboard', end: true },
  { to: '/dashboard/users', icon: Users, key: 'users' },
  { to: '/dashboard/trades', icon: TrendingUp, key: 'trades' },
  { to: '/dashboard/symbols', icon: BarChart3, key: 'symbols' },
  { to: '/dashboard/settings', icon: Settings, key: 'settings' },
];

export default function DashboardLayout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];
  const rtl = isRtl(i18n.language);

  useEffect(() => {
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language, rtl]);

  const changeLang = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('admin_lang', code);
    setShowLangMenu(false);
  };

  return (
    <div className="flex h-screen" style={{ direction: rtl ? 'rtl' : 'ltr' }}>
      {/* Sidebar */}
      <aside className={`w-64 bg-[#1e293b] flex flex-col shrink-0 ${rtl ? 'border-l border-[#334155]' : 'border-r border-[#334155]'}`}>
        <div className="p-6 border-b border-[#334155]">
          <h1 className="text-xl font-bold text-[#D4AF37]">{t('brand')}</h1>
          <p className="text-sm text-gray-400">{t('adminPanel')}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navKeys.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[#D4AF37]/10 text-[#D4AF37]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon size={20} />
              <span>{t(`nav.${item.key}`)}</span>
            </NavLink>
          ))}
        </nav>

        {/* Language Switcher */}
        <div className="px-4 pb-2 relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 w-full transition-colors"
          >
            <Globe size={20} />
            <span>{currentLang.label}</span>
          </button>
          {showLangMenu && (
            <div className={`absolute bottom-14 ${rtl ? 'right-4' : 'left-4'} bg-[#0f172a] border border-[#334155] rounded-lg shadow-xl overflow-hidden z-50 min-w-[140px]`}>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLang(lang.code)}
                  className={`block w-full px-4 py-2.5 text-sm transition-colors ${
                    rtl ? 'text-right' : 'text-left'
                  } ${
                    i18n.language === lang.code
                      ? 'bg-[#D4AF37]/10 text-[#D4AF37]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#334155]">
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-red-400 hover:bg-red-400/10 w-full transition-colors"
          >
            <LogOut size={20} />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8" style={{ direction: rtl ? 'rtl' : 'ltr' }}>
        <Outlet />
      </main>
    </div>
  );
}
