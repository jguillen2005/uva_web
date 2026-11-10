import React, { useState } from 'react';
import { RevisionData, ScreenKey } from '../types';
import { dictaminacion } from '../api/endpoints';
import { useApi, errorMessage } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { ArrowLeft, CheckCircle2, AlertTriangle, MessageSquare, ExternalLink, ShieldCheck, Eye, KeyRound } from 'lucide-react';

interface RevisionViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

/** Folio del expediente en revisión (el que muestra hoy la vista). */
const REVISION_FOLIO = 'UVA-0001';

export const RevisionView: React.FC<RevisionViewProps> = ({ onNavigate, onShowToast }) => {
  const { data, loading, error, reload } = useApi(() => dictaminacion.getRevision(REVISION_FOLIO));

  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <RevisionContent data={data} onNavigate={onNavigate} onShowToast={onShowToast} />;
};

interface RevisionContentProps extends RevisionViewProps {
  data: RevisionData;
}

const RevisionContent: React.FC<RevisionContentProps> = ({ data, onNavigate, onShowToast }) => {
  const [activeMainTab, setActiveMainTab] = useState('Lista de verificación');
  const [selectedSec, setSelectedSec] = useState('3');
  const [filterNC, setFilterNC] = useState(false);
  const [decision, setDecision] = useState<'autorizar' | 'devolver' | 'inconforme'>('autorizar');
  const [observations, setObservations] = useState('');
  const [showSignModal, setShowSignModal] = useState(false);
  const [eFirmaKey, setEFirmaKey] = useState('••••••••••••');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const { steps, sectionsSummary, pointsList, checks } = data;

  const handleSignAuthorize = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await dictaminacion.registrarDecision(REVISION_FOLIO, decision, observations);
      setShowSignModal(false);
      onShowToast(res.message);
      onNavigate(decision === 'devolver' ? 'Bandeja' : 'Expediente');
    } catch (e) {
      onShowToast(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="bg-white border-b border-line-200 px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-4">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-500">
              <button onClick={() => onNavigate('Bandeja')} className="text-brand-600 hover:underline">
                Expedientes de campo
              </button>
              <span>/</span>
              <span>[UVA-0001]</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight">
                [Cliente A] Minera de la Sierra · Pozo 1 Beneficio
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-warn-100 text-warn-700">
                Por revisar · vence en 2 días hábiles
              </span>
            </div>
            <p className="text-xs text-ink-600 mt-1">
              Verificación inicial · Visita 16/10/2026 · Verificador: Ing. Raúl Sánchez · Formato F-18-AC v1.5
            </p>
          </div>

          <button
            onClick={() => onShowToast('Abriendo repositorio SharePoint: /Clientes/MSI980412KJ1/UVA-0001')}
            className="h-10 px-4 rounded-lg border border-line-300 bg-white hover:bg-surface-50 text-ink-900 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-ink-500" />
            Abrir carpeta en SharePoint
          </button>
        </div>

        {/* 6-step progress lifecycle */}
        <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-semibold pt-1">
          {steps.map((s, idx) => (
            <li key={idx} className="flex flex-col gap-1.5">
              <span
                className={`h-1.5 rounded-full ${
                  s.state === 'done'
                    ? 'bg-brand-600'
                    : s.state === 'active'
                    ? 'bg-warn-500'
                    : 'bg-surface-300'
                }`}
              />
              <span
                className={`truncate ${
                  s.state === 'done' || s.state === 'active' ? 'text-ink-900' : 'text-side-400'
                }`}
              >
                {idx + 1}. {s.name}
              </span>
            </li>
          ))}
        </ol>

        {/* Main Tabs */}
        <div className="flex flex-wrap gap-2 text-xs font-semibold border-b border-line-200 -mb-5 pt-2">
          {['Lista de verificación', 'Datos del aprovechamiento', 'Documentos del cliente (6)', 'Vista previa del dictamen', 'Bitácora'].map(
            (tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveMainTab(tab);
                  if (tab !== 'Lista de verificación') {
                    onShowToast(`Pestaña: ${tab}`);
                  }
                }}
                className={`py-2 px-3 border-b-2 font-medium transition-colors ${
                  activeMainTab === tab
                    ? 'border-brand-600 text-brand-600 font-bold'
                    : 'border-transparent text-ink-500 hover:text-ink-900'
                }`}
              >
                {tab}
              </button>
            )
          )}
        </div>
      </header>

      {/* Main Body */}
      <div className="p-4 sm:px-6 lg:px-8 py-6 flex flex-col xl:flex-row gap-6 items-start flex-1">
        {/* Left Column: Sections badges + Verified points */}
        <div className="flex-[999] w-full min-w-0 flex flex-col gap-4">
          {/* Section pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {sectionsSummary.map((sec) => {
              const isSelected = selectedSec === sec.n;
              return (
                <button
                  key={sec.n}
                  type="button"
                  onClick={() => setSelectedSec(sec.n)}
                  className={`p-2.5 rounded-lg border text-left flex flex-col gap-0.5 text-xs transition-all ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50 shadow-xs'
                      : 'border-line-200 bg-white hover:border-brand-600'
                  }`}
                >
                  <span className="font-bold text-ink-900 truncate">{sec.name}</span>
                  <span className="text-[11px] text-ink-500 truncate">{sec.stat}</span>
                </button>
              );
            })}
          </div>

          {/* Section 3 Points Review */}
          <section
            aria-label="Puntos evaluados"
            className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-4"
          >
            <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-line-100">
              <h2 className="text-base font-bold text-ink-900">
                3 · Ubicación de la estación de aforo (NMX-AA-179)
              </h2>
              <label className="flex items-center gap-2 text-xs text-ink-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterNC}
                  onChange={(e) => setFilterNC(e.target.checked)}
                  className="rounded text-brand-600"
                />
                <span>Mostrar solo NC y comentados</span>
              </label>
            </div>

            <div className="divide-y divide-line-100">
              {pointsList
                .filter((p) => !filterNC || p.hasNote || p.ans === 'NC')
                .map((p) => (
                  <div key={p.n} className="py-4 space-y-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2.5 flex-1 min-w-[280px]">
                        <span className="font-mono font-bold text-xs text-brand-600 shrink-0 w-8">
                          {p.n}
                        </span>
                        <div className="space-y-1">
                          <p className="font-semibold text-xs text-ink-900 leading-snug">
                            {p.text}
                          </p>
                          <span className="text-[11px] text-ink-500 block">{p.extra}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span
                          className={`px-3 py-1 rounded-full font-bold text-xs ${
                            p.ans === 'C'
                              ? 'bg-success-100 text-success-700'
                              : p.ans === 'NC'
                              ? 'bg-danger-100 text-danger-700'
                              : 'bg-line-100 text-ink-700'
                          }`}
                        >
                          {p.ans}
                        </span>

                        {/* Photo attachments */}
                        <div className="flex items-center gap-1">
                          {p.photos.map((ph, pi) => (
                            <button
                              key={pi}
                              type="button"
                              onClick={() => setPreviewPhoto(ph)}
                              className="w-12 h-9 rounded bg-surface-300 hover:bg-line-300 text-[9.5px] font-mono text-ink-700 flex items-center justify-center transition-colors"
                              title="Ver foto con metadatos GPS"
                            >
                              foto {pi + 1}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => onShowToast(`Agregar nota técnica al punto ${p.n}`)}
                          className="w-9 h-9 rounded-lg border border-line-300 hover:bg-brand-50 flex items-center justify-center text-brand-600"
                          title="Comentar este punto"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {p.hasNote && (
                      <div className="ml-10 bg-warn-50 border border-warn-200 rounded-lg p-3 text-xs text-warn-800 leading-relaxed">
                        <strong>Comentario de revisión del Gerente Técnico:</strong> {p.note}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </section>
        </div>

        {/* Right Column: Decision & Automatic Checks */}
        <aside
          aria-label="Resolución y autorización"
          className="w-full xl:w-96 flex flex-col gap-4 shrink-0"
        >
          {/* Resultado calculado */}
          <div className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-2">
            <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block">
              Resultado normativo calculado
            </span>
            <div className="flex items-center gap-3">
              <span className="px-3.5 py-1 rounded-full bg-success-100 text-success-700 font-extrabold text-sm">
                Cumple
              </span>
              <span className="text-xs text-ink-700 font-medium">0 NC · 61 C · 5 N/A</span>
            </div>
            <p className="text-xs text-ink-700 pt-1">
              Documento a emitir: <strong className="text-ink-900">Dictamen F-17-AC v2.0 · Conforme</strong>
            </p>
          </div>

          {/* Validaciones automáticas del sistema */}
          <div className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                Validaciones automáticas
              </h3>
              <span className="text-[11px] font-semibold text-success-700">5/6 OK</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {checks.map((chk, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  {chk.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-warn-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-semibold text-ink-900 block leading-snug">
                      {chk.label}
                    </span>
                    <span className="text-[11px] text-ink-500 block leading-snug">
                      {chk.detail}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Decisión del Gerente Técnico */}
          <div className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-3.5">
            <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Decisión del Gerente Técnico
            </h3>

            <div className="space-y-2 text-xs font-semibold">
              <label
                className={`p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-colors ${
                  decision === 'autorizar'
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-line-300 hover:bg-surface-50 text-ink-900'
                }`}
              >
                <input
                  type="radio"
                  name="dec"
                  checked={decision === 'autorizar'}
                  onChange={() => setDecision('autorizar')}
                  className="text-brand-600"
                />
                <span>Autorizar y generar dictamen oficial F-17</span>
              </label>

              <label
                className={`p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-colors ${
                  decision === 'devolver'
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-line-300 hover:bg-surface-50 text-ink-900'
                }`}
              >
                <input
                  type="radio"
                  name="dec"
                  checked={decision === 'devolver'}
                  onChange={() => setDecision('devolver')}
                  className="text-brand-600"
                />
                <span>Devolver al verificador para corrección</span>
              </label>

              <label
                className={`p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-colors ${
                  decision === 'inconforme'
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-line-300 hover:bg-surface-50 text-ink-900'
                }`}
              >
                <input
                  type="radio"
                  name="dec"
                  checked={decision === 'inconforme'}
                  onChange={() => setDecision('inconforme')}
                  className="text-brand-600"
                />
                <span>Cambiar resultado a Inconforme (con justificación)</span>
              </label>
            </div>

            <div className="text-xs">
              <label className="block text-ink-600 font-semibold mb-1">
                Observaciones y considerandos de dictaminación
              </label>
              <textarea
                rows={3}
                placeholder="Se incluyen en el expediente y bitácora oficial..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="w-full p-2.5 border border-line-300 rounded-lg text-xs bg-white"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowSignModal(true)}
              className="w-full h-11 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              Autorizar con firma electrónica
            </button>

            <p className="text-[11px] text-ink-500 leading-relaxed">
              Al autorizar: se asigna folio al dictamen, se genera el PDF con la firma del Gerente Técnico, se archiva en SharePoint y el expediente pasa a "Pendiente de carga a CONAGUA".
            </p>
          </div>
        </aside>
      </div>

      {/* Signature Authorization Modal */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-600" />
                Firma electrónica del Gerente Técnico
              </h3>
              <button
                onClick={() => setShowSignModal(false)}
                className="text-ink-400 hover:text-ink-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-canvas rounded-lg space-y-1">
                <div>Firmante: <strong>Ing. Gerardo Torres (Gerente Técnico UVA)</strong></div>
                <div>Folio: <strong>DV-0105 / UVA-0001</strong></div>
                <div>Resultado: <strong className="text-success-700">Conforme</strong></div>
              </div>

              <div>
                <label className="block font-semibold text-ink-600 mb-1">
                  Certificado de e.firma (.cer / .key)
                </label>
                <div className="p-2.5 border border-line-300 rounded-lg bg-surface-50 flex items-center justify-between text-xs font-mono">
                  <span>eFirma_GTorres_UVA_2026.key</span>
                  <span className="text-success-700 font-bold">Válido</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink-600 mb-1">
                  Contraseña de clave privada
                </label>
                <input
                  type="password"
                  value={eFirmaKey}
                  onChange={(e) => setEFirmaKey(e.target.value)}
                  className="w-full px-3 py-2 border border-line-300 rounded-lg font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSignModal(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-ink-600 hover:bg-surface-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSignAuthorize}
                disabled={submitting}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                Firmar y autorizar dictamen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-lg w-full p-4 space-y-3 max-h-[90dvh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs font-bold text-ink-900">{previewPhoto}</span>
              <button onClick={() => setPreviewPhoto(null)} className="text-ink-500 font-bold">✕</button>
            </div>
            <div className="h-64 rounded-lg bg-surface-300 flex flex-col items-center justify-center text-center p-4 text-xs text-ink-700 space-y-2">
              <Eye className="w-8 h-8 text-brand-600" />
              <div className="font-semibold text-sm">Fotografía en alta resolución con coordenadas GPS</div>
              <div className="font-mono text-[11px] text-ink-500">
                Latitud: 22.7709° N · Longitud: 102.5832° W · Altitud: 2,410 msnm<br/>
                Fecha y hora UTC: 16/10/2026 16:42:10 · Hash SHA-256 verificado
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
