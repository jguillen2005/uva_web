import React, { useState } from 'react';
import { EstadisticasData } from '../types';
import { reportes } from '../api/endpoints';
import { useApi, errorMessage } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { Download, Filter, TrendingUp, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface EstadisticasViewProps {
  onShowToast: (msg: string) => void;
}

export const EstadisticasView: React.FC<EstadisticasViewProps> = ({ onShowToast }) => {
  const [periodo, setPeriodo] = useState('Últimos 6 meses');
  const { data, loading, error, reload } = useApi(() => reportes.getEstadisticas(periodo), [periodo]);

  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <EstadisticasContent data={data} periodo={periodo} setPeriodo={setPeriodo} onShowToast={onShowToast} />;
};

interface EstadisticasContentProps extends EstadisticasViewProps {
  data: EstadisticasData;
  periodo: string;
  setPeriodo: (value: string) => void;
}

const EstadisticasContent: React.FC<EstadisticasContentProps> = ({ data, periodo, setPeriodo, onShowToast }) => {
  const [inspector, setInspector] = useState('Todos');
  const [tipoVerif, setTipoVerif] = useState('Todas');
  const [cliente, setCliente] = useState('Todos');
  const [exporting, setExporting] = useState(false);

  const { months, stages, nonConformities, inspectors } = data;

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await reportes.exportEstadisticasCsv(periodo);
      onShowToast(res.message);
    } catch (e) {
      onShowToast(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto flex flex-col min-h-full">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4 pb-2 border-b border-line-200">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            Operación / Estadísticas
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
            Estadísticas y productividad
          </h1>
          <p className="text-sm text-ink-600 max-w-2xl leading-relaxed">
            Productividad, tiempos del proceso y hallazgos más frecuentes. Indicadores auditables bajo NMX-AA-179-SCFI-2018.
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          disabled={exporting}
          className="h-10 px-4 rounded-lg border border-line-300 bg-white hover:bg-surface-50 text-ink-900 text-xs font-semibold inline-flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <Download className="w-4 h-4 text-ink-500" />
          Exportar a Excel (CSV)
        </button>
      </div>

      {/* 4 Filter Controls */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-line-200 shadow-xs text-xs">
        <div>
          <label className="block text-ink-600 font-semibold mb-1">Periodo</label>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="w-full py-2 px-2.5 border border-line-300 rounded-lg bg-white"
          >
            <option>Últimos 6 meses</option>
            <option>Este año</option>
            <option>Personalizado</option>
          </select>
        </div>

        <div>
          <label className="block text-ink-600 font-semibold mb-1">Inspector</label>
          <select
            value={inspector}
            onChange={(e) => setInspector(e.target.value)}
            className="w-full py-2 px-2.5 border border-line-300 rounded-lg bg-white"
          >
            <option>Todos</option>
            <option>Inspector 1 (Raúl Sánchez)</option>
            <option>Inspector 2 (Ana María Torres)</option>
            <option>Inspector 3 (Carlos Mendoza)</option>
            <option>Inspector 4 (Laura Valdés)</option>
            <option>Inspector 5 (Jorge Morales)</option>
            <option>Inspector 6 (Diana Domínguez)</option>
          </select>
        </div>

        <div>
          <label className="block text-ink-600 font-semibold mb-1">Tipo de verificación</label>
          <select
            value={tipoVerif}
            onChange={(e) => setTipoVerif(e.target.value)}
            className="w-full py-2 px-2.5 border border-line-300 rounded-lg bg-white"
          >
            <option>Todas</option>
            <option>Inicial</option>
            <option>Periódica</option>
            <option>Extraordinaria</option>
          </select>
        </div>

        <div>
          <label className="block text-ink-600 font-semibold mb-1">Cliente</label>
          <select
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className="w-full py-2 px-2.5 border border-line-300 rounded-lg bg-white"
          >
            <option>Todos</option>
            <option>Cliente A (Minera de la Sierra)</option>
            <option>Cliente B (Bebidas San Jerónimo)</option>
            <option>Cliente G (Agroindustrias Bajío)</option>
          </select>
        </div>
      </div>

      {/* 4 Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-line-200 rounded-xl p-4 flex flex-col gap-1 shadow-xs">
          <span className="text-xs text-ink-600 font-medium">Verificaciones (6 meses)</span>
          <span className="text-3xl font-extrabold text-ink-900 tabular-nums">146</span>
          <span className="text-[11px] text-ink-500">Promedio 24 al mes</span>
        </div>

        <div className="bg-white border border-line-200 rounded-xl p-4 flex flex-col gap-1 shadow-xs">
          <span className="text-xs text-ink-600 font-medium">Dictámenes conformes</span>
          <span className="text-3xl font-extrabold text-success-700 tabular-nums">88 %</span>
          <span className="text-[11px] text-ink-500">12 % inconformes</span>
        </div>

        <div className="bg-white border border-line-200 rounded-xl p-4 flex flex-col gap-1 shadow-xs">
          <span className="text-xs text-ink-600 font-medium">Días solicitud → acuse</span>
          <span className="text-3xl font-extrabold text-ink-900 tabular-nums">23</span>
          <span className="text-[11px] text-ink-500">Promedio del periodo</span>
        </div>

        <div className="bg-white border border-line-200 rounded-xl p-4 flex flex-col gap-1 shadow-xs">
          <span className="text-xs text-ink-600 font-medium">Expedientes devueltos</span>
          <span className="text-3xl font-extrabold text-warn-700 tabular-nums">6 %</span>
          <span className="text-[11px] text-ink-500">Correcciones solicitadas</span>
        </div>
      </div>

      {/* 2x2 Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: Verificaciones por mes */}
        <section
          aria-label="Verificaciones por mes"
          className="bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col gap-3"
        >
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-between items-baseline">
            <h2 className="text-sm font-bold text-ink-900">Verificaciones por mes</h2>
            <span className="text-[11px] text-warn-700 font-semibold">Línea punteada: meta de 30</span>
          </div>

          <div className="relative h-56 pt-6 pb-2 border-b border-line-300 flex items-end justify-between gap-1 sm:gap-2 px-1 sm:px-4">
            {/* Target 30 dashed threshold line */}
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed border-warn-700 z-10"
              style={{ bottom: '168px' }}
            >
              <span className="absolute right-2 -top-4 text-[10px] font-bold text-warn-700 bg-white px-1">
                Meta 30
              </span>
            </div>

            {months.map((m) => {
              const heightPct = Math.round((m.value / 35) * 100);
              return (
                <div key={m.label} className="flex-1 min-w-0 flex flex-col items-center gap-1.5 h-full justify-end z-20">
                  <span className="text-xs font-bold text-ink-900 tabular-nums">{m.value}</span>
                  <div
                    className="w-full max-w-12 bg-brand-600 hover:bg-brand-700 rounded-t-md transition-all"
                    style={{ height: `${heightPct}%` }}
                    title={`${m.label}: ${m.value} verificaciones`}
                  />
                  <span className="text-xs text-ink-500 font-medium mt-1">{m.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Chart 2: Días promedio por etapa */}
        <section
          aria-label="Días promedio por etapa"
          className="bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col justify-between gap-3"
        >
          <h2 className="text-sm font-bold text-ink-900">Días promedio por etapa</h2>

          <div className="space-y-3">
            {stages.map((st, i) => {
              const widthPct = Math.round((st.days / st.max) * 100);
              return (
                <div key={i} className="grid grid-cols-[1fr_80px_60px] gap-2 items-center text-xs">
                  <span className={`truncate font-medium ${st.isTotal ? 'font-bold text-ink-900' : 'text-ink-700'}`}>
                    {st.label}
                  </span>
                  <div className="h-4 bg-surface-100 rounded-r-md overflow-hidden">
                    <div
                      className={`h-full rounded-r-md ${st.isTotal ? 'bg-side-900' : 'bg-brand-600'}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="font-bold text-ink-900 text-right tabular-nums">
                    {st.days} días
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-ink-500 pt-1 border-t border-line-100">
            Referencias: programar en ≤ 14 días naturales; resultados en ≤ 10 días hábiles posteriores a la visita.
          </p>
        </section>

        {/* Chart 3: No conformidades más frecuentes */}
        <section
          aria-label="No conformidades más frecuentes"
          className="bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col gap-3"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-ink-900">No conformidades más frecuentes</h2>
            <span className="text-[11px] text-ink-500">NMX-AA-179-SCFI-2018</span>
          </div>

          <div className="space-y-2.5">
            {nonConformities.map((nc, i) => {
              const widthPct = Math.round((nc.count / nc.max) * 100);
              return (
                <div key={i} className="grid grid-cols-[1fr_90px_35px] gap-2 items-center text-xs">
                  <span className="text-ink-700 truncate font-medium">{nc.label}</span>
                  <div className="h-4 bg-surface-100 rounded-r-md overflow-hidden">
                    <div className="h-full bg-danger-700 rounded-r-md" style={{ width: `${widthPct}%` }} />
                  </div>
                  <span className="font-bold text-danger-700 text-right tabular-nums">{nc.count}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Chart 4: Productividad por inspector */}
        <section
          aria-label="Productividad por inspector"
          className="bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col gap-3"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-ink-900">Verificaciones por inspector</h2>
            <span className="text-[11px] text-ink-500">Últimos 6 meses</span>
          </div>

          <div className="space-y-2.5">
            {inspectors.map((insp, i) => {
              const widthPct = Math.round((insp.count / 26) * 100);
              return (
                <div key={i} className="grid grid-cols-[minmax(0,110px)_1fr_28px_auto] sm:grid-cols-[140px_1fr_36px_90px] gap-2 items-center text-xs">
                  <span className="text-ink-700 truncate font-medium">{insp.name}</span>
                  <div className="h-4 bg-surface-100 rounded-r-md overflow-hidden">
                    <div className="h-full bg-brand-600 rounded-r-md" style={{ width: `${widthPct}%` }} />
                  </div>
                  <span className="font-bold text-ink-900 text-right tabular-nums">{insp.count}</span>
                  <span className="text-[11px] text-ink-500 text-right">{insp.returned} devueltos</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
