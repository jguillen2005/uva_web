export type ScreenKey =
  | 'Tablero'
  | 'Solicitudes'
  | 'Clientes'
  | 'Programacion'
  | 'Bandeja'
  | 'Dictamenes'
  | 'Conagua'
  | 'Estadisticas'
  | 'Main'
  | 'Instrumentos'
  | 'Verificadores'
  | 'Usuarios'
  | 'AltaFormato'
  | 'Editor'
  | 'Tipos'
  | 'Preview'
  | 'Calibracion'
  | 'Prestamos'
  | 'Revision'
  | 'Expediente'
  | 'Proceso'
  | 'Perfil';

export interface AlertItem {
  id: string;
  tag: string;
  severity: 'red' | 'amber' | 'blue';
  title: string;
  desc: string;
  actionText: string;
  targetScreen: ScreenKey;
}

export interface KPIItem {
  label: string;
  value: string | number;
  sub: string;
  warning?: boolean;
  targetScreen: ScreenKey;
}

export interface Solicitud {
  id: string;
  folio: string;
  client: string;
  well: string;
  title: string;
  kind: 'Inicial' | 'Periódica' | 'Extraordinaria';
  quote: string;
  quoteStatus: 'enviada' | 'aprobada';
  docsCount: number;
  totalDocs: number;
  status: 'En cotización' | 'Esperando pago' | 'Documentación pendiente' | 'Lista para programar' | 'Programada';
  dateStr?: string;
  registeredDate: string;
  coordinator: string;
  docs: {
    id: string;
    name: string;
    complete: boolean;
    required: boolean;
    filename?: string;
  }[];
}

export interface ClientItem {
  id: string;
  name: string;
  rfc: string;
  fiscalType: string;
  fiscalAddress: string;
  aspelCode: string;
  legalRep: string;
  noticeContact: string;
  phone: string;
  sharePointFolder: string;
  wells: WellSite[];
}

export interface WellSite {
  id: string;
  name: string;
  concessionTitle: string;
  annex: string;
  use: string;
  source: string;
  annualVolume: string;
  coords: string;
  dischargeDiameter: string;
  meterBrand: string;
  meterModel: string;
  meterSerial: string;
  meterDN: string;
  installationDate: string;
  supplierInvoice: string;
  electronicUnitSerial: string;
  transmissionUnitSerial: string;
  lastInspection: string;
  lastInspectionDate: string;
  nextInspectionDue: string;
  nextInspectionUrgent?: boolean;
  activeFolio?: string;
}

export interface InstrumentItem {
  id: string;
  type: string;
  brandModel: string;
  serial: string;
  invCode: string;
  assignedTo: string;
  calDueDate: string;
  status: 'Vigente' | 'Por vencer' | 'Vencido' | 'Disponible' | 'Fuera de servicio' | 'En calibración';
  labName?: string;
  certNumber?: string;
  calDate?: string;
}

export interface VerificadorItem {
  id: string;
  code: string;
  name: string;
  email: string;
  zone: string;
  compStatus: 'Vigente' | 'Por vencer' | 'Vencida';
  compDueText: string;
  monthlyVisits: number;
  monthlyTarget: number;
  assignedKit: string;
  status: 'Activo' | 'Vacaciones' | 'Inactivo';
  maxWeeklyVisits: number;
  equipmentDesc: string;
  activeLoans: { name: string; inv: string; status: 'Vigente' | 'Por vencer' }[];
  vacations?: string;
}

export interface FormatoItem {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  stage: 'Solicitud' | 'Contratación' | 'Campo' | 'Emisión' | 'Calibración';
  version: string;
  structureType: 'Check list' | 'Plantilla Word' | 'Cuestionario con secciones';
  structureDetail: string;
  status: 'Vigente' | 'Borrador' | 'En aprobación' | 'Obsoleto';
  modifiedDate: string;
}

// ───────────── reportes ─────────────
// Tipos del servicio reportes (svc-reportes, /api/reportes).

export interface StageCount {
  name: string;
  count: number;
  max: number;
}

export interface TodayVisit {
  time: string;
  folio: string;
  client: string;
  inspector: string;
}

/** GET /reportes/tablero */
export interface TableroData {
  kpis: KPIItem[];
  alerts: AlertItem[];
  stages: StageCount[];
  todayVisits: TodayVisit[];
}

export interface EstadisticaMes {
  label: string;
  value: number;
}

export interface EstadisticaEtapa {
  label: string;
  days: number;
  max: number;
  isTotal?: boolean;
}

