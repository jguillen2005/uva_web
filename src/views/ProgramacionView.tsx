import React, { useState } from 'react';
import { ProgramacionData, ScreenKey } from '../types';
import { operacion } from '../api/endpoints';
import { useApi, errorMessage } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { Calendar, ChevronLeft, ChevronRight, Clock, Check, AlertTriangle, ShieldAlert } from 'lucide-react';

interface ProgramacionViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

export const ProgramacionView: React.FC<ProgramacionViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => operacion.getProgramacion());
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <ProgramacionContent {...props} data={data} />;
};

const ProgramacionContent: React.FC<ProgramacionViewProps & { data: ProgramacionData }> = ({
  onNavigate,
  onShowToast,
  data
}) => {
  const { queueItems, inspectorsSchedule } = data;
  const suggestedInspectors = data.suggestedInspectors ?? [];
  const equipment = data.equipment ?? [];
  const dayHeaders = data.dayHeaders ?? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
  const kpis = data.kpis ?? {
    monthVisits: '—',
    toSchedule: queueItems.length,
    outOfWindow: queueItems.filter((q) => q.dueType === 'urgent').length,
    inspectorsAvailable: `${
      inspectorsSchedule.filter((i) => !i.days.every((d) => d?.type === 'off')).length
    } de ${inspectorsSchedule.length}`
  };

  const [viewMode, setViewMode] = useState<'Semana' | 'Mes' | 'Mapa'>('Semana');
  const [selectedQueueFolio, setSelectedQueueFolio] = useState<string>(
    (queueItems[1] ?? queueItems[0])?.rawFolio ?? ''
  );
  const [selectedInspector, setSelectedInspector] = useState<string>(suggestedInspectors[0]?.code ?? '');
  const [visitDate, setVisitDate] = useState<string>(data.defaultFecha ?? '');
  const [visitTime, setVisitTime] = useState<string>(data.defaultHora ?? '');
  const [sendOutlook, setSendOutlook] = useState<boolean>(true);
  const [sendClientEmail, setSendClientEmail] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  // Equipment reservation selections (por tipo de equipo)
  const [equipSel, setEquipSel] = useState<Record<string, string>>(() =>
    Object.fromEntries(equipment.map((slot) => [slot.key, slot.options.find((o) => !o.disabled)?.inv ?? '']))
  );

  const selectedQueueItem = queueItems.find((q) => q.rawFolio === selectedQueueFolio);

  const handleConfirmProgramming = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await operacion.confirmarVisita({
        folio: selectedQueueFolio,
        inspector_code: selectedInspector,
        fecha: visitDate,
        hora: visitTime,
        send_outlook: sendOutlook,
        send_client_email: sendClientEmail,
        equipo: Object.values(equipSel).filter(Boolean)
      });
      onShowToast(res.message);
    } catch (err) {
      onShowToast(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="bg-white border-b border-line-200 px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap justify-between items-end gap-4">
        <div>
          <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
            Operación / Programación de visitas
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
            Programación de visitas
          </h1>
          <p className="text-sm text-ink-600 max-w-2xl mt-1 leading-relaxed">
            Solo entran a programar las solicitudes con documentación completa. El sistema sugiere inspector y fecha; el coordinador asigna el equipo de medición disponible, confirma y se envía la cita al Outlook del inspector y a su app.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Segmented Toggle */}
          <div className="flex bg-surface-100 p-1 rounded-lg gap-1 text-xs font-medium">
            {(['Semana', 'Mes', 'Mapa'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  viewMode === m ? 'bg-white text-ink-900 font-bold shadow-xs' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onShowToast('Semana anterior: 12 – 16 de octubre')}
              className="w-9 h-9 rounded-lg border border-line-300 bg-white hover:bg-surface-50 flex items-center justify-center text-ink-900"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-ink-900 min-w-[130px] text-center">
              {data.weekLabel ?? ''}
            </span>
            <button
              onClick={() => onShowToast('Semana siguiente: 26 – 30 de octubre')}
              className="w-9 h-9 rounded-lg border border-line-300 bg-white hover:bg-surface-50 flex items-center justify-center text-ink-900"
              aria-label="Semana siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 4 KPIs Bar */}
      <div className="px-4 sm:px-6 lg:px-8 pt-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-line-200 rounded-xl p-3.5 flex flex-col gap-1 shadow-xs">
            <span className="text-xs text-ink-600 font-medium">Visitas del mes / meta</span>
            <span className="text-2xl font-bold text-ink-900 tabular-nums">{kpis.monthVisits}</span>
          </div>
          <div className="bg-white border border-line-200 rounded-xl p-3.5 flex flex-col gap-1 shadow-xs">
            <span className="text-xs text-ink-600 font-medium">Por programar</span>
            <span className="text-2xl font-bold text-ink-900 tabular-nums">{kpis.toSchedule}</span>
          </div>
          <div className="bg-white border border-warn-200 bg-warn-25 rounded-xl p-3.5 flex flex-col gap-1 shadow-xs">
            <span className="text-xs text-warn-700 font-semibold">Fuera de las 2 semanas</span>
            <span className="text-2xl font-bold text-warn-700 tabular-nums">{kpis.outOfWindow}</span>
          </div>
          <div className="bg-white border border-line-200 rounded-xl p-3.5 flex flex-col gap-1 shadow-xs">
            <span className="text-xs text-ink-600 font-medium">Inspectores disponibles</span>
            <span className="text-2xl font-bold text-ink-900 tabular-nums">{kpis.inspectorsAvailable}</span>
          </div>
        </div>
      </div>

      {/* 3 Columns: Queue + Schedule Grid + Assign Panel */}
      <div className="p-4 sm:px-6 lg:px-8 py-5 flex flex-col xl:flex-row gap-5 items-start flex-1">
        {/* Left: Por programar queue */}
        <section
          aria-label="Solicitudes por programar"
          className="w-full xl:w-72 bg-white border border-line-200 rounded-xl p-4 shadow-xs flex flex-col gap-3 shrink-0"
        >
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm font-bold text-ink-900">Por programar</h2>
            <span className="text-[11px] text-ink-500">Por fecha límite</span>
          </div>

          <div className="space-y-2.5">
            {queueItems.map((item) => {
              const isSelected = selectedQueueFolio === item.rawFolio;
              return (
                <button
                  key={item.folio}
                  type="button"
                  onClick={() => setSelectedQueueFolio(item.rawFolio)}
                  className={`w-full p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50 shadow-xs ring-1 ring-brand-600'
                      : 'border-line-200 bg-white hover:border-brand-600'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono font-bold text-ink-900">{item.folio}</span>
                    <span className="text-ink-500">{item.kind}</span>
                  </div>
                  <span className="font-semibold text-xs text-ink-900 line-clamp-1">{item.client}</span>
                  <span className="text-[11px] text-ink-500">{item.place}</span>
                  <span
                    className={`text-[11px] font-bold ${
                      item.dueType === 'urgent'
                        ? 'text-danger-700'
                        : item.dueType === 'warning'
                        ? 'text-warn-700'
                        : 'text-ink-700'
                    }`}
                  >
                    {item.due}
                  </span>
                  {item.instNote && (
                    <span className="text-[10.5px] font-medium text-danger-700 bg-danger-100 px-1.5 py-0.5 rounded">
                      {item.instNote}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Center: Weekly Inspector Grid */}
        <section
          aria-label="Calendario de inspectores"
          className="flex-[999] w-full min-w-0 bg-white border border-line-200 rounded-xl shadow-xs overflow-hidden flex flex-col"
        >
          <div className="overflow-x-auto">
            <div className="min-w-[650px]">
              {/* Header Days */}
              <div className="grid grid-cols-[160px_repeat(5,1fr)] bg-surface-100 text-xs font-semibold text-ink-700 border-b border-line-200">
                <div className="py-3 px-3.5">Inspector</div>
                {dayHeaders.map((d) => (
                  <div key={d} className="py-3 px-2 text-center">{d}</div>
                ))}
              </div>

              {/* Inspector Rows */}
              <div className="divide-y divide-line-100">
                {inspectorsSchedule.map((insp, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[160px_repeat(5,1fr)] min-h-[76px] items-stretch text-xs"
                  >
                    <div className="p-3 border-r border-line-100 bg-surface-50 flex flex-col justify-center gap-0.5">
                      <span className="font-bold text-ink-900 leading-tight truncate">{insp.name}</span>
                      <span className="text-[11px] text-ink-500">{insp.zone}</span>
                      <span className="text-[10px] text-ink-500">{insp.load}</span>
                    </div>

                    {insp.days.map((slot, dIdx) => (
                      <div
                        key={dIdx}
                        className="p-1.5 border-r border-surface-100 flex flex-col justify-center"
                      >
                        {slot && (
                          <div
                            className={`p-1.5 rounded-md text-[11px] leading-tight flex flex-col gap-0.5 ${
                              slot.type === 'conf'
                                ? 'bg-success-100 border border-success-600 text-success-800'
                                : slot.type === 'prog'
                                ? 'bg-brand-100 border border-brand-600 text-brand-800'
                                : slot.type === 'prop'
                                ? 'bg-warn-100 border-2 border-dashed border-warn-600 text-warn-800'
                                : 'bg-line-100 text-ink-500'
                            }`}
                          >
                            <span className="font-bold">{slot.text}</span>
                            <span className="text-[10px] opacity-90 truncate">{slot.client}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Color Legend */}
          <div className="p-3 border-t border-line-100 bg-surface-50 flex flex-wrap gap-4 text-xs text-ink-700">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-brand-100 border border-brand-600" />
              Programada
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-success-100 border border-success-600" />
              Confirmada por cliente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-warn-100 border border-dashed border-warn-600" />
              Propuesta (sin confirmar)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-line-100" />
              No disponible / Vacaciones
            </span>
          </div>
        </section>

        {/* Right: Asignar Visita Configuration Panel */}
        <aside
          aria-label="Asignar visita"
          className="w-full xl:w-88 bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col gap-4 shrink-0"
        >
          <div>
            <span className="text-xs font-bold text-ink-500 uppercase tracking-wider block">
              Asignar visita
            </span>
            <h2 className="text-base font-bold text-ink-900 mt-0.5">
              {selectedQueueItem ? `${selectedQueueItem.folio} · ${selectedQueueItem.client}` : '—'}
            </h2>
            <p className="text-xs text-ink-600 mt-0.5">
              {selectedQueueItem
                ? `${selectedQueueItem.kind} · ${selectedQueueItem.place} · ${selectedQueueItem.due.charAt(0).toLowerCase()}${selectedQueueItem.due.slice(1)}`
                : ''}
            </p>
          </div>

          {/* Suggested Inspectors */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-ink-700">Inspectores sugeridos por el sistema</h3>
            <div className="space-y-2">
              {suggestedInspectors.map((sug, sIdx) => (
                <label
                  key={sug.code}
                  className={`p-3 rounded-lg border flex gap-2.5 items-start cursor-pointer transition-colors ${
                    selectedInspector === sug.code
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-line-200 hover:bg-surface-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="insp_suggest"
                    checked={selectedInspector === sug.code}
                    onChange={() => setSelectedInspector(sug.code)}
                    className="mt-0.5 text-brand-600"
                  />
                  <div className="text-xs space-y-0.5 flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-ink-900">{sug.name}</span>
                      <span className={`font-bold ${sIdx === 0 ? 'text-brand-600' : 'text-ink-500'}`}>{sug.day}</span>
                    </div>
                    {sug.reasons.map((r) => (
                      <div key={r} className="text-ink-500">· {r}</div>
                    ))}
                    {sug.highlight && <div className="text-success-700 font-medium">· {sug.highlight}</div>}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Date & Time Picker */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-ink-600 font-semibold mb-1">Fecha</label>
              <input
                type="text"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-line-300 rounded-md bg-white font-medium focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-ink-600 font-semibold mb-1">Hora</label>
              <input
                type="text"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-line-300 rounded-md bg-white font-medium focus:border-brand-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Equipment Reservation Selection */}
          <fieldset className="border border-line-200 rounded-lg p-3 space-y-2 text-xs">
            <legend className="font-bold text-ink-900 px-1 text-xs">
              Equipo de medición a asignar
            </legend>
            <p className="text-[11px] text-ink-500 leading-tight">
              Solo se listan equipos libres ese día y con calibración vigente.
            </p>

            {equipment.map((slot) => (
              <div key={slot.key}>
                <label className="block text-ink-600 text-[11px] font-semibold mb-0.5">{slot.label}</label>
                <select
                  value={equipSel[slot.key] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEquipSel((prev) => ({ ...prev, [slot.key]: val }));
                  }}
                  className="w-full py-1.5 px-2 border border-line-300 rounded bg-white text-xs"
                >
                  {slot.options.map((o) => (
                    <option key={o.inv} disabled={o.disabled} value={o.inv}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className={`text-[10px] font-semibold ${slot.noteWarning ? 'text-warn-700' : 'text-success-700'}`}>
                  {slot.note}
                </span>
              </div>
            ))}
          </fieldset>

          {/* Communication Checkboxes */}
          <div className="space-y-1.5 text-xs text-ink-900">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendOutlook}
                onChange={(e) => setSendOutlook(e.target.checked)}
                className="text-brand-600 rounded"
              />
              <span>Enviar cita al Outlook del inspector</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendClientEmail}
                onChange={(e) => setSendClientEmail(e.target.checked)}
                className="text-brand-600 rounded"
              />
              <span>Pedir confirmación al cliente por correo</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleConfirmProgramming}
            disabled={submitting}
            className="w-full h-11 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors shadow-xs"
          >
            Confirmar programación
          </button>

          <p className="text-[11px] text-ink-500 leading-relaxed">
            Al confirmar, el equipo queda <strong>Reservado</strong> para esa fecha y la orden aparece en la app del inspector lista para trabajar sin señal. La entrega y devolución se registran en{' '}
            <button
              onClick={() => onNavigate('Prestamos')}
              className="text-brand-600 font-semibold underline"
            >
              Entrega y devolución de equipos
            </button>.
          </p>
        </aside>
      </div>
    </div>
  );
};
