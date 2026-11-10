import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileText, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { LEGAL_LINKS } from './legalLinks';

interface UserMenuProps {
  onProfile: () => void;
  onLogout: () => void;
  /** `light` para fondos claros (barra de escritorio), `dark` para la barra móvil azul. */
  tone?: 'light' | 'dark';
  /** Muestra nombre y puesto junto al avatar. */
  showName?: boolean;
}

const USER = { name: 'Ing. Gerardo Torres', title: 'Gerente Técnico', email: 'gtorres@sistemauva.mx', initials: 'GT' };

/** Menú de cuenta (esquina superior derecha): Ver mi perfil · Cerrar sesión. */
export const UserMenu: React.FC<UserMenuProps> = ({ onProfile, onLogout, tone = 'light', showName = true }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const buttonCls =
    tone === 'dark'
      ? 'hover:bg-side-700 text-white'
      : 'hover:bg-white hover:shadow-xs text-ink-900 border border-transparent hover:border-line-200';

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Cuenta de ${USER.name}`}
        className={`flex items-center gap-2.5 rounded-full sm:rounded-lg p-1 sm:pr-2 transition-colors ${buttonCls}`}
      >
        <span className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0 ring-2 ring-white/70">
          {USER.initials}
        </span>
        {showName && (
          <span className="hidden sm:block text-left leading-tight">
            <span className="block text-xs font-semibold">{USER.name}</span>
            <span className={`block text-[11px] ${tone === 'dark' ? 'text-side-300' : 'text-ink-500'}`}>{USER.title}</span>
          </span>
        )}
        <ChevronDown
          className={`hidden sm:block w-4 h-4 transition-transform ${open ? 'rotate-180' : ''} ${tone === 'dark' ? 'text-side-300' : 'text-ink-400'}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menú de cuenta"
          className="absolute right-0 top-full mt-2 w-64 bg-white border border-line-200 rounded-xl shadow-lg z-[60] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-line-200 bg-surface-50">
            <p className="text-sm font-semibold text-ink-900 truncate">{USER.name}</p>
            <p className="text-xs text-ink-500 truncate">{USER.email}</p>
          </div>
          <div className="p-1.5">
            <button
              ref={firstItemRef}
              type="button"
              role="menuitem"
              onClick={() => choose(onProfile)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-ink-800 hover:bg-surface-100 focus:bg-surface-100 text-left"
            >
              <UserRound className="w-4 h-4 text-ink-500" />
              Ver mi perfil
            </button>
          </div>
          <div className="p-1.5 border-t border-line-200">
            <a
              href={LEGAL_LINKS.terminos.href}
              target="_blank"
              rel="noopener"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-ink-700 hover:bg-surface-100 focus:bg-surface-100 text-left"
            >
              <FileText className="w-4 h-4 text-ink-400" />
              {LEGAL_LINKS.terminos.label}
            </a>
            <a
              href={LEGAL_LINKS.privacidad.href}
              target="_blank"
              rel="noopener"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-ink-700 hover:bg-surface-100 focus:bg-surface-100 text-left"
            >
              <ShieldCheck className="w-4 h-4 text-ink-400" />
              {LEGAL_LINKS.privacidad.label}
            </a>
          </div>
          <div className="p-1.5 border-t border-line-200">
            <button
              type="button"
              role="menuitem"
              onClick={() => choose(onLogout)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-danger-700 hover:bg-danger-50 focus:bg-danger-50 text-left"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
