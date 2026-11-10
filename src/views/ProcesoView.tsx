import React from 'react';
import { ScreenKey } from '../types';
import { procesoSteps } from '../data/proceso';
import { ArrowLeft, ArrowRight, CheckCircle2, Shield, AlertCircle } from 'lucide-react';

interface ProcesoViewProps {
  onNavigate: (screen: ScreenKey) => void;
}

export const ProcesoView: React.FC<ProcesoViewProps> = ({ onNavigate }) => {
  const steps = procesoSteps;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto flex flex-col min-h-full">
      {/* Header */}
      <div className="flex flex-col gap-1 pb-2 border-b border-line-200">
        <button
          onClick={() => onNavigate('Tablero')}
          className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1 mb-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver al Tablero
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
          Mapa del proceso NMX-AA-179-SCFI-2018
        </h1>
        <p className="text-sm text-ink-600 max-w-3xl leading-relaxed">
          Recorrido completo de una verificación normativa, de la solicitud de servicio al acuse oficial de CONAGUA. Cada etapa enlaza directamente a su pantalla de operación.
        </p>
      </div>

      {/* 8 Process Step Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((st) => (
          <div
            key={st.num}
            className="bg-white border border-line-200 rounded-xl p-4 shadow-xs flex flex-col justify-between gap-3 hover:border-brand-600 transition-colors"
          >
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider block">
                {st.num} · {st.role}
              </span>
              <h2 className="text-sm font-bold text-ink-900 leading-tight">{st.title}</h2>
              <p className="text-xs text-ink-600 leading-relaxed">{st.desc}</p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate(st.target)}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 pt-1"
            >
              {st.targetLabel}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Definitions Box */}
      <section
        aria-label="Definiciones del sistema"
        className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-3"
      >
        <h2 className="text-base font-bold text-ink-900">
          Definiciones operativas implementadas en el sistema UVA
        </h2>
        <ul className="space-y-2 text-xs text-ink-900 leading-relaxed list-disc pl-5">
          <li>
            <strong>Dictámenes y carga a CONAGUA:</strong> la carga la realiza el Encargado de registro ante CONAGUA, no el inspector de campo. Se cargan tanto dictámenes conformes como inconformes. Solo se pueden cargar dictámenes previamente autorizados y firmados por el Gerente Técnico.
          </li>
          <li>
            <strong>Tablero de control:</strong> pantalla principal con indicadores clave y lista de "Requiere atención" (plazos de 10 días hábiles, programación mayor a 2 semanas, regla de 30 días naturales de verificación inicial, devoluciones vencidas, calibraciones por vencer).
          </li>
          <li>
            <strong>Estadísticas y metas:</strong> monitoreo continuo contra la meta mensual de 30 verificaciones, tiempos promedio por etapa, No Conformidades más frecuentes y productividad por verificador.
          </li>
          <li>
            <strong>Formatos configurables tipo check list:</strong> CL-DOC (documentación requerida) y CL-CAL (calibración de equipos) se administran en Catálogos › Formatos y se renderizan dinámicamente en sus respectivas pantallas.
          </li>
          <li>
            <strong>Responsable de equipos:</strong> rol específico encargado del control de inventario, entregas, devoluciones y calibraciones de los instrumentos de medición.
          </li>
          <li>
            <strong>Ciclo de vida del equipo:</strong> Reservado al programar → Entregado al inspector → Devuelto y revisado → Disponible. Un equipo en calibración, vencido o pendiente de devolución no se puede asignar.
          </li>
        </ul>
      </section>

      {/* Por confirmar con el cliente */}
      <section
        aria-label="Puntos por confirmar"
        className="bg-warn-50 border border-warn-200 rounded-xl p-5 shadow-xs space-y-2 text-xs text-warn-800"
      >
        <h2 className="text-sm font-bold text-warn-800 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" />
          Puntos normativos y operacionales por ratificar
        </h2>
        <ul className="space-y-1 list-disc pl-5 leading-relaxed">
          <li>Columnas y fórmulas de cálculo de la sección 5 del F-18 (Determinación del gasto).</li>
          <li>Rubros definitivos de los check lists CL-DOC y CL-CAL, y sus códigos de control documental.</li>
          <li>Titular del rol de Responsable de equipos y política de plazos máximos para devolución.</li>
          <li>Frecuencia de corte de las estadísticas y destinatarios automáticos de los reportes.</li>
        </ul>
      </section>
    </div>
  );
};
