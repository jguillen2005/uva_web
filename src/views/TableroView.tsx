import React from 'react';
import { ScreenKey } from '../types';
import { reportes } from '../api/endpoints';
import { useApi } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { ArrowRight, AlertTriangle, Clock, CheckCircle2, Calendar, FileText } from 'lucide-react';

interface TableroViewProps {
  onNavigate: (screen: ScreenKey) => void;
}

export const TableroView: React.FC<TableroViewProps> = ({ onNavigate }) => {
  const { data, loading, error, reload } = useApi(() => reportes.getTablero());
  const currentTimeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  const { kpis, alerts, stages, todayVisits } = data;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4 pb-2 border-b border-line-200">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">Inicio</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">Tablero</h1>
          <p className="text-sm text-ink-600 max-w-2xl mt-1 leading-relaxed">
            Lo que hay que atender hoy. Cada usuario ve las tarjetas de su rol: el inspector sus visitas, 
            el Gerente Técnico lo que espera revisión, el encargado de CONAGUA lo que falta cargar.
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
          <button
            onClick={() => onNavigate('Proceso')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
          >
            Ver mapa del proceso
            <ArrowRight className="w-4 h-4" />
          </button>
          <span className="text-xs text-ink-500 font-medium">
            Datos operativos · actualizado {currentTimeStr} hrs
          </span>
        </div>
      </div>

      {/* 5 KPIs Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onNavigate(kpi.targetScreen)}
            className="bg-white border border-line-200 hover:border-brand-600 hover:shadow-xs rounded-xl p-4 flex flex-col gap-1.5 text-left transition-all group"
          >
            <span className="text-xs text-ink-600 font-medium group-hover:text-brand-600 transition-colors">
              {kpi.label}
            </span>
            <span className="text-2xl sm:text-3xl font-bold text-ink-900 leading-none tabular-nums">
              {kpi.value}
            </span>
            <span
              className={`text-xs font-medium truncate ${
                kpi.warning ? 'text-warn-700' : 'text-ink-500'
              }`}
            >
              {kpi.sub}
            </span>
          </button>
        ))}
      </div>

      {/* Main Grid: Requiere atención (Left) + Right widgets */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Requiere atención */}
        <section
          aria-label="Requiere atención"
          className="flex-[999] w-full min-w-0 bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warn-700" />
              Requiere atención prioritaria
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warn-100 text-warn-700">
              {alerts.length} asuntos
            </span>
          </div>

          <div className="divide-y divide-line-100">
            {alerts.map((alert) => {
              const tagStyles = {
                red: 'bg-danger-100 text-danger-700 border-danger-200',
                amber: 'bg-warn-100 text-warn-700 border-warn-200',
                blue: 'bg-brand-100 text-brand-800 border-brand-200'
              }[alert.severity];

              return (
                <div
                  key={alert.id}
                  className="py-3.5 flex flex-wrap sm:flex-nowrap items-center gap-3.5 justify-between hover:bg-surface-50 transition-colors -mx-2 px-2 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`shrink-0 w-24 sm:w-28 text-center py-1 px-2.5 rounded-full text-[11px] font-bold border ${tagStyles}`}
                    >
                      {alert.tag}
                    </span>
                    <div className="min-w-0 flex flex-col">
                      <span className="text-sm font-semibold text-ink-900 line-clamp-2">
                        {alert.title}
                      </span>
                      <span className="text-xs text-ink-500 truncate">{alert.desc}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigate(alert.targetScreen)}
                    className="shrink-0 text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-100 hover:bg-brand-150 px-3 py-1.5 rounded-md transition-colors"
                  >
                    {alert.actionText} →
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column */}
        <div className="w-full lg:w-96 flex flex-col gap-5 shrink-0">
          {/* Avance del mes */}
          <section
            aria-label="Avance del mes"
            className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink-900">Verificaciones del mes</h2>
              <span className="text-xs font-semibold text-brand-600">Octubre 2026</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-ink-900 tabular-nums">18</span>
              <span className="text-sm text-ink-600">de 30 (meta mensual)</span>
            </div>
            <div className="h-3 rounded-full bg-line-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-500"
                style={{ width: '60%' }}
                role="progressbar"
                aria-valuenow={60}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="text-xs text-ink-500 leading-relaxed">
              Al ritmo actual de 0.9 visitas/día hábil se proyecta cerrar en <strong>28 verificaciones</strong> (93% de la meta).
            </p>
          </section>

          {/* Expedientes por etapa */}
          <section
            aria-label="Expedientes por etapa"
            className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink-900">Expedientes por etapa</h2>
              <span className="text-xs text-ink-500">33 activos</span>
            </div>
            <div className="space-y-2">
              {stages.map((stage, idx) => {
                const percentage = Math.round((stage.count / stage.max) * 100);
                return (
                  <div key={idx} className="grid grid-cols-[minmax(0,140px)_1fr_28px] gap-2 items-center text-xs">
                    <span className="text-ink-700 truncate font-medium">{stage.name}</span>
                    <div className="h-3.5 bg-surface-100 rounded-r-md overflow-hidden">
                      <div
                        className="h-full bg-brand-600 rounded-r-md transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="font-bold text-ink-900 text-right tabular-nums">{stage.count}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Visitas de hoy */}
          <section
            aria-label="Visitas de hoy"
            className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-600" />
                Visitas programadas para hoy
              </h2>
              <span className="text-xs font-bold text-success-700 bg-success-100 px-2 py-0.5 rounded-full">
                {todayVisits.length} visitas
              </span>
            </div>
            <div className="divide-y divide-line-100">
              {todayVisits.map((v, i) => (
                <div key={i} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-semibold text-ink-900 flex flex-wrap items-center gap-x-1.5 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5 text-ink-500" />
                      {v.time} hrs · <span className="font-mono text-brand-600 whitespace-nowrap">{v.folio}</span>
                    </span>
                    <span className="text-ink-600 truncate">{v.client}</span>
                  </div>
                  <span className="text-ink-500 text-right shrink-0">{v.inspector}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => onNavigate('Programacion')}
              className="w-full text-center text-xs font-semibold text-brand-600 hover:text-brand-700 pt-1"
            >
              Ver calendario semanal completo →
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};
