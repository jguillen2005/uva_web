import React, { useState } from 'react';
import { PrestamosData, ScreenKey } from '../types';
import { operacion } from '../api/endpoints';
import { useApi, errorMessage } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { ArrowLeft, Clock, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';

interface PrestamosViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

export const PrestamosView: React.FC<PrestamosViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => operacion.getPrestamos());
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <PrestamosContent {...props} data={data} />;
};

const PrestamosContent: React.FC<PrestamosViewProps & { data: PrestamosData }> = ({
  onNavigate,
  onShowToast,
  data
}) => {
  const loans = data.loans;
  const [activeTab, setActiveTab] = useState<'entregar' | 'campo' | 'historial'>('campo');
  const [selectedVisitFolio, setSelectedVisitFolio] = useState(loans[0]?.folio ?? '');

  const [returnItems, setReturnItems] = useState(data.returnItems);

  const [receiverName, setReceiverName] = useState(data.receiverName);
  const [submitting, setSubmitting] = useState(false);

  const selectedLoan = loans.find((l) => l.folio === selectedVisitFolio);

  const handleReturnSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await operacion.registrarDevolucion({
        folio: selectedVisitFolio,
        items: returnItems,
        recibio: receiverName
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
      <header className="bg-white border-b border-line-200 px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onNavigate('Instrumentos')}
            className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Instrumentos de medición
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
            Entrega y devolución de equipos
          </h1>
          <p className="text-sm text-ink-600 max-w-3xl leading-relaxed mt-0.5">
            El equipo se reserva al programar la visita, se entrega al inspector antes de salir y vuelve a estar disponible solo cuando se registra su devolución en almacén.
          </p>
        </div>

        {/* Equipment Lifecycle Indicator */}
        <ol className="flex flex-wrap items-center gap-2 pt-2 text-xs font-semibold">
          <li className="px-3 py-1 rounded-full bg-brand-100 text-brand-800">
            1 · Reservado (al programar)
          </li>
          <li className="text-ink-400">→</li>
          <li className="px-3 py-1 rounded-full bg-warn-100 text-warn-700">
            2 · Entregado al inspector
          </li>
          <li className="text-ink-400">→</li>
          <li className="px-3 py-1 rounded-full bg-success-100 text-success-700">
            3 · Devuelto y revisado → Disponible
          </li>
          <li className="text-xs text-ink-500 font-normal">
            (o si tiene anomalías → Fuera de servicio / calibración)
          </li>
        </ol>
      </header>

      {/* Content */}
      <div className="p-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6 items-start flex-1">
        {/* Left: Loans Table */}
        <div className="flex-[999] w-full min-w-0 flex flex-col gap-3">
          {/* Subtabs */}
          <div className="flex gap-2 text-xs font-semibold border-b border-line-200">
            <button
              onClick={() => {
                setActiveTab('entregar');
                onShowToast('Mostrando visitas de mañana pendientes de entrega de equipo');
              }}
              className={`py-2 px-3 border-b-2 font-medium transition-colors ${
                activeTab === 'entregar'
                  ? 'border-brand-600 text-brand-600 font-bold'
                  : 'border-transparent text-ink-500 hover:text-ink-900'
              }`}
            >
              Por entregar ({data.pendingDeliveryCount})
            </button>
            <button
              onClick={() => setActiveTab('campo')}
              className={`py-2 px-3 border-b-2 font-medium transition-colors ${
                activeTab === 'campo'
                  ? 'border-brand-600 text-brand-600 font-bold'
                  : 'border-transparent text-ink-500 hover:text-ink-900'
              }`}
            >
              En campo · por devolver ({loans.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('historial');
                onShowToast('Mostrando historial de entregas de los últimos 60 días');
              }}
              className={`py-2 px-3 border-b-2 font-medium transition-colors ${
                activeTab === 'historial'
                  ? 'border-brand-600 text-brand-600 font-bold'
                  : 'border-transparent text-ink-500 hover:text-ink-900'
              }`}
            >
              Historial de movimientos
            </button>
          </div>

          <section
            aria-label="Movimientos de equipo"
            className="bg-white border border-line-200 rounded-xl shadow-xs overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[720px]">
                <thead>
                  <tr className="bg-surface-100 text-ink-700 font-semibold border-b border-line-200">
                    <th className="py-3 px-3.5">Visita</th>
                    <th className="py-3 px-3.5">Inspector</th>
                    <th className="py-3 px-3.5">Equipos asignados</th>
                    <th className="py-3 px-3.5">Entregado</th>
                    <th className="py-3 px-3.5">Devolver antes de</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-100">
                  {loans.map((loan) => (
                    <tr
                      key={loan.folio}
                      onClick={() => setSelectedVisitFolio(loan.folio)}
                      className={
                        selectedVisitFolio === loan.folio
                          ? 'cursor-pointer bg-brand-50 hover:bg-brand-100'
                          : 'cursor-pointer hover:bg-surface-50'
                      }
                    >
                      <td className="py-3 px-3.5">
                        <div className="font-mono font-bold text-ink-900">[{loan.folio}]</div>
                        <div className="text-[11px] text-ink-500">{loan.visitLabel}</div>
                      </td>
                      <td className="py-3 px-3.5 text-ink-700 font-medium">{loan.inspector}</td>
                      <td className="py-3 px-3.5 text-ink-700">{loan.equipment}</td>
                      <td className="py-3 px-3.5 text-ink-500">{loan.delivered}</td>
                      <td
                        className={`py-3 px-3.5 ${
                          loan.overdue ? 'text-danger-700 font-bold' : 'text-ink-700 font-semibold'
                        }`}
                      >
                        {loan.dueText}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs text-ink-500">
            "Devolver antes de" = la siguiente visita programada en la que ese equipo ya está reservado, o un plazo máximo de 2 días hábiles posteriores a la visita.
          </p>
        </div>

        {/* Right Aside: Return Inspection Checklist */}
        <aside
          aria-label="Registrar devolución"
          className="w-full lg:w-96 bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col gap-4 shrink-0"
        >
          <div>
            <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block">
              Recepción en almacén
            </span>
            <h2 className="text-base font-bold text-ink-900 mt-0.5">
              Registrar devolución · [{selectedVisitFolio}]
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              {selectedLoan?.detail ?? ''}
            </p>
          </div>

          <div className="space-y-3">
            {returnItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3 border border-line-100 rounded-lg bg-surface-50 space-y-2 text-xs"
              >
                <div className="flex justify-between items-center font-bold text-ink-900">
                  <span>{item.name}</span>
                  <span className="font-mono text-brand-600">{item.inv}</span>
                </div>

                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.received}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setReturnItems(returnItems.map((r, ri) => (ri === idx ? { ...r, received: val } : r)));
                      }}
                      className="rounded text-brand-600"
                    />
                    <span>Recibido</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.accessories}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setReturnItems(
                          returnItems.map((r, ri) =>
                            ri === idx ? { ...r, accessories: val, issue: !val } : r
                          )
                        );
                      }}
                      className="rounded text-brand-600"
                    />
                    <span>Accesorios completos</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.works}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setReturnItems(returnItems.map((r, ri) => (ri === idx ? { ...r, works: val } : r)));
                      }}
                      className="rounded text-brand-600"
                    />
                    <span>Funciona bien</span>
                  </label>
                </div>

                {item.issue && (
                  <div className="space-y-1.5 pt-1">
                    <input
                      type="text"
                      value={item.comment}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReturnItems(returnItems.map((r, ri) => (ri === idx ? { ...r, comment: val } : r)));
                      }}
                      className="w-full px-2 py-1 border border-warn-200 bg-warn-50 rounded text-xs text-warn-700"
                    />
                    <select
                      value={item.target}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReturnItems(returnItems.map((r, ri) => (ri === idx ? { ...r, target: val } : r)));
                      }}
                      className="w-full py-1 px-2 border border-line-300 rounded bg-white text-xs"
                    >
                      <option>Enviar a fuera de servicio</option>
                      <option>Enviar a calibración</option>
                      <option>Liberar como disponible</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-xs">
            <label className="block text-ink-600 font-semibold mb-1">
              Recibió en almacén de la UVA
            </label>
            <input
              type="text"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-line-300 rounded-lg bg-white font-medium text-xs"
            />
          </div>

          <button
            type="button"
            onClick={handleReturnSubmit}
            disabled={submitting}
            className="w-full h-11 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            Registrar devolución y liberar equipos
          </button>

          <p className="text-[11px] text-ink-500 leading-relaxed">
            Los equipos sin observaciones pasan inmediatamente a <strong>Disponible</strong> para siguientes verificaciones. El inspector confirma la entrega y la devolución con su firma electrónica desde la app de campo.
          </p>
        </aside>
      </div>
    </div>
  );
};
