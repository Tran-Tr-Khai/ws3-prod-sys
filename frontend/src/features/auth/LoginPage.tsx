import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '../../components/mes/controls/LanguageSwitcher';
import { useAuth } from '../../auth/useAuth';
import { useLanguage } from '../../i18n/useLanguage';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, loading } = useAuth();
  const { t, language } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) navigate('/ws3', { replace: true });
  }, [navigate, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await login(username, password);
    if (result !== 'success') {
      setError(
        result === 'sessionCookieRejected' ? t('loginSessionCookieError') : t('invalidCredentials'),
      );
      return;
    }
    const from = (location.state as { from?: string } | null)?.from ?? '/ws3';
    navigate(from, { replace: true });
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#f2f5f6] text-slate-800">
      <header className="flex min-h-9 items-center border-b border-[#415e6d] bg-[#547587] px-4 text-[#f6fafb]">
        <div className="inline-flex items-center gap-2">
          <strong className="text-[13px] font-bold tracking-[0.03em]">WS3</strong>
          <span className="border-l border-white/25 pl-2 text-[9px] font-semibold tracking-[0.1em] text-[#d5e2e7]">
            MES
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[10px] text-[#e8f0f2] sm:inline">{t('systemTitle')}</span>
          <LanguageSwitcher />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-[400px] border border-[#b8c6cc] bg-white shadow-[0_12px_30px_rgb(45_69_81_/_0.12)]">
          <header className="border-b border-[#dce5e8] px-5 py-4">
            <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-[#293d47]">
              {t('loginTitle')}
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('loginSubtitle')}</p>
          </header>
          <form className="grid gap-4 p-5" onSubmit={submit}>
            <label className="grid gap-1.5 text-xs font-medium text-[#4f6470]">
              {t('username')}
              <input
                className="min-h-10 border border-[#afbec5] bg-white px-3 text-sm font-medium text-[#293d47] outline-none transition-colors placeholder:text-slate-400 focus:border-[#547587] focus:ring-2 focus:ring-[#547587]/15"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-[#4f6470]">
              {t('password')}
              <span className="flex min-h-10 border border-[#afbec5] bg-white transition-colors focus-within:border-[#547587] focus-within:ring-2 focus-within:ring-[#547587]/15">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm font-medium text-[#293d47] outline-none"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={
                    showPassword
                      ? language === 'vi'
                        ? 'Ẩn mật khẩu'
                        : 'Hide password'
                      : language === 'vi'
                        ? 'Hiện mật khẩu'
                        : 'Show password'
                  }
                  title={
                    showPassword
                      ? language === 'vi'
                        ? 'Ẩn mật khẩu'
                        : 'Hide password'
                      : language === 'vi'
                        ? 'Hiện mật khẩu'
                        : 'Show password'
                  }
                  className="inline-flex w-10 shrink-0 items-center justify-center text-[#547587] hover:bg-[#f1f5f6]"
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {showPassword && <path d="m4 4 16 16" />}
                  </svg>
                </button>
              </span>
            </label>
            {error && (
              <div className="border border-[#d79b9b] bg-[#fff7f7] px-3 py-2 text-xs text-alarm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex min-h-10 items-center justify-center bg-[#547587] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#415e6d] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {t('login')}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
