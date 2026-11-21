import React, { useState } from 'react';
import { RolDisponible, UsuarioInput, UsuarioItem, UsuariosData } from '../types';
import { catalogos } from '../api/endpoints';
import { errorMessage, useApi } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { ClaveTemporalDialog, UsuarioFormModal } from '../components/UsuarioFormModal';
import { KeyRound, Pencil, Plus, ShieldCheck, Smartphone, UserCheck, UserX } from 'lucide-react';

interface UsuariosViewProps {
  onShowToast: (msg: string) => void;
}

export const UsuariosView: React.FC<UsuariosViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => catalogos.getUsuarios());
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <UsuariosContent {...props} data={data} reload={reload} />;
};

type Dialogo =
  | { tipo: 'nuevo' }
  | { tipo: 'editar'; usuario: UsuarioItem }
  | { tipo: 'clave'; nombre: string; correo: string; clave: string }
  | null;

const getCellBadge = (val: string) => {
  switch (val) {
    case 'V':
      return 'text-brand-800 font-bold';
    case 'E':
      return 'text-success-700 bg-success-50 font-bold px-1.5 py-0.5 rounded';
    case 'A':
      return 'text-warn-700 bg-warn-50 font-bold px-1.5 py-0.5 rounded';
    default:
      return 'text-ink-400';
  }
};

const botonAccion = 'h-8 px-2 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50';

