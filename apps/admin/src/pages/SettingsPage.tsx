import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [mtStatus, setMtStatus] = useState<any>(null);
  const [mtForm, setMtForm] = useState({ accountId: '', token: '' });
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/mt/status').then(({ data }) => setMtStatus(data)).catch(() => {});
    api.get('/settings/privacy-policy').then(({ data }) => setPrivacyPolicy(data.value));
  }, []);

  const connectMt = async () => {
    await api.post('/mt/connect', mtForm);
    const { data } = await api.get('/mt/status');
    setMtStatus(data);
  };

  const disconnectMt = async () => {
    await api.post('/mt/disconnect');
    setMtStatus({ connected: false });
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
            <p className="text-green-400 mb-2">{t('settings.connectedTo', { id: mtStatus.accountId, platform: mtStatus.platform })}</p>
            <button onClick={disconnectMt} className="px-4 py-2 bg-red-600 text-white rounded-lg">{t('settings.disconnect')}</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">{t('settings.notConnected')}</p>
            <input value={mtForm.accountId} onChange={(e) => setMtForm({ ...mtForm, accountId: e.target.value })} placeholder={t('settings.accountId')} className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg text-white" />
            <input value={mtForm.token} onChange={(e) => setMtForm({ ...mtForm, token: e.target.value })} placeholder={t('settings.token')} type="password" className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg text-white" />
            <button onClick={connectMt} className="px-6 py-2.5 bg-[#D4AF37] text-black rounded-lg font-semibold">{t('settings.connect')}</button>
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
