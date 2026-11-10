import type { CampoSesion, PrestamosData, ProgramacionData } from '../types';

/* ---------------- Programación de visitas ---------------- */

export const mockProgramacion: ProgramacionData = {
  weekLabel: '19 – 23 de octubre',
  dayHeaders: ['Lun 19', 'Mar 20', 'Mié 21', 'Jue 22', 'Vie 23'],
  kpis: {
    monthVisits: '18 / 30',
    toSchedule: 4,
    outOfWindow: 1,
    inspectorsAvailable: '6 de 7'
  },
  defaultFecha: 'Mié 21 oct',
  defaultHora: '09:00',
  queueItems: [
    {
      folio: '[UVA-0010]',
      rawFolio: 'UVA-0010',
      kind: 'Periódica',
      client: '[Cliente H] Desarrollos Turísticos',
      place: 'Cancún, Q.Roo',
      due: 'Vencida hace 2 días',
      dueType: 'urgent',
      instNote: null
    },
    {
      folio: '[UVA-0012]',
      rawFolio: 'UVA-0012',
      kind: 'Inicial',
      client: '[Cliente G] Agroindustrias del Bajío',
      place: 'Irapuato, GTO',
      due: 'Programar antes del 26 oct',
      dueType: 'warning',
      instNote: 'Instalación + 30 días naturales: 29 oct'
    },
    {
      folio: '[UVA-0013]',
      rawFolio: 'UVA-0013',
      kind: 'Inicial',
      client: '[Cliente I] Invernaderos Michoacán',
      place: 'Uruapan, MICH',
      due: 'Programar antes del 30 oct',
      dueType: 'normal',
      instNote: 'Instalación + 30 días naturales: 3 nov'
    },
    {
      folio: '[UVA-0014]',
      rawFolio: 'UVA-0014',
      kind: 'Extraordinaria',
      client: '[Cliente J] Parque El Salto',
      place: 'El Salto, JAL',
      due: 'Programar antes del 2 nov',
      dueType: 'normal',
      instNote: null
    }
  ],
  inspectorsSchedule: [
    {
      name: '[Inspector 1] Raúl Sánchez',
      zone: 'Zona [A] Centro-Norte',
      load: '4 visitas este mes',
      days: [
        { type: 'conf', text: '[UVA-0007] · 09:00', client: 'Minera Sierra' },
        null,
        null,
        { type: 'prog', text: '[UVA-0009] · 10:00', client: 'Planta 2' },
        null
      ]
    },
    {
      name: '[Inspector 2] Ana María Torres',
      zone: 'Zona [A] Centro-Norte',
      load: '5 visitas este mes',
      days: [
        null,
        { type: 'conf', text: '[UVA-0008] · 08:30', client: 'Lácteos Norte' },
        null,
        null,
        { type: 'off', text: 'Capacitación EMA', client: 'Todo el día' }
      ]
    },
    {
      name: '[Inspector 3] Carlos Mendoza',
      zone: 'Zona [B] Bajío-Occidente',
      load: '3 visitas este mes',
      days: [
        null,
        null,
        { type: 'prop', text: '[UVA-0012] · 09:00', client: 'Propuesta · AgroBajío' },
        null,
        null
      ]
    },
    {
      name: '[Inspector 4] Laura Valdés',
      zone: 'Zona [B] Bajío-Occidente',
      load: '4 visitas este mes',
      days: [
        { type: 'prog', text: '[UVA-0005] · 09:00', client: 'Textil SM' },
        null,
        null,
        null,
        { type: 'conf', text: '[UVA-0011] · 11:00', client: 'Textil SM' }
      ]
    },
    {
      name: '[Inspector 5] Jorge Morales',
      zone: 'Zona [C] Noreste',
      load: '4 visitas este mes',
      days: [
        null,
        { type: 'prog', text: '[UVA-0006] · 09:30', client: 'Agro Export' },
        null,
        null,
        null
      ]
    },
    {
      name: '[Inspector 6] Diana Domínguez',
      zone: 'Zona [C] Noreste',
      load: '5 visitas este mes',
      days: [
        null,
        null,
        { type: 'conf', text: '[UVA-0004] · 10:00', client: 'Parque Salto' },
        null,
        null
      ]
    },
    {
      name: '[Inspector 7] Héctor Beltrán',
      zone: 'Zona [A] Centro-Norte',
      load: 'Vacaciones programadas',
      days: [
        { type: 'off', text: 'Vacaciones', client: '' },
        { type: 'off', text: 'Vacaciones', client: '' },
        { type: 'off', text: 'Vacaciones', client: '' },
        { type: 'off', text: 'Vacaciones', client: '' },
        { type: 'off', text: 'Vacaciones', client: '' }
      ]
    }
  ],
  suggestedInspectors: [
    {
      code: 'I3',
      name: '[Inspector 3] Carlos Mendoza',
      day: 'Mié 21',
      reasons: ['Misma zona: 28 km del pozo', 'Menor carga del mes (3 visitas)'],
      highlight: 'Equipo completo disponible ese día'
    },
    {
      code: 'I5',
      name: '[Inspector 5] Jorge Morales',
      day: 'Jue 22',
      reasons: ['Zona vecina: 84 km', '4 visitas este mes']
    }
  ],
  equipment: [
    {
      key: 'flexometro',
      label: 'Flexómetro',
      options: [
        { inv: 'INV-[0001]', label: 'INV-[0001] · Disponible (Stanley FatMax)' },
        { inv: 'INV-[0006]', label: 'INV-[0006] · Asignado a [Inspector 1] ese día', disabled: true }
      ],
      note: '✓ Disponible · calibración vigente'
    },
    {
      key: 'multimetro',
      label: 'Multímetro',
      options: [
        { inv: 'INV-[0002]', label: 'INV-[0002] · Disponible (Fluke 87V)' },
        { inv: 'INV-[0012]', label: 'INV-[0012] · Pendiente de devolución', disabled: true }
      ],
      note: '✓ Disponible · calibración vigente'
    },
    {
      key: 'gps',
      label: 'GPS',
      options: [
        { inv: 'INV-[0020]', label: 'INV-[0020] · Disponible (Garmin 65s)' },
        { inv: 'INV-[0011]', label: 'INV-[0011] · Calibración vencida (bloqueado)', disabled: true }
      ],
      note: '✓ Disponible · calibración vigente'
    },
    {
      key: 'flujometro',
      label: 'Flujómetro ultrasónico portátil',
      options: [
        { inv: 'INV-[0021]', label: 'INV-[0021] · Disponible (GE Sensing PT878)' },
        { inv: 'INV-[0004]', label: 'INV-[0004] · En calibración externa', disabled: true }
      ],
      note: '! Solo 1 disponible ese día: INV-[0021]',
      noteWarning: true
    }
  ]
};

