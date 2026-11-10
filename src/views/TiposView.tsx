import React from 'react';
import { ScreenKey, TiposData } from '../types';
import { catalogos } from '../api/endpoints';
import { useApi } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { ArrowLeft, Check, Layers, ListChecks, Type, TableProperties } from 'lucide-react';

interface TiposViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

export const TiposView: React.FC<TiposViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => catalogos.getTipos());
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <TiposContent {...props} data={data} />;
};

const TiposContent: React.FC<TiposViewProps & { data: TiposData }> = ({ onNavigate, data }) => {
  const { panels, coverage } = data;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto flex flex-col min-h-full">
      {/* Header */}
      <div className="flex flex-col gap-1 pb-2 border-b border-line-200">
        <button
          onClick={() => onNavigate('Editor')}
          className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1 mb-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a Editor F-18
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
          Tipo de respuesta y valores (NMX-AA-179)
        </h1>
        <p className="text-sm text-ink-600 max-w-3xl leading-relaxed">
          En las propiedades del punto se elige uno de seis tipos de respuesta estandarizados. Debajo, la sección <strong>Valores</strong> cambia según el tipo elegido. Con estos seis tipos se cubren todos los 72 puntos normativos del F-18.
        </p>
      </div>

      {/* 6 Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {panels.map((p, idx) => (
          <section
            key={idx}
            className="bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider block">
                  Tipo de respuesta {idx + 1}
                </span>
                <h2 className="text-sm font-bold text-ink-900 mt-0.5">{p.type}</h2>
              </div>

              {/* Options pills */}
              {p.isOptions && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider">
                    Valores configurados
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {p.values?.map((v) => (
                      <span
                        key={v}
                        className="px-2.5 py-1 rounded-full border border-line-300 bg-canvas font-bold text-xs text-ink-900"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Text limit */}
              {p.isText && (
                <div className="space-y-1.5 text-xs text-ink-700">
                  <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block">
                    Parámetros
                  </span>
                  <div className="p-2.5 rounded-lg border border-line-100 bg-surface-50">
                    Longitud máxima: <strong className="text-ink-900">500 caracteres</strong>
                  </div>
                </div>
              )}

              {/* Group table */}
              {p.isGroup && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block">
                    Estructura de campos
                  </span>
                  <div className="border border-line-200 rounded-lg overflow-hidden text-xs">
                    <div className="bg-surface-100 px-3 py-1.5 text-ink-700 font-semibold flex justify-between">
                      <span>Campo</span>
                      <span>Long.</span>
                      {p.perField && <span>Evalúa</span>}
                    </div>
                    <div className="divide-y divide-line-100">
                      {p.fields?.map((f, fi) => (
                        <div key={fi} className="px-3 py-1.5 flex justify-between items-center text-ink-900">
                          <span className="font-medium">{f.label}</span>
                          <span className="text-ink-500 font-mono text-[11px]">{f.max} car.</span>
                          {p.perField && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-100 text-brand-800">
                              C/NC/NA
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {p.hasEval && (
                <div className="p-2.5 rounded-lg bg-brand-50 border border-brand-200 text-xs text-brand-800 flex items-center justify-between">
                  <span className="font-semibold">{p.evalLabel}</span>
                  <span className="font-bold">C / NC / NA</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-line-100 text-xs space-y-0.5">
              <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block">
                Puntos del F-18 que lo usan
              </span>
              <p className="text-ink-700 leading-relaxed">{p.uses}</p>
            </div>
          </section>
        ))}
      </div>

      {/* Coverage Table */}
      <section
        aria-label="Cobertura del F-18"
        className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-3"
      >
        <h2 className="text-base font-bold text-ink-900">
          Cobertura completa del F-18 por sección
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[700px]">
            <thead>
              <tr className="bg-surface-100 text-ink-700 font-semibold border-b border-line-200">
                <th className="py-2.5 px-3 w-56">Sección de la norma</th>
                <th className="py-2.5 px-3">Tipos de respuesta empleados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-100">
              {coverage.map((c, i) => (
                <tr key={i} className="hover:bg-surface-50">
                  <td className="py-2.5 px-3 font-bold text-ink-900">{c.s}</td>
                  <td className="py-2.5 px-3 text-ink-700">{c.t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
