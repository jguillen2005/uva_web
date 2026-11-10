import React, { useState } from 'react';
import { ScreenKey, VerificadorItem } from '../types';
import { catalogos } from '../api/endpoints';
import { useApi } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { Plus, Users, Award, ShieldCheck, Calendar, Briefcase, FileText } from 'lucide-react';

interface VerificadoresViewProps {
  onShowToast: (msg: string) => void;
}

export const VerificadoresView: React.FC<VerificadoresViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => catalogos.getVerificadores());
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <VerificadoresContent {...props} initialVerificadores={data} />;
};

const VerificadoresContent: React.FC<VerificadoresViewProps & { initialVerificadores: VerificadorItem[] }> = ({ onShowToast, initialVerificadores }) => {
  const [verificadores, setVerificadores] = useState<VerificadorItem[]>(initialVerificadores);
  const [selectedId, setSelectedId] = useState<string>('v3'); // Inspector 3 selected by default

  const selectedInsp = verificadores.find((v) => v.id === selectedId) || verificadores[0];

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="bg-white border-b border-line-200 px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap justify-between items-end gap-4">
        <div>
          <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
            Catálogos / Verificadores
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
            Verificadores autorizados
          </h1>
          <p className="text-sm text-ink-600 max-w-2xl mt-1 leading-relaxed">
            Inspectores de la UVA: acceso con su cuenta Microsoft 365, competencias vigentes, disponibilidad e instrumentos asignados. Esta información alimenta las sugerencias de programación.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onShowToast('Apertura de formulario de nuevo verificador e invitación Microsoft 365')}
          className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo verificador
        </button>
      </header>

      {/* Content Area */}
      <div className="p-4 sm:px-6 lg:px-8 py-5 flex flex-col lg:flex-row gap-6 items-start flex-1">
        {/* Table Column */}
        <section
          aria-label="Lista de verificadores"
          className="flex-[999] w-full min-w-0 bg-white border border-line-200 rounded-xl shadow-xs overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[780px]">
              <thead>
                <tr className="bg-surface-100 text-ink-700 font-semibold border-b border-line-200">
                  <th className="py-3 px-3.5">Verificador</th>
                  <th className="py-3 px-3.5">Zona base</th>
                  <th className="py-3 px-3.5">Competencia</th>
                  <th className="py-3 px-3.5">Visitas del mes</th>
                  <th className="py-3 px-3.5">Equipo en su poder</th>
                  <th className="py-3 px-3.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-100">
                {verificadores.map((r) => {
                  const isSelected = r.id === selectedId;
                  const progressPct = Math.round((r.monthlyVisits / r.monthlyTarget) * 100);

                  const compBadge = {
                    Vigente: 'bg-success-100 text-success-700',
                    'Por vencer': 'bg-warn-100 text-warn-700 font-bold',
                    Vencida: 'bg-danger-100 text-danger-700 font-bold'
                  }[r.compStatus];

                  const kitBadge =
                    r.assignedKit === 'Completo'
                      ? 'bg-success-100 text-success-700'
                      : 'bg-warn-100 text-warn-700 font-semibold';

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-brand-50' : 'hover:bg-surface-50'
                      }`}
                    >
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-brand-150 text-brand-800 font-bold flex items-center justify-center text-xs shrink-0">
                            {r.code}
                          </span>
                          <div>
                            <div className="font-bold text-ink-900 leading-tight">{r.name}</div>
                            <div className="text-[11px] text-ink-500">{r.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-ink-700 font-medium">{r.zone}</td>
                      <td className="py-3 px-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full ${compBadge}`}>
                          {r.compStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-line-100 overflow-hidden">
                            <div
                              className="h-full bg-brand-600 rounded-full"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="font-medium text-ink-700 tabular-nums">
                            {r.monthlyVisits} / {r.monthlyTarget}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full ${kitBadge}`}>
                          {r.assignedKit}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-ink-700 font-semibold">{r.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Aside: Inspector Profile */}
        {selectedInsp && (
          <aside
            aria-label="Detalle del verificador"
            className="w-full lg:w-96 bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col gap-4 shrink-0"
          >
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-full bg-brand-150 text-brand-800 font-extrabold flex items-center justify-center text-base shrink-0 shadow-inner">
                {selectedInsp.code}
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-ink-900 truncate">{selectedInsp.name}</h2>
                <p className="text-xs text-ink-500 truncate">{selectedInsp.email} · Microsoft 365</p>
              </div>
            </div>

            {/* Datos de operación */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                Datos de operación
              </h3>
              <dl className="grid grid-cols-2 gap-2 text-xs border-t border-line-100 pt-2">
                <div>
                  <dt className="text-ink-500">Zona base</dt>
                  <dd className="font-semibold text-ink-900">{selectedInsp.zone}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Visitas máx / semana</dt>
                  <dd className="font-semibold text-ink-900">{selectedInsp.maxWeeklyVisits} visitas</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Roles en sistema</dt>
                  <dd className="font-semibold text-ink-900">Inspector / Verificador</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Equipo de cómputo</dt>
                  <dd className="font-semibold text-ink-900">{selectedInsp.equipmentDesc}</dd>
                </div>
              </dl>
            </div>

            {/* Competencias y documentos */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                Competencias y acreditación
              </h3>
              <div className="border-t border-line-100 divide-y divide-line-100 text-xs">
                <div className="py-1.5 flex justify-between items-center">
                  <span className="text-ink-700">Calificación NMX-AA-179</span>
                  <span className="font-bold text-success-700">{selectedInsp.compDueText}</span>
                </div>
                <div className="py-1.5 flex justify-between items-center">
                  <span className="text-ink-700">Credencial oficial UVA</span>
                  <span className="font-bold text-success-700">Vigente a 31/12/2026</span>
                </div>
                <div className="py-1.5 flex justify-between items-center">
                  <span className="text-ink-700">Curso Metrología de Flujo</span>
                  <button onClick={() => onShowToast('Visualizando constancia en PDF')} className="text-brand-600 font-semibold hover:underline">
                    Ver PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Ausencias programadas */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                  Ausencias programadas
                </h3>
                <button onClick={() => onShowToast('Registrar periodo de ausencia o capacitación')} className="text-xs font-semibold text-brand-600 hover:underline">
                  + Agregar
                </button>
              </div>
              <div className="border-t border-line-100 pt-1 text-xs">
                {selectedInsp.vacations ? (
                  <div className="py-1 flex justify-between items-center text-warn-700 font-semibold">
                    <span>Vacaciones</span>
                    <span>{selectedInsp.vacations}</span>
                  </div>
                ) : (
                  <span className="text-ink-500">Sin ausencias programadas este mes</span>
                )}
              </div>
            </div>

            {/* Equipo en su poder */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                Equipo en su poder (préstamo activo)
              </h3>
              <div className="border-t border-line-100 divide-y divide-line-100 text-xs">
                {selectedInsp.activeLoans.map((loan, idx) => (
                  <div key={idx} className="py-1.5 flex justify-between items-center">
                    <span className="text-ink-700">{loan.name} · {loan.inv}</span>
                    <span className={loan.status === 'Vigente' ? 'text-success-700 font-medium' : 'text-warn-700 font-bold'}>
                      {loan.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-line-100">
              <div className="bg-canvas rounded-lg p-2 flex flex-col gap-0.5 text-center">
                <span className="text-[10px] text-ink-500">Visitas año</span>
                <span className="text-base font-bold text-ink-900 tabular-nums">28</span>
              </div>
              <div className="bg-canvas rounded-lg p-2 flex flex-col gap-0.5 text-center">
                <span className="text-[10px] text-ink-500">Devueltos</span>
                <span className="text-base font-bold text-ink-900 tabular-nums">3 %</span>
              </div>
              <div className="bg-canvas rounded-lg p-2 flex flex-col gap-0.5 text-center">
                <span className="text-[10px] text-ink-500">Sincronización</span>
                <span className="text-base font-bold text-ink-900 tabular-nums">4 hrs</span>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
