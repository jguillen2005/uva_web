import React, { useState } from 'react';
import { CampoSesion, ScreenKey } from '../types';
import { operacion } from '../api/endpoints';
import { useApi, errorMessage } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { ArrowLeft, Camera, WifiOff, CheckCircle2, ChevronDown, ChevronRight, Image as ImageIcon } from 'lucide-react';

interface PreviewViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

/** Folio de la orden de trabajo que simula la PWA. */
const PREVIEW_FOLIO = 'UVA-0012';

export const PreviewView: React.FC<PreviewViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => operacion.getCampoSesion(PREVIEW_FOLIO));
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <PreviewContent {...props} sesion={data} />;
};

const PreviewContent: React.FC<PreviewViewProps & { sesion: CampoSesion }> = ({ onNavigate, onShowToast, sesion }) => {
  const totalPoints = sesion.totalPoints;
  const sectionN = sesion.section.n;
  const [selectedResponse, setSelectedResponse] = useState<'C' | 'NC' | 'NA'>('C');
  const [photos, setPhotos] = useState<string[]>(sesion.photos);
  const [observation, setObservation] = useState('');
  const [pointIndex, setPointIndex] = useState(sesion.currentPoint); // 2 of 7
  const [saving, setSaving] = useState(false);

  const handleTakePhoto = () => {
    const time = new Date().toLocaleTimeString('es-MX');
    setPhotos([...photos, `${time} · ${sesion.gps}`]);
    onShowToast(`Foto capturada con metadatos GPS: ${sesion.folio}_${sectionN}.${pointIndex}_0${photos.length + 1}.jpg`);
  };

  const nextPoint = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await operacion.registrarRespuestaCampo(sesion.folio, {
        punto: `${sectionN}.${pointIndex}`,
        respuesta: selectedResponse,
        fotos: photos,
        observacion: observation || undefined
      });
      onShowToast(res.message);
      if (pointIndex < totalPoints) {
        setPointIndex(pointIndex + 1);
      }
    } catch (err) {
      onShowToast(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const prevPoint = () => {
    if (pointIndex > 1) {
      setPointIndex(pointIndex - 1);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 max-w-4xl mx-auto flex flex-col items-center min-h-full">
      {/* Top back link */}
      <div className="w-full flex flex-wrap justify-between items-center gap-2 pb-2">
        <button
          onClick={() => onNavigate('Editor')}
          className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al editor de formato
        </button>
        <span className="text-xs font-medium text-ink-500">
          Simulador de aplicación móvil para verificador (PWA Offline)
        </span>
      </div>

      {/* Mobile Device Frame */}
      <div className="w-full max-w-[390px] h-[min(844px,calc(100dvh-7rem))] min-h-[560px] rounded-[32px] sm:rounded-[44px] border-[6px] sm:border-[10px] border-ink-900 bg-canvas shadow-2xl overflow-hidden flex flex-col relative select-none">
        {/* Dynamic Island / Speaker notch */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-4 bg-ink-900 rounded-full z-50 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-black/60 mr-4" />
          <div className="w-2 h-2 rounded-full bg-blue-900/40" />
        </div>

        {/* Mobile App Header */}
        <header className="bg-side-900 text-white pt-9 pb-3.5 px-4 flex flex-col gap-2 shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-xs text-side-200 font-mono">{sesion.folio} · {sesion.site}</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-warn-100 text-warn-700">
              <WifiOff className="w-3 h-3" /> Sin señal · guardado
            </span>
          </div>

          <h1 className="text-base font-bold text-white leading-tight">
            {sectionN} · {sesion.section.name}
          </h1>

          <div className="flex items-center gap-2.5">
            <div className="flex-1 h-1.5 rounded-full bg-side-600 overflow-hidden">
              <div
                className="h-full bg-accent-300 transition-all duration-300"
                style={{ width: `${(pointIndex / totalPoints) * 100}%` }}
              />
            </div>
            <span className="text-xs font-mono text-side-200 tabular-nums">
              {pointIndex} de {totalPoints}
            </span>
          </div>
        </header>

        {/* Mobile Viewport Body */}
        <main className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {/* Question card */}
          <div className="bg-white border border-line-200 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-100 text-ink-900">
                {sectionN}.{pointIndex}
              </span>
              <span className="px-2 py-0.5 rounded bg-brand-100 text-brand-800 font-bold text-[11px]">
                {sesion.point.kind}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-100 text-ink-700 font-mono text-[11px]">
                {sesion.point.ref}
              </span>
            </div>

            <p className="text-sm font-bold text-ink-900 leading-snug">
              {sesion.point.text}
            </p>

            <details className="text-xs text-ink-700 border-t border-surface-100 pt-2">
              <summary className="font-semibold text-brand-600 cursor-pointer hover:underline py-1">
                Ver criterio normativo
              </summary>
              <div className="p-2.5 mt-1 rounded bg-canvas text-[11px] leading-relaxed text-ink-600">
                {sesion.point.criterio}
              </div>
            </details>

            {/* C, NC, N/A Large Touch Radiogroup */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedResponse('C')}
                className={`h-12 rounded-xl text-base font-extrabold flex items-center justify-center transition-all ${
                  selectedResponse === 'C'
                    ? 'border-2 border-success-700 bg-success-100 text-success-700 shadow-xs'
                    : 'border border-line-300 bg-white text-ink-900 hover:bg-surface-50'
                }`}
              >
                C
              </button>

              <button
                type="button"
                onClick={() => setSelectedResponse('NC')}
                className={`h-12 rounded-xl text-base font-extrabold flex items-center justify-center transition-all ${
                  selectedResponse === 'NC'
                    ? 'border-2 border-danger-700 bg-danger-100 text-danger-700 shadow-xs'
                    : 'border border-line-300 bg-white text-ink-900 hover:bg-surface-50'
                }`}
              >
                NC
              </button>

              <button
                type="button"
                onClick={() => setSelectedResponse('NA')}
                className={`h-12 rounded-xl text-base font-extrabold flex items-center justify-center transition-all ${
                  selectedResponse === 'NA'
                    ? 'border-2 border-ink-600 bg-surface-200 text-ink-800 shadow-xs'
                    : 'border border-line-300 bg-white text-ink-900 hover:bg-surface-50'
                }`}
              >
                N/A
              </button>
            </div>
          </div>

          {/* Evidence card */}
          <div className="bg-white border border-line-200 rounded-xl p-4 space-y-2.5 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-ink-900 text-xs">Evidencia fotográfica</span>
              <span className="text-[11px] font-bold text-warn-700">
                Obligatoria · mín. 1
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {photos.map((item, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-surface-300 p-1.5 flex flex-col justify-end text-[9.5px] text-ink-700 leading-tight font-mono relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent flex items-end p-1 text-white text-[8.5px]">
                    foto {i + 1}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleTakePhoto}
                className="aspect-square rounded-lg border-2 border-dashed border-line-400 hover:border-brand-600 bg-white text-brand-600 flex flex-col items-center justify-center gap-1 font-bold text-[11px] transition-colors"
              >
                <Camera className="w-5 h-5" />
                <span>Tomar foto</span>
              </button>
            </div>

            <span className="text-[10px] text-ink-500 font-mono block">
              Se nombra sola: {sesion.folio}_{sectionN}.{pointIndex}_0{photos.length}.jpg
            </span>
          </div>

          {/* Observaciones */}
          <div className="space-y-1">
            <label className="block font-bold text-ink-900 text-xs">Observaciones de campo</label>
            <textarea
              rows={2}
              placeholder="Opcional: registrar detalles particulares encontrados en la instalación..."
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              className="w-full p-2.5 border border-line-300 rounded-xl text-xs bg-white focus:outline-none focus:border-brand-600"
            />
          </div>
        </main>

        {/* Mobile Sticky Footer */}
        <footer className="bg-white border-t border-line-200 p-3 grid grid-cols-2 gap-2.5 shrink-0">
          <button
            type="button"
            onClick={prevPoint}
            disabled={pointIndex <= 1}
            className={`h-11 rounded-xl text-xs font-bold border transition-colors ${
              pointIndex <= 1
                ? 'border-line-200 text-ink-400 cursor-not-allowed'
                : 'border-line-300 text-ink-900 hover:bg-surface-50'
            }`}
          >
            Anterior
          </button>

          <button
            type="button"
            onClick={nextPoint}
            disabled={saving}
            className="h-11 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            {pointIndex < totalPoints ? 'Siguiente punto' : 'Finalizar sección'}
          </button>
        </footer>
      </div>
    </div>
  );
};
