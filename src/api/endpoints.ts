/**
 * Endpoints tipados del contrato `backend/CONTRACT.md`, agrupados por servicio.
 * Cada función elige backend (`VITE_DATA_SOURCE=api`) o datos mock locales (`mock`, predeterminado).
 */
import { client, saveBlob, seg } from './client';
import { mockAction, mockResolve, pick, type ActionResult } from './source';
import type { AltaFormatoDefaults, BandejaData, CalibracionActual, CalibracionStep, CampoSesion, CargaConaguaModo, ClientItem, ClienteInput, CompletarCalibracionInput, ConaguaItem, ConfirmarVisitaInput, CreateInstrumentoInput, CreateSolicitudInput, DictamenItem, EstadisticasData, ExpedienteData, FormatoCreateInput, FormatoEstructura, FormatoItem, InstrumentDetail, PerfilData, PerfilInput, PozoInput, PrestamosData, ProgramacionData, RegistrarDevolucionInput, RespuestaCampoInput, RevisionData, RevisionDecision, Solicitud, SolicitudStatus, TableroData, TiposData, UsuariosData, VerificadorItem, WellSite } from '../types';
import { mockEstadisticas, mockTablero } from '../data/reportes';
import { mockClients, mockFormatos, mockSolicitudes, mockVerificadores } from '../data/mockData';
import { mockAltaFormatoDefaults, mockFormatoEstructura, mockPerfil, mockTipos, mockUsuarios } from '../data/catalogos';
import { mockCoordinador, mockSolicitudDocsTemplate } from '../data/solicitudes';
import { mockCampoSesion, mockPrestamos, mockProgramacion } from '../data/operacion';
import { mockCalibracionActual, mockInstrumentDetails } from '../data/calidad';
import { mockBandeja, mockConagua, mockDictamenes, mockExpedientes, mockRevisiones } from '../data/dictaminacion';

// ═════════════ reportes ═════════════
const EXPORT_OK = 'Reporte exportado exitosamente a formato CSV/Excel.';

function defaultCsvName(): string {
  return `Estadisticas_UVA_${new Date().toISOString().slice(0, 10)}.csv`;
}

/** svc-reportes — /api/reportes */
export const reportes = {
  /** GET /reportes/tablero */
  getTablero: (): Promise<TableroData> =>
    pick(
      () => client.get<TableroData>('/reportes/tablero'),
      () => mockResolve(mockTablero)
    ),

  /** GET /reportes/estadisticas?periodo= */
  getEstadisticas: (periodo?: string): Promise<EstadisticasData> =>
    pick(
      () => client.get<EstadisticasData>('/reportes/estadisticas', { periodo }),
      () => mockResolve(mockEstadisticas)
    ),

  /**
   * GET /reportes/estadisticas/export?periodo= → text/csv.
   * Descarga el archivo en el navegador y devuelve `{ok, message}` para el toast.
   */
  exportEstadisticasCsv: (periodo?: string): Promise<ActionResult<{ filename: string }>> =>
    pick(
      async () => {
        const { blob, filename } = await client.download('/reportes/estadisticas/export', { periodo });
        const name = filename ?? defaultCsvName();
        saveBlob(blob, name);
        return { ok: true, message: EXPORT_OK, filename: name };
      },
      () => {
        // Modo mock: genera el mismo CSV que generaba la vista con los datos locales.
        const name = defaultCsvName();
        const csv =
          'Mes,Verificaciones,Meta\n' + mockEstadisticas.months.map((m) => `${m.label},${m.value},30`).join('\n');
        saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), name);
        return mockAction(EXPORT_OK, { filename: name });
      }
    ),
};

// ═════════════ catalogos ═════════════
/* Estado mock en memoria (sólo modo `mock`): las altas persisten durante la sesión. */
const mockState = {
  clients: JSON.parse(JSON.stringify(mockClients)) as ClientItem[],
  formatos: JSON.parse(JSON.stringify(mockFormatos)) as FormatoItem[],
  estructuras: {} as Record<string, FormatoEstructura>,
  perfil: JSON.parse(JSON.stringify(mockPerfil)) as PerfilData,
};

const STAGE_BY_ETAPA: Record<string, FormatoItem['stage']> = {
  Solicitud: 'Solicitud',
  Contratación: 'Contratación',
  Campo: 'Campo',
  Emisión: 'Emisión',
  Calibración: 'Calibración',
};

