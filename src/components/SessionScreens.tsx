import React, { useEffect, useRef } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { LEGAL_LINKS } from './legalLinks';

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
