// Datos mock del servicio catalogos (antes inline en UsuariosView, AltaFormatoView, EditorView y TiposView).
// Clientes, verificadores y formatos siguen en mockData.ts (mockClients, mockVerificadores, mockFormatos).
import type { AltaFormatoDefaults, FormatoEditorRef, FormatoEstructura, PerfilData, TiposData, UsuariosData } from '../types';

/* ---------- UsuariosView ---------- */

export const mockUsuarios: UsuariosData = {
  users: [
    { name: '[Administrador] Lic. Karla Pacheco', email: 'kpacheco@sistemauva.mx', roles: ['Administrador'], date: '19/10/2026', st: 'Activo' },
    { name: '[Gerente Técnico] Ing. Gerardo Torres', email: 'gtorres@sistemauva.mx', roles: ['Gerente Técnico', 'Administrador'], date: 'Hoy 08:14', st: 'Activo' },
    { name: '[Coordinador] Ing. Roberto Silva', email: 'rsilva@sistemauva.mx', roles: ['Coordinador'], date: 'Hoy 09:30', st: 'Activo' },
    { name: '[Encargado CONAGUA] Lic. Samuel Rivas', email: 'srivas@sistemauva.mx', roles: ['Registro CONAGUA'], date: 'Ayer 17:40', st: 'Activo' },
    { name: '[Inspector 1] Ing. Raúl Sánchez', email: 'rsanchez@sistemauva.mx', roles: ['Inspector'], date: '18/10/2026', st: 'Activo' },
    { name: '[Inspector 2] Ing. Ana María Torres', email: 'atorres@sistemauva.mx', roles: ['Inspector'], date: '19/10/2026', st: 'Activo' },
    { name: '[Inspector 3] Ing. Carlos Mendoza', email: 'cmendoza@sistemauva.mx', roles: ['Inspector'], date: 'Hoy 07:10', st: 'Activo' },
    { name: '[Responsable de equipos] Téc. Luis Navarro', email: 'lnavarro@sistemauva.mx', roles: ['Resp. equipos'], date: '18/10/2026', st: 'Activo' },
    { name: '[Dirección General] Dr. Alejandro Vega', email: 'avega@sistemauva.mx', roles: ['Consulta'], date: '16/10/2026', st: 'Activo' }
  ],
  rolesHeaders: ['Admin.', 'Coordinador', 'Inspector', 'Gerente Técnico', 'Registro CONAGUA', 'Resp. equipos', 'Consulta'],
  matrix: [
    { mod: 'Tablero', vals: ['V', 'V', 'V', 'V', 'V', 'V', 'V'] },
    { mod: 'Formatos', vals: ['E', '—', '—', 'A', '—', '—', 'V'] },
    { mod: 'Instrumentos', vals: ['E', 'V', 'V', 'E', '—', 'E', 'V'] },
    { mod: 'Calibración de instrumentos', vals: ['V', '—', '—', 'A', '—', 'E', 'V'] },
    { mod: 'Entrega y devolución de equipos', vals: ['V', 'V', 'V', '—', '—', 'E', 'V'] },
    { mod: 'Verificadores', vals: ['E', 'V', '—', 'E', '—', '—', 'V'] },
    { mod: 'Usuarios y roles', vals: ['E', '—', '—', '—', '—', '—', '—'] },
    { mod: 'Clientes y aprovechamientos', vals: ['E', 'E', 'V', 'V', 'V', '—', 'V'] },
    { mod: 'Solicitudes (F-12)', vals: ['E', 'E', 'V', 'V', '—', '—', 'V'] },
    { mod: 'Programación de visitas', vals: ['V', 'E', 'V', 'V', '—', 'V', 'V'] },
    { mod: 'Captura en campo', vals: ['—', '—', 'E', 'V', '—', '—', '—'] },
    { mod: 'Revisión técnica', vals: ['V', 'V', 'V', 'A', '—', '—', 'V'] },
    { mod: 'Carga a CONAGUA', vals: ['V', '—', '—', 'V', 'E', '—', 'V'] },
    { mod: 'Estadísticas', vals: ['V', 'V', '—', 'V', 'V', '—', 'V'] }
  ]
};

/* ---------- PerfilView ---------- */