/* ---------------- Entrega y devolución de equipos ---------------- */

export const mockPrestamos: PrestamosData = {
  pendingDeliveryCount: 2,
  receiverName: 'Téc. Luis Navarro [Responsable de equipos]',
  loans: [
    {
      folio: 'UVA-0012',
      visitLabel: 'Visita 21 oct',
      inspector: '[Inspector 3] Carlos Mendoza',
      equipment: 'Flexómetro, multímetro, GPS, flujómetro',
      delivered: '21/10 07:30 hrs',
      dueText: '23 oct',
      detail: 'Inspector 3 · Visita del 21 oct · entregado a las 07:30 hrs'
    },
    {
      folio: 'UVA-0008',
      visitLabel: 'Visita 20 oct',
      inspector: '[Inspector 2] Ana María Torres',
      equipment: 'Flexómetro, multímetro, GPS',
      delivered: '20/10 07:45 hrs',
      dueText: 'Vencido · se requiere el 22 oct',
      overdue: true,
      detail: 'Inspector 2 · Visita del 20 oct · entregado a las 07:45 hrs'
    },
    {
      folio: 'UVA-0006',
      visitLabel: 'Visita 20 oct',
      inspector: '[Inspector 5] Jorge Morales',
      equipment: 'Flexómetro, multímetro, GPS, flujómetro',
      delivered: '20/10 08:00 hrs',
      dueText: '22 oct',
      detail: 'Inspector 5 · Visita del 20 oct · entregado a las 08:00 hrs'
    }
  ],
  returnItems: [
    { name: 'Flexómetro', inv: 'INV-[0001]', received: true, accessories: true, works: true, issue: false, comment: '', target: 'Disponible' },
    { name: 'Multímetro industrial', inv: 'INV-[0002]', received: true, accessories: true, works: true, issue: false, comment: '', target: 'Disponible' },
    { name: 'GPS de precisión', inv: 'INV-[0020]', received: true, accessories: true, works: true, issue: false, comment: '', target: 'Disponible' },
    { name: 'Flujómetro ultrasónico', inv: 'INV-[0021]', received: true, accessories: false, works: true, issue: true, comment: 'Falta cable de sensor transductor B', target: 'Enviar a fuera de servicio' }
  ]
};

/* ---------------- App de campo (PWA) ---------------- */

export const mockCampoSesion: CampoSesion = {
  folio: 'UVA-0012',
  site: 'Pozo San Juan',
  section: { n: '3', name: 'Estación de aforo' },
  totalPoints: 7,
  currentPoint: 2,
  point: {
    n: '3.2',
    kind: 'Visual',
    ref: '[7.1 a]',
    text: '¿El medidor está instalado de forma tal que el tubo esté lleno de agua bajo condiciones normales de operación?',
    criterio:
      'Se da por bueno si bajo condiciones normales de operación el tubo se encuentra completamente lleno en la sección del medidor. Por ejemplo, con un arreglo en omega o elevación aguas abajo.'
  },
  photos: ['10:42:15 · 20.6736° N, 101.3563° W', '10:43:02 · 20.6737° N, 101.3562° W'],
  gps: '20.6736° N, 101.3564° W'
};
