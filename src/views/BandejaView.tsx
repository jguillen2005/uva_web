import React, { useState } from 'react';
import { ScreenKey } from '../types';
import { dictaminacion } from '../api/endpoints';
import { useApi } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { Search, Filter, Clock, CheckCircle, AlertTriangle, Eye, ArrowRight } from 'lucide-react';

interface BandejaViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

export const BandejaView: React.FC<BandejaViewProps> = ({ onNavigate, onShowToast }) => {
  const { data, loading, error, reload } = useApi(() => dictaminacion.getBandeja());
  const [filterKpi, setFilterKpi] = useState<string>('Por revisar');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [inspectorFilter, setInspectorFilter] = useState<string>('Todos');
  const [typeFilter, setTypeFilter] = useState<string>('Todas');

  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  const { kpis, expedientes } = data;

  const filtered = expedientes.filter((e) => {
    const matchesSearch =
      e.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.site.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesInspector = inspectorFilter === 'Todos' || e.who.includes(inspectorFilter);
    const matchesType = typeFilter === 'Todas' || e.kind === typeFilter;
    return matchesSearch && matchesInspector && matchesType;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto flex flex-col min-h-full">
      {/* Header */}
      <div className="flex flex-col gap-1 pb-2 border-b border-line-200">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          Operación / Revisión técnica
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
          Expedientes de campo
        </h1>
        <p className="text-sm text-ink-600 max-w-3xl leading-relaxed">
          Todo lo que los verificadores sincronizan desde campo llega aquí. Ningún expediente pasa a CONAGUA sin la autorización del Gerente Técnico.
        </p>
      </div>

      {/* KPI filter chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => {
          const isSelected = filterKpi === kpi.id;
          return (
            <button
              key={kpi.id}
              type="button"
              onClick={() => setFilterKpi(isSelected ? 'Todas' : kpi.id)}
              className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                isSelected
                  ? 'border-brand-600 bg-brand-50 shadow-xs ring-1 ring-brand-600'
                  : 'border-line-200 bg-white hover:border-brand-600'
              }`}
            >
              <span className="text-xs text-ink-600 font-medium leading-tight">{kpi.label}</span>
              <span className="text-2xl font-bold text-ink-900 tabular-nums">{kpi.count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-end gap-3 bg-white p-3.5 rounded-xl border border-line-200 shadow-xs">
        <label className="flex-1 min-w-[240px] flex flex-col gap-1 text-xs font-semibold text-ink-600">
          Buscar
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="search"
              placeholder="Folio, cliente, RFC, título o serie del medidor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-line-300 rounded-lg text-xs bg-white focus:outline-none focus:border-brand-600"
            />
          </div>
        </label>

        <label className="w-44 flex flex-col gap-1 text-xs font-semibold text-ink-600">
          Verificador
          <select
            value={inspectorFilter}
            onChange={(e) => setInspectorFilter(e.target.value)}
            className="py-2 px-2.5 border border-line-300 rounded-lg text-xs bg-white focus:outline-none focus:border-brand-600"
          >
            <option value="Todos">Todos</option>
            <option value="Verificador 1">Verificador 1 (Raúl Sánchez)</option>
            <option value="Verificador 2">Verificador 2 (Ana María Torres)</option>
            <option value="Verificador 3">Verificador 3 (Carlos Mendoza)</option>
          </select>
        </label>

        <label className="w-40 flex flex-col gap-1 text-xs font-semibold text-ink-600">
          Tipo
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="py-2 px-2.5 border border-line-300 rounded-lg text-xs bg-white focus:outline-none focus:border-brand-600"
          >
            <option value="Todas">Todas</option>
            <option value="Inicial">Inicial</option>
            <option value="Periódica">Periódica</option>
            <option value="Extraordinaria">Extraordinaria</option>
          </select>
        </label>

        <label className="w-40 flex flex-col gap-1 text-xs font-semibold text-ink-600">
          Fecha de visita
          <input
            type="text"
            readOnly
            value="Últimos 30 días"
            className="py-2 px-2.5 border border-line-300 rounded-lg text-xs bg-surface-50 text-ink-900"
          />
        </label>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-line-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[960px]">
            <thead>
              <tr className="bg-surface-100 text-ink-700 font-semibold border-b border-line-200">
                <th className="py-3 px-4">Folio</th>
                <th className="py-3 px-4">Cliente / aprovechamiento</th>
                <th className="py-3 px-4">Verificador</th>
                <th className="py-3 px-4">Visita</th>
                <th className="py-3 px-4">Resultado</th>
                <th className="py-3 px-4">Evidencias</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Plazo (10 días háb.)</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-100">
              {filtered.map((r, i) => (
                <tr key={i} className="hover:bg-surface-50 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-ink-900">{r.folio}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-ink-900 leading-tight">{r.client}</div>
                    <div className="text-[11px] text-ink-500">{r.site}</div>
                  </td>
                  <td className="py-3.5 px-4 text-ink-700 font-medium">{r.who}</td>
                  <td className="py-3.5 px-4">
                    <div className="text-ink-900 font-medium">{r.date}</div>
                    <div className="text-[11px] text-ink-500">{r.kind}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full font-bold ${
                        r.resType === 'ok'
                          ? 'bg-success-100 text-success-700'
                          : 'bg-danger-100 text-danger-700'
                      }`}
                    >
                      {r.res}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-ink-700">{r.ev}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full font-semibold ${
                        r.stType === 'review'
                          ? 'bg-warn-100 text-warn-700'
                          : r.stType === 'auth'
                          ? 'bg-brand-100 text-brand-800'
                          : r.stType === 'done'
                          ? 'bg-side-900 text-white'
                          : 'bg-line-100 text-ink-700'
                      }`}
                    >
                      {r.st}
                    </span>
                  </td>
                  <td
                    className={`py-3.5 px-4 font-bold tabular-nums ${
                      r.slaUrgent ? 'text-danger-700' : 'text-ink-700'
                    }`}
                  >
                    {r.sla}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onNavigate(r.target)}
                      className="inline-flex items-center gap-1 font-bold text-brand-600 hover:text-brand-700 bg-brand-100 hover:bg-brand-150 px-3 py-1.5 rounded-md transition-colors"
                    >
                      {r.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-ink-500">
        <strong>Resultado</strong> = calculado por el sistema según las respuestas C/NC conforme a NMX-AA-179. <strong>Plazo</strong> = días hábiles restantes para emitir resultados después de la visita, según el contrato F-12.
      </p>
    </div>
  );
};
