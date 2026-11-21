import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, KeyRound, Smartphone, Monitor } from 'lucide-react';
import type { RolDisponible, UsuarioInput, UsuarioItem } from '../types';

const RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const claseCampo = 'w-full px-3 py-2 border border-line-300 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-600 disabled:bg-surface-100';

/** Escape cierra el diálogo (con la versión más reciente de la función). */
function useEscape(alCerrar: () => void) {
  const ref = useRef(alCerrar);
  ref.current = alCerrar;
  useEffect(() => {
    const alEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') ref.current(); };
    window.addEventListener('keydown', alEscape);
    return () => window.removeEventListener('keydown', alEscape);
  }, []);
}

const Dialogo: React.FC<{ id: string; titulo: string; onCerrar: () => void; ocupado?: boolean; children: React.ReactNode }> = ({
  id, titulo, onCerrar, ocupado, children,
}) => (
  <div
    className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    onMouseDown={(e) => { if (e.target === e.currentTarget && !ocupado) onCerrar(); }}
  >
    <div role="dialog" aria-modal="true" aria-labelledby={id}
      className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-xl w-full p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
      <div className="flex justify-between items-center border-b border-line-100 pb-3">
        <h3 id={id} className="text-lg font-bold text-ink-900">{titulo}</h3>
        <button type="button" onClick={onCerrar} disabled={ocupado} aria-label="Cerrar" className="text-ink-400 hover:text-ink-600 text-lg font-bold">
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);

/**
 * Registrar o editar un usuario: nombre, correo y roles. Los roles marcados con «App» dan acceso a la app
 * de campo (verificador); los demás solo a la web.
 */