export interface EstadisticaNoConformidad {
  label: string;
  count: number;
  max: number;
}

export interface EstadisticaInspector {
  name: string;
  count: number;
  returned: number;
}

/** GET /reportes/estadisticas?periodo= */
export interface EstadisticasData {
  months: EstadisticaMes[];
  stages: EstadisticaEtapa[];
  nonConformities: EstadisticaNoConformidad[];
  inspectors: EstadisticaInspector[];
}

// ───────────── catalogos ─────────────
// Tipos del servicio catalogos (/api/catalogos).

/* ---------- Clientes / pozos ---------- */

/** Campos editables de un cliente (POST/PUT /clientes). */
export type ClienteInput = Partial<Omit<ClientItem, 'id' | 'wells'>>;

/** Campos de un aprovechamiento nuevo (POST /clientes/{id}/pozos). */
export type PozoInput = Partial<WellSite>;

/* ---------- Usuarios y roles ---------- */

export interface UsuarioItem {
  name: string;
  email: string;
  roles: string[];
  date: string;
  st: string;
}

/** Fila de la matriz de permisos: V = Ver, E = Editar, A = Autorizar, — = Sin acceso. */
export interface PermisoRow {
  mod: string;
  vals: string[];
}

export interface UsuariosData {
  users: UsuarioItem[];
  rolesHeaders: string[];
  matrix: PermisoRow[];
}

/* ---------- Mi perfil ---------- */

export interface PerfilPrefs {
  correo: boolean;
  teams: boolean;
  vencimientos: boolean;
  resumenDiario: boolean;
}

export interface PerfilData {
  name: string;
  initials: string;
  title: string;
  email: string;
  login: string;
  phone: string;
  tz: string;
  roles: string[];
  lastAccess: string;
  identityProvider: string;
  verificadorCode: string;
  prefs: PerfilPrefs;
  /** Permiso efectivo por módulo (el mayor entre sus roles): V, E, A o —. */
  permisos: { mod: string; val: string }[];
}

export interface PerfilInput {
  phone?: string;
  prefs?: Partial<PerfilPrefs>;
}

/* ---------- Formatos ---------- */

export type FormatoEstructuraTipo = 'checklist' | 'word' | 'cuestionario';

export interface AltaChecklistItem {
  id: number;
  text: string;
  req: boolean;
  date: boolean;
  comment: boolean;
  file: boolean;
}

export interface WordFieldMapping {
  key: string;
  mapTo: string;
}

export interface FormatoSeccionResumen {
  n: string;
  name: string;
  count: string;
}

/** GET /formatos/plantillas-alta */
export interface AltaFormatoDefaults {
  checklistItems: AltaChecklistItem[];
  wordFields: WordFieldMapping[];
  sections: FormatoSeccionResumen[];
}

/** POST /formatos */
export interface FormatoCreateInput {
  codigo: string;
  nombre: string;
  version: string;
  etapa: string;
  estructura: FormatoEstructuraTipo;
  checklistItems?: AltaChecklistItem[];
  sections?: FormatoSeccionResumen[];
}

export interface FormatoEditorPoint {
  n: string;
  text: string;
  kind: string;
  ref: string;
  resp: string;
  ev: string;
  /** Criterio de aceptación (opcional; precarga el panel de propiedades). */
  criterion?: string;
}

/** GET/PUT /formatos/{id}/estructura */
export interface FormatoEstructura {
  sections: FormatoSeccionResumen[];
  points: FormatoEditorPoint[];
}

/** Formato que se edita en EditorView (código vigente; el backend toma la versión más reciente). */
export interface FormatoEditorRef {
  code: string;
  shortCode: string;
  name: string;
  version: string;
  status: FormatoItem['status'] | 'Borrador';
  defaultSection: string;
  defaultPoint: string;
}

/* ---------- Tipos de respuesta ---------- */

export interface TipoRespuestaPanel {
  type: string;
  isOptions?: boolean;
  isText?: boolean;
  isGroup?: boolean;
  hasEval?: boolean;
  perField?: boolean;
  evalLabel?: string;
  values?: string[];
  fields?: { label: string; max: number }[];
  uses: string;
}

export interface TipoCoberturaRow {
  s: string;
  t: string;
}

/** GET /tipos */
export interface TiposData {
  panels: TipoRespuestaPanel[];
  coverage: TipoCoberturaRow[];
}

// ───────────── solicitudes ─────────────
/** Documento del checklist CL-DOC de una solicitud. */
export type SolicitudDocumento = Solicitud['docs'][number];

