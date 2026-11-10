import React, { useState } from 'react';
import { ExpedienteData, ScreenKey } from '../types';
import { dictaminacion } from '../api/endpoints';
import { useApi, errorMessage } from '../api/useApi';
import { isMock } from '../api/source';
import { AsyncState } from '../components/AsyncState';
import { ArrowLeft, Download, ExternalLink, Bot, CheckCircle2, Clock, Upload, Send, ShieldCheck, FileCheck } from 'lucide-react';

interface ExpedienteViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

/** Folio del expediente mostrado (el que muestra hoy la vista). */
const EXPEDIENTE_FOLIO = 'UVA-0004';
const ACUSE_FOLDER = '05_Acuse';

export const ExpedienteView: React.FC<ExpedienteViewProps> = ({ onNavigate, onShowToast }) => {
  const { data, loading, error, reload } = useApi(() => dictaminacion.getExpediente(EXPEDIENTE_FOLIO));

  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <ExpedienteContent data={data} onNavigate={onNavigate} onShowToast={onShowToast} />;
};

interface ExpedienteContentProps extends ExpedienteViewProps {
  data: ExpedienteData;
}

const ExpedienteContent: React.FC<ExpedienteContentProps> = ({ data, onNavigate, onShowToast }) => {
  const [cargaMode, setCargaMode] = useState<'bot' | 'manual'>('bot');
  const [botStep, setBotStep] = useState(2); // 1 = done, 2 = user auth pause
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [acuseStatus, setAcuseStatus] = useState(
    () => data.docs.find((d) => d.folder === ACUSE_FOLDER)?.st ?? 'Pendiente'
  );
  const [uploadingManual, setUploadingManual] = useState(false);

  const { groups, botSteps, logEntries } = data;
  const docs = data.docs.map((d) =>
    d.folder === ACUSE_FOLDER ? { ...d, st: acuseStatus, action: acuseStatus === 'Listo' ? 'Ver' : 'Subir manual' } : d
  );

  const runBotSimulation = async () => {
    if (isBotRunning) return;
    setIsBotRunning(true);
    try {
      const res = await dictaminacion.cargaConagua(EXPEDIENTE_FOLIO, 'bot');
      onShowToast(res.message);
    } catch (e) {
      setIsBotRunning(false);
      onShowToast(errorMessage(e));
      return;
    }
    // Avance visual de los pasos del bot (la integración con el portal es un stub en el backend).
    setTimeout(() => {
      setBotStep(3);
      if (isMock) onShowToast('Captcha y e.firma validados. Capturando formulario de dictamen...');
      setTimeout(() => {
        setBotStep(4);
        if (isMock) onShowToast('Dictamen registrado. Descargando acuse oficial...');
        setTimeout(() => {
          setBotStep(5);
          setIsBotRunning(false);
          setAcuseStatus('Listo');
          if (isMock) onShowToast('Acuse CONAGUA guardado en SharePoint y enviado por correo al cliente.');
        }, 1200);
      }, 1200);
    }, 1200);
  };

  const handleManualUpload = async () => {
    if (uploadingManual) return;
    setUploadingManual(true);
    try {
      const res = await dictaminacion.cargaConagua(EXPEDIENTE_FOLIO, 'manual', `Acuse_CONAGUA_${EXPEDIENTE_FOLIO}.pdf`);
      setAcuseStatus('Listo');
      onShowToast(res.message);
    } catch (e) {
      onShowToast(errorMessage(e));
    } finally {
      setUploadingManual(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="bg-white border-b border-line-200 px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-500">
            <button onClick={() => onNavigate('Dictamenes')} className="text-brand-600 hover:underline">
              Dictámenes y actas
            </button>
            <span>/</span>
            <span>UVA-0004</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 mt-1">
            <h1 className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight">
              Dictamen oficial DV-0104
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-800">
              {acuseStatus === 'Listo' ? 'Cargado a CONAGUA · Acuse recibido' : 'Autorizado · pendiente de carga a CONAGUA'}
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-success-100 text-success-700">
              Conforme
            </span>
          </div>

          <p className="text-xs text-ink-600 mt-1">
            [Cliente D] Tequilera Los Altos · Pozo Maguey · Verificación extraordinaria · Autorizó Ing. Gerardo Torres el 08/10/2026
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onShowToast('Abriendo SharePoint: /Clientes/TLA091024HJ2/PozoMaguey/2026/UVA-0004/')}
            className="h-10 px-4 rounded-lg border border-line-300 bg-white hover:bg-surface-50 text-ink-900 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-ink-500" />
            Abrir carpeta en SharePoint
          </button>
          <button
            type="button"
            onClick={() => onShowToast('Descargando PDF oficial del Dictamen DV-0104 con firma digital')}
            className="h-10 px-4 rounded-lg bg-side-900 hover:bg-side-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-side-200" />
            Descargar dictamen PDF
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 sm:px-6 lg:px-8 py-6 flex flex-col xl:flex-row gap-6 items-start flex-1">
        {/* Left: Ficha del dictamen + Documentos */}
        <div className="flex-[999] w-full min-w-0 flex flex-col gap-5">
          {/* Ficha */}
          <section
            aria-label="Ficha del dictamen"
            className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-5"
          >
            <h2 className="text-base font-bold text-ink-900">Ficha del dictamen oficial</h2>

            <div className="space-y-4">
              {groups.map((g, gi) => (
                <div key={gi} className="space-y-2">
                  <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                    {g.title}
                  </h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs border-t border-line-100 pt-2">
                    {g.items.map((it, ii) => (
                      <div key={ii}>
                        <dt className="text-ink-500">{it.k}</dt>
                        <dd className="font-semibold text-ink-900 mt-0.5">{it.v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </section>

          {/* Documentos del expediente */}
          <section
            aria-label="Documentos del expediente"
            className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-3"
          >
            <div className="flex flex-wrap justify-between items-baseline gap-2 pb-1 border-b border-line-100">
              <h2 className="text-base font-bold text-ink-900">Documentos del expediente</h2>
              <span className="font-mono text-xs text-ink-500 break-all">
                /Clientes/TLA091024HJ2/PozoMaguey/2026/UVA-0004/
              </span>
            </div>

            <div className="divide-y divide-line-100 text-xs">
              {docs.map((d, di) => (
                <div key={di} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-ink-500 shrink-0 w-28">
                      {d.folder}
                    </span>
                    <span className="font-medium text-ink-900 truncate">{d.name}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        d.st === 'Listo'
                          ? 'bg-success-100 text-success-700'
                          : 'bg-warn-100 text-warn-700'
                      }`}
                    >
                      {d.st}
                    </span>
                    <button
                      onClick={() => onShowToast(`Abriendo archivo de carpeta ${d.folder}`)}
                      className="text-xs font-bold text-brand-600 hover:underline"
                    >
                      {d.action}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Aside: Carga a CONAGUA + Bitácora */}
        <aside
          aria-label="Carga y bitácora"
          className="w-full xl:w-96 flex flex-col gap-5 shrink-0"
        >
          {/* Carga a CONAGUA */}
          <section
            aria-label="Carga a CONAGUA"
            className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-4"
          >
            <div>
              <h2 className="text-base font-bold text-ink-900">Carga a CONAGUA</h2>
              <p className="text-xs text-ink-600 mt-0.5">
                Responsable: <strong>Lic. Samuel Rivas [Encargado CONAGUA]</strong>. Se cargan dictámenes conformes e inconformes.
              </p>
            </div>

            {/* Mode switch */}
            <div className="grid grid-cols-2 gap-1 bg-surface-100 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCargaMode('manual')}
                className={`py-1.5 rounded-md transition-colors ${
                  cargaMode === 'manual' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-600'
                }`}
              >
                Manual (Fase 1)
              </button>
              <button
                type="button"
                onClick={() => setCargaMode('bot')}
                className={`py-1.5 rounded-md transition-colors ${
                  cargaMode === 'bot' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-600'
                }`}
              >
                Asistida con bot (Fase 2)
              </button>
            </div>

            {cargaMode === 'bot' ? (
              <div className="space-y-3">
                <ol className="divide-y divide-line-100 text-xs">
                  {botSteps.map((bs) => {
                    const isDone = bs.n < botStep;
                    const isCurrent = bs.n === botStep;
                    return (
                      <li key={bs.n} className="py-2.5 flex gap-2.5 items-start">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isDone
                              ? 'bg-brand-600 text-white'
                              : isCurrent
                              ? 'bg-warn-500 text-white animate-pulse'
                              : 'bg-line-100 text-ink-500'
                          }`}
                        >
                          {isDone ? '✓' : bs.n}
                        </span>
                        <div className="space-y-0.5 min-w-0">
                          <span className="font-bold text-ink-900 block leading-tight">
                            {bs.title}
                          </span>
                          <span className="text-[11px] text-ink-500 block leading-relaxed">
                            {bs.desc}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <div className="bg-warn-50 border border-warn-200 rounded-lg p-3 text-xs text-warn-800 leading-relaxed">
                  <strong>Pausa para el usuario:</strong> el bot abre el portal y espera a que cargues la e.firma y resuelvas el captcha. Después continúa solo.
                </div>

                <button
                  type="button"
                  disabled={isBotRunning || acuseStatus === 'Listo'}
                  onClick={runBotSimulation}
                  className={`w-full h-11 rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-2 ${
                    acuseStatus === 'Listo'
                      ? 'bg-success-700 text-white cursor-default'
                      : 'bg-brand-600 hover:bg-brand-700 text-white'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  {isBotRunning
                    ? 'Procesando carga en portal CONAGUA...'
                    : acuseStatus === 'Listo'
                    ? '✓ Trámite CONAGUA completado'
                    : 'Iniciar carga asistida con bot'}
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-ink-600 mb-1">Folio de acuse CONAGUA</label>
                  <input
                    type="text"
                    placeholder="Ej. ACU-CONAGUA-2026-0091"
                    className="w-full px-2.5 py-1.5 border border-line-300 rounded-md bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-600 mb-1">Fecha de carga</label>
                  <input
                    type="text"
                    defaultValue={new Date().toLocaleDateString('es-MX')}
                    className="w-full px-2.5 py-1.5 border border-line-300 rounded-md bg-white"
                  />
                </div>
                <div className="border border-dashed border-line-400 rounded-lg p-3 text-center">
                  <button
                    onClick={handleManualUpload}
                    disabled={uploadingManual}
                    className="text-xs font-bold text-brand-600 hover:underline"
                  >
                    Subir PDF del acuse recibido
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Bitácora */}
          <section
            aria-label="Bitácora oficial"
            className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-3"
          >
            <h2 className="text-base font-bold text-ink-900">Bitácora oficial de eventos</h2>

            <div className="divide-y divide-line-100 text-xs">
              {logEntries.map((log, idx) => (
                <div key={idx} className="py-2.5 flex items-start gap-2.5">
                  <span className="font-mono text-[11px] text-ink-500 shrink-0 w-20">
                    {log.when}
                  </span>
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-semibold text-ink-900 block leading-snug">
                      {log.what}
                    </span>
                    <span className="text-[11px] text-ink-500 block">{log.who}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