export const mockPerfil: PerfilData = {
  name: 'Ing. Gerardo Torres',
  initials: 'GT',
  title: 'Gerente Técnico',
  email: 'gtorres@sistemauva.mx',
  login: 'gtorres',
  phone: '',
  tz: 'America/Mexico_City',
  roles: ['Gerente Técnico', 'Administrador'],
  lastAccess: 'Hoy 08:14',
  identityProvider: 'Microsoft 365 (Entra ID)',
  verificadorCode: '',
  prefs: { correo: true, teams: true, vencimientos: true, resumenDiario: false },
  // Mayor permiso entre las columnas "Gerente Técnico" y "Admin." de mockUsuarios.matrix
  permisos: mockUsuarios.matrix.map((row) => {
    const rank = ['—', 'V', 'E', 'A'];
    const best = [row.vals[0], row.vals[3]].reduce((a, b) => (rank.indexOf(b) > rank.indexOf(a) ? b : a), '—');
    return { mod: row.mod, val: best };
  })
};

/* ---------- AltaFormatoView ---------- */

export const mockAltaFormatoDefaults: AltaFormatoDefaults = {
  checklistItems: [
    { id: 1, text: 'Título de concesión o asignación', req: true, date: true, comment: true, file: true },
    { id: 2, text: 'Certificado o dictamen de calibración del medidor', req: true, date: true, comment: true, file: true },
    { id: 3, text: 'Factura del medidor', req: true, date: true, comment: true, file: true },
    { id: 4, text: 'Identificación del representante legal', req: true, date: true, comment: true, file: true },
    { id: 5, text: 'Manual de instalación del medidor', req: true, date: true, comment: true, file: true },
    { id: 6, text: 'Reporte de instalación del equipo', req: false, date: true, comment: true, file: true }
  ],
  wordFields: [
    { key: 'RazonSocial', mapTo: 'Cliente › Razón social' },
    { key: 'RFC', mapTo: 'Cliente › RFC' },
    { key: 'TituloConcesion', mapTo: 'Aprovechamiento › No. de título' },
    { key: 'NumeroDictamen', mapTo: 'Dictamen › Folio' },
    { key: 'Resultado', mapTo: 'Dictamen › Conforme / Inconforme' }
  ],
  sections: [
    { n: '1', name: 'Datos generales', count: '4 bloques' },
    { n: '2', name: 'Ubicación y características del medidor', count: '10 puntos' },
    { n: '3', name: 'Estación de aforo', count: '7 puntos' },
    { n: '4', name: 'Componentes del medidor', count: '35 puntos' },
    { n: '5', name: 'Determinación del gasto', count: 'Tabla Apéndice B' },
    { n: '6', name: 'Pruebas y verificaciones', count: '14 puntos' }
  ]
};

/* ---------- EditorView ---------- */

export const editorFormatoActual: FormatoEditorRef = {
  code: 'F-18-AC',
  shortCode: 'F-18',
  name: 'Lista de verificación de campo',
  version: '1.6',
  status: 'Borrador',
  defaultSection: '3',
  defaultPoint: '3.2'
};

export const mockFormatoEstructura: FormatoEstructura = {
  sections: [
    { n: '1', name: 'Datos generales', count: '4 bloques' },
    { n: '2', name: 'Ubicación y características', count: '10' },
    { n: '3', name: 'Estación de aforo', count: '7' },
    { n: '4', name: 'Componentes del medidor', count: '35' },
    { n: '5', name: 'Determinación del gasto', count: 'Ap. B' },
    { n: '6', name: 'Pruebas y verificaciones', count: '14' }
  ],
  points: [
    {
      n: '3.1',
      text: '¿El sitio de medición es un tramo recto de tubería circular de diámetro uniforme y sin obstrucciones?',
      kind: 'Visual',
      ref: '[7.1]',
      resp: 'Option box · C/NC/NA',
      ev: 'Foto obligatoria'
    },
    {
      n: '3.2',
      text: '¿El medidor está instalado de forma tal que el tubo esté lleno de agua bajo condiciones normales de operación?',
      kind: 'Visual',
      ref: '[7.1 a]',
      resp: 'Option box · C/NC/NA',
      ev: 'Foto obligatoria',
      criterion:
        'Se da por bueno si bajo condiciones normales de operación el tubo se encuentra lleno en la sección del medidor. Por ejemplo, con un arreglo en omega.'
    },
    {
      n: '3.3',
      text: '¿La posición del medidor es horizontal, o bien vertical siempre y cuando el gasto sea ascendente?',
      kind: 'Visual',
      ref: '[7.1 b]',
      resp: 'Option box · C/NC/NA',
      ev: 'Foto obligatoria'
    },
    {
      n: '3.4',
      text: 'Longitud del tramo de tubería y de los tramos aguas arriba y aguas abajo (L, L1, L2, L3).',
      kind: 'Medición',
      ref: '[7.1]',
      resp: 'Grupo + C/NC/NA por grupo',
      ev: 'Foto obligatoria'
    },
    {
      n: '3.5',
      text: 'No existen bifurcaciones o válvulas de seccionamiento antes de la ubicación del medidor.',
      kind: 'Visual',
      ref: '[7.1 e]',
      resp: 'Option box · C/NC/NA',
      ev: 'Foto si NC'
    },
    {
      n: '3.6',
      text: 'El sitio contiene las estructuras adecuadas que permiten la remoción del medidor.',
      kind: 'Visual',
      ref: '[7.1 f]',
      resp: 'Option box · C/NC/NA',
      ev: 'Foto si NC'
    },
    {
      n: '3.7',
      text: 'La ubicación del equipo permite el acceso sencillo para la toma de lectura.',
      kind: 'Visual',
      ref: '[7.1 g]',
      resp: 'Option box · C/NC/NA',
      ev: 'Foto si NC'
    }
  ]
};