const STRUCTURE_LABEL: Record<FormatoCreateInput['estructura'], FormatoItem['structureType']> = {
  checklist: 'Check list',
  word: 'Plantilla Word',
  cuestionario: 'Cuestionario con secciones',
};

const todayStr = (): string => new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Busca un formato por id o, si no es numérico/id conocido, por código (versión más reciente). */
function findMockFormato(idOrCode: string): FormatoItem | undefined {
  const byId = mockState.formatos.find((f) => f.id === idOrCode);
  if (byId) return byId;
  const byCode = mockState.formatos.filter((f) => f.code === idOrCode);
  return byCode.sort((a, b) => parseFloat(b.version) - parseFloat(a.version))[0];
}

const shortCode = (code: string): string => code.replace(/-AC$/, '');

function emptyWell(vals: PozoInput): WellSite {
  return {
    id: `[ID-${String(Date.now()).slice(-3)}]`,
    name: 'Nuevo aprovechamiento',
    concessionTitle: '—',
    annex: '—',
    use: '—',
    source: '—',
    annualVolume: '—',
    coords: '—',
    dischargeDiameter: '—',
    meterBrand: '—',
    meterModel: '—',
    meterSerial: '—',
    meterDN: '—',
    installationDate: '—',
    supplierInvoice: '—',
    electronicUnitSerial: '—',
    transmissionUnitSerial: '—',
    lastInspection: 'Sin dictamen',
    lastInspectionDate: '—',
    nextInspectionDue: 'Por definir',
    ...vals,
  };
}

