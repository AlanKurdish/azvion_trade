import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [mtStatus, setMtStatus] = useState<any>(null);
  const [mtForm, setMtForm] = useState({ login: '', password: '', server: '' });
  const [connecting, setConnecting] = useState(false);
  const [mtError, setMtError] = useState('');
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const [saved, setSaved] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoSaving, setDemoSaving] = useState(false);

  const loadStatus = () => {
    api.get('/mt/status').then(({ data }) => setMtStatus(data)).catch(() => {});
  };

  useEffect(() => {
    loadStatus();
    api.get('/settings/privacy-policy').then(({ data }) => setPrivacyPolicy(data.value));
    api.get('/settings/demo-mode').then(({ data }) => setDemoMode(!!data.demoMode)).catch(() => {});
  }, []);

  const toggleDemoMode = async () => {
    const next = !demoMode;
    setDemoSaving(true);
    try {
      await api.put('/settings/demo_mode', { value: next ? 'true' : 'false' });
      setDemoMode(next);
    } catch {
      // ignore
    } finally {
      setDemoSaving(false);
    }
  };

  const connectMt = async () => {
    if (!mtForm.login || !mtForm.password || !mtForm.server) return;
    setConnecting(true);
    setMtError('');
    try {
      await api.post('/mt/connect', mtForm);
      loadStatus();
      setMtForm({ login: '', password: '', server: '' });
    } catch (err: any) {
      setMtError(err.response?.data?.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const disconnectMt = async () => {
    await api.post('/mt/disconnect');
    setMtStatus({ connected: false });
  };

  const autoConnectMt = async () => {
    setConnecting(true);
    setMtError('');
    try {
      await api.post('/mt/auto-connect');
      loadStatus();
    } catch (err: any) {
      setMtError(err.response?.data?.message || 'Auto-connect failed. Make sure MT5 terminal is running with an account logged in.');
    } finally {
      setConnecting(false);
    }
  };

  const savePrivacy = async () => {
    await api.put('/settings/privacy_policy', { value: privacyPolicy });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">{t('settings.title')}</h2>

      <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155]">
        <h3 className="text-lg font-semibold mb-4">{t('settings.mtConnection')}</h3>
        {mtStatus?.connected ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 font-medium">{t('settings.connected')}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div>
                <span className="text-gray-400 block text-xs">{t('settings.login')}</span>
                <span>{mtStatus.login || '-'}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-xs">{t('settings.server')}</span>
                <span>{mtStatus.brokerServer || '-'}</span>
              </div>
              {mtStatus.balance != null && (
                <>
                  <div>
                    <span className="text-gray-400 block text-xs">{t('settings.balance')}</span>
                    <span className="text-[#D4AF37] font-semibold">${mtStatus.balance?.toFixed?.(2) ?? mtStatus.balance}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-xs">{t('settings.equity')}</span>
                    <span>${mtStatus.equity?.toFixed?.(2) ?? mtStatus.equity}</span>
                  </div>
                </>
              )}
            </div>
            <button onClick={disconnectMt} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">{t('settings.disconnect')}</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-gray-400 text-sm">{t('settings.notConnected')}</span>
            </div>
            {mtError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{mtError}</div>
            )}
            {/* Auto-connect button */}
            <button
              onClick={autoConnectMt}
              disabled={connecting}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {connecting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              )}
              {t('settings.autoConnect')}
            </button>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#334155]" />
              <span className="text-xs text-gray-500">{t('settings.orManual')}</span>
              <div className="flex-1 h-px bg-[#334155]" />
            </div>
            <input
              value={mtForm.login}
              onChange={(e) => setMtForm({ ...mtForm, login: e.target.value })}
              placeholder={t('settings.loginPlaceholder')}
              className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg text-white"
            />
            <input
              value={mtForm.password}
              onChange={(e) => setMtForm({ ...mtForm, password: e.target.value })}
              placeholder={t('settings.passwordPlaceholder')}
              type="password"
              className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg text-white"
            />
            <input
              value={mtForm.server}
              onChange={(e) => setMtForm({ ...mtForm, server: e.target.value })}
              placeholder={t('settings.serverPlaceholder')}
              className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg text-white"
            />
            <button
              onClick={connectMt}
              disabled={connecting || !mtForm.login || !mtForm.password || !mtForm.server}
              className="px-6 py-2.5 bg-[#D4AF37] text-black rounded-lg font-semibold disabled:opacity-50"
            >
              {connecting ? t('settings.connecting') : t('settings.connect')}
            </button>
          </div>
        )}
      </div>

      {/* Demo Mode toggle */}
      <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">{t('settings.demoMode')}</h3>
            <p className="text-sm text-gray-400">{t('settings.demoModeHelp')}</p>
          </div>
          <button
            onClick={toggleDemoMode}
            disabled={demoSaving}
            className={`w-12 h-6 rounded-full transition-colors shrink-0 ${demoMode ? 'bg-[#D4AF37]' : 'bg-gray-600'} ${demoSaving ? 'opacity-50' : ''}`}
          >
            <span className={`block w-5 h-5 bg-white rounded-full transform transition-transform ${demoMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {demoMode && (
          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm">
            {t('settings.demoModeActive')}
          </div>
        )}
      </div>

      <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155]">
        <h3 className="text-lg font-semibold mb-4">{t('settings.privacyPolicy')}</h3>
        <textarea
          value={privacyPolicy}
          onChange={(e) => setPrivacyPolicy(e.target.value)}
          rows={8}
          className="w-full px-4 py-3 bg-[#0f172a] border border-[#334155] rounded-lg text-white resize-y"
        />
        <div className="flex items-center gap-4 mt-3">
          <button onClick={savePrivacy} className="px-6 py-2.5 bg-[#D4AF37] text-black rounded-lg font-semibold">{t('settings.save')}</button>
          {saved && <span className="text-green-400 text-sm">{t('settings.saved')}</span>}
        </div>
      </div>
    </div>
  );
}