const UsuariosContent: React.FC<UsuariosViewProps & { data: UsuariosData; reload: () => Promise<void> }> = ({
  onShowToast,
  data,
  reload,
}) => {
  const { users, rolesHeaders, matrix } = data;
  const roles: RolDisponible[] = data.rolesDisponibles ?? [];
  const appKeys = roles.filter((r) => r.app).map((r) => r.clave);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const activos = users.filter((u) => u.active !== false).length;

  const registrar = async (vals: UsuarioInput) => {
    const r = await catalogos.createUsuario(vals);
    await reload();
    setDialogo({ tipo: 'clave', nombre: r.usuario.name, correo: r.usuario.email, clave: r.claveTemporal });
  };

  const editar = (u: UsuarioItem) => async (vals: UsuarioInput) => {
    const r = await catalogos.updateUsuario(u.id!, vals);
    await reload();
    setDialogo(null);
    onShowToast(r.message);
  };

  const accion = async (u: UsuarioItem, fn: () => Promise<void>) => {
    setOcupado(u.id ?? null);
    try {
      await fn();
    } catch (err) {
      onShowToast(errorMessage(err));
    } finally {
      setOcupado(null);
    }
  };

  const alternarActivo = (u: UsuarioItem) =>
    accion(u, async () => {
      const activar = u.active === false;
      if (!activar && !window.confirm(`¿Desactivar a ${u.name}? Ya no podrá entrar a la web ni a la app.`)) return;
      const r = await catalogos.updateUsuario(u.id!, { active: activar });
      await reload();
      onShowToast(r.message);
    });

  const restablecer = (u: UsuarioItem) =>
    accion(u, async () => {
      if (!window.confirm(`¿Crear una contraseña temporal nueva para ${u.name}? La actual dejará de servir.`)) return;
      const r = await catalogos.restablecerClaveUsuario(u.id!);
      await reload();
      setDialogo({ tipo: 'clave', nombre: u.name, correo: u.email, clave: r.claveTemporal });
    });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto flex flex-col min-h-full">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4 pb-2 border-b border-line-200">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">
            Catálogos / Usuarios y roles
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
            Usuarios y control de accesos
          </h1>
          <p className="text-sm text-ink-600 max-w-2xl leading-relaxed">
            Registre a cada persona con su correo y asígnele uno o varios roles. Los roles definen qué puede ver y hacer
            en la web; el rol <strong>Inspector</strong> además le da acceso a la app de campo. Al registrarla, el sistema
            crea una contraseña temporal que la persona cambia la primera vez que entra.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setDialogo({ tipo: 'nuevo' })}
          disabled={!roles.length}
          className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </button>
      </div>

      <div className="flex flex-col gap-6 items-start">
        {/* Directorio de usuarios */}
        <section aria-label="Directorio de usuarios" className="w-full bg-white border border-line-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-line-200 bg-surface-50 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
              Usuarios ({activos} activos de {users.length})
            </h2>
            <span className="text-[11px] text-ink-500 inline-flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" /> = también usa la app de campo
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[760px]">
              <thead>
                <tr className="bg-surface-50 text-ink-500 text-[11px] uppercase tracking-wide font-bold border-b border-line-200">
                  <th className="py-2.5 px-3.5">Usuario</th>
                  <th className="py-2.5 px-3.5">Roles asignados</th>
                  <th className="py-2.5 px-3.5">Último acceso</th>
                  <th className="py-2.5 px-3.5">Estado</th>
                  <th className="py-2.5 px-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-100">
                {users.map((u, i) => {
                  const inactivo = u.active === false;
                  const usaApp = (u.roleKeys ?? []).some((k) => appKeys.includes(k));
                  return (
                    <tr key={u.id ?? i} className={`transition-colors ${inactivo ? 'bg-surface-50' : 'hover:bg-surface-50'}`}>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-ink-900 leading-tight inline-flex items-center gap-1">
                          {u.name}
                          {usaApp && <Smartphone className="w-3.5 h-3.5 text-brand-600" aria-label="Usa la app de campo" />}
                        </div>
                        <div className="text-[11px] text-ink-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r, ri) => (
                            <span
                              key={ri}
                              className="px-2 py-0.5 rounded bg-brand-100 text-brand-800 font-bold text-[10.5px] ring-1 ring-inset ring-brand-200"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-ink-500 whitespace-nowrap">{u.date}</td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`font-bold ${inactivo ? 'text-ink-500' : 'text-success-700'}`}>{u.st}</span>
                        {u.cambiarClave && !inactivo && (
                          <span className="block text-[10.5px] text-warn-700 font-semibold">Contraseña temporal</span>
                        )}
                      </td>
                      <td className="py-2 px-3.5">
                        {u.id !== undefined && (
                          <div className="flex justify-end flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => setDialogo({ tipo: 'editar', usuario: u })}
                              disabled={ocupado === u.id}
                              className={`${botonAccion} text-brand-700 hover:bg-brand-50`}
                              aria-label={`Editar a ${u.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" /> Editar
                            </button>
                            {!inactivo && (
                              <button
                                type="button"
                                onClick={() => void restablecer(u)}
                                disabled={ocupado === u.id}
                                className={`${botonAccion} text-ink-700 hover:bg-surface-100`}
                                aria-label={`Restablecer la contraseña de ${u.name}`}
                              >
                                <KeyRound className="w-3.5 h-3.5" /> Contraseña
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void alternarActivo(u)}
                              disabled={ocupado === u.id}
                              className={`${botonAccion} ${inactivo ? 'text-success-700 hover:bg-success-50' : 'text-danger-700 hover:bg-danger-50'}`}
                              aria-label={`${inactivo ? 'Activar' : 'Desactivar'} a ${u.name}`}
                            >
                              {inactivo ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                              {inactivo ? 'Activar' : 'Desactivar'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Matriz de permisos por rol */}
        <section
          aria-label="Permisos por rol"
          className="w-full min-w-0 bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap justify-between items-baseline gap-2 pb-1 border-b border-line-100">
            <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              Matriz de permisos por rol
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-500">
              <span className="text-brand-800">V = Ver</span>
              <span>·</span>
              <span className="text-success-700">E = Editar</span>
              <span>·</span>
              <span className="text-warn-700">A = Autorizar</span>
              <span>·</span>
              <span className="text-ink-400">— = Sin acceso</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs min-w-[620px]">
              <thead>
                <tr className="bg-surface-50 text-ink-500 text-[11px] font-bold border-b border-line-200">
                  <th className="py-2.5 px-3 text-left">Módulo</th>
                  {rolesHeaders.map((rh) => (
                    <th key={rh} className="py-2.5 px-2 text-center text-[11px] font-bold">
                      {rh}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-100">
                {matrix.map((row, i) => (
                  <tr key={i} className="hover:bg-surface-50 transition-colors">
                    <td className="py-2 px-3 text-left font-medium text-ink-900">{row.mod}</td>
                    {row.vals.map((v, vi) => (
                      <td key={vi} className="py-2 px-2">
                        <span className={`inline-block ${getCellBadge(v)}`}>{v}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-ink-500 leading-relaxed pt-2 border-t border-line-100">
            Un usuario puede tener más de un rol: recibe el permiso mayor de todos ellos. Toda autorización queda registrada
            en la bitácora auditable con nombre, RFC, fecha, hora y firma electrónica.
          </p>
        </section>
      </div>

      {dialogo?.tipo === 'nuevo' && (
        <UsuarioFormModal titulo="Nuevo usuario" roles={roles} onCancelar={() => setDialogo(null)} onGuardar={registrar} />
      )}
      {dialogo?.tipo === 'editar' && (
        <UsuarioFormModal
          titulo={`Editar a ${dialogo.usuario.name}`}
          roles={roles}
          inicial={dialogo.usuario}
          onCancelar={() => setDialogo(null)}
          onGuardar={editar(dialogo.usuario)}
        />
      )}
      {dialogo?.tipo === 'clave' && (
        <ClaveTemporalDialog nombre={dialogo.nombre} correo={dialogo.correo} clave={dialogo.clave} onCerrar={() => setDialogo(null)} />
      )}
    </div>
  );
};
