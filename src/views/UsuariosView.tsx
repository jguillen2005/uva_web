import React, { useState } from 'react';
import { UsuariosData } from '../types';
import { catalogos } from '../api/endpoints';
import { useApi } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { Plus, Shield, UserCheck, ShieldCheck, KeyRound } from 'lucide-react';

interface UsuariosViewProps {
  onShowToast: (msg: string) => void;
}

export const UsuariosView: React.FC<UsuariosViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => catalogos.getUsuarios());
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <UsuariosContent {...props} data={data} />;
};

const UsuariosContent: React.FC<UsuariosViewProps & { data: UsuariosData }> = ({ onShowToast, data }) => {
  const { users, rolesHeaders, matrix } = data;

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto flex flex-col min-h-full">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4 pb-2 border-b border-line-200">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            Catálogos / Usuarios y roles
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
            Usuarios y control de accesos
          </h1>
          <p className="text-sm text-ink-600 max-w-2xl leading-relaxed">
            Los usuarios entran con su cuenta institucional de Microsoft 365. Aquí solo se les asigna uno o varios roles operativos; si se da de baja la cuenta en Microsoft Entra ID, pierde el acceso automáticamente.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onShowToast('Buscador de directorio activo Microsoft 365 / Entra ID')}
          className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          Agregar usuario de Microsoft 365
        </button>
      </div>

      {/* 2 Columns: Users list + Matrix */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: User Table */}
        <section
          aria-label="Directorio de usuarios"
          className="w-full lg:w-[480px] bg-white border border-line-200 rounded-xl shadow-xs overflow-hidden shrink-0"
        >
          <div className="p-4 border-b border-line-200 bg-surface-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
              Usuarios activos ({users.length})
            </h2>
            <span className="text-[11px] text-ink-500">Microsoft 365 Tenant UVA</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[420px]">
              <thead>
                <tr className="bg-surface-100 text-ink-700 font-semibold border-b border-line-200">
                  <th className="py-2.5 px-3.5">Usuario</th>
                  <th className="py-2.5 px-3.5">Roles asignados</th>
                  <th className="py-2.5 px-3.5">Último acceso</th>
                  <th className="py-2.5 px-3.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-100">
                {users.map((u, i) => (
                  <tr key={i} className="hover:bg-surface-50 transition-colors">
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-ink-900 leading-tight">{u.name}</div>
                      <div className="text-[11px] text-ink-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r, ri) => (
                          <span
                            key={ri}
                            className="px-2 py-0.5 rounded bg-brand-100 text-brand-800 font-bold text-[10.5px]"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-ink-500 whitespace-nowrap">{u.date}</td>
                    <td className="py-3 px-3.5 text-success-700 font-bold">{u.st}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right: Permissions Matrix */}
        <section
          aria-label="Permisos por rol"
          className="flex-[999] w-full min-w-0 bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap justify-between items-baseline gap-2 pb-1 border-b border-line-100">
            <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              Matriz de permisos por rol
            </h2>
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-500">
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
                <tr className="bg-surface-100 text-ink-700 font-semibold border-b border-line-200">
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
            Un usuario puede tener más de un rol asignado. Ejemplo: el Gerente Técnico también tiene permisos de administrador del sistema. Toda autorización queda registrada en la bitácora auditable con nombre, RFC, fecha, hora y firma electrónica.
          </p>
        </section>
      </div>
    </div>
  );
};