export const catalogos = {
  /* ---------- Clientes ---------- */

  /** GET /catalogos/clientes */
  getClientes: (): Promise<ClientItem[]> =>
    pick(
      () => client.get<ClientItem[]>('/catalogos/clientes'),
      () => mockResolve(mockState.clients),
    ),

  /** POST /catalogos/clientes */
  createCliente: (vals: ClienteInput): Promise<ActionResult<{ cliente: ClientItem }>> =>
    pick(
      () => client.post<ActionResult<{ cliente: ClientItem }>>('/catalogos/clientes', vals),
      () => {
        const cliente: ClientItem = {
          id: `c-${Date.now()}`,
          name: 'Nuevo cliente',
          rfc: '—',
          fiscalType: '—',
          fiscalAddress: '—',
          aspelCode: '—',
          legalRep: '—',
          noticeContact: '—',
          phone: '—',
          sharePointFolder: '—',
          ...vals,
          wells: [],
        };
        mockState.clients.push(cliente);
        return mockAction('Apertura de formulario de nuevo cliente', { cliente });
      },
    ),

  /** PUT /catalogos/clientes/{id} */
  updateCliente: (clienteId: string, vals: ClienteInput): Promise<ActionResult<{ cliente: ClientItem }>> =>
    pick(
      () => client.put<ActionResult<{ cliente: ClientItem }>>(`/catalogos/clientes/${seg(clienteId)}`, vals),
      () => {
        const idx = mockState.clients.findIndex((c) => c.id === clienteId);
        if (idx >= 0) mockState.clients[idx] = { ...mockState.clients[idx], ...vals };
        const cliente = mockState.clients[idx] ?? ({ id: clienteId, wells: [], ...vals } as ClientItem);
        return mockAction('Edición de datos fiscales y representante legal', { cliente });
      },
    ),

  /** POST /catalogos/clientes/{id}/pozos */
  createPozo: (clienteId: string, vals: PozoInput): Promise<ActionResult<{ pozo: WellSite }>> =>
    pick(
      () => client.post<ActionResult<{ pozo: WellSite }>>(`/catalogos/clientes/${seg(clienteId)}/pozos`, vals),
      () => {
        const pozo = emptyWell(vals);
        mockState.clients.find((c) => c.id === clienteId)?.wells.push(pozo);
        return mockAction('Apertura de formulario para registrar nuevo pozo', { pozo });
      },
    ),

  /** POST /catalogos/clientes/sync-aspel */
  syncAspel: (): Promise<ActionResult> =>
    pick(
      () => client.post<ActionResult>('/catalogos/clientes/sync-aspel'),
      () => mockAction('Sincronizando 142 clientes y catálogos de cuentas desde Aspel SAE'),
    ),

  /* ---------- Verificadores / usuarios ---------- */

  /** GET /catalogos/verificadores */
  getVerificadores: (): Promise<VerificadorItem[]> =>
    pick(
      () => client.get<VerificadorItem[]>('/catalogos/verificadores'),
      () => mockResolve(mockVerificadores),
    ),

  /** GET /catalogos/usuarios */
  getUsuarios: (): Promise<UsuariosData> =>
    pick(
      () => client.get<UsuariosData>('/catalogos/usuarios'),
      () => mockResolve(mockUsuarios),
    ),

  /* ---------- Mi perfil ---------- */

  /** GET /catalogos/perfil — usuario en sesión */
  getPerfil: (): Promise<PerfilData> =>
    pick(
      () => client.get<PerfilData>('/catalogos/perfil'),
      () => mockResolve(mockState.perfil),
    ),

  /** PUT /catalogos/perfil — teléfono y preferencias de notificación */
  updatePerfil: (vals: PerfilInput): Promise<ActionResult<{ perfil: PerfilData }>> =>
    pick(
      () => client.put<ActionResult<{ perfil: PerfilData }>>('/catalogos/perfil', vals),
      () => {
        const p = mockState.perfil;
        if (vals.phone !== undefined) p.phone = vals.phone.trim();
        if (vals.prefs) p.prefs = { ...p.prefs, ...vals.prefs };
        return mockAction('Perfil actualizado', { perfil: p });
      },
    ),

  /* ---------- Formatos ---------- */

  /** GET /catalogos/formatos */
  getFormatos: (): Promise<FormatoItem[]> =>
    pick(
      () => client.get<FormatoItem[]>('/catalogos/formatos'),
      () => mockResolve(mockState.formatos),
    ),

  /** POST /catalogos/formatos */
  createFormato: (vals: FormatoCreateInput): Promise<ActionResult<{ formato: FormatoItem }>> =>
    pick(
      () => client.post<ActionResult<{ formato: FormatoItem }>>('/catalogos/formatos', vals),
      () => {
        const detail =
          vals.estructura === 'checklist'
            ? `${vals.checklistItems?.length ?? 0} rubros`
            : vals.estructura === 'cuestionario'
              ? `${vals.sections?.length ?? 0} secciones`
              : 'Variables de plantilla';
        const formato: FormatoItem = {
          id: `f-${Date.now()}`,
          code: vals.codigo,
          name: vals.nombre,
          subtitle: 'Borrador en edición',
          stage: STAGE_BY_ETAPA[vals.etapa] ?? 'Solicitud',
          version: vals.version,
          structureType: STRUCTURE_LABEL[vals.estructura],
          structureDetail: detail,
          status: 'Borrador',
          modifiedDate: todayStr(),
        };
        mockState.formatos.push(formato);
        return mockAction(`Borrador del formato ${vals.codigo} v${vals.version} guardado.`, { formato });
      },
    ),

  /** POST /catalogos/formatos/{id}/enviar-aprobacion (id numérico o código vigente). */
  formatoEnviarAprobacion: (formatoId: string): Promise<ActionResult> =>
    pick(
      () => client.post<ActionResult>(`/catalogos/formatos/${seg(formatoId)}/enviar-aprobacion`),
      () => {
        const f = findMockFormato(formatoId);
        const code = f?.code ?? formatoId;
        if (f) f.status = 'En aprobación';
        // Mismos textos que mostraban EditorView (cuestionario) y AltaFormatoView (resto).
        const message =
          f?.structureType === 'Cuestionario con secciones'
            ? `Lista ${shortCode(code)} enviada a aprobación del Gerente Técnico`
            : `Formato ${code} enviado a aprobación del Gerente Técnico.`;
        return mockAction(message);
      },
    ),

  /** GET /catalogos/formatos/{id}/estructura */
  getFormatoEstructura: (formatoId: string): Promise<FormatoEstructura> =>
    pick(
      () => client.get<FormatoEstructura>(`/catalogos/formatos/${seg(formatoId)}/estructura`),
      () => mockResolve(mockState.estructuras[formatoId] ?? mockFormatoEstructura),
    ),

  /** PUT /catalogos/formatos/{id}/estructura */
  saveFormatoEstructura: (formatoId: string, estructura: FormatoEstructura): Promise<ActionResult> =>
    pick(
      () => client.put<ActionResult>(`/catalogos/formatos/${seg(formatoId)}/estructura`, estructura),
      () => {
        mockState.estructuras[formatoId] = JSON.parse(JSON.stringify(estructura)) as FormatoEstructura;
        const f = findMockFormato(formatoId);
        return mockAction(`Borrador de ${shortCode(f?.code ?? formatoId)} v${f?.version ?? ''} guardado localmente`);
      },
    ),

  /** GET /catalogos/formatos/plantillas-alta */
  getAltaFormatoDefaults: (): Promise<AltaFormatoDefaults> =>
    pick(
      () => client.get<AltaFormatoDefaults>('/catalogos/formatos/plantillas-alta'),
      () => mockResolve(mockAltaFormatoDefaults),
    ),

  /** GET /catalogos/tipos */
  getTipos: (): Promise<TiposData> =>
    pick(
      () => client.get<TiposData>('/catalogos/tipos'),
      () => mockResolve(mockTipos),
    ),
};

