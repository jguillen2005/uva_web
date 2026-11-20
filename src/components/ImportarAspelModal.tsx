import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, RefreshCw, Upload, X } from 'lucide-react';
import { catalogos } from '../api/endpoints';
import { errorMessage } from '../api/useApi';
import type { ClientItem, FilaAspel, ImportacionAspel } from '../types';

/**
 * Importación de clientes desde el archivo exportado de Aspel SAE (Excel o CSV).
 * 1) El usuario elige el archivo; el servidor lo lee y devuelve una vista previa (no guarda nada).
 * 2) Al confirmar, se dan de alta los nuevos y se actualizan los existentes (empatados por RFC).
 */
const TAMANO_MAXIMO_MB = 7;
const ETIQUETAS: Record<string, string> = {
  clave: 'Clave', nombre: 'Nombre', rfc: 'RFC', calle: 'Calle', numext: 'Núm. ext.', numint: 'Núm. int.', colonia: 'Colonia',
  municipio: 'Municipio', ciudad: 'Ciudad', estado: 'Estado', cp: 'C.P.', telefono: 'Teléfono', email: 'Correo', contacto: 'Contacto', estatus: 'Estatus',
};
const CAMPOS_PARTNER: Record<string, string> = {
  name: 'nombre', uva_tipo_fiscal: 'tipo fiscal', uva_codigo_aspel: 'clave Aspel', uva_domicilio_fiscal: 'domicilio', phone: 'teléfono',
  email: 'correo', uva_contacto_avisos: 'contacto', zip: 'C.P.',
};

const leerBase64 = (archivo: File) =>
  new Promise<string>((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).replace(/^data:[^,]*,/, ''));
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });

export const ImportarAspelModal: React.FC<{
  onCerrar: () => void;
  onImportado: (mensaje: string, clientes?: ClientItem[]) => void;
}> = ({ onCerrar, onImportado }) => {
  const [archivo, setArchivo] = useState<{ nombre: string; contenido: string } | null>(null);
  const [vista, setVista] = useState<ImportacionAspel | null>(null);
  const [pestana, setPestana] = useState<'nuevos' | 'actualizar' | 'errores'>('nuevos');
  const [trabajando, setTrabajando] = useState<'' | 'leyendo' | 'importando'>('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  const trabajandoRef = useRef(trabajando);
  trabajandoRef.current = trabajando;

  useEffect(() => {
    inputRef.current?.focus();
    const alEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && !trabajandoRef.current) cerrarRef.current(); };
    window.addEventListener('keydown', alEscape);
    return () => window.removeEventListener('keydown', alEscape);
  }, []);

  const elegir = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setVista(null);
    if (f.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      setError(`El archivo pesa más de ${TAMANO_MAXIMO_MB} MB. Exporte solo el catálogo de clientes o divídalo en partes.`);
      return;
    }
    setTrabajando('leyendo');
    try {
      const contenido = await leerBase64(f);
      const res = await catalogos.importarAspel(f.name, contenido, false);
      setArchivo({ nombre: f.name, contenido });
      setVista(res);
      setPestana((res.totalNuevos ?? 0) > 0 ? 'nuevos' : (res.totalActualizar ?? 0) > 0 ? 'actualizar' : 'errores');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setTrabajando('');
    }
  };

  const importar = async () => {
    if (!archivo) return;
    setTrabajando('importando');
    setError(null);
    try {
      const res = await catalogos.importarAspel(archivo.nombre, archivo.contenido, true);
      onImportado(res.message, res.clientes);
    } catch (e) {
      setError(errorMessage(e));
      setTrabajando('');
    }
  };

  const totalNuevos = vista?.totalNuevos ?? 0;
  const totalActualizar = vista?.totalActualizar ?? 0;
  const totalErrores = vista?.totalErrores ?? 0;
  const aImportar = totalNuevos + totalActualizar;
  const lista: FilaAspel[] = !vista
    ? []
    : pestana === 'nuevos'
      ? (Array.isArray(vista.nuevos) ? vista.nuevos : [])
      : pestana === 'actualizar'
        ? vista.actualizar || []
        : Array.isArray(vista.errores) ? vista.errores : [];
  const total = pestana === 'nuevos' ? totalNuevos : pestana === 'actualizar' ? totalActualizar : totalErrores;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !trabajando) onCerrar(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-aspel" aria-busy={!!trabajando}
        className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-3xl w-full p-5 sm:p-6 space-y-4 max-h-[92dvh] overflow-y-auto">
        <div className="flex justify-between items-start gap-3 border-b border-line-100 pb-3">
          <div>
            <h3 id="titulo-aspel" className="text-lg font-bold text-ink-900">Importar clientes de Aspel</h3>
            <p className="text-xs text-ink-600 mt-0.5">Archivo de clientes exportado de Aspel SAE (Excel .xlsx/.xls o CSV). Se empata por RFC.</p>
          </div>
          <button type="button" onClick={onCerrar} disabled={!!trabajando} aria-label="Cerrar" className="text-ink-400 hover:text-ink-600 p-1 disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <label
          htmlFor="archivo-aspel"
          className={`flex flex-col sm:flex-row items-center gap-3 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${
            archivo ? 'border-brand-200 bg-brand-50/50' : 'border-line-300 hover:border-brand-400 hover:bg-surface-50'
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void elegir(e.dataTransfer.files?.[0]); }}
        >
          <FileSpreadsheet className="w-8 h-8 text-brand-600 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-center sm:text-left">
            <span className="block text-sm font-semibold text-ink-900">{archivo ? archivo.nombre : 'Elija o arrastre el archivo exportado de Aspel'}</span>
            <span className="block text-[11px] text-ink-500">En Aspel SAE: Clientes &gt; Exportar (Excel o texto). Hasta {TAMANO_MAXIMO_MB} MB.</span>
          </span>
          <span className="h-9 px-3 rounded-lg border border-line-300 bg-white text-brand-700 text-xs font-semibold inline-flex items-center gap-1.5">
            {trabajando === 'leyendo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : archivo ? <RefreshCw className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
            {trabajando === 'leyendo' ? 'Leyendo…' : archivo ? 'Cambiar archivo' : 'Elegir archivo'}
          </span>
          <input id="archivo-aspel" ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="sr-only"
            onChange={(e) => { void elegir(e.target.files?.[0]); e.target.value = ''; }} disabled={!!trabajando} />
        </label>

        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        {vista && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ['Nuevos', totalNuevos, 'text-emerald-700 bg-emerald-50 border-emerald-200'],
                ['Por actualizar', totalActualizar, 'text-brand-700 bg-brand-50 border-brand-200'],
                ['Sin cambios', vista.sinCambios, 'text-ink-600 bg-surface-50 border-line-200'],
                ['Con error', totalErrores, totalErrores ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-ink-600 bg-surface-50 border-line-200'],
              ].map(([t, n, c]) => (
                <div key={String(t)} className={`rounded-lg border px-3 py-2 ${c}`}>
                  <div className="text-xl font-bold tabular-nums">{n}</div>
                  <div className="text-[11px] font-semibold">{t}</div>
                </div>
              ))}
            </div>

            {vista.columnas && (
              <p className="text-[11px] text-ink-500">
                Columnas reconocidas (encabezados en la fila {vista.filaEncabezados}):{' '}
                {vista.columnas.map((c) => `${ETIQUETAS[c.campo] || c.campo} = «${c.encabezado}»`).join(' · ')}
              </p>
            )}

            <div role="tablist" aria-label="Detalle de la vista previa" className="flex gap-1 border-b border-line-200">
              {([['nuevos', `Nuevos (${totalNuevos})`], ['actualizar', `Por actualizar (${totalActualizar})`], ['errores', `Con error (${totalErrores})`]] as const).map(([k, t]) => (
                <button key={k} role="tab" type="button" aria-selected={pestana === k} onClick={() => setPestana(k)}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px ${pestana === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-line-200">
              {lista.length === 0 ? (
                <p className="text-xs text-ink-500 text-center py-6">Sin renglones en esta lista.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-surface-50 text-ink-600 sticky top-0">
                    <tr>
                      <th className="text-left font-semibold px-3 py-2">Fila</th>
                      <th className="text-left font-semibold px-3 py-2">RFC</th>
                      <th className="text-left font-semibold px-3 py-2">Nombre</th>
                      <th className="text-left font-semibold px-3 py-2">{pestana === 'errores' ? 'Motivo' : pestana === 'actualizar' ? 'Cambia' : 'Clave Aspel'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((f) => (
                      <tr key={`${f.fila}-${f.rfc}`} className="border-t border-line-100">
                        <td className="px-3 py-1.5 tabular-nums text-ink-500">{f.fila}</td>
                        <td className="px-3 py-1.5 font-mono">
                          {f.rfc || '—'}
                          {f.generico && <span className="ml-1 font-sans text-[10px] font-semibold text-amber-700">genérico → RFC pendiente</span>}
                        </td>
                        <td className="px-3 py-1.5">{f.nombre || '—'}</td>
                        <td className="px-3 py-1.5 text-ink-600">
                          {pestana === 'errores' ? f.motivo : pestana === 'actualizar' ? (f.campos || []).map((c) => CAMPOS_PARTNER[c] || c).join(', ') : f.clave || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {lista.length < total && <p className="text-[11px] text-ink-500">Se muestran los primeros {lista.length} de {total}.</p>}

            {(vista.totalGenericos ?? 0) > 0 && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-1.5 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                {vista.totalGenericos} cliente(s) con el RFC genérico del SAT (público en general): se importan sin RFC y se identifican por
                su clave de Aspel. El RFC es único por cliente: capture el del titular en su ficha antes de emitir el dictamen.
              </p>
            )}

            {totalErrores > 0 && (
              <p className="text-xs text-amber-800 flex gap-1.5 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                Los renglones con error no se importan. Corríjalos en Aspel y vuelva a exportar si los necesita.
              </p>
            )}
          </>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button type="button" onClick={onCerrar} disabled={!!trabajando}
            className="h-10 px-4 rounded-lg border border-line-300 text-ink-700 hover:bg-surface-50 text-sm font-semibold disabled:opacity-60">
            Cancelar
          </button>
          <button type="button" onClick={() => void importar()} disabled={!vista || aImportar === 0 || !!trabajando}
            className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
            {trabajando === 'importando' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {trabajando === 'importando' ? 'Importando…' : vista ? `Importar ${aImportar} cliente(s)` : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
};
