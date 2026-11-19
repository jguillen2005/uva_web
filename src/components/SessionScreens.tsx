import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, LogIn, LogOut, Mail, MailCheck } from 'lucide-react';
import { LEGAL_LINKS } from './legalLinks';
import { sesion, type PerfilSesion } from '../api/sesion';

const LegalNota: React.FC = () => (
  <p className="text-[11px] text-ink-500 mt-4 leading-relaxed text-center">
    Al iniciar sesión aceptas los{' '}
    <a href={LEGAL_LINKS.terminos.href} target="_blank" rel="noopener" className="text-brand-700 font-semibold hover:underline">
      {LEGAL_LINKS.terminos.label}
    </a>{' '}
    y el{' '}
    <a href={LEGAL_LINKS.privacidad.href} target="_blank" rel="noopener" className="text-brand-700 font-semibold hover:underline">
      {LEGAL_LINKS.privacidad.label}
    </a>
    .
  </p>
);

const inputClase =
  'w-full h-11 rounded-lg border border-line-300 bg-white pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 disabled:bg-surface-100';

/**
 * Inicio de sesión de la web con el usuario y la contraseña de Odoo, y recuperación de contraseña
 * (Odoo envía al correo el enlace para restablecerla).
 */
export const LoginScreen: React.FC<{ aviso?: string | null; onLoggedIn: (perfil: PerfilSesion) => void }> = ({
  aviso,
  onLoggedIn,
}) => {
  const [modo, setModo] = useState<'login' | 'recuperar'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, [modo]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Escriba su correo y su contraseña.');
      return;
    }
    setEnviando(true);
    try {
      const r = await sesion.iniciar(email.trim(), password);
      onLoggedIn(r.perfil);
    } catch (err) {
      setError((err as Error).message || 'No se pudo iniciar sesión.');
      setPassword('');
    } finally {
      setEnviando(false);
    }
  };

  const recuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Escriba su correo electrónico.');
      return;
    }
    setEnviando(true);
    try {
      const r = await sesion.recuperar(email.trim());
      setConfirmacion(r.message);
    } catch (err) {
      setError((err as Error).message || 'No se pudo enviar la solicitud.');
    } finally {
      setEnviando(false);
    }
  };

  const cambiarModo = (m: 'login' | 'recuperar') => {
    setModo(m);
    setError(null);
    setConfirmacion(null);
    setPassword('');
  };

  return (
    <div className="min-h-dvh bg-side-900 flex items-center justify-center p-4">
      <main className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 sm:p-8">
        <div className="text-center">
          <img src="/brand/logo-uva.png" alt="Logotipo Sistema UVA" className="w-16 h-16 mx-auto object-contain" />
          <h1 className="text-xl font-bold text-ink-900 mt-4">
            {modo === 'login' ? 'Iniciar sesión' : 'Restablecer contraseña'}
          </h1>
          <p className="text-sm text-ink-600 mt-1 leading-relaxed">
            {modo === 'login'
              ? 'Sistema UVA · NMX-AA-179-SCFI-2018'
              : 'Escriba su correo y le enviaremos un enlace para crear una contraseña nueva.'}
          </p>
        </div>

        {aviso && modo === 'login' && !error && (
          <p role="status" className="mt-5 rounded-lg bg-brand-50 text-brand-800 text-sm px-3 py-2 text-center">
            {aviso}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-danger-50 text-danger-700 text-sm px-3 py-2">
            {error}
          </p>
        )}

        {modo === 'login' ? (
          <form onSubmit={entrar} noValidate className="mt-5 space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold text-ink-800 mb-1">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  ref={emailRef}
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={enviando}
                  placeholder="usuario@empresa.com"
                  className={inputClase}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="block text-sm font-semibold text-ink-800">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => cambiarModo('recuperar')}
                  className="text-xs font-semibold text-brand-700 hover:underline"
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={verPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={enviando}
                  className={`${inputClase} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={verPassword}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-md text-ink-500 hover:text-ink-800"
                >
                  {verPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={enviando}
              className="w-full h-11 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-70 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {enviando ? 'Verificando…' : 'Iniciar sesión'}
            </button>
          </form>
        ) : confirmacion ? (
          <div className="mt-5 text-center">
            <MailCheck className="w-10 h-10 text-brand-600 mx-auto" aria-hidden="true" />
            <p role="status" className="text-sm text-ink-700 mt-3 leading-relaxed">
              {confirmacion}
            </p>
            <p className="text-xs text-ink-500 mt-2">Revise también la carpeta de correo no deseado.</p>
            <button
              type="button"
              onClick={() => cambiarModo('login')}
              className="mt-5 w-full h-11 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={recuperar} noValidate className="mt-5 space-y-4">
            <div>
              <label htmlFor="recuperar-email" className="block text-sm font-semibold text-ink-800 mb-1">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  ref={emailRef}
                  id="recuperar-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={enviando}
                  placeholder="usuario@empresa.com"
                  className={inputClase}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={enviando}
              className="w-full h-11 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-70 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {enviando ? 'Enviando…' : 'Enviar enlace'}
            </button>
            <button
              type="button"
              onClick={() => cambiarModo('login')}
              className="w-full h-10 rounded-lg text-sm font-semibold text-ink-700 hover:bg-surface-100 inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a iniciar sesión
            </button>
          </form>
        )}

        <LegalNota />
      </main>
    </div>
  );
};

/** Pantalla breve mientras se comprueba si hay una sesión vigente. */
export const SessionLoading: React.FC = () => (
  <div className="min-h-dvh bg-side-900 flex items-center justify-center" role="status" aria-live="polite">
    <Loader2 className="w-8 h-8 text-white animate-spin" aria-hidden="true" />
    <span className="sr-only">Comprobando la sesión…</span>
  </div>
);

/** Diálogo de confirmación antes de cerrar sesión. */
export const LogoutDialog: React.FC<{ onCancel: () => void; onConfirm: () => void }> = ({ onCancel, onConfirm }) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        aria-describedby="logout-desc"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-sm w-full p-5 sm:p-6"
      >
        <div className="w-11 h-11 rounded-full bg-danger-50 text-danger-700 flex items-center justify-center mb-3">
          <LogOut className="w-5 h-5" />
        </div>
        <h2 id="logout-title" className="text-lg font-bold text-ink-900">¿Cerrar sesión?</h2>
        <p id="logout-desc" className="text-sm text-ink-600 mt-1 leading-relaxed">
          Saldrás del Sistema UVA en este dispositivo. Los cambios que no hayas guardado se perderán.
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="h-10 px-4 rounded-lg border border-line-300 text-ink-700 hover:bg-surface-100 text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 px-4 rounded-lg bg-danger-700 hover:brightness-110 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
};

/** Pantalla mostrada tras cerrar sesión. */
export const SignedOutScreen: React.FC<{ onSignIn: () => void }> = ({ onSignIn }) => (
  <div className="min-h-dvh bg-side-900 flex items-center justify-center p-4">
    <main className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 sm:p-8 text-center">
      <img src="/brand/logo-uva.png" alt="Logotipo Sistema UVA" className="w-16 h-16 mx-auto object-contain" />
      <h1 className="text-xl font-bold text-ink-900 mt-4">Cerraste sesión</h1>
      <p className="text-sm text-ink-600 mt-1 leading-relaxed">
        Gracias por usar el Sistema UVA. Para volver a entrar usa tu cuenta institucional.
      </p>
      <button
        type="button"
        onClick={onSignIn}
        autoFocus
        className="mt-6 w-full h-11 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
      >
        <LogIn className="w-4 h-4" />
        Iniciar sesión con Microsoft 365
      </button>
      <p className="text-[11px] text-ink-500 mt-4 leading-relaxed">
        Al iniciar sesión aceptas los{' '}
        <a href={LEGAL_LINKS.terminos.href} target="_blank" rel="noopener" className="text-brand-700 font-semibold hover:underline">
          {LEGAL_LINKS.terminos.label}
        </a>{' '}
        y el{' '}
        <a href={LEGAL_LINKS.privacidad.href} target="_blank" rel="noopener" className="text-brand-700 font-semibold hover:underline">
          {LEGAL_LINKS.privacidad.label}
        </a>
        .
      </p>
    </main>
  </div>
);
