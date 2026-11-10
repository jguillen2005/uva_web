import React, { useState } from 'react';
import { ScreenKey, AltaFormatoDefaults, AltaChecklistItem, FormatoSeccionResumen, FormatoCreateInput } from '../types';
import { catalogos } from '../api/endpoints';
import { useApi, errorMessage } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { ArrowLeft, Check, Upload, Trash2, Plus, GripVertical, FileText, CheckSquare, Layers } from 'lucide-react';

interface AltaFormatoViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

export const AltaFormatoView: React.FC<AltaFormatoViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => catalogos.getAltaFormatoDefaults());
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <AltaFormatoContent {...props} defaults={data} />;
};

const AltaFormatoContent: React.FC<AltaFormatoViewProps & { defaults: AltaFormatoDefaults }> = ({ onNavigate, onShowToast, defaults }) => {
  const [codigo, setCodigo] = useState('CL-DOC');
  const [nombre, setNombre] = useState('Lista de verificación de documentación requerida');
  const [version, setVersion] = useState('1.0');
  const [etapa, setEtapa] = useState('Solicitud');
  const [estructura, setEstructura] = useState<'checklist' | 'word' | 'cuestionario'>('checklist');

  // Checklist items state
  const [checklistItems, setChecklistItems] = useState<AltaChecklistItem[]>(defaults.checklistItems);

  // Word fields
  const wordFields = defaults.wordFields;

  // Cuestionario sections
  const [sections, setSections] = useState<FormatoSeccionResumen[]>(defaults.sections);
  const [saving, setSaving] = useState(false);

  const handleAddRubro = () => {
    const nextId = checklistItems.length + 1;
    setChecklistItems([
      ...checklistItems,
      { id: nextId, text: `Nuevo rubro documental ${nextId}`, req: true, date: true, comment: true, file: true }
    ]);
    onShowToast('Rubro añadido al checklist');
  };

  const handleRemoveRubro = (id: number) => {
    setChecklistItems(checklistItems.filter((i) => i.id !== id));
  };

  const buildVals = (): FormatoCreateInput => ({
    codigo,
    nombre,
    version,
    etapa,
    estructura,
    ...(estructura === 'checklist' ? { checklistItems } : {}),
    ...(estructura === 'cuestionario' ? { sections } : {})
  });

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await catalogos.createFormato(buildVals());
      onShowToast(res.message);
      onNavigate('Main');
    } catch (e) {
      onShowToast(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const created = await catalogos.createFormato(buildVals());
      const res = await catalogos.formatoEnviarAprobacion(created.formato.id);
      onShowToast(res.message);
      onNavigate('Main');
    } catch (e) {
      onShowToast(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto flex flex-col min-h-full">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4 pb-2 border-b border-line-200">
        <div>
          <button
            onClick={() => onNavigate('Main')}
            className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a Catálogo de Formatos
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
            Alta o edición de formato
          </h1>
          <p className="text-sm text-ink-600 max-w-2xl leading-relaxed mt-1">
            Según el tipo de estructura, el sistema pide los rubros de un check list, una plantilla de Word o las secciones de un cuestionario normativo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-4 rounded-lg border border-line-300 bg-white hover:bg-surface-50 text-ink-900 text-xs font-semibold transition-colors"
          >
            Guardar borrador
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="h-10 px-5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors shadow-xs"
          >
            Enviar a aprobación
          </button>
        </div>
      </div>

      {/* Datos Generales Section */}
      <section
        aria-label="Datos generales"
        className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-5"
      >
        <h2 className="text-base font-bold text-ink-900">Datos generales del formato</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-ink-600 font-semibold mb-1">Código oficial</label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="w-full px-3 py-2 border border-line-300 rounded-lg font-mono font-bold text-ink-900 bg-white focus:outline-none focus:border-brand-600"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-ink-600 font-semibold mb-1">Nombre del formato</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 border border-line-300 rounded-lg text-ink-900 bg-white focus:outline-none focus:border-brand-600"
            />
          </div>

          <div>
            <label className="block text-ink-600 font-semibold mb-1">Versión</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full px-3 py-2 border border-line-300 rounded-lg font-mono text-ink-900 bg-white focus:outline-none focus:border-brand-600"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-ink-600 font-semibold mb-1">Etapa del proceso</label>
            <select
              value={etapa}
              onChange={(e) => setEtapa(e.target.value)}
              className="w-full px-3 py-2 border border-line-300 rounded-lg text-ink-900 bg-white focus:outline-none focus:border-brand-600"
            >
              <option>Solicitud</option>
              <option>Contratación</option>
              <option>Campo</option>
              <option>Emisión</option>
              <option>Calibración</option>
            </select>
          </div>
        </div>

        {/* Structure Type 3-Way Selector */}
        <fieldset className="space-y-2 border-t border-line-100 pt-4">
          <legend className="text-xs font-bold text-ink-600 mb-2 uppercase tracking-wider">
            Tipo de estructura
          </legend>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Check list */}
            <label
              className={`p-4 rounded-xl border flex gap-3 items-start cursor-pointer transition-all ${
                estructura === 'checklist'
                  ? 'border-brand-600 bg-brand-50 shadow-xs'
                  : 'border-line-300 bg-white hover:border-brand-600'
              }`}
            >
              <input
                type="radio"
                name="est"
                checked={estructura === 'checklist'}
                onChange={() => setEstructura('checklist')}
                className="mt-1 text-brand-600"
              />
              <div className="text-xs space-y-1">
                <span className="font-bold text-sm text-ink-900 block flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-brand-600" />
                  Check list
                </span>
                <p className="text-ink-500 leading-relaxed">
                  Rubros o pasos que se palomean con fecha y comentario. Ej. CL-DOC, CL-CAL.
                </p>
              </div>
            </label>

            {/* Plantilla Word */}
            <label
              className={`p-4 rounded-xl border flex gap-3 items-start cursor-pointer transition-all ${
                estructura === 'word'
                  ? 'border-brand-600 bg-brand-50 shadow-xs'
                  : 'border-line-300 bg-white hover:border-brand-600'
              }`}
            >
              <input
                type="radio"
                name="est"
                checked={estructura === 'word'}
                onChange={() => setEstructura('word')}
                className="mt-1 text-brand-600"
              />
              <div className="text-xs space-y-1">
                <span className="font-bold text-sm text-ink-900 block flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-brand-600" />
                  Plantilla Word
                </span>
                <p className="text-ink-500 leading-relaxed">
                  Documento que el sistema llena con datos y convierte a PDF. Ej. F-12, F-17.
                </p>
              </div>
            </label>

            {/* Cuestionario con secciones */}
            <label
              className={`p-4 rounded-xl border flex gap-3 items-start cursor-pointer transition-all ${
                estructura === 'cuestionario'
                  ? 'border-brand-600 bg-brand-50 shadow-xs'
                  : 'border-line-300 bg-white hover:border-brand-600'
              }`}
            >
              <input
                type="radio"
                name="est"
                checked={estructura === 'cuestionario'}
                onChange={() => setEstructura('cuestionario')}
                className="mt-1 text-brand-600"
              />
              <div className="text-xs space-y-1">
                <span className="font-bold text-sm text-ink-900 block flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-brand-600" />
                  Cuestionario con secciones
                </span>
                <p className="text-ink-500 leading-relaxed">
                  Secciones y puntos con tipo de respuesta normalizada. Ej. F-18.
                </p>
              </div>
            </label>
          </div>
        </fieldset>
      </section>

      {/* Dynamic Section According to Structure Type */}

      {/* 1. CHECK LIST */}
      {estructura === 'checklist' && (
        <section
          aria-label="Check list editor"
          className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap justify-between items-end gap-3 pb-2 border-b border-line-100">
            <div>
              <h2 className="text-base font-bold text-ink-900">Rubros del check list</h2>
              <p className="text-xs text-ink-500">
                Estos rubros aparecen tal cual en la pantalla donde se use el formato.
              </p>
            </div>
            <label className="text-xs font-semibold text-ink-600 flex flex-col gap-1 min-w-0 max-w-full">
              Se muestra en pantalla
              <select className="max-w-full px-3 py-1.5 border border-line-300 rounded-lg bg-white text-xs">
                <option>Solicitudes › Documentos del cliente</option>
                <option>Instrumentos › Registrar calibración (CL-CAL)</option>
              </select>
            </label>
          </div>

          <div className="overflow-x-auto border border-line-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs min-w-[700px]">
              <thead>
                <tr className="bg-surface-100 text-ink-700 font-semibold border-b border-line-200">
                  <th className="py-2.5 px-3 w-10">#</th>
                  <th className="py-2.5 px-3">Rubro</th>
                  <th className="py-2.5 px-2 text-center">Obligatorio</th>
                  <th className="py-2.5 px-2 text-center">Pide fecha</th>
                  <th className="py-2.5 px-2 text-center">Pide comentario</th>
                  <th className="py-2.5 px-2 text-center">Pide archivo</th>
                  <th className="py-2.5 px-3 text-right">Quitar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-100">
                {checklistItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-surface-50">
                    <td className="py-2.5 px-3 text-ink-500 font-mono">⋮⋮ {idx + 1}</td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => {
                          const val = e.target.value;
                          setChecklistItems((prev) =>
                            prev.map((it) => (it.id === item.id ? { ...it, text: val } : it))
                          );
                        }}
                        className="w-full px-2 py-1.5 border border-line-300 rounded bg-white text-xs"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={item.req}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setChecklistItems((prev) =>
                            prev.map((it) => (it.id === item.id ? { ...it, req: checked } : it))
                          );
                        }}
                        className="rounded text-brand-600"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input type="checkbox" defaultChecked className="rounded text-brand-600" />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input type="checkbox" defaultChecked className="rounded text-brand-600" />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={item.file}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setChecklistItems((prev) =>
                            prev.map((it) => (it.id === item.id ? { ...it, file: checked } : it))
                          );
                        }}
                        className="rounded text-brand-600"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleRemoveRubro(item.id)}
                        className="text-danger-700 hover:text-danger-700 p-1"
                        aria-label="Quitar rubro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleAddRubro}
            className="text-xs font-bold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Agregar rubro
          </button>
        </section>
      )}

      {/* 2. PLANTILLA WORD */}
      {estructura === 'word' && (
        <section
          aria-label="Plantilla Word"
          className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-4"
        >
          <h2 className="text-base font-bold text-ink-900">Plantilla de Word (.docx)</h2>

          <div className="border-2 border-dashed border-line-400 rounded-xl p-6 text-center flex flex-col items-center justify-center gap-2 bg-surface-50">
            <Upload className="w-8 h-8 text-brand-600" />
            <button
              onClick={() => onShowToast('Plantilla Word F-17 cargada y procesada correctamente')}
              className="text-sm font-bold text-brand-600 hover:underline"
            >
              Subir o reemplazar plantilla (.docx)
            </button>
            <p className="text-xs text-ink-500 max-w-md">
              Marca los datos variables en el documento con «NombreDelCampo». El parser del sistema los detecta automáticamente al subirlo.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider mb-2">
              Campos detectados en la plantilla
            </h3>
            <div className="overflow-x-auto border border-line-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-100 text-ink-700 font-semibold border-b border-line-200">
                    <th className="py-2.5 px-3">Campo en el Word</th>
                    <th className="py-2.5 px-3">Se vincula automáticamente con</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-100">
                  {wordFields.map((f) => (
                    <tr key={f.key}>
                      <td className="py-2.5 px-3 font-mono font-bold text-ink-900">«{f.key}»</td>
                      <td className="py-2.5 px-3 text-ink-700 font-medium">{f.mapTo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-ink-900 cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded text-brand-600" />
            <span>Generar y firmar automáticamente PDF oficial al emitir el dictamen</span>
          </label>
        </section>
      )}

      {/* 3. CUESTIONARIO CON SECCIONES */}
      {estructura === 'cuestionario' && (
        <section
          aria-label="Cuestionario"
          className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-4"
        >
          <div className="flex justify-between items-center pb-2 border-b border-line-100">
            <div>
              <h2 className="text-base font-bold text-ink-900">Secciones del cuestionario normativo</h2>
              <p className="text-xs text-ink-500">
                Estructura de secciones según NMX-AA-179. Los puntos específicos de cada sección se editan en el Editor de Puntos.
              </p>
            </div>
            <button
              onClick={() => onNavigate('Editor')}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
            >
              Abrir editor de puntos →
            </button>
          </div>

          <div className="space-y-2">
            {sections.map((sec) => (
              <div
                key={sec.n}
                className="flex items-center gap-3 p-3 border border-line-100 rounded-lg bg-surface-50"
              >
                <GripVertical className="w-4 h-4 text-ink-400 cursor-grab" />
                <span className="font-mono text-xs font-bold text-ink-500 w-6">{sec.n}</span>
                <span className="font-semibold text-xs text-ink-900 flex-1">{sec.name}</span>
                <span className="text-xs font-medium text-ink-500 px-2 py-0.5 rounded bg-white border border-line-200">
                  {sec.count}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => onShowToast('Añadir nueva sección normativa')}
            className="text-xs font-bold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Agregar sección
          </button>
        </section>
      )}
    </div>
  );
};
