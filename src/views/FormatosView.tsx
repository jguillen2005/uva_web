import React, { useState } from 'react';
import { ScreenKey, FormatoItem } from '../types';
import { catalogos } from '../api/endpoints';
import { useApi } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { Plus, Copy, Search, FileText, CheckCircle2, Clock, Edit, FileCode } from 'lucide-react';

interface FormatosViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

export const FormatosView: React.FC<FormatosViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => catalogos.getFormatos());
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <FormatosContent {...props} initialFormatos={data} />;
};

const FormatosContent: React.FC<FormatosViewProps & { initialFormatos: FormatoItem[] }> = ({ onNavigate, onShowToast, initialFormatos }) => {
  const [formatos, setFormatos] = useState<FormatoItem[]>(initialFormatos);
  const stats = {
    vigentes: formatos.filter((f) => f.status === 'Vigente').length,
    borradores: formatos.filter((f) => f.status === 'Borrador').length,
    enAprobacion: formatos.filter((f) => f.status === 'En aprobación').length,
    enCampo: formatos.filter((f) => f.stage === 'Campo' && f.status === 'Vigente').length
  };
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('Todas');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');

  const filtered = formatos.filter((f) => {
    const matchesSearch =
      f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.subtitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === 'Todas' || f.stage === stageFilter;
    const matchesStatus = statusFilter === 'Todos' || f.status === statusFilter;
    return matchesSearch && matchesStage && matchesStatus;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto flex flex-col min-h-full">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4 pb-2 border-b border-line-200">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            Catálogos / Formatos
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
            Formatos del sistema
          </h1>
          <p className="text-sm text-ink-600 max-w-2xl leading-relaxed">
            Alta, edición y control de versiones de los formatos que se usan en solicitud, campo y emisión. Solo la versión vigente de cada formato se descarga a la app de campo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onShowToast('Selecciona un formato base para clonar su estructura')}
            className="h-10 px-4 rounded-lg border border-line-300 bg-white hover:bg-surface-50 text-ink-900 text-xs font-semibold transition-colors"
          >
            Duplicar desde existente
          </button>
          <button
            type="button"
            onClick={() => onNavigate('AltaFormato')}
            className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Nuevo formato
          </button>
        </div>
      </div>

      {/* 4 Stat Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-line-200 rounded-xl p-3.5 flex flex-col gap-1 shadow-xs">
          <span className="text-xs text-ink-500">Formatos vigentes</span>
          <span className="text-2xl font-bold text-ink-900 tabular-nums">{stats.vigentes}</span>
        </div>
        <div className="bg-white border border-line-200 rounded-xl p-3.5 flex flex-col gap-1 shadow-xs">
          <span className="text-xs text-ink-500">Borradores</span>
          <span className="text-2xl font-bold text-ink-900 tabular-nums">{stats.borradores}</span>
        </div>
        <div className="bg-white border border-line-200 rounded-xl p-3.5 flex flex-col gap-1 shadow-xs">
          <span className="text-xs text-ink-500">Pendientes de aprobación</span>
          <span className="text-2xl font-bold text-warn-700 tabular-nums">{stats.enAprobacion}</span>
        </div>
        <div className="bg-white border border-line-200 rounded-xl p-3.5 flex flex-col gap-1 shadow-xs">
          <span className="text-xs text-ink-500">Usados en campo</span>
          <span className="text-2xl font-bold text-brand-600 tabular-nums">{stats.enCampo}</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-white p-3.5 rounded-xl border border-line-200 shadow-xs">
        <label className="flex-1 min-w-[240px] flex flex-col gap-1 text-xs font-semibold text-ink-600">
          Buscar
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="search"
              placeholder="Código o nombre del formato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-line-300 rounded-lg text-xs bg-white focus:outline-none focus:border-brand-600"
            />
          </div>
        </label>

        <label className="w-44 flex flex-col gap-1 text-xs font-semibold text-ink-600">
          Etapa del proceso
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="py-2 px-2.5 border border-line-300 rounded-lg text-xs bg-white focus:outline-none focus:border-brand-600"
          >
            <option>Todas</option>
            <option>Solicitud</option>
            <option>Contratación</option>
            <option>Campo</option>
            <option>Emisión</option>
            <option>Calibración</option>
          </select>
        </label>

        <label className="w-44 flex flex-col gap-1 text-xs font-semibold text-ink-600">
          Estado
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-2.5 border border-line-300 rounded-lg text-xs bg-white focus:outline-none focus:border-brand-600"
          >
            <option>Todos</option>
            <option>Vigente</option>
            <option>Borrador</option>
            <option>En aprobación</option>
            <option>Obsoleto</option>
          </select>
        </label>
      </div>

      {/* Formatos Table */}
      <div className="bg-white border border-line-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[950px]">
            <thead>
              <tr className="bg-surface-100 text-ink-700 font-semibold border-b border-line-200">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Nombre</th>
                <th className="py-3 px-4">Etapa</th>
                <th className="py-3 px-4">Versión</th>
                <th className="py-3 px-4">Tipo de estructura</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Modificado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-100">
              {filtered.map((f) => (
                <tr key={f.id} className="hover:bg-surface-50 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-ink-900 whitespace-nowrap">
                    {f.code}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-ink-900 leading-tight">{f.name}</div>
                    <div className="text-[11px] text-ink-500">{f.subtitle}</div>
                  </td>
                  <td className="py-3.5 px-4 text-ink-700 font-medium">{f.stage}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-ink-900">{f.version}</td>
                  <td className="py-3.5 px-4 text-ink-700">
                    {f.structureType}
                    <div className="text-[10px] text-ink-500">{f.structureDetail}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full font-bold ${
                        f.status === 'Vigente'
                          ? 'bg-success-100 text-success-700'
                          : f.status === 'En aprobación'
                          ? 'bg-warn-100 text-warn-700'
                          : 'bg-line-100 text-ink-700'
                      }`}
                    >
                      {f.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-ink-500">{f.modifiedDate}</td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (f.code === 'F-18-AC') {
                            onNavigate('Editor');
                          } else {
                            onNavigate('AltaFormato');
                          }
                        }}
                        className="font-bold text-brand-600 hover:underline"
                      >
                        Editar
                      </button>
                      <span className="text-line-300">·</span>
                      <button
                        onClick={() => onShowToast(`Historial de versiones para formato ${f.code}`)}
                        className="text-ink-500 hover:text-ink-900"
                      >
                        Versiones
                      </button>
                      <span className="text-line-300">·</span>
                      <button
                        onClick={() => onShowToast(`Descargando PDF oficial de plantilla ${f.code}`)}
                        className="text-ink-500 hover:text-ink-900"
                      >
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-ink-500">
        Al publicar una versión nueva, la anterior queda como obsoleta pero se conserva: cada expediente guarda la versión exacta con la que fue levantado en campo.
      </p>
    </div>
  );
};
