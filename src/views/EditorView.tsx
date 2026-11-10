import React, { useState } from 'react';
import { ScreenKey, FormatoEstructura } from '../types';
import { catalogos } from '../api/endpoints';
import { useApi, errorMessage } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { editorFormatoActual as formato } from '../data/catalogos';
import { ArrowLeft, Smartphone, Save, Send, GripVertical, Plus, Info, ExternalLink } from 'lucide-react';

interface EditorViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

export const EditorView: React.FC<EditorViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => catalogos.getFormatoEstructura(formato.code));
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <EditorContent {...props} estructura={data} />;
};

const EditorContent: React.FC<EditorViewProps & { estructura: FormatoEstructura }> = ({ onNavigate, onShowToast, estructura }) => {
  const { sections, points } = estructura;
  const initialPoint = points.find((p) => p.n === formato.defaultPoint) ?? points[0];

  const [activeTab, setActiveTab] = useState<string>('Estructura y puntos');
  const [selectedSec, setSelectedSec] = useState<string>(formato.defaultSection);
  const [selectedPointId, setSelectedPointId] = useState<string>(initialPoint?.n ?? '');
  const [busy, setBusy] = useState(false);

  // Form states for the selected point (precargados desde la estructura)
  const [pointNum, setPointNum] = useState(initialPoint?.n ?? '');
  const [normRef, setNormRef] = useState((initialPoint?.ref ?? '').replace(/^\[|\]$/g, ''));
  const [question, setQuestion] = useState(initialPoint?.text ?? '');
  const [criterion, setCriterion] = useState(initialPoint?.criterion ?? '');
  const [verifType, setVerifType] = useState(initialPoint?.kind ?? 'Visual');
  const [responseType, setResponseType] = useState('Una sola opción (option box)');
  const [photoRequired, setPhotoRequired] = useState(true);
  const [minPhotos, setMinPhotos] = useState(1);
  const [appliesInicial, setAppliesInicial] = useState(true);
  const [appliesPeriodica, setAppliesPeriodica] = useState(true);
  const [appliesExtra, setAppliesExtra] = useState(true);

  const handleSaveDraft = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await catalogos.saveFormatoEstructura(formato.code, { sections, points });
      onShowToast(res.message);
    } catch (e) {
      onShowToast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSendApproval = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await catalogos.saveFormatoEstructura(formato.code, { sections, points });
      const res = await catalogos.formatoEnviarAprobacion(formato.code);
      onShowToast(res.message);
      onNavigate('Main');
    } catch (e) {
      onShowToast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="bg-white border-b border-line-200 px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-500">
              <button onClick={() => onNavigate('Main')} className="text-brand-600 hover:underline">
                Formatos
              </button>
              <span>/</span>
              <span>{formato.code}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight">
                {formato.name}
              </h1>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-100 text-ink-900">
                v{formato.version}
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-line-100 text-ink-700">
                {formato.status}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('Preview')}
              className="h-10 px-4 rounded-lg border border-line-300 bg-white hover:bg-surface-50 text-ink-900 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Smartphone className="w-4 h-4 text-brand-600" />
              Vista previa en campo
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={busy}
              className="h-10 px-4 rounded-lg border border-line-300 bg-white hover:bg-surface-50 text-ink-900 text-xs font-semibold transition-colors"
            >
              Guardar borrador
            </button>
            <button
              type="button"
              onClick={handleSendApproval}
              disabled={busy}
              className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors shadow-xs"
            >
              Enviar a aprobación
            </button>
          </div>
        </div>

        {/* Editor Subtabs */}
        <div className="flex flex-wrap gap-2 text-xs font-semibold border-b border-line-200 -mb-5 pt-1">
          {['Estructura y puntos', 'Datos precargados', 'Reglas de resultado', 'Plantilla PDF', 'Historial de versiones'].map(
            (tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab !== 'Estructura y puntos') {
                    onShowToast(`Pestaña configurada: ${tab}`);
                  }
                }}
                className={`py-2 px-3 border-b-2 font-medium transition-colors ${
                  activeTab === tab
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

      {/* 3 Columns Layout */}
      <div className="p-4 sm:px-6 lg:px-8 py-6 flex flex-col xl:flex-row gap-5 items-start flex-1">
        {/* Left: Sections List */}
        <section
          aria-label="Secciones del formato"
          className="w-full xl:w-64 bg-white border border-line-200 rounded-xl p-4 shadow-xs flex flex-col gap-2 shrink-0"
        >
          <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block mb-1">
            Secciones
          </span>

          <div className="space-y-1">
            {sections.map((sec) => {
              const isSelected = selectedSec === sec.n;
              return (
                <button
                  key={sec.n}
                  type="button"
                  onClick={() => setSelectedSec(sec.n)}
                  className={`w-full p-2.5 rounded-lg flex items-center justify-between text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-brand-100 text-brand-800 font-bold'
                      : 'hover:bg-surface-50 text-ink-900'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-ink-500">{sec.n}</span>
                    <span className="truncate">{sec.name}</span>
                  </span>
                  <span className="text-[11px] text-ink-500 shrink-0 font-normal">
                    {sec.count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onShowToast('Añadir nueva sección al cuestionario F-18')}
            className="w-full py-2.5 mt-2 border border-dashed border-line-400 hover:border-brand-600 rounded-lg text-xs font-bold text-brand-600 hover:bg-brand-50 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar sección
          </button>
        </section>

        {/* Center: Points of Selected Section */}
        <section
          aria-label="Puntos de la sección"
          className="flex-[999] w-full min-w-0 bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col gap-4"
        >
          <div className="flex flex-wrap justify-between items-baseline gap-2 pb-1 border-b border-line-100">
            <h2 className="text-base font-bold text-ink-900">
              3 · Ubicación de la estación de aforo
            </h2>
            <span className="text-xs text-ink-500">
              Inciso 7.1 de la norma · 7 puntos normativos
            </span>
          </div>

          <div className="space-y-2.5">
            {points.map((p) => {
              const isSelected = selectedPointId === p.n;
              return (
                <div
                  key={p.n}
                  onClick={() => setSelectedPointId(p.n)}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50 shadow-xs'
                      : 'border-line-100 bg-white hover:border-brand-600'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-ink-400 shrink-0 mt-0.5 cursor-grab" />
                  <span className="font-mono font-bold text-xs text-ink-900 shrink-0 w-8">
                    {p.n}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-xs font-medium text-ink-900 leading-relaxed">
                      {p.text}
                    </p>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="px-2 py-0.2 rounded bg-brand-100 text-brand-800 font-bold">
                        {p.kind}
                      </span>
                      <span className="px-2 py-0.2 rounded bg-surface-100 text-ink-700 font-mono">
                        {p.ref}
                      </span>
                      <span className="px-2 py-0.2 rounded bg-surface-100 text-ink-700">
                        {p.resp}
                      </span>
                      <span className="px-2 py-0.2 rounded bg-warn-100 text-warn-700 font-semibold">
                        {p.ev}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onShowToast('Añadir nuevo punto normativo')}
            className="w-full py-2.5 border border-dashed border-line-400 hover:border-brand-600 rounded-lg text-xs font-bold text-brand-600 hover:bg-brand-50 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Agregar punto a esta sección
          </button>
        </section>

        {/* Right: Point Properties Form */}
        <aside
          aria-label="Propiedades del punto"
          className="w-full xl:w-96 bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col gap-4 shrink-0"
        >
          <div className="pb-1 border-b border-line-100">
            <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block">
              Configuración de campo
            </span>
            <h2 className="text-base font-bold text-ink-900 mt-0.5">
              Propiedades del punto {selectedPointId}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-ink-600 font-semibold mb-1">Número</label>
              <input
                type="text"
                value={pointNum}
                onChange={(e) => setPointNum(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-line-300 rounded-md bg-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-ink-600 font-semibold mb-1">Numeral norma</label>
              <input
                type="text"
                value={normRef}
                onChange={(e) => setNormRef(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-line-300 rounded-md bg-white font-mono font-bold text-brand-600"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-ink-600 font-semibold mb-1">Pregunta / verificación</label>
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full p-2 border border-line-300 rounded-lg text-xs bg-white resize-y"
            />
          </div>

          <div className="text-xs">
            <label className="block text-ink-600 font-semibold mb-1">
              Criterio normativo (se muestra al verificador)
            </label>
            <textarea
              rows={3}
              value={criterion}
              onChange={(e) => setCriterion(e.target.value)}
              className="w-full p-2 border border-line-300 rounded-lg text-xs bg-white resize-y text-ink-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-ink-600 font-semibold mb-1">Tipo de verificación</label>
              <select
                value={verifType}
                onChange={(e) => setVerifType(e.target.value)}
                className="w-full py-1.5 px-2 border border-line-300 rounded bg-white text-xs"
              >
                <option>Visual</option>
                <option>Documental</option>
                <option>Medición</option>
                <option>Observación</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-ink-600 font-semibold">Tipo respuesta</label>
                <button
                  type="button"
                  onClick={() => onNavigate('Tipos')}
                  className="text-[10px] text-brand-600 font-bold underline"
                >
                  Ver 6 tipos
                </button>
              </div>
              <select
                value={responseType}
                onChange={(e) => setResponseType(e.target.value)}
                className="w-full py-1.5 px-2 border border-line-300 rounded bg-white text-xs truncate"
              >
                <option>Una sola opción (option box)</option>
                <option>Varias opciones (checkbox)</option>
                <option>Texto libre</option>
                <option>Grupo de campos con texto libre</option>
                <option>Grupo + C/NC/NA por grupo</option>
                <option>Grupo + C/NC/NA por punto</option>
              </select>
            </div>
          </div>

          {/* Values pills */}
          <div className="text-xs space-y-1.5">
            <span className="font-semibold text-ink-600 block">Valores configurados</span>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-success-100 text-success-700 font-bold text-xs border border-success-700/30">
                C
              </span>
              <span className="px-3 py-1 rounded-full bg-danger-100 text-danger-700 font-bold text-xs border border-danger-700/30">
                NC
              </span>
              <span className="px-3 py-1 rounded-full bg-line-100 text-ink-700 font-bold text-xs border border-line-300">
                N/A
              </span>
              <button
                type="button"
                onClick={() => onShowToast('Agregar valor alternativo')}
                className="px-2.5 py-1 rounded-full border border-dashed border-line-400 text-brand-600 font-semibold text-xs hover:bg-brand-50"
              >
                + Valor
              </button>
            </div>
          </div>

          {/* Evidencia Fieldset */}
          <fieldset className="border border-line-200 rounded-lg p-3 text-xs space-y-2">
            <legend className="font-bold text-ink-900 px-1 text-xs">Evidencia fotográfica</legend>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={photoRequired}
                onChange={(e) => setPhotoRequired(e.target.checked)}
                className="rounded text-brand-600"
              />
              <span className="font-medium text-ink-900">Foto obligatoria con coordenadas GPS</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded text-brand-600" />
              <span className="text-ink-600">Solo si la respuesta es No Conforme (NC)</span>
            </label>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-ink-600">Mínimo de fotos requeridas:</span>
              <input
                type="number"
                value={minPhotos}
                onChange={(e) => setMinPhotos(Number(e.target.value))}
                min={1}
                max={5}
                className="w-14 py-1 px-2 border border-line-300 rounded text-center font-bold"
              />
            </div>
          </fieldset>

          {/* Scope checkboxes */}
          <fieldset className="border border-line-200 rounded-lg p-3 text-xs space-y-1.5">
            <legend className="font-bold text-ink-900 px-1 text-xs">Aplica en verificación</legend>
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={appliesInicial}
                  onChange={(e) => setAppliesInicial(e.target.checked)}
                  className="rounded text-brand-600"
                />
                <span>Inicial</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={appliesPeriodica}
                  onChange={(e) => setAppliesPeriodica(e.target.checked)}
                  className="rounded text-brand-600"
                />
                <span>Periódica</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={appliesExtra}
                  onChange={(e) => setAppliesExtra(e.target.checked)}
                  className="rounded text-brand-600"
                />
                <span>Extraordinaria</span>
              </label>
            </div>
          </fieldset>

          <div className="bg-warn-50 border border-warn-200 rounded-lg p-3 text-xs text-warn-800 leading-relaxed">
            <strong>Regla de dictamen:</strong> si el verificador marca <strong>NC</strong>, el Dictamen F-17 se emite automáticamente como inconforme y este numeral se transcribe en el cuadro de No Conformidades oficiales.
          </div>
        </aside>
      </div>
    </div>
  );
};
