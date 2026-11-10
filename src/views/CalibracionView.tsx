import React, { useState } from 'react';
import { CalibracionActual, ScreenKey } from '../types';
import { calidad } from '../api/endpoints';
import { useApi, errorMessage } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { ArrowLeft, CheckCircle2, Upload, AlertTriangle, ShieldCheck, FileText } from 'lucide-react';

interface CalibracionViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

export const CalibracionView: React.FC<CalibracionViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => calidad.getCalibracionActual());
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <CalibracionContent {...props} data={data} />;
};

const CalibracionContent: React.FC<CalibracionViewProps & { data: CalibracionActual }> = ({
  onNavigate,
  onShowToast,
  data
}) => {
  const { instrument } = data;
  const cert = data.certificate;
  const [activeTab, setActiveTab] = useState<'curso' | 'historial'>('curso');

  const [steps, setSteps] = useState(data.steps);
  const [busy, setBusy] = useState(false);

  // Form inputs
  const [labName, setLabName] = useState(cert?.labName ?? '');
  const [certFolio, setCertFolio] = useState(cert?.certNumber ?? '');
  const [calDate, setCalDate] = useState(cert?.calDate ?? '');
  const [vigencia, setVigencia] = useState(cert?.vigencia ?? '12 meses');
  const [hasFile, setHasFile] = useState(Boolean(cert?.fileName));
  const [notes, setNotes] = useState(cert?.notes ?? '');

  const completedCount = steps.filter((s) => s.done).length;
  const allRequiredDone = steps.filter((s) => s.req).every((s) => s.done);
  const canRelease = allRequiredDone && labName && certFolio && calDate && hasFile;

  const toggleStep = (id: number) => {
    setSteps(
      steps.map((s) =>
        s.id === id ? { ...s, done: !s.done, date: !s.done ? new Date().toLocaleDateString('es-MX') : '' } : s
      )
    );
  };

  const handleSaveProgress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await calidad.saveCalibracionPasos(data.id, steps);
      onShowToast(res.message);
    } catch (err) {
      onShowToast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRelease = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await calidad.saveCalibracionPasos(data.id, steps);
      const res = await calidad.completarCalibracion(data.id, {
        cert_number: certFolio,
        lab_name: labName,
        cal_date: calDate,
        vigencia,
        notes
      });
      onShowToast(res.message);
      onNavigate('Instrumentos');
    } catch (err) {
      onShowToast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="bg-white border-b border-line-200 px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-3">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <button
              onClick={() => onNavigate('Instrumentos')}
              className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1 mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Instrumentos de medición / {instrument.invCode}
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight">
                {instrument.type} · {instrument.invCode}
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-warn-100 text-warn-700">
                {instrument.statusLabel}
              </span>
            </div>
            <p className="text-xs text-ink-600 mt-1">
              {instrument.brandModel} · NS {instrument.serial} · Calibración anterior venció el {instrument.previousDueDate}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveProgress}
              disabled={busy}
              className="h-10 px-4 rounded-lg border border-line-300 bg-white hover:bg-surface-50 text-ink-900 text-xs font-semibold transition-colors"
            >
              Guardar avance
            </button>
            <button
              type="button"
              disabled={!canRelease || busy}
              onClick={handleRelease}
              className={`h-10 px-4 rounded-lg text-xs font-bold transition-colors shadow-xs ${
                canRelease
                  ? 'bg-brand-600 hover:bg-brand-700 text-white'
                  : 'bg-surface-200 text-ink-400 cursor-not-allowed'
              }`}
            >
              Cerrar calibración y liberar equipo
            </button>
          </div>
        </div>

        <div className="flex gap-2 text-xs font-semibold border-b border-line-200 -mb-5 pt-1">
          <button
            onClick={() => setActiveTab('curso')}
            className={`py-2 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'curso'
                ? 'border-brand-600 text-brand-600 font-bold'
                : 'border-transparent text-ink-500 hover:text-ink-900'
            }`}
          >
            Calibración en curso
          </button>
          <button
            onClick={() => {
              setActiveTab('historial');
              onShowToast('Mostrando histórico de certificados anuales');
            }}
            className={`py-2 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'historial'
                ? 'border-brand-600 text-brand-600 font-bold'
                : 'border-transparent text-ink-500 hover:text-ink-900'
            }`}
          >
            Historial de calibraciones
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6 items-start flex-1">
        {/* Left: Checklist */}
        <section
          aria-label="Checklist de calibración"
          className="flex-[999] w-full min-w-0 bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap justify-between items-baseline gap-2 pb-2 border-b border-line-100">
            <div>
              <h2 className="text-base font-bold text-ink-900">Checklist de calibración</h2>
              <p className="text-xs text-ink-500">
                Pasos del formato{' '}
                <button
                  onClick={() => onNavigate('Main')}
                  className="text-brand-600 font-bold underline"
                >
                  CL-CAL v1.0
                </button>{' '}
                (Catálogos › Formatos)
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-24 h-2 rounded-full bg-line-100 overflow-hidden">
                <div
                  className="h-full bg-brand-600 rounded-full transition-all"
                  style={{ width: `${(completedCount / steps.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold text-ink-900 tabular-nums">
                {completedCount} de {steps.length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-[48px_1fr_130px_160px] gap-2 py-2 px-2 bg-surface-100 rounded-lg text-xs font-semibold text-ink-700 mb-2">
                <span className="text-center">Hecho</span>
                <span>Paso normativo</span>
                <span>Fecha realización</span>
                <span>Comentarios / guía</span>
              </div>

              <div className="divide-y divide-line-100 text-xs">
                {steps.map((st) => (
                  <div
                    key={st.id}
                    className="grid grid-cols-[48px_1fr_130px_160px] gap-2 py-3 px-2 items-center hover:bg-surface-50"
                  >
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={st.done}
                        onChange={() => toggleStep(st.id)}
                        className="w-4 h-4 rounded text-brand-600 cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className={`leading-snug ${st.done ? 'text-ink-700' : 'font-semibold text-ink-900'}`}>
                        {st.id}. {st.title}
                      </span>
                      {st.req && (
                        <span className="text-[10px] font-bold text-warn-700">Obligatorio</span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="dd/mm/aaaa"
                      value={st.date}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSteps(steps.map((s) => (s.id === st.id ? { ...s, date: val } : s)));
                      }}
                      className="px-2 py-1 border border-line-300 rounded bg-white text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Opcional..."
                      value={st.comment}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSteps(steps.map((s) => (s.id === st.id ? { ...s, comment: val } : s)));
                      }}
                      className="px-2 py-1 border border-line-300 rounded bg-white text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Right Aside: Calibration Metadata Form */}
        <aside
          aria-label="Datos de la calibración"
          className="w-full lg:w-96 bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col gap-4 shrink-0"
        >
          <div>
            <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block">
              Certificado oficial
            </span>
            <h2 className="text-base font-bold text-ink-900 mt-0.5">
              Datos de la nueva calibración
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-ink-600 font-semibold mb-1">
                Laboratorio acreditado *
              </label>
              <input
                type="text"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="Nombre del laboratorio acreditado ante EMA"
                className="w-full px-2.5 py-1.5 border border-line-300 rounded-md bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-ink-600 font-semibold mb-1">
                Folio del certificado de calibración *
              </label>
              <input
                type="text"
                value={certFolio}
                onChange={(e) => setCertFolio(e.target.value)}
                placeholder="Ej. EMA-FLUX-2026-081"
                className="w-full px-2.5 py-1.5 border border-line-300 rounded-md bg-white font-mono font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-ink-600 font-semibold mb-1">Fecha calibración *</label>
                <input
                  type="text"
                  value={calDate}
                  onChange={(e) => setCalDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-line-300 rounded-md bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-ink-600 font-semibold mb-1">Vigencia</label>
                <select
                  value={vigencia}
                  onChange={(e) => setVigencia(e.target.value)}
                  className="w-full py-1.5 px-2 border border-line-300 rounded-md bg-white text-xs"
                >
                  <option>12 meses</option>
                  <option>6 meses</option>
                  <option>24 meses</option>
                </select>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-50 border border-line-100 text-xs">
              Nuevo vencimiento calculado: <strong className="text-success-700">{cert?.newDueDate ?? '—'}</strong>
            </div>

            {/* Certificate Dropzone */}
            <div className="border-2 border-dashed border-line-400 rounded-xl p-4 text-center flex flex-col items-center justify-center gap-1.5 bg-surface-50">
              <FileText className="w-6 h-6 text-brand-600" />
              <button
                type="button"
                onClick={() => {
                  setHasFile(true);
                  onShowToast('Certificado PDF cargado exitosamente en SharePoint');
                }}
                className="text-xs font-bold text-brand-600 hover:underline"
              >
                {hasFile ? `${cert?.fileName ?? 'Certificado.pdf'} (Cargado)` : 'Adjuntar certificado (PDF)'}
              </button>
              <span className="text-[10px] text-ink-500">
                Se guarda en SharePoint en la carpeta del instrumento
              </span>
            </div>

            <div>
              <label className="block text-ink-600 font-semibold mb-1">Comentarios generales</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border border-line-300 rounded-lg text-xs bg-white"
              />
            </div>
          </div>

          <div className="bg-warn-50 border border-warn-200 rounded-lg p-3 text-xs text-warn-800 leading-relaxed">
            El botón <strong>Cerrar calibración y liberar equipo</strong> se habilita cuando todos los pasos obligatorios están palomeados y se capturó laboratorio, folio, fecha y certificado. Al cerrar, el equipo vuelve a <strong>Disponible</strong>.
          </div>
        </aside>
      </div>
    </div>
  );
};
