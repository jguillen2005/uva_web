import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { ScreenKey } from '../types';
import { sesion, type PerfilSesion } from '../api/sesion';
import { MedidorClave, evaluarClave, reglasClave } from '../components/MedidorClave';

interface CambiarClaveViewProps {
  onNavigate: (s: ScreenKey) => void;
  onShowToast: (msg: string) => void;
  user?: PerfilSesion | null;
}

const claseCampo =
  'w-full h-11 rounded-lg border border-line-300 bg-white pl-10 pr-11 text-sm text-ink-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 disabled:bg-surface-100';

/** Cambiar contraseña: cualquier usuario cambia la suya cuando quiera (la misma para la web y la app). */
export const CambiarClaveView: React.FC<CambiarClaveViewProps> = ({ onNavigate, onShowToast, user }) => {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [ver, setVer] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pistas = [user?.email ?? '', (user?.email ?? '').split('@')[0], ...(user?.name ?? '').split(/\s+/)];

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!actual) return setError('Escriba su contraseña actual.');
    if (!reglasClave(nueva, actual).every((r) => r.ok)) return setError('La contraseña nueva no cumple todos los requisitos.');
    if (evaluarClave(nueva, pistas).nivel < 2) return setError('La contraseña nueva es muy débil. Siga el consejo debajo de la barra.');
    if (nueva !== repetir) return setError('Las dos contraseñas nuevas no son iguales.');
    setGuardando(true);
    try {
      await sesion.cambiarClave(actual, nueva);
      setActual(''); setNueva(''); setRepetir('');
      onShowToast('Contraseña cambiada. Úsela desde ahora en la web y en la app de campo.');
      onNavigate('Perfil');
    } catch (err) {
      setError((err as Error).message || 'No se pudo cambiar la contraseña.');
    } finally {
      setGuardando(false);
    }
  };

  const campo = (id: string, etiqueta: string, valor: string, cambiar: (v: string) => void, autoComplete: string, ayuda?: string) => (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink-800 mb-1">{etiqueta}</label>
      <div className="relative">
        <Lock className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input id={id} type={ver ? 'text' : 'password'} autoComplete={autoComplete} value={valor}
          onChange={(e) => cambiar(e.target.value)} disabled={guardando} className={claseCampo}
          aria-describedby={ayuda ? `${id}-ayuda` : undefined} />
        <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
          aria-pressed={ver} className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-md text-ink-500 hover:text-ink-800">
          {ver ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {ayuda && <p id={`${id}-ayuda`} className="text-[11px] text-ink-500 mt-1">{ayuda}</p>}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6">
      <div className="pb-2 border-b border-line-200">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">Mi cuenta / Cambiar contraseña</span>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">Cambiar contraseña</h1>
        <p className="text-sm text-ink-600 leading-relaxed mt-1">
          La contraseña nueva sirve para la web y para la app de campo. En los teléfonos donde ya tenga la sesión abierta,
          úsela la próxima vez que inicie sesión.
        </p>
      </div>

      <section aria-label="Cambiar contraseña" className="bg-white border border-line-200 rounded-xl shadow-xs p-4 sm:p-6">
        <form onSubmit={guardar} noValidate className="space-y-5 max-w-md">
          {error && (
            <p role="alert" className="rounded-lg bg-danger-50 text-danger-700 text-sm px-3 py-2">{error}</p>
          )}
          {campo('cc-actual', 'Contraseña actual', actual, setActual, 'current-password')}
          {campo('cc-nueva', 'Contraseña nueva', nueva, setNueva, 'new-password')}
          <MedidorClave nueva={nueva} actual={actual} pistas={pistas} />
          {campo('cc-repetir', 'Escriba otra vez la contraseña nueva', repetir, setRepetir, 'new-password',
            repetir && nueva !== repetir ? 'Todavía no coinciden.' : undefined)}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <button type="button" onClick={() => onNavigate('Perfil')} disabled={guardando}
              className="h-11 px-4 rounded-lg border border-line-300 text-ink-700 hover:bg-surface-50 text-sm font-semibold disabled:opacity-60">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="h-11 px-5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-70 text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {guardando ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </section>

      <p className="text-xs text-ink-500 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0" aria-hidden="true" />
        Consejo: use una frase fácil de recordar para usted, por ejemplo tres palabras con un número y un símbolo. No use su nombre,
        su correo ni el nombre del sistema.
      </p>
    </div>
  );
};