export const UsuarioFormModal: React.FC<{
  titulo: string;
  roles: RolDisponible[];
  inicial?: UsuarioItem;
  rolesIniciales?: string[];
  onCancelar: () => void;
  onGuardar: (vals: UsuarioInput) => Promise<void>;
}> = ({ titulo, roles, inicial, rolesIniciales, onCancelar, onGuardar }) => {
  const editando = !!inicial;
  const [nombre, setNombre] = useState(inicial?.name ?? '');
  const [correo, setCorreo] = useState(inicial?.email ?? '');
  const [elegidos, setElegidos] = useState<string[]>(inicial?.roleKeys ?? rolesIniciales ?? []);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const primerCampo = useRef<HTMLInputElement>(null);
  useEscape(() => { if (!guardando) onCancelar(); });
  useEffect(() => { primerCampo.current?.focus(); }, []);

  const alternar = (clave: string) =>
    setElegidos((r) => (r.includes(clave) ? r.filter((x) => x !== clave) : [...r, clave]));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim().length < 3) return setError('Escriba el nombre completo.');
    if (!editando && !RE_CORREO.test(correo.trim())) return setError('Escriba un correo electrónico válido.');
    if (!elegidos.length) return setError('Elija al menos un rol.');
    setError(null);
    setGuardando(true);
    try {
      await onGuardar(editando
        ? { name: nombre.trim(), roles: elegidos }
        : { name: nombre.trim(), email: correo.trim().toLowerCase(), roles: elegidos });
    } catch (err) {
      setError((err as Error).message || 'No se pudo guardar.');
      setGuardando(false);
    }
  };

  const usaApp = roles.some((r) => r.app && elegidos.includes(r.clave));
  return (
    <Dialogo id="titulo-form-usuario" titulo={titulo} onCerrar={onCancelar} ocupado={guardando}>
      <form onSubmit={enviar} noValidate className="space-y-4">
        {error && (
          <p role="alert" className="text-sm text-danger-700 bg-danger-50 border border-danger-200 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="usr-nombre" className="block text-xs font-bold text-ink-600 mb-1">Nombre completo *</label>
            <input id="usr-nombre" ref={primerCampo} type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
              className={claseCampo} autoComplete="name" placeholder="Ing. Ana López" disabled={guardando} />
          </div>
          <div>
            <label htmlFor="usr-correo" className="block text-xs font-bold text-ink-600 mb-1">Correo electrónico *</label>
            <input id="usr-correo" type="email" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)}
              className={claseCampo} autoComplete="email" placeholder="ana.lopez@empresa.com" disabled={guardando || editando}
              aria-describedby="usr-correo-ayuda" />
            <p id="usr-correo-ayuda" className="text-[11px] text-ink-500 mt-1">
              {editando ? 'El correo no se puede cambiar: es con el que entra.' : 'Con este correo entrará a la web y a la app.'}
            </p>
          </div>
        </div>

        <fieldset>
          <legend className="block text-xs font-bold text-ink-600 mb-2">Roles * <span className="font-normal text-ink-500">(puede elegir varios)</span></legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {roles.map((r) => {
              const activo = elegidos.includes(r.clave);
              return (
                <label key={r.clave}
                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${activo ? 'border-brand-500 bg-brand-50' : 'border-line-200 hover:bg-surface-50'}`}>
                  <input type="checkbox" checked={activo} onChange={() => alternar(r.clave)} disabled={guardando}
                    className="mt-0.5 w-4 h-4 accent-brand-600" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                      {r.nombre}
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${r.app ? 'bg-success-100 text-success-800' : 'bg-surface-100 text-ink-600'}`}>
                        {r.app ? <Smartphone className="w-3 h-3" aria-hidden="true" /> : <Monitor className="w-3 h-3" aria-hidden="true" />}
                        {r.app ? 'Web y app' : 'Web'}
                      </span>
                    </span>
                    <span className="block text-[11px] text-ink-500 leading-snug mt-0.5">{r.descripcion}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {usaApp && (
            <p className="text-[11px] text-ink-600 mt-2 bg-surface-50 border border-line-200 rounded-lg px-3 py-2">
              Con el rol de verificador, esta persona aparece en «Verificadores», se le pueden programar visitas y
              puede entrar a la app de campo con el mismo correo y contraseña.
            </p>
          )}
        </fieldset>

        {!editando && (
          <p className="text-[11px] text-ink-500">
            Al guardar, el sistema crea una contraseña temporal. Désela a la persona: la primera vez que entre a la web
            se le pedirá crear una propia.
          </p>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button type="button" onClick={onCancelar} disabled={guardando}
            className="h-10 px-4 rounded-lg border border-line-300 text-ink-700 hover:bg-surface-50 text-sm font-semibold disabled:opacity-60">
            Cancelar
          </button>
          <button type="submit" disabled={guardando}
            className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar usuario'}
          </button>
        </div>
      </form>
    </Dialogo>
  );
};

/** Muestra una sola vez la contraseña temporal para que el Administrador se la dé a la persona. */
export const ClaveTemporalDialog: React.FC<{ nombre: string; correo: string; clave: string; onCerrar: () => void }> = ({
  nombre, correo, clave, onCerrar,
}) => {
  const [copiado, setCopiado] = useState(false);
  useEscape(onCerrar);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`Sistema UVA\nCorreo: ${correo}\nContraseña temporal: ${clave}`);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <Dialogo id="titulo-clave-temporal" titulo="Contraseña temporal" onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-ink-700 leading-relaxed">
          Entregue estos datos a <strong>{nombre}</strong>. La contraseña solo se muestra ahora; si se pierde, use
          el botón «Contraseña» de su fila para crear otra.
        </p>
        <dl className="rounded-lg border border-line-200 bg-surface-50 divide-y divide-line-200 text-sm">
          <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-ink-500">Correo</dt><dd className="font-semibold text-ink-900 break-all text-right">{correo}</dd></div>
          <div className="flex justify-between gap-3 px-3 py-2 items-center">
            <dt className="text-ink-500 inline-flex items-center gap-1"><KeyRound className="w-4 h-4" aria-hidden="true" />Contraseña temporal</dt>
            <dd className="font-mono font-bold text-base text-ink-900 tracking-wider select-all">{clave}</dd>
          </div>
        </dl>
        <p className="text-[11px] text-ink-500">
          La primera vez que entre a la web se le pedirá crear una contraseña propia; después podrá usar la app de campo.
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={copiar}
            className="h-10 px-4 rounded-lg border border-line-300 text-ink-700 hover:bg-surface-50 text-sm font-semibold inline-flex items-center justify-center gap-1.5">
            {copiado ? <Check className="w-4 h-4 text-success-700" /> : <Copy className="w-4 h-4" />}
            {copiado ? 'Copiado' : 'Copiar datos'}
          </button>
          <button type="button" onClick={onCerrar} autoFocus
            className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold">
            Listo
          </button>
        </div>
      </div>
    </Dialogo>
  );
};