// ═════════════ solicitudes ═════════════
/* Estado en memoria del modo mock: las acciones persisten mientras dure la sesión del navegador. */
let mockStore: Solicitud[] = mockSolicitudes.map((s) => ({ ...s, docs: s.docs.map((d) => ({ ...d })) }));

function mockFind(id: string): Solicitud {
  const sol = mockStore.find((s) => s.id === id);
  if (!sol) throw new Error('Solicitud no encontrada.');
  return sol;
}

function mockReplace(updated: Solicitud): Solicitud {
  mockStore = mockStore.map((s) => (s.id === updated.id ? updated : s));
  return updated;
}

export const solicitudes = {
  /** GET /api/solicitudes */
  list: (): Promise<Solicitud[]> =>
    pick(
      () => client.get<Solicitud[]>('/solicitudes'),
      () => mockResolve(mockStore)
    ),

  /** POST /api/solicitudes */
  create: (vals: CreateSolicitudInput): Promise<ActionResult<{ solicitud: Solicitud }>> =>
    pick(
      () => client.post<ActionResult<{ solicitud: Solicitud }>>('/solicitudes', vals),
      () => {
        const newFolioNumber = mockStore.length + 11;
        const solicitud: Solicitud = {
          id: `s-${Date.now()}`,
          folio: `[UVA-00${newFolioNumber}]`,
          client: vals.client,
          well: vals.well,
          title: vals.title,
          kind: vals.kind,
          quote: `COT-${Math.floor(8900 + Math.random() * 100)} · enviada`,
          quoteStatus: 'enviada',
          docsCount: 0,
          totalDocs: mockSolicitudDocsTemplate.length,
          status: 'En cotización',
          registeredDate: new Date().toLocaleDateString('es-MX'),
          coordinator: mockCoordinador,
          docs: mockSolicitudDocsTemplate.map((d) => ({ ...d }))
        };
        mockStore = [solicitud, ...mockStore];
        return mockAction(`Solicitud ${solicitud.folio} creada exitosamente.`, { solicitud });
      }
    ),

  /** PATCH /api/solicitudes/{id}/documentos/{docId} */
  setDocumento: (
    solicitudId: string,
    documentoId: string,
    complete: boolean,
    filename?: string
  ): Promise<ActionResult<{ solicitud: Solicitud }>> =>
    pick(
      () =>
        client.patch<ActionResult<{ solicitud: Solicitud }>>(
          `/solicitudes/${seg(solicitudId)}/documentos/${seg(documentoId)}`,
          { complete, filename }
        ),
      () => {
        const sol = mockFind(solicitudId);
        const docs = sol.docs.map((d) =>
          d.id === documentoId
            ? { ...d, complete, filename: complete ? filename ?? `Documento_${d.name.slice(0, 15)}.pdf` : undefined }
            : d
        );
        const docsCount = docs.filter((d) => d.complete).length;
        const status: SolicitudStatus =
          docsCount === sol.totalDocs && sol.status === 'Documentación pendiente' ? 'Lista para programar' : sol.status;
        const solicitud = mockReplace({ ...sol, docs, docsCount, status });
        return mockAction('Documento recibido y verificado.', { solicitud });
      }
    ),

  /** PATCH /api/solicitudes/{id}/estado */
  setEstado: (solicitudId: string, status: SolicitudStatus): Promise<ActionResult<{ solicitud: Solicitud }>> =>
    pick(
      () => client.patch<ActionResult<{ solicitud: Solicitud }>>(`/solicitudes/${seg(solicitudId)}/estado`, { status }),
      () => {
        const solicitud = mockReplace({ ...mockFind(solicitudId), status });
        const message =
          status === 'Lista para programar'
            ? 'Solicitud enviada a programación. Plazo de 2 semanas activado.'
            : `Estado de la solicitud actualizado a "${status}".`;
        return mockAction(message, { solicitud });
      }
    )
};

