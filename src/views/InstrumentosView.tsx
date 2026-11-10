import React, { useState } from 'react';
import { ScreenKey, InstrumentDetail } from '../types';
import { calidad } from '../api/endpoints';
import { useApi, errorMessage } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { Plus, Search, Gauge, AlertTriangle, FileText, ExternalLink, ArrowRight } from 'lucide-react';

interface InstrumentosViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

export const InstrumentosView: React.FC<InstrumentosViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => calidad.getInstrumentos());
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <InstrumentosContent {...props} initialInstruments={data} />;
};

const emptyNewInstrument = { type: '', brandModel: '', serial: '', invCode: '', calDueDate: '' };

const InstrumentosContent: React.FC<InstrumentosViewProps & { initialInstruments: InstrumentDetail[] }> = ({
  onNavigate,
  onShowToast,
  initialInstruments
}) => {
  const [instruments, setInstruments] = useState<InstrumentDetail[]>(initialInstruments);
  const [selectedId, setSelectedId] = useState<string>(
    (initialInstruments.find((i) => i.status === 'Por vencer') ?? initialInstruments[0])?.id ?? ''
  ); // INV-[0004] selected by default
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('Todos');
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [newInst, setNewInst] = useState(emptyNewInstrument);
  const [saving, setSaving] = useState(false);

  const stats = {
    total: instruments.length,
    vigentes: instruments.filter((i) => i.status === 'Vigente' || i.status === 'Disponible').length,
    porVencer: instruments.filter((i) => i.status === 'Por vencer').length,
    vencidos: instruments.filter((i) => i.status === 'Vencido').length
  };

  const handleCreateInstrument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !newInst.type.trim() || !newInst.invCode.trim()) return;
    setSaving(true);
    try {
      const res = await calidad.createInstrumento(newInst);
      setInstruments((prev) => [...prev, res.instrumento]);
      setSelectedId(res.instrumento.id);
      setShowNewModal(false);
      setNewInst(emptyNewInstrument);
      onShowToast(res.message);
    } catch (err) {
      onShowToast(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const selectedInst = instruments.find((i) => i.id === selectedId) || instruments[0];

  const filtered = instruments.filter((inst) => {
    const matchesSearch =
      inst.invCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.brandModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.serial.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'Todos' || inst.type.includes(typeFilter);
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="bg-white border-b border-line-200 px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap justify-between items-end gap-4">
        <div>
          <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
            Catálogos / Instrumentos de medición
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
            Instrumentos de medición
          </h1>
          <p className="text-sm text-ink-600 max-w-2xl mt-1 leading-relaxed">
            Los equipos que se registran en la sección 1.4 de la lista de verificación. Un instrumento con calibración vencida no se puede seleccionar en campo y aparece como alerta al programar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('Prestamos')}
            className="h-10 px-4 rounded-lg border border-line-300 bg-white hover:bg-surface-50 text-ink-900 text-xs font-semibold transition-colors"
          >
            Entrega y devolución de equipos
          </button>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Nuevo instrumento
          </button>
        </div>
      </header>

      {/* 4 Stat Tiles */}
      <div className="px-4 sm:px-6 lg:px-8 pt-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-line-200 rounded-xl p-3.5 flex flex-col gap-1 shadow-xs">
            <span className="text-xs text-ink-600">Instrumentos registrados</span>
            <span className="text-2xl font-bold text-ink-900 tabular-nums">{stats.total}</span>
          </div>
          <div className="bg-white border border-line-200 rounded-xl p-3.5 flex flex-col gap-1 shadow-xs">
            <span className="text-xs text-ink-600">Calibración vigente</span>
            <span className="text-2xl font-bold text-success-700 tabular-nums">{stats.vigentes}</span>
          </div>
          <div className="bg-white border border-warn-200 bg-warn-25 rounded-xl p-3.5 flex flex-col gap-1 shadow-xs">
            <span className="text-xs text-warn-700 font-semibold">Vencen en 30 días</span>
            <span className="text-2xl font-bold text-warn-700 tabular-nums">{stats.porVencer}</span>
          </div>
          <div className="bg-white border border-danger-200 bg-danger-50 rounded-xl p-3.5 flex flex-col gap-1 shadow-xs">
            <span className="text-xs text-danger-700 font-semibold">Vencidos (bloqueados)</span>
            <span className="text-2xl font-bold text-danger-700 tabular-nums">{stats.vencidos}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area: Table + Aside */}
      <div className="p-4 sm:px-6 lg:px-8 py-5 flex flex-col lg:flex-row gap-6 items-start flex-1">
        {/* Table Column */}
        <div className="flex-[999] w-full min-w-0 flex flex-col gap-3">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 bg-white p-3.5 rounded-xl border border-line-200 shadow-xs">
            <label className="flex-1 min-w-[200px] flex flex-col gap-1 text-xs font-semibold text-ink-600">
              Buscar
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="search"
                  placeholder="Serie, inventario o marca..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-line-300 rounded-lg text-xs bg-white focus:outline-none focus:border-brand-600"
                />
              </div>
            </label>

            <label className="w-48 flex flex-col gap-1 text-xs font-semibold text-ink-600">
              Tipo
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="py-1.5 px-2.5 border border-line-300 rounded-lg text-xs bg-white focus:outline-none focus:border-brand-600"
              >
                <option value="Todos">Todos</option>
                <option value="Flexómetro">Flexómetro</option>
                <option value="Multímetro">Multímetro</option>
                <option value="GPS">GPS</option>
                <option value="Flujómetro">Flujómetro ultrasónico portátil</option>
              </select>
            </label>
          </div>

          {/* Table */}
          <section
            aria-label="Lista de instrumentos"
            className="bg-white border border-line-200 rounded-xl shadow-xs overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[780px]">
                <thead>
                  <tr className="bg-surface-100 text-ink-700 font-semibold border-b border-line-200">
                    <th className="py-3 px-3.5">Tipo</th>
                    <th className="py-3 px-3.5">Marca / modelo</th>
                    <th className="py-3 px-3.5">No. serie</th>
                    <th className="py-3 px-3.5">Inventario</th>
                    <th className="py-3 px-3.5">Asignado a</th>
                    <th className="py-3 px-3.5">Vence calibración</th>
                    <th className="py-3 px-3.5">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-100">
                  {filtered.map((r) => {
                    const isSelected = r.id === selectedId;
                    const statusBadge = {
                      Vigente: 'bg-success-100 text-success-700',
                      'Por vencer': 'bg-warn-100 text-warn-700 font-bold',
                      Vencido: 'bg-danger-100 text-danger-700 font-bold',
                      Disponible: 'bg-line-100 text-ink-700',
                      'Fuera de servicio': 'bg-line-100 text-ink-700',
                      'En calibración': 'bg-warn-100 text-warn-700'
                    }[r.status];

                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-brand-50' : 'hover:bg-surface-50'
                        }`}
                      >
                        <td className="py-3 px-3.5 font-bold text-ink-900">{r.type}</td>
                        <td className="py-3 px-3.5 text-ink-700">{r.brandModel}</td>
                        <td className="py-3 px-3.5 font-mono text-[11px] text-ink-900">{r.serial}</td>
                        <td className="py-3 px-3.5 font-mono font-bold text-brand-600">{r.invCode}</td>
                        <td className="py-3 px-3.5 text-ink-700">{r.assignedTo}</td>
                        <td className="py-3 px-3.5 text-ink-700 font-medium">{r.calDueDate}</td>
                        <td className="py-3 px-3.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full ${statusBadge}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Aside: Instrument Details */}
        {selectedInst && (
          <aside
            aria-label="Detalle del instrumento"
            className="w-full lg:w-96 bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col gap-4 shrink-0"
          >
            <div>
              <span className="font-mono text-xs font-bold text-brand-600 uppercase tracking-wider block">
                {selectedInst.invCode}
              </span>
              <h2 className="text-base font-bold text-ink-900 mt-0.5">
                {selectedInst.type}
              </h2>
              <p className="text-xs text-ink-500 mt-0.5">
                {selectedInst.brandModel} · NS {selectedInst.serial}
              </p>
            </div>

            {selectedInst.status === 'Por vencer' && (
              <div className="bg-warn-50 border border-warn-200 rounded-lg p-3 text-xs text-warn-800 leading-relaxed">
                <strong>Alerta preventiva:</strong> la calibración vence en 5 días. Se envió aviso por correo al responsable de calidad y al inspector asignado.
              </div>
            )}

            {selectedInst.status === 'Vencido' && (
              <div className="bg-danger-100 border border-danger-200 rounded-lg p-3 text-xs text-danger-700 leading-relaxed">
                <strong>Bloqueo operativo:</strong> calibración vencida. No se puede seleccionar en campo ni en asignación de visitas.
              </div>
            )}

            {/* Certificado de calibración vigente */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                Certificado de calibración vigente
              </h3>
              <dl className="grid grid-cols-2 gap-2 text-xs border-t border-line-100 pt-2">
                <div>
                  <dt className="text-ink-500">Laboratorio</dt>
                  <dd className="font-semibold text-ink-900">{selectedInst.labName || 'Laboratorio acreditado EMA'}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">No. de certificado</dt>
                  <dd className="font-mono font-semibold text-ink-900">{selectedInst.certNumber || 'MIC-2025-081'}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Fecha calibración</dt>
                  <dd className="font-semibold text-ink-900">{selectedInst.calDate || '12/11/2025'}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Vence</dt>
                  <dd className="font-semibold text-warn-700">{selectedInst.calDueDate}</dd>
                </div>
              </dl>
              <div className="flex gap-3 text-xs pt-1 font-semibold">
                <button
                  onClick={() => onShowToast('Visualizando certificado PDF del laboratorio')}
                  className="text-brand-600 hover:underline"
                >
                  Ver certificado PDF
                </button>
                <span className="text-line-300">·</span>
                <button
                  onClick={() => onNavigate('Calibracion')}
                  className="text-brand-600 hover:underline"
                >
                  Registrar nueva calibración
                </button>
              </div>
            </div>

            {/* Historial */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                Historial de calibraciones
              </h3>
              <div className="border-t border-line-100 divide-y divide-line-100 text-xs">
                {(selectedInst.calHistory ?? []).map((h) => (
                  <div key={`${h.date}-${h.lab}`} className="py-1.5 flex justify-between items-center">
                    <span className="text-ink-700">{h.date} · {h.lab}</span>
                    <button onClick={() => onShowToast('Descargando PDF histórico')} className="text-brand-600 font-semibold hover:underline">
                      PDF
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Uso en expedientes */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                Uso en expedientes
              </h3>
              <div className="border-t border-line-100 divide-y divide-line-100 text-xs">
                {(selectedInst.usage ?? []).map((u) => (
                  <div key={u.folio} className="py-1.5 flex justify-between items-center">
                    <span className="font-mono text-brand-600 font-bold">{u.folio} · {u.label}</span>
                    <span className="text-ink-500">{u.date}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-ink-500 leading-relaxed pt-1">
                Trazabilidad para auditorías EMA y CONAGUA: muestra en qué verificaciones se usó cada equipo y con qué certificado de calibración.
              </p>
            </div>
          </aside>
        )}
      </div>

      {/* New Instrument Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-ink-900">Registrar nuevo instrumento de medición</h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-ink-400 hover:text-ink-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInstrument} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-ink-600 mb-1">Tipo *</label>
                <select
                  required
                  value={newInst.type}
                  onChange={(e) => setNewInst({ ...newInst, type: e.target.value })}
                  className="w-full px-3 py-2 border border-line-300 rounded-lg focus:border-brand-600 focus:outline-none bg-white"
                >
                  <option value="">Seleccione…</option>
                  <option value="Flexómetro">Flexómetro</option>
                  <option value="Multímetro">Multímetro</option>
                  <option value="GPS">GPS</option>
                  <option value="Flujómetro ultrasónico portátil">Flujómetro ultrasónico portátil</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-ink-600 mb-1">Marca / modelo</label>
                  <input
                    type="text"
                    value={newInst.brandModel}
                    onChange={(e) => setNewInst({ ...newInst, brandModel: e.target.value })}
                    className="w-full px-3 py-2 border border-line-300 rounded-lg focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-600 mb-1">No. serie</label>
                  <input
                    type="text"
                    value={newInst.serial}
                    onChange={(e) => setNewInst({ ...newInst, serial: e.target.value })}
                    className="w-full px-3 py-2 border border-line-300 rounded-lg focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-600 mb-1">Inventario *</label>
                  <input
                    type="text"
                    required
                    placeholder="INV-0000"
                    value={newInst.invCode}
                    onChange={(e) => setNewInst({ ...newInst, invCode: e.target.value })}
                    className="w-full px-3 py-2 border border-line-300 rounded-lg focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-600 mb-1">Vence calibración</label>
                  <input
                    type="text"
                    placeholder="dd/mm/aaaa"
                    value={newInst.calDueDate}
                    onChange={(e) => setNewInst({ ...newInst, calDueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-line-300 rounded-lg focus:border-brand-600 focus:outline-none"
                  />
                </div>
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
                  disabled={saving}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold"
                >
                  Guardar instrumento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