export type SolicitudKind = Solicitud['kind'];
export type SolicitudStatus = Solicitud['status'];

/** Cuerpo de `POST /api/solicitudes`. */
export interface CreateSolicitudInput {
  client: string;
  well: string;
  title: string;
  kind: SolicitudKind;
}

// ───────────── operacion ─────────────
/* ---------- Programación (GET /api/operacion/programacion) ---------- */

export interface ProgramacionQueueItem {
  folio: string;
  rawFolio: string;
  kind: string;
  client: string;
  place: string;
  due: string;
  dueType: 'urgent' | 'warning' | 'normal';
  instNote: string | null;
}

export interface ScheduleSlot {
  type: 'conf' | 'prog' | 'prop' | 'off';
  text: string;
  client: string;
}

export interface InspectorSchedule {
  name: string;
  zone: string;
  load: string;
  /** Lun–Vie de la semana consultada; `null` = día libre. */
  days: (ScheduleSlot | null)[];
}

export interface ProgramacionKpis {
  monthVisits: string;
  toSchedule: number;
  outOfWindow: number;
  inspectorsAvailable: string;
}

export interface SuggestedInspector {
  code: string;
  name: string;
  day: string;
  reasons: string[];
  /** Razón resaltada en verde (p. ej. disponibilidad de equipo). */
  highlight?: string;
}

export interface EquipmentOption {
  inv: string;
  label: string;
  disabled?: boolean;
}

export interface EquipmentSlot {
  key: string;
  label: string;
  options: EquipmentOption[];
  note: string;
  noteWarning?: boolean;
}

export interface ProgramacionData {
  queueItems: ProgramacionQueueItem[];
  inspectorsSchedule: InspectorSchedule[];
  /** Extensiones opcionales (no listadas en el contrato): si faltan, la vista las deriva u oculta. */
  weekLabel?: string;
  dayHeaders?: string[];
  kpis?: ProgramacionKpis;
  suggestedInspectors?: SuggestedInspector[];
  equipment?: EquipmentSlot[];
  defaultFecha?: string;
  defaultHora?: string;
}

/** Cuerpo de `POST /api/operacion/visitas` (claves = kwargs del método Odoo). */
export interface ConfirmarVisitaInput {
  folio: string;
  inspector_code: string;
  fecha: string;
  hora: string;
  send_outlook: boolean;
  send_client_email: boolean;
  /** Extensión: inventarios de equipo reservados. */
  equipo?: string[];
}

/* ---------- Préstamos (GET /api/operacion/prestamos) ---------- */

export interface ReturnItem {
  name: string;
  inv: string;
  received: boolean;
  accessories: boolean;
  works: boolean;
  issue: boolean;
  comment: string;
  target: string;
}

export interface LoanRow {
  folio: string;
  visitLabel: string;
  inspector: string;
  equipment: string;
  delivered: string;
  dueText: string;
  overdue?: boolean;
  /** Subtítulo del panel de devolución. */
  detail: string;
}

export interface PrestamosData {
  returnItems: ReturnItem[];
  loans: LoanRow[];
  pendingDeliveryCount: number;
  receiverName: string;
}

/** Cuerpo de `POST /api/operacion/prestamos/devolucion`. */
export interface RegistrarDevolucionInput {
  folio: string;
  items: ReturnItem[];
  /** Extensión: quién recibió en almacén. */
  recibio?: string;
}

/* ---------- Campo / PWA (PreviewView) ---------- */

export type RespuestaCampo = 'C' | 'NC' | 'NA';

export interface CampoSesion {
  folio: string;
  site: string;
  section: { n: string; name: string };
  totalPoints: number;
  currentPoint: number;
  point: { n: string; kind: string; ref: string; text: string; criterio: string };
  photos: string[];
  gps: string;
}

/** Cuerpo de `POST /api/operacion/campo/{folio}/respuesta`. */
export interface RespuestaCampoInput {
  punto: string;
  respuesta: RespuestaCampo;
  fotos: string[];
  /** Extensión: observaciones de campo. */
  observacion?: string;
}

/* ---------- Mapa del proceso (estático) ---------- */

export interface ProcesoStep {
  num: string;
  role: string;
  title: string;
  desc: string;
  target: ScreenKey;
  targetLabel: string;
}

// ───────────── calidad ─────────────
/** Extensión opcional de `InstrumentItem` con historial y trazabilidad (panel lateral). */
export interface InstrumentDetail extends InstrumentItem {
  calHistory?: { date: string; lab: string }[];
  usage?: { folio: string; label: string; date: string }[];
}

