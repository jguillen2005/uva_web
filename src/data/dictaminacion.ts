// Datos mock del servicio dictaminacion (antes inline en Bandeja/Revision/Dictamenes/Conagua/Expediente).
import type { BandejaData, ConaguaItem, DictamenItem, ExpedienteData, RevisionData } from '../types';

export const mockBandeja: BandejaData = {
  kpis: [
    { label: 'Por revisar', count: 3, id: 'Por revisar' },
    { label: 'Devueltos al verificador', count: 1, id: 'Devueltos al verificador' },
    { label: 'Autorizados', count: 2, id: 'Autorizados' },
    { label: 'Pendientes de carga CONAGUA', count: 2, id: 'Pendientes de carga CONAGUA' },
    { label: 'Con acuse este mes', count: 9, id: 'Con acuse este mes' }
  ],
  expedientes: [
    {
      folio: '[UVA-0001]',
      rawFolio: 'UVA-0001',
      client: '[Cliente A] Minera de la Sierra',
      site: '08ZAC100293 · Pozo 1 Beneficio',
      who: '[Verificador 1] Ing. Raúl Sánchez',
      date: '16/10/2026',
      kind: 'Inicial',
      res: 'Cumple',
      resType: 'ok',
      ev: '42 fotos · 6 docs',
      st: 'Por revisar',
      stType: 'review',
      sla: '2 días',
      slaUrgent: true,
      action: 'Revisar',
      target: 'Revision'
    },
    {
      folio: '[UVA-0002]',
      rawFolio: 'UVA-0002',
      client: '[Cliente B] Bebidas San Jerónimo',
      site: '08SLP102839 · Pozo Planta',
      who: '[Verificador 2] Ing. Ana María Torres',
      date: '14/10/2026',
      kind: 'Periódica',
      res: '3 NC',
      resType: 'nc',
      ev: '38 fotos · 5 docs',
      st: 'Por revisar',
      stType: 'review',
      sla: '6 días',
      slaUrgent: false,
      action: 'Revisar',
      target: 'Revision'
    },
    {
      folio: '[UVA-0003]',
      rawFolio: 'UVA-0003',
      client: '[Cliente C] Agrofrutícola del Centro',
      site: '08AGS109281 · Pozo 4',
      who: '[Verificador 1] Ing. Raúl Sánchez',
      date: '11/10/2026',
      kind: 'Inicial',
      res: 'Cumple',
      resType: 'ok',
      ev: '40 fotos · 6 docs',
      st: 'Devuelto',
      stType: 'back',
      sla: '4 días',
      slaUrgent: false,
      action: 'Ver comentarios',
      target: 'Revision'
    },
    {
      folio: '[UVA-0004]',
      rawFolio: 'UVA-0004',
      client: '[Cliente D] Tequilera Los Altos',
      site: '08JAL192830 · Pozo Maguey',
      who: '[Verificador 3] Ing. Carlos Mendoza',
      date: '08/10/2026',
      kind: 'Extraordinaria',
      res: 'Cumple',
      resType: 'ok',
      ev: '45 fotos · 7 docs',
      st: 'Autorizado',
      stType: 'auth',
      sla: '—',
      slaUrgent: false,
      action: 'Cargar a CONAGUA',
      target: 'Expediente'
    },
    {
      folio: '[UVA-0005]',
      rawFolio: 'UVA-0005',
      client: '[Cliente E] Papelera de Oriente',
      site: '08VER102938 · Pozo Calentador',
      who: '[Verificador 2] Ing. Ana María Torres',
      date: '02/10/2026',
      kind: 'Inicial',
      res: 'Cumple',
      resType: 'ok',
      ev: '41 fotos · 6 docs',
      st: 'Con acuse',
      stType: 'done',
      sla: '—',
      slaUrgent: false,
      action: 'Ver dictamen',
      target: 'Expediente'
    },
    {
      folio: '[UVA-0006]',
      rawFolio: 'UVA-0006',
      client: '[Cliente F] Textil Santa María',
      site: '08PUE104820 · Pozo Planta 3',
      who: '[Verificador 3] Ing. Carlos Mendoza',
      date: '28/09/2026',
      kind: 'Periódica',
      res: '1 NC',
      resType: 'nc',
      ev: '36 fotos · 5 docs',
      st: 'Dictamen inconforme',
      stType: 'inconforme',
      sla: '—',
      slaUrgent: false,
      action: 'Ver dictamen',
      target: 'Expediente'
    }
  ]
};