// ═════════════ operacion ═════════════
export const operacion = {
  /** GET /api/operacion/programacion?semana= */
  getProgramacion: (semana?: string): Promise<ProgramacionData> =>
    pick(
      () => client.get<ProgramacionData>('/operacion/programacion', { semana }),
      () => mockResolve(mockProgramacion)
    ),

  /** POST /api/operacion/visitas */
  confirmarVisita: (vals: ConfirmarVisitaInput): Promise<ActionResult> =>
    pick(
      () => client.post<ActionResult>('/operacion/visitas', vals),
      () =>
        mockAction(
          `Visita ${vals.folio} confirmada para el ${vals.fecha} a las ${vals.hora} hrs.` +
            (vals.send_outlook
              ? ' Cita enviada a Microsoft 365 Outlook y sincronizada con la app del verificador.'
              : '')
        )
    ),

  /** GET /api/operacion/prestamos */
  getPrestamos: (): Promise<PrestamosData> =>
    pick(
      () => client.get<PrestamosData>('/operacion/prestamos'),
      () => mockResolve(mockPrestamos)
    ),

  /** POST /api/operacion/prestamos/devolucion */
  registrarDevolucion: (vals: RegistrarDevolucionInput): Promise<ActionResult> =>
    pick(
      () => client.post<ActionResult>('/operacion/prestamos/devolucion', vals),
      () => mockAction(`Devolución de equipos para visita ${vals.folio} registrada exitosamente.`)
    ),

  /** GET /api/operacion/campo/{folio} — sesión de captura de campo (punto en curso de la PWA) */
  getCampoSesion: (folio: string): Promise<CampoSesion> =>
    pick(
      () => client.get<CampoSesion>(`/operacion/campo/${seg(folio)}`),
      () => mockResolve(mockCampoSesion)
    ),

  /** POST /api/operacion/campo/{folio}/respuesta */
  registrarRespuestaCampo: (folio: string, vals: RespuestaCampoInput): Promise<ActionResult> =>
    pick(
      () => client.post<ActionResult>(`/operacion/campo/${seg(folio)}/respuesta`, vals),
      () => {
        const [section, point] = vals.punto.split('.');
        const n = Number(point);
        const message =
          n < mockCampoSesion.totalPoints
            ? `Avanzando a punto ${section}.${n + 1}`
            : `Sección ${section} completa. Pasando a Sección ${Number(section) + 1}.`;
        return mockAction(message);
      }
    )
};

// ═════════════ calidad ═════════════
export const calidad = {
  /** GET /api/calidad/instrumentos */
  getInstrumentos: (): Promise<InstrumentDetail[]> =>
    pick(
      () => client.get<InstrumentDetail[]>('/calidad/instrumentos'),
      () => mockResolve(mockInstrumentDetails)
    ),

  /** POST /api/calidad/instrumentos */
  createInstrumento: (vals: CreateInstrumentoInput): Promise<ActionResult<{ instrumento: InstrumentDetail }>> =>
    pick(
      () => client.post<ActionResult<{ instrumento: InstrumentDetail }>>('/calidad/instrumentos', vals),
      () => {
        const instrumento: InstrumentDetail = {
          id: `i-${Date.now()}`,
          ...vals,
          assignedTo: 'Sin asignar (en almacén)',
          status: 'Disponible',
          calHistory: [],
          usage: []
        };
        return mockAction(`Instrumento ${vals.invCode} registrado en el catálogo.`, { instrumento });
      }
    ),

  /** GET /api/calidad/calibraciones/actual */
  getCalibracionActual: (): Promise<CalibracionActual> =>
    pick(
      () => client.get<CalibracionActual>('/calidad/calibraciones/actual'),
      () => mockResolve(mockCalibracionActual)
    ),

  /** PUT /api/calidad/calibraciones/{id}/pasos */
  saveCalibracionPasos: (calibracionId: string, steps: CalibracionStep[]): Promise<ActionResult> =>
    pick(
      () => client.put<ActionResult>(`/calidad/calibraciones/${seg(calibracionId)}/pasos`, { steps }),
      () => mockAction('Avance del checklist guardado')
    ),

  /** POST /api/calidad/calibraciones/{id}/completar */
  completarCalibracion: (calibracionId: string, vals: CompletarCalibracionInput): Promise<ActionResult> =>
    pick(
      () => client.post<ActionResult>(`/calidad/calibraciones/${seg(calibracionId)}/completar`, vals),
      () =>
        mockAction(
          `Calibración completada con éxito. Instrumento ${mockCalibracionActual.instrument.invCode} liberado como DISPONIBLE.`
        )
    )
};

