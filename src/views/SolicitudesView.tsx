import React, { useState } from 'react';
import { ScreenKey, Solicitud } from '../types';
import { solicitudes as solicitudesApi } from '../api/endpoints';
import { useApi, errorMessage } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { mockNuevaSolicitudTitle } from '../data/solicitudes';
import { Plus, Check, AlertCircle, FileText, Send, Mail, Search, Eye, Upload } from 'lucide-react';

interface SolicitudesViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

export const SolicitudesView: React.FC<SolicitudesViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => solicitudesApi.list());
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <SolicitudesContent {...props} initialSolicitudes={data} />;
};

const SolicitudesContent: React.FC<SolicitudesViewProps & { initialSolicitudes: Solicitud[] }> = ({
  onNavigate,
  onShowToast,
  initialSolicitudes
}) => {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>(initialSolicitudes);
  const [selectedId, setSelectedId] = useState<string>(
    (initialSolicitudes[1] ?? initialSolicitudes[0])?.id ?? ''
  ); // UVA-0015 selected by default
  const [filterStatus, setFilterStatus] = useState<string>('Documentación pendiente');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showNewModal, setShowNewModal] = useState<boolean>(false);

  // New Solicitud form state
  const [newClient, setNewClient] = useState('');
  const [newWell, setNewWell] = useState('');
  const [newKind, setNewKind] = useState<'Inicial' | 'Periódica' | 'Extraordinaria'>('Inicial');

  const selectedItem = solicitudes.find((s) => s.id === selectedId) || solicitudes[0];

  const filteredList = solicitudes.filter((s) => {
    const matchesFilter = filterStatus === 'Todas' || s.status === filterStatus;
    const matchesSearch =
      s.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.well.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const replaceSolicitud = (updated: Solicitud) =>
    setSolicitudes((prev) => prev.map((sol) => (sol.id === updated.id ? updated : sol)));

  const handleUploadDoc = async (docId: string) => {
    const doc = selectedItem?.docs.find((d) => d.id === docId);
    if (!selectedItem || !doc) return;
    try {
      const res = await solicitudesApi.setDocumento(
        selectedItem.id,
        docId,
        true,
        `Documento_${doc.name.slice(0, 15)}.pdf`
      );
      replaceSolicitud(res.solicitud);
      onShowToast(res.message);
    } catch (err) {
      onShowToast(errorMessage(err));
    }
  };

  const handleSendToScheduling = async () => {
    if (!selectedItem) return;
    try {
      const res = await solicitudesApi.setEstado(selectedItem.id, 'Lista para programar');
      replaceSolicitud(res.solicitud);
      onShowToast(res.message);
      onNavigate('Programacion');
    } catch (err) {
      onShowToast(errorMessage(err));
    }
  };

  const handleCreateSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.trim() || !newWell.trim()) return;

    try {
      const res = await solicitudesApi.create({
        client: newClient,
        well: newWell,
        title: mockNuevaSolicitudTitle,
        kind: newKind
      });
      setSolicitudes((prev) => [res.solicitud, ...prev]);
      setSelectedId(res.solicitud.id);
      setShowNewModal(false);
      setNewClient('');
      setNewWell('');
      onShowToast(res.message);
    } catch (err) {
      onShowToast(errorMessage(err));
    }
  };

  const statusCategories = [
    { label: 'En cotización', count: solicitudes.filter((s) => s.status === 'En cotización').length },
    { label: 'Esperando pago', count: solicitudes.filter((s) => s.status === 'Esperando pago').length },
    { label: 'Documentación pendiente', count: solicitudes.filter((s) => s.status === 'Documentación pendiente').length },
    { label: 'Lista para programar', count: solicitudes.filter((s) => s.status === 'Lista para programar').length },
    { label: 'Programada', count: solicitudes.filter((s) => s.status === 'Programada').length }
  ];

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="bg-white border-b border-line-200 px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap justify-between items-end gap-4">
        <div>
          <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
            Operación / Solicitudes
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
            Solicitudes de servicio (F-12)
          </h1>
          <p className="text-sm text-ink-600 max-w-2xl mt-1 leading-relaxed">
            De la solicitud a la documentación completa. Cuando el F-12 está firmado, el pago registrado y
            todos los documentos del cliente recibidos, la solicitud pasa a programación.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="h-11 px-5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nueva solicitud
        </button>
      </header>

      {/* 5 Status Filter Tabs */}
      <div className="px-4 sm:px-6 lg:px-8 pt-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statusCategories.map((cat) => {
            const isSelected = filterStatus === cat.label;
            return (
              <button
                key={cat.label}
                type="button"
                onClick={() => setFilterStatus(isSelected ? 'Todas' : cat.label)}
                className={`p-3.5 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                  isSelected
                    ? 'border-brand-600 bg-brand-50 shadow-xs'
                    : 'border-line-200 bg-white hover:border-brand-600'
                }`}
              >
                <span className="text-xs text-ink-600 font-medium leading-tight">{cat.label}</span>
                <span className="text-2xl font-bold text-ink-900 tabular-nums">{cat.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area: Table + Detail Aside */}
      <div className="p-4 sm:px-6 lg:px-8 py-5 flex flex-col lg:flex-row gap-6 items-start flex-1">
        {/* Table Column */}
        <section
          aria-label="Lista de solicitudes"
          className="flex-[999] w-full min-w-0 bg-white border border-line-200 rounded-xl shadow-xs overflow-hidden flex flex-col"
        >
          <div className="p-4 border-b border-line-200 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type="search"
                placeholder="Buscar por folio, cliente, pozo o título..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-line-300 rounded-lg bg-white focus:outline-none focus:border-brand-600"
              />
            </div>
            <span className="text-xs font-medium text-ink-500 shrink-0">
              {filteredList.length} expediente{filteredList.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm min-w-[760px]">
              <thead>
                <tr className="bg-surface-100 text-ink-700 font-semibold text-xs border-b border-line-200">
                  <th className="py-3 px-4">Folio</th>
                  <th className="py-3 px-4">Cliente / aprovechamiento</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Cotización Aspel</th>
                  <th className="py-3 px-4">Documentos</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-100">
                {filteredList.map((row) => {
                  const isSelected = row.id === selectedId;
                  const docPct = Math.round((row.docsCount / row.totalDocs) * 100);

                  const statusBadge = {
                    'En cotización': 'bg-line-100 text-ink-700',
                    'Esperando pago': 'bg-warn-100 text-warn-700',
                    'Documentación pendiente': 'bg-warn-100 text-warn-700 font-semibold',
                    'Lista para programar': 'bg-success-100 text-success-700 font-semibold',
                    Programada: 'bg-brand-100 text-brand-800 font-semibold'
                  }[row.status];

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-brand-50' : 'hover:bg-surface-50'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-ink-900">
                        {row.folio}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-ink-900 leading-snug">{row.client}</div>
                        <div className="text-xs text-ink-500">
                          {row.title} · {row.well}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-ink-700">{row.kind}</td>
                      <td className="py-3.5 px-4 text-xs text-ink-700">{row.quote}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-line-100 overflow-hidden">
                            <div
                              className="h-full bg-brand-600 rounded-full"
                              style={{ width: `${docPct}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium tabular-nums text-ink-700">
                            {row.docsCount} de {row.totalDocs}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs ${statusBadge}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Aside: Request Details */}
        {selectedItem && (
          <aside
            aria-label="Detalle de la solicitud"
            className="w-full lg:w-[410px] bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col gap-5 shrink-0"
          >
            <div>
              <span className="font-mono text-xs font-bold text-brand-600 uppercase tracking-wider block">
                {selectedItem.folio}
              </span>
              <h2 className="text-lg font-bold text-ink-900 mt-0.5 leading-snug">
                {selectedItem.client}
              </h2>
              <p className="text-xs text-ink-500 mt-0.5">
                {selectedItem.kind} · registrada el {selectedItem.registeredDate} por {selectedItem.coordinator}
              </p>
            </div>

            {/* Contratación */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">Contratación</h3>
              <div className="border-t border-line-100 divide-y divide-line-100 text-xs">
                <div className="py-2 flex justify-between items-center">
                  <span className="text-ink-700">Cotización Aspel</span>
                  <span className="font-semibold text-ink-900">{selectedItem.quote}</span>
                </div>
                <div className="py-2 flex justify-between items-center">
                  <span className="text-ink-700">Solicitud F-12</span>
                  <button
                    onClick={() => onShowToast('Abriendo PDF oficial F-12 firmado digitalmente')}
                    className="font-semibold text-brand-600 hover:underline flex items-center gap-1"
                  >
                    Firmada · ver PDF
                  </button>
                </div>
                <div className="py-2 flex justify-between items-center">
                  <span className="text-ink-700">Pago de servicio</span>
                  <span className="font-semibold text-success-700">
                    {selectedItem.status === 'En cotización' || selectedItem.status === 'Esperando pago'
                      ? 'Pendiente de pago'
                      : 'Registrado ' + selectedItem.registeredDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Documentos del cliente */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                  Documentos del cliente
                </h3>
                <span className="text-xs font-bold text-ink-900 tabular-nums">
                  {selectedItem.docsCount} de {selectedItem.totalDocs}
                </span>
              </div>
              <p className="text-[11px] text-ink-500">
                Rubros del formato{' '}
                <button
                  onClick={() => onNavigate('Main')}
                  className="text-brand-600 font-semibold underline"
                >
                  CL-DOC v1.0
                </button>{' '}
                (Catálogos › Formatos)
              </p>

              <div className="border-t border-line-100 divide-y divide-line-100 text-xs">
                {selectedItem.docs.map((doc) => (
                  <div key={doc.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          doc.complete ? 'bg-success-100 text-success-700' : 'bg-warn-100 text-warn-700'
                        }`}
                      >
                        {doc.complete ? '✓' : '!'}
                      </span>
                      <span className={`truncate ${doc.complete ? 'text-ink-900' : 'text-warn-700 font-medium'}`}>
                        {doc.name}
                      </span>
                    </div>
                    {doc.complete ? (
                      <button
                        onClick={() => onShowToast(`Visualizando documento: ${doc.name}`)}
                        className="text-brand-600 font-semibold hover:underline shrink-0 flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> Ver
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUploadDoc(doc.id)}
                        className="text-brand-600 font-semibold hover:underline shrink-0 bg-brand-100 hover:bg-brand-150 px-2 py-0.5 rounded flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" /> Subir
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2 border-t border-line-100">
              <button
                type="button"
                onClick={() => onShowToast('Recordatorio enviado por correo al contacto del cliente.')}
                className="w-full h-10 rounded-lg border border-line-300 hover:bg-canvas text-ink-900 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Mail className="w-4 h-4 text-ink-500" />
                Pedir documentos faltantes por correo
              </button>

              <button
                type="button"
                disabled={selectedItem.docsCount < selectedItem.totalDocs}
                onClick={handleSendToScheduling}
                className={`w-full h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                  selectedItem.docsCount >= selectedItem.totalDocs
                    ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-xs'
                    : 'bg-line-300 text-ink-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
                Enviar a programación
              </button>

              <p className="text-[11px] text-ink-500 leading-relaxed">
                Se habilita con la documentación completa (6/6). Desde ese día corren las <strong>2 semanas</strong> obligatorias para programar la visita de campo.
              </p>
            </div>
          </aside>
        )}
      </div>

      {/* New Request Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-ink-900">Registrar nueva solicitud de servicio</h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-ink-400 hover:text-ink-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSolicitud} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-ink-600 mb-1">
                  Cliente / Razón Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Agrícola Santa Clara, S.A. de C.V."
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  className="w-full px-3 py-2 border border-line-300 rounded-lg focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-600 mb-1">
                  Nombre del aprovechamiento o pozo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pozo Fracción 4 - Sector Nogales"
                  value={newWell}
                  onChange={(e) => setNewWell(e.target.value)}
                  className="w-full px-3 py-2 border border-line-300 rounded-lg focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-600 mb-1">
                  Tipo de verificación
                </label>
                <select
                  value={newKind}
                  onChange={(e: any) => setNewKind(e.target.value)}
                  className="w-full px-3 py-2 border border-line-300 rounded-lg focus:border-brand-600 focus:outline-none bg-white"
                >
                  <option value="Inicial">Inicial (Dentro de 30 días de instalación)</option>
                  <option value="Periódica">Periódica (Cada 2 años)</option>
                  <option value="Extraordinaria">Extraordinaria (Cambio de medidor o solicitud CONAGUA)</option>
                </select>
              </div>

              <div className="bg-brand-50 p-3 rounded-lg border border-brand-200 text-xs text-brand-800 leading-relaxed">
                Al crear la solicitud se genera el folio F-12, se sincroniza con Aspel para la cotización y se inicia la lista de verificación CL-DOC v1.0.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 border border-line-300 rounded-lg text-sm text-ink-600 hover:bg-surface-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold"
                >
                  Guardar solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