/** Revisión técnica por folio (sin corchetes). */
export const mockRevisiones: Record<string, RevisionData> = {
  'UVA-0001': {
    steps: [
      { name: 'Solicitud F-12', state: 'done' },
      { name: 'Visita en campo', state: 'done' },
      { name: 'Revisión técnica', state: 'active' },
      { name: 'Dictamen autorizado', state: 'pending' },
      { name: 'Cargado a CONAGUA', state: 'pending' },
      { name: 'Acuse enviado al cliente', state: 'pending' }
    ],
    sectionsSummary: [
      { n: '1', name: '1 Datos generales', stat: 'Completo' },
      { n: '2', name: '2 Medidor', stat: '10 C' },
      { n: '3', name: '3 Estación de aforo', stat: '6 C · 1 N/A · 1 nota' },
      { n: '4', name: '4 Componentes', stat: '33 C · 2 N/A' },
      { n: '5', name: '5 Gasto', stat: 'N/A (inicial)' },
      { n: '6', name: '6 Pruebas', stat: '12 C · 2 N/A' }
    ],
    pointsList: [
      {
        n: '3.1',
        text: '¿El sitio de medición es un tramo recto de tubería circular de diámetro uniforme y sin obstrucciones?',
        extra: 'Visual · [7.1]',
        ans: 'C',
        photos: ['foto_3.1_01.jpg', 'foto_3.1_02.jpg'],
        hasNote: false,
        note: ''
      },
      {
        n: '3.2',
        text: '¿El medidor está instalado de forma tal que el tubo esté lleno de agua bajo condiciones normales de operación?',
        extra: 'Visual · [7.1 a]',
        ans: 'C',
        photos: ['foto_3.2_01.jpg'],
        hasNote: true,
        note: 'La foto no permite ver el arreglo en omega completo. ¿Hay otra toma desde un ángulo más abierto? Si no, documentarlo en observaciones.'
      },
      {
        n: '3.3',
        text: '¿La posición del medidor es horizontal, o bien vertical siempre y cuando el gasto sea ascendente?',
        extra: 'Visual · [7.1 b]',
        ans: 'C',
        photos: ['foto_3.3_01.jpg'],
        hasNote: false,
        note: ''
      },
      {
        n: '3.4',
        text: 'Longitud del tramo de tubería y de los tramos aguas arriba y aguas abajo.',
        extra: 'Medición · L: 3.20 m · L1: 1.80 m · L2: 1.40 m · L3: 0.00 m · Cumple contra certificado',
        ans: 'C',
        photos: ['foto_3.4_01.jpg', 'foto_3.4_02.jpg'],
        hasNote: false,
        note: ''
      },
      {
        n: '3.5',
        text: 'No existen bifurcaciones o válvulas de seccionamiento antes de la ubicación del medidor.',
        extra: 'Visual · [7.1 e]',
        ans: 'N/A',
        photos: [],
        hasNote: false,
        note: ''
      }
    ],
    checks: [
      { ok: true, label: 'Datos del medidor coinciden con solicitud F-12', detail: 'Marca Krohne, modelo Waterflux, serie WF-2022-83921 y DN 150 mm' },
      { ok: true, label: 'Verificación inicial dentro de los 30 días', detail: 'Instalación: 29/09/2026 · Visita: 16/10/2026 (17 días transcurridos)' },
      { ok: true, label: 'Evidencias fotográficas obligatorias completas', detail: '42 fotografías con sello de agua y metadatos GPS válidos' },
      { ok: true, label: 'Instrumentos con calibración vigente al día de visita', detail: 'Flexómetro, multímetro, GPS y flujómetro vigentes ante EMA' },
      { ok: true, label: 'Firmas digitales completas', detail: 'Verificador, usuario / representante legal y 2 testigos de asistencia' },
      { ok: false, warn: true, label: 'Coordenadas GPS con leve variación respecto al título', detail: 'Diferencia de 28 metros calculada. Requiere ratificación en dictamen.' }
    ]
  }
};