// ═════════════ dictaminacion ═════════════
/** Normaliza un folio mostrado como "[UVA-0001]" a "UVA-0001". */
const cleanFolio = (folio: string) => folio.replace(/[[\]]/g, '').trim();

function mockByFolio<T>(table: Record<string, T>, folio: string, label: string): Promise<T> {
  const data = table[cleanFolio(folio)];
  if (!data) return Promise.reject(new Error(`No se encontró ${label} ${cleanFolio(folio)}.`));
  return mockResolve(data);
}

const DECISION_MESSAGES: Record<RevisionDecision, string> = {
  autorizar: 'Dictamen DV-0105 firmado electrónicamente y autorizado. Folio oficial generado.',
  devolver: 'Expediente devuelto al verificador para corrección.',
  inconforme: 'Resultado cambiado a Inconforme. Dictamen DV-0105 firmado electrónicamente.',
};

export interface DecisionResult {
  dictamen?: { no: string; folio: string; res?: string } | Record<string, unknown>;
}

/** svc-dictaminacion — /api/dictaminacion */
export const dictaminacion = {
  /** GET /dictaminacion/bandeja */
  getBandeja: (): Promise<BandejaData> =>
    pick(
      () => client.get<BandejaData>('/dictaminacion/bandeja'),
      () => mockResolve(mockBandeja)
    ),

  /** GET /dictaminacion/revision/{folio} */
  getRevision: (folio: string): Promise<RevisionData> =>
    pick(
      () => client.get<RevisionData>(`/dictaminacion/revision/${seg(cleanFolio(folio))}`),
      () => mockByFolio(mockRevisiones, folio, 'la revisión del expediente')
    ),

  /** POST /dictaminacion/revision/{folio}/decision */
  registrarDecision: (
    folio: string,
    decision: RevisionDecision,
    comentario: string
  ): Promise<ActionResult<DecisionResult>> =>
    pick(
      () =>
        client.post<ActionResult<DecisionResult>>(`/dictaminacion/revision/${seg(cleanFolio(folio))}/decision`, {
          decision,
          comentario,
        }),
      () =>
        mockAction<DecisionResult>(
          DECISION_MESSAGES[decision],
          decision === 'devolver' ? {} : { dictamen: { no: 'DV-0105', folio: cleanFolio(folio) } }
        )
    ),

  /** GET /dictaminacion/dictamenes */
  getDictamenes: (): Promise<DictamenItem[]> =>
    pick(
      () => client.get<DictamenItem[]>('/dictaminacion/dictamenes'),
      () => mockResolve(mockDictamenes)
    ),

  /** GET /dictaminacion/conagua */
  getConagua: (): Promise<ConaguaItem[]> =>
    pick(
      () => client.get<ConaguaItem[]>('/dictaminacion/conagua'),
      () => mockResolve(mockConagua)
    ),

  /** POST /dictaminacion/conagua/{id}/acuse */
  enviarAcuse: (id: string): Promise<ActionResult<{ item: ConaguaItem }>> =>
    pick(
      () => client.post<ActionResult<{ item: ConaguaItem }>>(`/dictaminacion/conagua/${seg(id)}/acuse`),
      () => {
        const item = mockConagua.find((i) => i.id === id);
        if (!item) return Promise.reject(new Error('No se encontró la carga CONAGUA.'));
        return mockAction(`Acuse oficial CONAGUA enviado por correo a ${item.client}`, {
          item: { ...item, st: 'Acuse enviado', stType: 'done' as const, action: 'Ver' as const },
        });
      }
    ),

  /** GET /dictaminacion/expedientes/{folio} */
  getExpediente: (folio: string): Promise<ExpedienteData> =>
    pick(
      () => client.get<ExpedienteData>(`/dictaminacion/expedientes/${seg(cleanFolio(folio))}`),
      () => mockByFolio(mockExpedientes, folio, 'el expediente')
    ),

  /** POST /dictaminacion/expedientes/{folio}/carga-conagua */
  cargaConagua: (folio: string, modo: CargaConaguaModo, acuseFilename?: string): Promise<ActionResult> =>
    pick(
      () =>
        client.post<ActionResult>(`/dictaminacion/expedientes/${seg(cleanFolio(folio))}/carga-conagua`, {
          modo,
          acuse_filename: acuseFilename ?? null,
        }),
      () =>
        mockAction(modo === 'bot' ? 'Bot iniciado: Conectando al portal CONAGUA...' : 'Acuse PDF adjuntado correctamente')
    ),
};
