import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { HMIHeader } from '../../components/hmi/HMIHeader';
import { useAuth } from '../../auth/AuthContext';
import { LanguageSwitcher } from '../../components/hmi/GlobalNavigation';
import { useLanguage } from '../../i18n/LanguageContext';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, loading } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (user) navigate('/ws3', { replace: true }); }, [navigate, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!await login(username, password)) {
      setError(t('invalidCredentials'));
      return;
    }
    const from = (location.state as { from?: string } | null)?.from ?? '/ws3';
    navigate(from, { replace: true });
  };

  return <main className="flex min-h-screen flex-col bg-navy text-slate-800"><HMIHeader variant="machine" title={t('systemTitle')} subtitle={t('loginSubtitle')} time={new Date().toLocaleTimeString()} children={<LanguageSwitcher />} /><div className="flex flex-1 items-center justify-center bg-hmiConsole p-4"><div className="w-full max-w-[460px] border-2 border-industrialDark bg-white"><header className="bg-industrialDark px-4 py-3 text-white"><h1 className="text-sm font-bold uppercase tracking-wider">{t('loginTitle')}</h1><p className="mt-1 text-[10px] text-slate-300">{t('loginSubtitle')}</p></header><form className="grid gap-3 p-4" onSubmit={submit}><label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{t('username')}<input className="min-h-10 border-2 border-line bg-white px-3 text-sm font-semibold" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label><label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{t('password')}<input type="password" className="min-h-10 border-2 border-line bg-white px-3 text-sm font-semibold" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>{error && <div className="border border-alarm bg-red-50 px-3 py-2 text-xs font-semibold text-alarm">{error}</div>}<HMIButton type="submit" variant="primary" size="large" disabled={loading}>{t('login')}</HMIButton></form></div></div></main>;
}