export const mockDictamenes: DictamenItem[] = [
  {
    no: '[DV-0104]',
    folio: '[UVA-0004]',
    client: '[Cliente D] Tequilera Los Altos',
    well: 'Pozo Maguey',
    title: '08JAL192830',
    date: '08/10/2026',
    res: 'Conforme',
    resType: 'ok',
    due: '08/10/2028',
    dueWarning: false,
    cn: 'Pendiente de carga',
    cnType: 'pend'
  },
  {
    no: '[DV-0103]',
    folio: '[UVA-0005]',
    client: '[Cliente E] Papelera de Oriente',
    well: 'Pozo Calentador',
    title: '08VER102938',
    date: '02/10/2026',
    res: 'Conforme',
    resType: 'ok',
    due: '02/10/2028',
    dueWarning: false,
    cn: 'Con acuse',
    cnType: 'done'
  },
  {
    no: '[DV-0102]',
    folio: '[UVA-0006]',
    client: '[Cliente F] Textil Santa María',
    well: 'Pozo Planta 3',
    title: '08PUE104820',
    date: '28/09/2026',
    res: 'Inconforme · 1 NC',
    resType: 'nc',
    due: '—',
    dueWarning: false,
    cn: 'Con acuse',
    cnType: 'done'
  },
  {
    no: '[DV-0087]',
    folio: '[UVA-0051]',
    client: '[Cliente G] Agroindustrias del Bajío',
    well: 'Pozo 2 Invernadero',
    title: '08GTO128392',
    date: '20/11/2024',
    res: 'Conforme',
    resType: 'ok',
    due: 'En 45 días (20/11/2026)',
    dueWarning: true,
    cn: 'Con acuse',
    cnType: 'done'
  },
  {
    no: '[DV-0081]',
    folio: '[UVA-0047]',
    client: '[Cliente H] Desarrollos Turísticos',
    well: 'Pozo Suministro',
    title: '08QRO102931',
    date: '05/12/2024',
    res: 'Conforme',
    resType: 'ok',
    due: 'En 58 días (05/12/2026)',
    dueWarning: true,
    cn: 'Con acuse',
    cnType: 'done'
  }
];

export const mockConagua: ConaguaItem[] = [
  {
    id: 'cg1',
    no: '[DV-0104]',
    client: '[Cliente D] Tequilera Los Altos',
    well: 'Pozo Maguey',
    title: '08JAL192830',
    res: 'Conforme',
    resType: 'ok',
    authDate: '08/10/2026 · Ing. Gerardo Torres',
    days: '1 día',
    st: 'Pendiente de carga',
    stType: 'pend',
    action: 'Cargar'
  },
  {
    id: 'cg2',
    no: '[DV-0105]',
    client: '[Cliente A] Minera de la Sierra',
    well: 'Pozo Beneficio',
    title: '08ZAC100293',
    res: 'Conforme',
    resType: 'ok',
    authDate: '09/10/2026 · Ing. Gerardo Torres',
    days: '0 días (hoy)',
    st: 'Pendiente de carga',
    stType: 'pend',
    action: 'Cargar'
  },
  {
    id: 'cg3',
    no: '[DV-0102]',
    client: '[Cliente F] Textil Santa María',
    well: 'Pozo Planta 3',
    title: '08PUE104820',
    res: 'Inconforme',
    resType: 'nc',
    authDate: '28/09/2026 · Ing. Gerardo Torres',
    days: '—',
    st: 'Acuse por enviar al cliente',
    stType: 'blue',
    action: 'Enviar acuse'
  },
  {
    id: 'cg4',
    no: '[DV-0103]',
    client: '[Cliente E] Papelera de Oriente',
    well: 'Pozo Calentador',
    title: '08VER102938',
    res: 'Conforme',
    resType: 'ok',
    authDate: '02/10/2026 · Ing. Gerardo Torres',
    days: '—',
    st: 'Acuse enviado',
    stType: 'done',
    action: 'Ver'
  }
];

