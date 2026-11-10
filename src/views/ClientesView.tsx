import React, { useRef, useState } from 'react';
import { ScreenKey, ClientItem, WellSite } from '../types';
import { catalogos } from '../api/endpoints';
import { useApi, errorMessage } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import {
  Search,
  Plus,
  MapPin,
  Building,
  ExternalLink,
  RefreshCw,
  Pencil,
  User,
  Mail,
  FolderOpen,
  Droplets,
  FilePlus2,
  CalendarClock,
  History,
  AlertTriangle,
} from 'lucide-react';

interface ClientesViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

export const ClientesView: React.FC<ClientesViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => catalogos.getClientes());
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <ClientesContent {...props} initialClients={data} />;
};

const ClientesContent: React.FC<ClientesViewProps & { initialClients: ClientItem[] }> = ({ onNavigate, onShowToast, initialClients }) => {
  const [clients, setClients] = useState<ClientItem[]>(initialClients);
  const [selectedClientId, setSelectedClientId] = useState<string>('c-G'); // Cliente G selected by default
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedWellId, setSelectedWellId] = useState<string>('[ID-001]');
  const clientRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients[0];
  const selectedWell = selectedClient?.wells.find((w) => w.id === selectedWellId) || selectedClient?.wells[0];

  const handleSyncAspel = async () => {
    try {
      const res = await catalogos.syncAspel();
      onShowToast(res.message);
      setClients(await catalogos.getClientes());
    } catch (e) {
      onShowToast(errorMessage(e));
    }
  };

  const handleNewClient = async () => {
    try {
      const res = await catalogos.createCliente({ name: 'Nuevo cliente' });
      onShowToast(res.message);
      setClients((prev) => [...prev, res.cliente]);
      setSelectedClientId(res.cliente.id);
    } catch (e) {
      onShowToast(errorMessage(e));
    }
  };

  const handleEditClient = async () => {
    if (!selectedClient) return;
    const { id, wells, ...vals } = selectedClient;
    try {
      const res = await catalogos.updateCliente(id, vals);
      onShowToast(res.message);
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...res.cliente, wells: res.cliente.wells ?? c.wells } : c)));
    } catch (e) {
      onShowToast(errorMessage(e));
    }
  };

  const handleNewWell = async () => {
    if (!selectedClient) return;
    const clientId = selectedClient.id;
    try {
      const res = await catalogos.createPozo(clientId, { name: 'Nuevo aprovechamiento' });
      onShowToast(res.message);
      setClients((prev) =>
        prev.map((c) =>
          c.id === clientId ? { ...c, wells: c.wells.some((w) => w.id === res.pozo.id) ? c.wells : [...c.wells, res.pozo] } : c
        )
      );
      setSelectedWellId(res.pozo.id);
    } catch (e) {
      onShowToast(errorMessage(e));
    }
  };

  if (!selectedClient) {
    return <AsyncState loading={false} error={new Error('No hay clientes registrados.')} onRetry={() => void catalogos.getClientes().then(setClients, (e) => onShowToast(errorMessage(e)))} />;
  }

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.rfc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectClient = (client: ClientItem) => {
    setSelectedClientId(client.id);
    if (client.wells.length > 0) setSelectedWellId(client.wells[0].id);
    // En una sola columna (móvil) el detalle queda debajo de la lista: lo traemos a la vista
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => clientRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const selectWell = (well: WellSite) => {
    setSelectedWellId(well.id);
    // Si el detalle está debajo de la lista de pozos (no a un lado), desplazarse hasta él
    requestAnimationFrame(() => {
      const el = detailRef.current;
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.65) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  const mapsUrl = selectedWell ? googleMapsUrl(selectedWell.coords) : null;
  const hasPrevInspection = !!selectedWell && selectedWell.lastInspectionDate !== '—';

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="bg-white border-b border-line-200 px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap justify-between items-end gap-4">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
            Operación / Clientes y aprovechamientos
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
            Clientes y aprovechamientos
          </h1>
          <p className="text-sm text-ink-600 max-w-2xl mt-1 leading-relaxed">
            Los datos del titular, sus pozos y medidores se capturan una vez y se precargan en la solicitud, la lista de verificación y el dictamen.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSyncAspel}
            className="h-10 px-4 rounded-lg border border-line-300 bg-white hover:bg-surface-50 text-ink-900 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Importar de Aspel
          </button>
          <button
            type="button"
            onClick={handleNewClient}
            className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Nuevo cliente
          </button>
        </div>
      </header>

      {/*
        Layout: lista de clientes + área de trabajo. El área de trabajo es un contenedor (@container):
        el detalle del pozo se coloca a un lado solo si cabe; si no, va debajo. Así se adapta al espacio
        real (zoom del navegador, escalado de Windows, menú lateral), no solo al ancho de la ventana.
      */}
      <div className="p-4 sm:px-6 lg:px-8 py-5 grid grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)] gap-5 lg:gap-6 items-start flex-1">
        {/* Directorio de clientes */}
        <section
          aria-label="Directorio de clientes"
          className="bg-white border border-line-200 rounded-xl shadow-xs flex flex-col min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)]"
        >
          <div className="p-4 pb-3 flex flex-col gap-2 border-b border-line-100">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="buscar-cliente" className="text-xs font-semibold text-ink-600">
                Buscar cliente
              </label>
              <span className="text-[11px] text-ink-500 tabular-nums">
                {filteredClients.length} de {clients.length}
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                id="buscar-cliente"
                type="search"
                placeholder="Razón social o RFC"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-line-300 rounded-lg text-xs bg-white focus:outline-none focus:border-brand-600"
              />
            </div>
          </div>

          <ul className="p-2 flex flex-col gap-0.5 overflow-y-auto max-h-72 lg:max-h-none lg:flex-1" aria-label="Clientes">
            {filteredClients.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-ink-500">
                Ningún cliente coincide con «{searchQuery}».
              </li>
            )}
            {filteredClients.map((client) => {
              const isSelected = client.id === selectedClient.id;
              return (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => selectClient(client)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex flex-col gap-0.5 border-l-[3px] ${
                      isSelected
                        ? 'bg-brand-100 border-brand-600 text-brand-800'
                        : 'border-transparent hover:bg-surface-50 text-ink-900'
                    }`}
                  >
                    <span className="font-semibold text-xs leading-snug line-clamp-2">{client.name}</span>
                    <span className={`text-[11px] ${isSelected ? 'text-brand-800/80' : 'text-ink-500'}`}>
                      <span className="font-mono">{client.rfc}</span> · {client.wells.length} aprovechamiento
                      {client.wells.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Área de trabajo */}
        <div ref={clientRef} className="@container min-w-0 flex flex-col gap-5 scroll-mt-20">
          {/* Datos del cliente */}
          <section aria-label="Datos del cliente" className="bg-white border border-line-200 rounded-xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex items-start gap-3">
                <span className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                  <Building className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-ink-900 leading-snug text-balance">{selectedClient.name}</h2>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Chip mono>{selectedClient.rfc}</Chip>
                    <Chip>{selectedClient.fiscalType}</Chip>
                    <Chip mono>Aspel {selectedClient.aspelCode}</Chip>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleEditClient}
                className="h-9 px-3 rounded-lg border border-line-300 text-brand-600 hover:bg-brand-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar datos
              </button>
            </div>

            <dl className="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-4 gap-x-6 gap-y-3 text-xs border-t border-line-100 pt-4">
              <Field label="Representante legal" icon={<User className="w-3.5 h-3.5" />}>
                {selectedClient.legalRep}
              </Field>
              <Field label="Contacto para avisos" icon={<Mail className="w-3.5 h-3.5" />}>
                {selectedClient.noticeContact.split(' · ').map((part) => (
                  <span key={part} className="block break-words">{part}</span>
                ))}
              </Field>
              <Field label="Domicilio fiscal" icon={<MapPin className="w-3.5 h-3.5" />} className="@lg:col-span-2">
                {selectedClient.fiscalAddress}
              </Field>
              <Field label="Carpeta en SharePoint" icon={<FolderOpen className="w-3.5 h-3.5" />} className="@lg:col-span-2 @4xl:col-span-4">
                <a
                  href="#SharePoint"
                  onClick={(e) => {
                    e.preventDefault();
                    onShowToast(`Abriendo repositorio SharePoint: ${selectedClient.sharePointFolder}`);
                  }}
                  className="text-brand-600 hover:underline font-mono inline-flex items-center gap-1 break-all"
                >
                  {selectedClient.sharePointFolder}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </Field>
            </dl>
          </section>

          <div className="grid grid-cols-1 @5xl:grid-cols-[minmax(0,1fr)_24rem] gap-5 items-start">
            {/* Aprovechamientos */}
            <section aria-label="Aprovechamientos" className="@container bg-white border border-line-200 rounded-xl shadow-xs overflow-hidden min-w-0">
              <div className="p-4 border-b border-line-200 flex flex-wrap justify-between items-center gap-3">
                <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-brand-600" />
                  Aprovechamientos
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-100 text-ink-600 tabular-nums">
                    {selectedClient.wells.length}
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={handleNewWell}
                  className="h-9 px-3 rounded-lg border border-line-300 text-brand-600 hover:bg-brand-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar aprovechamiento
                </button>
              </div>

              {selectedClient.wells.length === 0 ? (
                <div className="px-6 py-10 flex flex-col items-center text-center gap-2">
                  <span className="w-11 h-11 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center">
                    <Droplets className="w-5 h-5" />
                  </span>
                  <p className="text-sm font-semibold text-ink-900">Este cliente aún no tiene pozos registrados</p>
                  <p className="text-xs text-ink-500 max-w-sm">
                    Registra el aprovechamiento con su título de concesión y medidor para poder crear solicitudes de verificación.
                  </p>
                  <button
                    type="button"
                    onClick={handleNewWell}
                    className="mt-2 h-9 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar el primer aprovechamiento
                  </button>
                </div>
              ) : (
                <>
                  {/* Tarjetas cuando el espacio es angosto */}
                  <ul className="@2xl:hidden divide-y divide-line-100">
                    {selectedClient.wells.map((well) => {
                      const isSelected = well.id === selectedWell?.id;
                      return (
                        <li key={well.id}>
                          <button
                            type="button"
                            onClick={() => selectWell(well)}
                            aria-current={isSelected ? 'true' : undefined}
                            className={`w-full text-left px-4 py-3 flex flex-col gap-1.5 border-l-[3px] transition-colors ${
                              isSelected ? 'bg-brand-50 border-brand-600' : 'border-transparent hover:bg-surface-50'
                            }`}
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="font-mono font-bold text-xs text-ink-900">{well.id}</span>
                                <span className="text-xs font-semibold text-ink-900"> {well.name}</span>
                              </span>
                              <InspectionChip well={well} />
                            </span>
                            <span className="text-[11px] text-ink-500">
                              {well.use} · {well.meterBrand} · título {well.concessionTitle}
                            </span>
                            <NextDue well={well} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Tabla cuando hay espacio */}
                  <div className="hidden @2xl:block">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-surface-100 text-ink-700 font-semibold border-b border-line-200">
                          <th scope="col" className="py-2.5 px-3.5">Aprovechamiento</th>
                          <th scope="col" className="py-2.5 px-3.5">Título / anexo</th>
                          <th scope="col" className="py-2.5 px-3.5">Medidor</th>
                          <th scope="col" className="py-2.5 px-3.5">Último dictamen</th>
                          <th scope="col" className="py-2.5 px-3.5">Próxima verificación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-100">
                        {selectedClient.wells.map((well) => {
                          const isSelected = well.id === selectedWell?.id;
                          return (
                            <tr
                              key={well.id}
                              onClick={() => selectWell(well)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  selectWell(well);
                                }
                              }}
                              tabIndex={0}
                              aria-selected={isSelected}
                              className={`cursor-pointer transition-colors outline-offset-[-2px] ${
                                isSelected ? 'bg-brand-50 shadow-[inset_3px_0_0_var(--color-brand-600)]' : 'hover:bg-surface-50'
                              }`}
                            >
                              <td className="py-3 px-3.5">
                                <span className="font-mono font-bold text-ink-900 block">{well.id}</span>
                                <span className="text-ink-600">{well.name} · {well.use}</span>
                              </td>
                              <td className="py-3 px-3.5 text-ink-700 font-mono whitespace-nowrap">
                                {well.concessionTitle} · {well.annex}
                              </td>
                              <td className="py-3 px-3.5 text-ink-700">
                                {well.meterBrand}
                                <span className="block text-ink-500 font-mono whitespace-nowrap">{well.meterSerial}</span>
                              </td>
                              <td className="py-3 px-3.5">
                                <InspectionChip well={well} />
                              </td>
                              <td className="py-3 px-3.5">
                                <NextDue well={well} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            {/* Detalle del aprovechamiento seleccionado */}
            {selectedWell && (
              <aside
                ref={detailRef}
                aria-label="Detalle del aprovechamiento"
                className="@container bg-white border border-line-200 rounded-xl shadow-xs min-w-0 scroll-mt-20 @5xl:sticky @5xl:top-4"
              >
                <div className="p-5 pb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line-100">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block">Aprovechamiento</span>
                    <h2 className="text-lg font-bold text-ink-900 mt-0.5 leading-snug">
                      <span className="font-mono">{selectedWell.id}</span> {selectedWell.name}
                    </h2>
                    <p className="text-xs text-ink-500 mt-0.5">
                      Uso {selectedWell.use.toLowerCase()} · fuente {selectedWell.source.toLowerCase()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onShowToast(`Generando solicitud F-12 precargada para ${selectedWell.name}`);
                      onNavigate('Solicitudes');
                    }}
                    disabled={!!selectedWell.activeFolio}
                    title={selectedWell.activeFolio ? `Ya tiene la solicitud ${selectedWell.activeFolio} en proceso` : undefined}
                    className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:bg-surface-200 disabled:text-ink-500 disabled:cursor-not-allowed text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <FilePlus2 className="w-4 h-4" />
                    {selectedWell.activeFolio ? `En proceso: ${selectedWell.activeFolio}` : 'Crear solicitud'}
                  </button>
                </div>

                <div className="p-5 grid grid-cols-1 @2xl:grid-cols-2 gap-x-8 gap-y-5">
                  {/* Ubicación */}
                  <div className="rounded-lg bg-brand-50 border border-brand-200 p-3 flex flex-wrap items-center gap-3 @2xl:col-span-2">
                    <span className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <div className="min-w-[10rem] flex-1">
                      <span className="text-xs font-semibold text-ink-900 font-mono block">{selectedWell.coords}</span>
                      <span className="text-[11px] text-ink-600">Coordenadas WGS84 verificadas en campo</span>
                    </div>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-brand-600 hover:underline inline-flex items-center gap-1 shrink-0"
                      >
                        Ver mapa
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <DetailGroup title="Título de concesión">
                    <Field label="Título / anexo"><span className="font-mono">{selectedWell.concessionTitle} · {selectedWell.annex}</span></Field>
                    <Field label="Volumen concesionado">{selectedWell.annualVolume}</Field>
                    <Field label="Diámetro de descarga">{selectedWell.dischargeDiameter}</Field>
                    <Field label="Fuente">{selectedWell.source}</Field>
                  </DetailGroup>

                  <DetailGroup title="Sistema de medición">
                    <Field label="Medidor">{selectedWell.meterBrand} {selectedWell.meterModel}</Field>
                    <Field label="No. serie / DN"><span className="font-mono">{selectedWell.meterSerial}</span> · {selectedWell.meterDN} mm</Field>
                    <Field label="Instalación">{selectedWell.installationDate}</Field>
                    <Field label="Factura">{selectedWell.supplierInvoice}</Field>
                    <Field label="Unidad electrónica"><span className="font-mono">{selectedWell.electronicUnitSerial}</span></Field>
                    <Field label="Unidad de transmisión"><span className="font-mono">{selectedWell.transmissionUnitSerial}</span></Field>
                  </DetailGroup>

                  <div className="flex flex-col gap-2 @2xl:col-span-2">
                    <h3 className="text-[11px] font-bold text-ink-500 uppercase tracking-wider">Verificaciones</h3>
                    <div className="border border-line-100 rounded-lg divide-y divide-line-100 text-xs">
                      <div className="px-3 py-2 flex flex-wrap justify-between items-center gap-2">
                        <span className="text-ink-700 inline-flex items-center gap-1.5">
                          <CalendarClock className="w-3.5 h-3.5 text-ink-500" />
                          Próxima
                        </span>
                        <NextDue well={selectedWell} />
                      </div>
                      <div className="px-3 py-2 flex flex-wrap justify-between items-center gap-2">
                        <span className="text-ink-700 inline-flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-ink-500" />
                          {hasPrevInspection ? `Última · ${selectedWell.lastInspectionDate}` : 'Última'}
                        </span>
                        <InspectionChip well={selectedWell} />
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- Piezas de presentación ---------- */

const Chip: React.FC<{ children: React.ReactNode; mono?: boolean }> = ({ children, mono }) => (
  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md bg-surface-100 text-ink-700 ${mono ? 'font-mono' : ''}`}>
    {children}
  </span>
);

const Field: React.FC<{ label: string; icon?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
  label,
  icon,
  className = '',
  children,
}) => (
  <div className={`min-w-0 ${className}`}>
    <dt className="text-ink-500 font-medium inline-flex items-center gap-1.5">
      {icon && <span className="text-ink-400">{icon}</span>}
      {label}
    </dt>
    <dd className="text-ink-900 font-semibold mt-0.5 break-words">{children}</dd>
  </div>
);

const DetailGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-2 min-w-0">
    <h3 className="text-[11px] font-bold text-ink-500 uppercase tracking-wider">{title}</h3>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs border-t border-line-100 pt-2.5">{children}</dl>
  </div>
);

const InspectionChip: React.FC<{ well: WellSite }> = ({ well }) => {
  const conforme = well.lastInspection.includes('Conforme');
  const inconforme = /inconforme|no conforme/i.test(well.lastInspection);
  const label = well.lastInspection.split('·')[0].trim();
  const style = inconforme
    ? 'bg-danger-100 text-danger-700'
    : conforme
    ? 'bg-success-100 text-success-700'
    : 'bg-surface-100 text-ink-600';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${style}`}>{label}</span>;
};

const NextDue: React.FC<{ well: WellSite }> = ({ well }) => {
  if (well.nextInspectionUrgent) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warn-700">
        <AlertTriangle className="w-3.5 h-3.5" />
        {well.nextInspectionDue}
      </span>
    );
  }
  if (well.activeFolio) {
    return <span className="text-[11px] font-semibold text-brand-800">{well.nextInspectionDue}</span>;
  }
  return <span className="text-[11px] font-medium text-ink-700">{well.nextInspectionDue}</span>;
};

/** "22.7709° N, 102.5832° W" → enlace de Google Maps; null si el texto no tiene coordenadas reconocibles. */
function googleMapsUrl(coords: string): string | null {
  const m = coords.match(/(-?\d+(?:\.\d+)?)°?\s*([NS])[,\s]+(-?\d+(?:\.\d+)?)°?\s*([EW])/i);
  if (!m) return null;
  const lat = Number(m[1]) * (m[2].toUpperCase() === 'S' ? -1 : 1);
  const lon = Number(m[3]) * (m[4].toUpperCase() === 'W' ? -1 : 1);
  return `https://www.google.com/maps?q=${lat},${lon}`;
}