/* ---------- TiposView ---------- */

export const mockTipos: TiposData = {
  panels: [
    {
      type: '1. Una sola opción (option box)',
      isOptions: true,
      values: ['C', 'NC', 'N/A'],
      uses: 'C/NC/NA en la mayoría de los puntos (2.3, 3.1–3.7, 4.1…). Otros valores: FTP / SMS (4.33), Subterránea / Superficial (2.2), Inicial / Periódica / Extraordinaria.'
    },
    {
      type: '2. Varias opciones (checkbox)',
      isOptions: true,
      values: ['GSM/GPRS/3G/4G/5G', 'Wi-Fi', 'Ethernet', 'Enlace satelital', 'Otro'],
      uses: '4.32 Tecnología empleada para la transmisión remota de mediciones a CONAGUA.'
    },
    {
      type: '3. Texto libre',
      isText: true,
      uses: 'Observaciones generales, 6.13 y 6.14 (folios de etiquetas y precintos colocados), nombre del representante presente.'
    },
    {
      type: '4. Grupo de campos con texto libre',
      isGroup: true,
      fields: [
        { label: 'Marca', max: 40 },
        { label: 'Modelo', max: 40 },
        { label: 'Número de serie', max: 30 }
      ],
      uses: 'Encabezados de 4.4 (unidad electrónica), 4.15 (memoria no volátil) y 4.22 (gabinete); 1.2 datos generales, 1.4 instrumentos, 2.1 coordenadas, sección 5.'
    },
    {
      type: '5. Grupo de campos + C/NC/NA por grupo',
      isGroup: true,
      hasEval: true,
      evalLabel: 'Una evaluación global para todo el grupo',
      fields: [
        { label: 'L (m)', max: 10 },
        { label: 'L1 (m)', max: 10 },
        { label: 'L2 (m)', max: 10 },
        { label: 'L3 (m)', max: 10 }
      ],
      uses: '3.4 longitudes de tramo recto, 6.1–6.5 voltajes y corriente de alimentación, 4.20 alimentación (DC / AC).'
    },
    {
      type: '6. Grupo de campos + C/NC/NA por punto',
      isGroup: true,
      perField: true,
      fields: [
        { label: 'Fecha (aaaammdd)', max: 8 },
        { label: 'Hora (hhmmss)', max: 6 },
        { label: 'Lectura acumulada (Lec)', max: 20 }
      ],
      uses: '4.6 variables de la unidad electrónica: cada campo lleva su propia evaluación independiente C/NC/NA.'
    }
  ],
  coverage: [
    { s: '1 · Datos generales', t: 'Grupo de campos con texto libre · Una sola opción (tipo de verificación, persona física o moral)' },
    { s: '2 · Ubicación y características', t: 'Grupo de campos (2.1 coordenadas) · Una sola opción (2.2 fuente) y C/NC/NA en 2.3–2.10' },
    { s: '3 · Estación de aforo', t: 'Una sola opción C/NC/NA · Grupo + C/NC/NA por grupo (3.4 longitudes de tramo)' },
    { s: '4 · Componentes del medidor', t: 'Grupo de campos (4.4, 4.15, 4.22) · C/NC/NA · por punto (4.6) · por grupo (4.20) · Varias opciones (4.32) · Una sola opción (4.33)' },
    { s: '5 · Determinación del gasto', t: 'Grupo de campos con texto libre (aforo volumétrico y velocidad de flujo)' },
    { s: '6 · Pruebas y verificaciones', t: 'Grupo + C/NC/NA por grupo (6.1–6.5) · C/NC/NA (6.6–6.12) · Texto libre (6.13, 6.14 precintos)' }
  ]
};