/** Expedientes (ficha del dictamen) por folio (sin corchetes). */
export const mockExpedientes: Record<string, ExpedienteData> = {
  'UVA-0004': {
    groups: [
      {
        title: 'Dictamen oficial',
        items: [
          { k: 'No. de dictamen', v: 'DV-0104' },
          { k: 'Fecha de emisión', v: '08/10/2026' },
          { k: 'Vigencia oficial', v: '08/10/2028 · 2 años' }
        ]
      },
      {
        title: 'Usuario y aprovechamiento',
        items: [
          { k: 'Razón social', v: '[Cliente D] Tequilera Los Altos, S.A. de C.V.' },
          { k: 'RFC', v: 'TLA091024HJ2' },
          { k: 'Título de concesión', v: '08JAL192830 · anexo 01' },
          { k: 'Identificador del pozo', v: 'ID-001 (Pozo Maguey)' },
          { k: 'Uso / fuente', v: 'Industrial · Subterránea' },
          { k: 'Volumen concesionado', v: '280,000 m³ anuales' }
        ]
      },
      {
        title: 'Sistema de medición',
        items: [
          { k: 'Medidor', v: 'Krohne Waterflux 3070 · NSM WF-2022-991' },
          { k: 'Unidad electrónica', v: 'NSUE-88210' },
          { k: 'Unidad de transmisión', v: 'NSUT-44810 · GSM · FTP' },
          { k: 'Diámetro nominal', v: '150 mm (6")' },
          { k: 'Certificado de calibración', v: 'Krohne México EMA · 10/05/2026' },
          { k: 'Coordenadas WGS84', v: '20.8124° N, 102.7641° W' }
        ]
      },
      {
        title: 'Seguridad y precintos',
        items: [
          { k: 'Holograma oficial UVA', v: 'Folio UVA-HOL-009214' },
          { k: 'Precintos numerados', v: 'Folios P-8821 y P-8822' },
          { k: 'Calcomanías de inviolabilidad', v: 'Folio CAL-9921' }
        ]
      }
    ],
    docs: [
      { folder: '01_Solicitud', name: 'Solicitud de servicio F-12 firmada', st: 'Listo', action: 'Ver' },
      { folder: '02_DocsCliente', name: 'Título, certificado calibración, factura medidor, manuales (6)', st: 'Listo', action: 'Ver' },
      { folder: '03_Campo', name: 'Lista de verificación F-18 firmada + 45 fotos + archivos interrogador', st: 'Listo', action: 'Ver' },
      { folder: '04_Dictamen', name: 'Dictamen F-17 firmado por el Gerente Técnico', st: 'Listo', action: 'Ver' },
      { folder: '05_Acuse', name: 'Acuse oficial de registro ante CONAGUA', st: 'Pendiente', action: 'Subir manual' }
    ],
    botSteps: [
      { n: 1, title: 'Preparar datos', desc: 'Valida que el dictamen esté autorizado y arma la trama para el portal.' },
      { n: 2, title: 'Iniciar sesión en portal CONAGUA', desc: 'Espera a que el usuario cargue la e.firma y resuelva el captcha.' },
      { n: 3, title: 'Capturar y adjuntar', desc: 'Llena el formulario con los datos del dictamen y adjunta el PDF.' },
      { n: 4, title: 'Descargar acuse', desc: 'Guarda el acuse oficial en 05_Acuse y registra el folio de carga.' },
      { n: 5, title: 'Enviar al cliente', desc: 'Envía el acuse y el dictamen por correo al contacto del cliente.' }
    ],
    logEntries: [
      { when: '08/10 16:30', what: 'Dictamen autorizado y firmado electrónicamente', who: 'Ing. Gerardo Torres [Gerente Técnico]' },
      { when: '08/10 12:15', what: 'Corrección sincronizada desde campo (foto adicional de precinto)', who: '[Verificador 3] Carlos Mendoza' },
      { when: '07/10 18:20', what: 'Devuelto en revisión: faltaba foto del precinto en bornera', who: 'Ing. Gerardo Torres [Gerente Técnico]' },
      { when: '07/10 14:10', what: 'Expediente sincronizado desde app (45 fotos y firmas completas)', who: '[Verificador 3] Carlos Mendoza' },
      { when: '25/09 11:00', what: 'Visita de campo asignada y equipos reservados', who: 'Ing. Roberto Silva [Coordinador]' },
      { when: '22/09 09:30', what: 'Solicitud F-12 registrada · cotización Aspel COT-8899', who: 'Ing. Roberto Silva [Coordinador]' }
    ]
  }
};