/** Cuerpo de `POST /api/calidad/instrumentos`. */
export interface CreateInstrumentoInput {
  type: string;
  brandModel: string;
  serial: string;
  invCode: string;
  calDueDate: string;
}

export interface CalibracionStep {
  id: number;
  title: string;
  req: boolean;
  done: boolean;
  date: string;
  comment: string;
}

export interface CalibracionInstrument {
  id: string;
  invCode: string;
  type: string;
  brandModel: string;
  serial: string;
  statusLabel: string;
  previousDueDate: string;
}

export interface CalibracionCertificado {
  labName: string;
  certNumber: string;
  calDate: string;
  vigencia: string;
  newDueDate: string;
  fileName: string | null;
  notes: string;
}

/** `GET /api/calidad/calibraciones/actual`. */
export interface CalibracionActual {
  /** id de `uva.calibracion` (para PUT pasos / POST completar). */
  id: string;
  instrument: CalibracionInstrument;
  steps: CalibracionStep[];
  certificate?: CalibracionCertificado;
}

/** Cuerpo de `POST /api/calidad/calibraciones/{id}/completar`. */
export interface CompletarCalibracionInput {
  cert_number: string;
  lab_name: string;
  /** Extensiones. */
  cal_date?: string;
  vigencia?: string;
  notes?: string;
}

// ───────────── dictaminacion ─────────────
// Tipos del servicio dictaminacion (svc-dictaminacion, /api/dictaminacion).

export interface BandejaKpi {
  label: string;
  count: number;
  id: string;
}

export interface BandejaExpediente {
  folio: string;
  rawFolio: string;
  client: string;
  site: string;
  who: string;
  date: string;
  kind: string;
  res: string;
  resType: 'ok' | 'nc';
  ev: string;
  st: string;
  stType: 'review' | 'back' | 'auth' | 'done' | 'inconforme';
  sla: string;
  slaUrgent: boolean;
  action: string;
  target: ScreenKey;
}

/** GET /dictaminacion/bandeja */
export interface BandejaData {
  kpis: BandejaKpi[];
  expedientes: BandejaExpediente[];
}

export interface RevisionStep {
  name: string;
  state: 'done' | 'active' | 'pending';
}

export interface RevisionSectionSummary {
  n: string;
  name: string;
  stat: string;
}

export interface RevisionPoint {
  n: string;
  text: string;
  extra: string;
  ans: 'C' | 'NC' | 'N/A';
  photos: string[];
  hasNote: boolean;
  note: string;
}

export interface RevisionCheck {
  ok: boolean;
  warn?: boolean;
  label: string;
  detail: string;
}

/** GET /dictaminacion/revision/{folio} */
export interface RevisionData {
  steps: RevisionStep[];
  sectionsSummary: RevisionSectionSummary[];
  pointsList: RevisionPoint[];
  checks: RevisionCheck[];
}

export type RevisionDecision = 'autorizar' | 'devolver' | 'inconforme';

/** GET /dictaminacion/dictamenes (elemento) */
export interface DictamenItem {
  no: string;
  folio: string;
  client: string;
  well: string;
  title: string;
  date: string;
  res: string;
  resType: 'ok' | 'nc';
  due: string;
  dueWarning: boolean;
  cn: string;
  cnType: 'pend' | 'done';
}

/** GET /dictaminacion/conagua (elemento). `id` = id de `uva.conagua.carga`. */
export interface ConaguaItem {
  id: string;
  no: string;
  client: string;
  well: string;
  title: string;
  res: string;
  resType: 'ok' | 'nc';
  authDate: string;
  days: string;
  st: string;
  stType: 'pend' | 'blue' | 'done';
  action: 'Cargar' | 'Enviar acuse' | 'Ver';
}

export interface ExpedienteFieldGroup {
  title: string;
  items: { k: string; v: string }[];
}

export interface ExpedienteDoc {
  folder: string;
  name: string;
  st: string;
  action: string;
}

export interface ExpedienteBotStep {
  n: number;
  title: string;
  desc: string;
}

export interface ExpedienteLogEntry {
  when: string;
  what: string;
  who: string;
}

/** GET /dictaminacion/expedientes/{folio} */
export interface ExpedienteData {
  groups: ExpedienteFieldGroup[];
  docs: ExpedienteDoc[];
  botSteps: ExpedienteBotStep[];
  logEntries: ExpedienteLogEntry[];
}

export type CargaConaguaModo = 'bot' | 'manual';
