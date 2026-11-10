import { AlertItem, ClientItem, FormatoItem, InstrumentItem, KPIItem, Solicitud, VerificadorItem } from '../types';

export const mockKPIs: KPIItem[] = [
  { label: 'Solicitudes activas', value: '6', sub: '6 esperando documentos', targetScreen: 'Solicitudes' },
  { label: 'Visitas esta semana', value: '7', sub: '1 sin equipo asignado', warning: true, targetScreen: 'Programacion' },
  { label: 'Por revisar', value: '3', sub: '1 vence en 2 días hábiles', warning: true, targetScreen: 'Bandeja' },
  { label: 'Por cargar a CONAGUA', value: '2', sub: 'Más antiguo: 1 día', targetScreen: 'Conagua' },
  { label: 'Equipos por devolver', value: '3', sub: '1 devolución vencida', warning: true, targetScreen: 'Prestamos' }
];

export const mockAlerts: AlertItem[] = [
  {
    id: 'a1',
    tag: 'Plazo 10 días',
    severity: 'red',
    title: '[UVA-0001] vence su plazo de resultados en 2 días hábiles',
    desc: 'En revisión técnica · [Cliente A]',
    actionText: 'Revisar',
    targetScreen: 'Revision'
  },
  {
    id: 'a2',
    tag: 'Programación',
    severity: 'red',
    title: '[UVA-0010] lleva más de 2 semanas sin programar',
    desc: 'Documentación completa desde 05/10/2026',
    actionText: 'Programar',
    targetScreen: 'Programacion'
  },
  {
    id: 'a3',
    tag: '30 días',
    severity: 'amber',
    title: '[UVA-0012] verificación inicial: la instalación cumple 30 días el 29 oct',
    desc: 'Visita programada el 21 oct · [Cliente G]',
    actionText: 'Ver',
    targetScreen: 'Programacion'
  },
  {
    id: 'a4',
    tag: 'Devolución',
    severity: 'amber',
    title: 'Equipo de [UVA-0008] no se ha devuelto y está reservado para el 22 oct',
    desc: '[Inspector 2] · flexómetro, multímetro, GPS',
    actionText: 'Registrar',
    targetScreen: 'Prestamos'
  },
  {
    id: 'a5',
    tag: 'Calibración',
    severity: 'amber',
    title: 'Flujómetro INV-[0004] en calibración; GPS INV-[0011] vencido',
    desc: 'Quedan 2 flujómetros disponibles',
    actionText: 'Ver equipos',
    targetScreen: 'Instrumentos'
  },
  {
    id: 'a6',
    tag: 'Competencia',
    severity: 'amber',
    title: '[Inspector 4]: calificación vence en 18 días',
    desc: 'Si vence, no se le pueden asignar visitas',
    actionText: 'Ver',
    targetScreen: 'Verificadores'
  },
  {
    id: 'a7',
    tag: 'Oportunidad',
    severity: 'blue',
    title: '4 dictámenes de clientes vencen en los próximos 60 días',
    desc: 'Proponer verificación periódica conforme a NMX-AA-179',
    actionText: 'Ver clientes',
    targetScreen: 'Clientes'
  }
];

export const mockStages = [
  { name: 'Documentación pendiente', count: 6, max: 9 },
  { name: 'Por programar', count: 4, max: 9 },
  { name: 'Programadas', count: 7, max: 9 },
  { name: 'En campo / sincronizar', count: 2, max: 9 },
  { name: 'En revisión técnica', count: 3, max: 9 },
  { name: 'Por cargar a CONAGUA', count: 2, max: 9 },
  { name: 'Acuse enviado (mes)', count: 9, max: 9 }
];

export const mockTodayVisits = [
  { time: '09:00', folio: 'UVA-0012', client: 'Agroindustrias del Bajío, S.A. de C.V. [Cliente G]', inspector: 'Ing. Carlos Mendoza [Inspector 3]' },
  { time: '11:00', folio: 'UVA-0011', client: 'Textil Santa María, S.A. de C.V. [Cliente F]', inspector: 'Ing. Laura Valdés [Inspector 4]' }
];

export const mockSolicitudes: Solicitud[] = [
  {
    id: 's1',
    folio: '[UVA-0016]',
    client: '[Cliente L] Lácteos y Quesos del Norte',
    well: 'Pozo Rancho Los Encinos (ID-001)',
    title: '08ZAC104928/12FMDL18',
    kind: 'Periódica',
    quote: 'COT-8921 · enviada',
    quoteStatus: 'enviada',
    docsCount: 0,
    totalDocs: 6,
    status: 'En cotización',
    registeredDate: '18/10/2026',
    coordinator: 'Ing. Roberto Silva',
    docs: [
      { id: 'd1', name: 'Título de concesión o asignación', complete: false, required: true },
      { id: 'd2', name: 'Certificado o dictamen de calibración del medidor', complete: false, required: true },
      { id: 'd3', name: 'Factura del medidor', complete: false, required: true },
      { id: 'd4', name: 'Identificación del representante legal', complete: false, required: true },
      { id: 'd5', name: 'Manual de instalación del medidor', complete: false, required: true },
      { id: 'd6', name: 'Reporte de instalación del equipo', complete: false, required: false }
    ]
  },
  {
    id: 's2',
    folio: '[UVA-0015]',
    client: '[Cliente K] Agrícola San Pedro SPR de RL',
    well: 'Pozo Agrícola San Pedro #2',
    title: '08SON153921/09HGR81',
    kind: 'Inicial',
    quote: 'COT-8914 · aprobada',
    quoteStatus: 'aprobada',
    docsCount: 4,
    totalDocs: 6,
    status: 'Documentación pendiente',
    registeredDate: '15/10/2026',
    coordinator: 'Lic. Mariana Gómez',
    docs: [
      { id: 'd1', name: 'Título de concesión o asignación', complete: true, required: true, filename: 'Titulo_Concesion_08SON.pdf' },
      { id: 'd2', name: 'Certificado o dictamen de calibración del medidor', complete: true, required: true, filename: 'Cert_Calib_Krohne_2026.pdf' },
      { id: 'd3', name: 'Factura del medidor', complete: true, required: true, filename: 'Factura_A-4921.pdf' },
      { id: 'd4', name: 'Identificación del representante', complete: true, required: true, filename: 'INE_RepLegal.pdf' },
      { id: 'd5', name: 'Manual de instalación del medidor', complete: false, required: true },
      { id: 'd6', name: 'Reporte de instalación del equipo', complete: false, required: false }
    ]
  },
  {
    id: 's3',
    folio: '[UVA-0014]',
    client: '[Cliente J] Parque Industrial El Salto',
    well: 'Pozo Suministro Sector B',
    title: '08JAL193821/11EGR14',
    kind: 'Extraordinaria',
    quote: 'COT-8899 · aprobada',
    quoteStatus: 'aprobada',
    docsCount: 6,
    totalDocs: 6,
    status: 'Lista para programar',
    registeredDate: '12/10/2026',
    coordinator: 'Ing. Roberto Silva',
    docs: [
      { id: 'd1', name: 'Título de concesión o asignación', complete: true, required: true },
      { id: 'd2', name: 'Certificado o dictamen de calibración del medidor', complete: true, required: true },
      { id: 'd3', name: 'Factura del medidor', complete: true, required: true },
      { id: 'd4', name: 'Identificación del representante', complete: true, required: true },
      { id: 'd5', name: 'Manual de instalación del medidor', complete: true, required: true },
      { id: 'd6', name: 'Reporte de instalación del equipo', complete: true, required: true }
    ]
  },
  {
    id: 's4',
    folio: '[UVA-0013]',
    client: '[Cliente I] Invernaderos de Michoacán',
    well: 'Pozo Las Huertas #1',
    title: '08MCH103810/08MDR99',
    kind: 'Inicial',
    quote: 'COT-8890 · aprobada',
    quoteStatus: 'aprobada',
    docsCount: 6,
    totalDocs: 6,
    status: 'Lista para programar',
    registeredDate: '10/10/2026',
    coordinator: 'Lic. Mariana Gómez',
    docs: [
      { id: 'd1', name: 'Título de concesión o asignación', complete: true, required: true },
      { id: 'd2', name: 'Certificado o dictamen de calibración del medidor', complete: true, required: true },
      { id: 'd3', name: 'Factura del medidor', complete: true, required: true },
      { id: 'd4', name: 'Identificación del representante', complete: true, required: true },
      { id: 'd5', name: 'Manual de instalación del medidor', complete: true, required: true },
      { id: 'd6', name: 'Reporte de instalación del equipo', complete: true, required: true }
    ]
  },
  {
    id: 's5',
    folio: '[UVA-0012]',
    client: '[Cliente G] Agroindustrias del Bajío, S.A.',
    well: 'Pozo ID-001 San Juan',
    title: '08GTO128392/12HMDA19',
    kind: 'Inicial',
    quote: 'COT-8865 · aprobada',
    quoteStatus: 'aprobada',
    docsCount: 6,
    totalDocs: 6,
    status: 'Programada',
    dateStr: 'Mié 21 oct',
    registeredDate: '01/10/2026',
    coordinator: 'Ing. Roberto Silva',
    docs: [
      { id: 'd1', name: 'Título de concesión o asignación', complete: true, required: true },
      { id: 'd2', name: 'Certificado o dictamen de calibración del medidor', complete: true, required: true },
      { id: 'd3', name: 'Factura del medidor', complete: true, required: true },
      { id: 'd4', name: 'Identificación del representante', complete: true, required: true },
      { id: 'd5', name: 'Manual de instalación del medidor', complete: true, required: true },
      { id: 'd6', name: 'Reporte de instalación del equipo', complete: true, required: true }
    ]
  },
  {
    id: 's6',
    folio: '[UVA-0011]',
    client: '[Cliente F] Textil Santa María, S.A.',
    well: 'Pozo Planta 3',
    title: '08PUE104820/10HGR23',
    kind: 'Periódica',
    quote: 'COT-8850 · aprobada',
    quoteStatus: 'aprobada',
    docsCount: 2,
    totalDocs: 6,
    status: 'Esperando pago',
    registeredDate: '28/09/2026',
    coordinator: 'Lic. Mariana Gómez',
    docs: [
      { id: 'd1', name: 'Título de concesión o asignación', complete: true, required: true },
      { id: 'd2', name: 'Certificado o dictamen de calibración del medidor', complete: true, required: true },
      { id: 'd3', name: 'Factura del medidor', complete: false, required: true },
      { id: 'd4', name: 'Identificación del representante', complete: false, required: true },
      { id: 'd5', name: 'Manual de instalación del medidor', complete: false, required: true },
      { id: 'd6', name: 'Reporte de instalación del equipo', complete: false, required: false }
    ]
  }
];

export const mockClients: ClientItem[] = [
  {
    id: 'c-A',
    name: '[Cliente A] Minera de la Sierra, S.A. de C.V.',
    rfc: 'MSI980412KJ1',
    fiscalType: 'Persona moral',
    fiscalAddress: 'Av. Hidalgo 1240, Col. Centro, Zacatecas, ZAC, C.P. 98000',
    aspelCode: 'CLI-00142',
    legalRep: 'Ing. Fernando Treviño Garza',
    noticeContact: 'contacto@minerasierra.com · (492) 839-2010',
    phone: '(492) 839-2010',
    sharePointFolder: '/Clientes/MSI980412KJ1',
    wells: [
      {
        id: '[ID-001]',
        name: '[Pozo 1 - Beneficio]',
        concessionTitle: '08ZAC100293',
        annex: '01',
        use: 'Industrial',
        source: 'Subterránea',
        annualVolume: '450,000 m³',
        coords: '22.7709° N, 102.5832° W',
        dischargeDiameter: '150 mm (6")',
        meterBrand: 'Krohne',
        meterModel: 'Waterflux 3070',
        meterSerial: 'WF-2022-83921',
        meterDN: '150',
        installationDate: '15/03/2023',
        supplierInvoice: 'Krohne México · Factura A-3920',
        electronicUnitSerial: 'NSUE-99214',
        transmissionUnitSerial: 'NSUT-44819',
        lastInspection: 'Conforme',
        lastInspectionDate: '24/10/2024',
        nextInspectionDue: 'Periódica: 24/10/2026'
      },
      {
        id: '[ID-002]',
        name: '[Pozo 2 - Servicios]',
        concessionTitle: '08ZAC100293',
        annex: '02',
        use: 'Servicios',
        source: 'Subterránea',
        annualVolume: '120,000 m³',
        coords: '22.7745° N, 102.5801° W',
        dischargeDiameter: '100 mm (4")',
        meterBrand: 'Endress+Hauser',
        meterModel: 'Promag W 400',
        meterSerial: 'EH-8839201',
        meterDN: '100',
        installationDate: '10/06/2024',
        supplierInvoice: 'E+H México · Factura B-1102',
        electronicUnitSerial: 'NSUE-10492',
        transmissionUnitSerial: 'NSUT-55912',
        lastInspection: 'Conforme',
        lastInspectionDate: '12/08/2024',
        nextInspectionDue: 'Periódica: 12/08/2026'
      }
    ]
  },
  {
    id: 'c-B',
    name: '[Cliente B] Bebidas y Embotelladora San Jerónimo',
    rfc: 'BSJ040819TX3',
    fiscalType: 'Persona moral',
    fiscalAddress: 'Carretera Central km 14.5, San Luis Potosí, SLP',
    aspelCode: 'CLI-00201',
    legalRep: 'Lic. Patricia Alarcón R.',
    noticeContact: 'medicion@embotelladorasj.com · (444) 912-3840',
    phone: '(444) 912-3840',
    sharePointFolder: '/Clientes/BSJ040819TX3',
    wells: [
      {
        id: '[ID-001]',
        name: '[Pozo Planta Embotellado]',
        concessionTitle: '08SLP102839',
        annex: '01',
        use: 'Industrial',
        source: 'Subterránea',
        annualVolume: '380,000 m³',
        coords: '22.1565° N, 100.9855° W',
        dischargeDiameter: '150 mm',
        meterBrand: 'Siemens',
        meterModel: 'MAG 8000',
        meterSerial: 'SIE-891024',
        meterDN: '150',
        installationDate: '20/01/2023',
        supplierInvoice: 'Siemens México · Factura 4409',
        electronicUnitSerial: 'NSUE-88129',
        transmissionUnitSerial: 'NSUT-12903',
        lastInspection: 'Conforme',
        lastInspectionDate: '05/11/2024',
        nextInspectionDue: 'Periódica: 05/11/2026'
      }
    ]
  },
  {
    id: 'c-G',
    name: '[Cliente G] Agroindustrias del Bajío, S.A. de C.V.',
    rfc: 'ABA091012KL8',
    fiscalType: 'Persona moral',
    fiscalAddress: 'Calzada de los Héroes 450, Col. Centro, Irapuato, GTO, C.P. 36500',
    aspelCode: 'CLI-00389',
    legalRep: 'Ing. Salvador Mora Villalobos',
    noticeContact: 'smora@agrobajio.com.mx · (462) 624-9000',
    phone: '(462) 624-9000',
    sharePointFolder: '/Clientes/ABA091012KL8',
    wells: [
      {
        id: '[ID-001]',
        name: '[Pozo 1 - Riego Tecnificado]',
        concessionTitle: '08GTO128392',
        annex: '01',
        use: 'Agrícola',
        source: 'Subterránea',
        annualVolume: '620,000 m³',
        coords: '20.6736° N, 101.3563° W',
        dischargeDiameter: '200 mm (8")',
        meterBrand: 'Krohne',
        meterModel: 'Waterflux 3070 F',
        meterSerial: 'WF-2023-99120',
        meterDN: '200',
        installationDate: '29/09/2026',
        supplierInvoice: 'Krohne México · Factura KM-9428',
        electronicUnitSerial: 'NSUE-78219',
        transmissionUnitSerial: 'NSUT-39102',
        lastInspection: 'Conforme · 20/10/2024',
        lastInspectionDate: '20/10/2024',
        nextInspectionDue: 'Periódica: 20/10/2026'
      },
      {
        id: '[ID-002]',
        name: '[Pozo 2 - Invernadero Norte]',
        concessionTitle: '08GTO128392',
        annex: '02',
        use: 'Agrícola',
        source: 'Subterránea',
        annualVolume: '340,000 m³',
        coords: '20.6811° N, 101.3490° W',
        dischargeDiameter: '150 mm (6")',
        meterBrand: 'Badger Meter',
        meterModel: 'M-2000 Mag Meter',
        meterSerial: 'BM-2022-7718',
        meterDN: '150',
        installationDate: '14/11/2022',
        supplierInvoice: 'Equipos Hidráulicos · Factura EH-301',
        electronicUnitSerial: 'NSUE-66291',
        transmissionUnitSerial: 'NSUT-88192',
        lastInspection: 'Conforme · 18/11/2024',
        lastInspectionDate: '18/11/2024',
        nextInspectionDue: 'Periódica: en 11 días',
        nextInspectionUrgent: true
      },
      {
        id: '[ID-003]',
        name: '[Pozo 3 - Empacadora]',
        concessionTitle: '08GTO128392',
        annex: '03',
        use: 'Agroindustrial',
        source: 'Subterránea',
        annualVolume: '180,000 m³',
        coords: '20.6790° N, 101.3520° W',
        dischargeDiameter: '100 mm (4")',
        meterBrand: 'Endress+Hauser',
        meterModel: 'Promag W 400',
        meterSerial: 'EH-2026-00492',
        meterDN: '100',
        installationDate: '01/10/2026',
        supplierInvoice: 'E+H México · Factura 89201',
        electronicUnitSerial: 'NSUE-90182',
        transmissionUnitSerial: 'NSUT-90183',
        lastInspection: 'Sin verificación previa',
        lastInspectionDate: '—',
        nextInspectionDue: 'Inicial en proceso ([UVA-0012])',
        activeFolio: 'UVA-0012'
      }
    ]
  },
  {
    id: 'c-H',
    name: '[Cliente H] Desarrollos Turísticos Punta Paraíso',
    rfc: 'DTP120309QA4',
    fiscalType: 'Persona moral',
    fiscalAddress: 'Blvd. Kukulcán km 19, Cancún, Q.Roo',
    aspelCode: 'CLI-00412',
    legalRep: 'Arq. Mónica Estrada Solís',
    noticeContact: 'mantenimiento@puntaparaiso.com',
    phone: '(998) 881-4000',
    sharePointFolder: '/Clientes/DTP120309QA4',
    wells: []
  },
  {
    id: 'c-K',
    name: '[Cliente K] Agrícola San Pedro SPR de RL',
    rfc: 'ASP150720MN2',
    fiscalType: 'Persona moral',
    fiscalAddress: 'Valle del Yaqui s/n, Cd. Obregón, SON',
    aspelCode: 'CLI-00445',
    legalRep: 'Don Pedro Ochoa Valenzuela',
    noticeContact: 'pochoa@agricolasanpedro.com',
    phone: '(644) 410-2918',
    sharePointFolder: '/Clientes/ASP150720MN2',
    wells: []
  },
  {
    id: 'c-L',
    name: '[Cliente L] Lácteos y Quesos del Norte, S.A.',
    rfc: 'LQN180902KK9',
    fiscalType: 'Persona moral',
    fiscalAddress: 'Av. Industrial 800, Cuauhtémoc, CHIH',
    aspelCode: 'CLI-00510',
    legalRep: 'Ing. Gerhard Dyck Penner',
    noticeContact: 'calidad@lacteosnorte.mx',
    phone: '(625) 581-3000',
    sharePointFolder: '/Clientes/LQN180902KK9',
    wells: []
  }
];

export const mockInstruments: InstrumentItem[] = [
  { id: 'i1', type: 'Flexómetro', brandModel: 'Stanley FatMax 10m', serial: 'ST-991024', invCode: 'INV-[0001]', assignedTo: '[Inspector 3] Ing. Carlos Mendoza', calDueDate: '14/11/2026', status: 'Vigente', labName: 'Metrología Integral del Centro, S.A.', certNumber: 'MIC-2025-FL-081', calDate: '14/11/2025' },
  { id: 'i2', type: 'Multímetro', brandModel: 'Fluke 87V Industrial', serial: 'FL-882910', invCode: 'INV-[0002]', assignedTo: '[Inspector 3] Ing. Carlos Mendoza', calDueDate: '08/01/2027', status: 'Vigente', labName: 'Laboratorios Metrológicos Acreditados EMA', certNumber: 'LMA-EL-2026-112', calDate: '08/01/2026' },
  { id: 'i3', type: 'GPS', brandModel: 'Garmin GPSMAP 66sr', serial: 'GM-772910', invCode: 'INV-[0003]', assignedTo: '[Inspector 3] Ing. Carlos Mendoza', calDueDate: '22/02/2027', status: 'Vigente', labName: 'Centro Nacional de Metrología (CENAM)', certNumber: 'CEN-GEO-26-094', calDate: '22/02/2026' },
  { id: 'i4', type: 'Flujómetro ultrasónico portátil', brandModel: 'Flexim FLUXUS F601', serial: 'FX-601-8841', invCode: 'INV-[0004]', assignedTo: '[Inspector 3] Ing. Carlos Mendoza', calDueDate: '12/11/2026', status: 'Por vencer', labName: 'Krohne Calibration Center EMA', certNumber: 'KCC-FLUX-2025-44', calDate: '12/11/2025' },
  { id: 'i5', type: 'GPS', brandModel: 'Garmin Montana 700', serial: 'GM-551029', invCode: 'INV-[0011]', assignedTo: '[Inspector 5] Ing. Jorge Morales', calDueDate: '18/09/2026', status: 'Vencido', labName: 'Metrología Integral EMA', certNumber: 'MIC-2024-GEO-19', calDate: '18/09/2024' },
  { id: 'i6', type: 'Multímetro', brandModel: 'Fluke 179 True-RMS', serial: 'FL-330192', invCode: 'INV-[0012]', assignedTo: '[Inspector 5] Ing. Jorge Morales', calDueDate: '04/05/2027', status: 'Vigente', labName: 'Laboratorios EMA', certNumber: 'EMA-8829-E', calDate: '04/05/2026' },
  { id: 'i7', type: 'GPS', brandModel: 'Garmin GPSMAP 65s', serial: 'GM-440192', invCode: 'INV-[0020]', assignedTo: 'Sin asignar (en almacén)', calDueDate: '15/04/2027', status: 'Disponible', labName: 'CENAM', certNumber: 'CEN-2026-99', calDate: '15/04/2026' },
  { id: 'i8', type: 'Flujómetro ultrasónico portátil', brandModel: 'GE Sensing PT878', serial: 'GE-991028', invCode: 'INV-[0021]', assignedTo: 'En calibración (Lab Externo)', calDueDate: '—', status: 'En calibración', labName: 'Metrología Avanzada de Flujo', certNumber: 'En proceso', calDate: '—' }
];

export const mockVerificadores: VerificadorItem[] = [
  { id: 'v1', code: 'I1', name: '[Inspector 1] Ing. Raúl Sánchez', email: 'rsanchez@sistemauva.mx', zone: 'Zona [A] Centro-Norte', compStatus: 'Vigente', compDueText: 'Vigente a 15/08/2027', monthlyVisits: 4, monthlyTarget: 5, assignedKit: 'Completo', status: 'Activo', maxWeeklyVisits: 2, equipmentDesc: 'Laptop Dell Rugged y Samsung Galaxy XCover', activeLoans: [{ name: 'Flexómetro', inv: 'INV-0005', status: 'Vigente' }, { name: 'Multímetro', inv: 'INV-0008', status: 'Vigente' }, { name: 'GPS', inv: 'INV-0010', status: 'Vigente' }] },
  { id: 'v2', code: 'I2', name: '[Inspector 2] Ing. Ana María Torres', email: 'atorres@sistemauva.mx', zone: 'Zona [A] Centro-Norte', compStatus: 'Vigente', compDueText: 'Vigente a 20/09/2027', monthlyVisits: 5, monthlyTarget: 5, assignedKit: 'Completo', status: 'Activo', maxWeeklyVisits: 2, equipmentDesc: 'Laptop Lenovo ThinkPad y Celular Cat S62', activeLoans: [{ name: 'Flexómetro', inv: 'INV-0006', status: 'Vigente' }, { name: 'Multímetro', inv: 'INV-0009', status: 'Vigente' }, { name: 'GPS', inv: 'INV-0015', status: 'Vigente' }] },
  { id: 'v3', code: 'I3', name: '[Inspector 3] Ing. Carlos Mendoza', email: 'cmendoza@sistemauva.mx', zone: 'Zona [B] Bajío-Occidente', compStatus: 'Vigente', compDueText: 'Vigente a 10/12/2027', monthlyVisits: 3, monthlyTarget: 5, assignedKit: '1 por vencer', status: 'Activo', maxWeeklyVisits: 2, equipmentDesc: 'Laptop Dell Latitude y Celular Samsung Pro', activeLoans: [{ name: 'Flexómetro', inv: 'INV-0001', status: 'Vigente' }, { name: 'Multímetro', inv: 'INV-0002', status: 'Vigente' }, { name: 'GPS', inv: 'INV-0003', status: 'Vigente' }, { name: 'Flujómetro ultrasónico', inv: 'INV-0004', status: 'Por vencer' }] },
  { id: 'v4', code: 'I4', name: '[Inspector 4] Ing. Laura Valdés', email: 'lvaldes@sistemauva.mx', zone: 'Zona [B] Bajío-Occidente', compStatus: 'Por vencer', compDueText: 'Vence en 18 días (25/11/2026)', monthlyVisits: 4, monthlyTarget: 5, assignedKit: 'Completo', status: 'Activo', maxWeeklyVisits: 2, equipmentDesc: 'Laptop HP EliteBook y Celular XCover', activeLoans: [{ name: 'Flexómetro', inv: 'INV-0007', status: 'Vigente' }, { name: 'Multímetro', inv: 'INV-0014', status: 'Vigente' }] },
  { id: 'v5', code: 'I5', name: '[Inspector 5] Ing. Jorge Morales', email: 'jmorales@sistemauva.mx', zone: 'Zona [C] Noreste-Pacífico', compStatus: 'Vigente', compDueText: 'Vigente a 04/04/2027', monthlyVisits: 4, monthlyTarget: 5, assignedKit: 'GPS vencido', status: 'Activo', maxWeeklyVisits: 2, equipmentDesc: 'Laptop Dell y Celular Rugged', activeLoans: [{ name: 'Flexómetro', inv: 'INV-0013', status: 'Vigente' }, { name: 'GPS', inv: 'INV-0011', status: 'Vigente' }] },
  { id: 'v6', code: 'I6', name: '[Inspector 6] Ing. Diana Domínguez', email: 'ddominguez@sistemauva.mx', zone: 'Zona [C] Noreste-Pacífico', compStatus: 'Vigente', compDueText: 'Vigente a 14/06/2027', monthlyVisits: 5, monthlyTarget: 5, assignedKit: 'Completo', status: 'Activo', maxWeeklyVisits: 2, equipmentDesc: 'Laptop Lenovo y Celular Cat', activeLoans: [{ name: 'Kit completo estándar', inv: 'KIT-06', status: 'Vigente' }] },
  { id: 'v7', code: 'I7', name: '[Inspector 7] Ing. Héctor Beltrán', email: 'hbeltran@sistemauva.mx', zone: 'Zona [A] Centro-Norte', compStatus: 'Vigente', compDueText: 'Vigente a 30/11/2027', monthlyVisits: 0, monthlyTarget: 5, assignedKit: 'Completo', status: 'Vacaciones', maxWeeklyVisits: 2, equipmentDesc: 'Laptop en resguardo de almacén', activeLoans: [], vacations: '19 oct – 30 oct' }
];

export const mockFormatos: FormatoItem[] = [
  { id: 'f1', code: 'F-12-AC', name: 'Solicitud de servicio', subtitle: 'Contrato y datos del cliente', stage: 'Contratación', version: '1.2', structureType: 'Plantilla Word', structureDetail: 'Variables de contrato y firma', status: 'Vigente', modifiedDate: '12/04/2026' },
  { id: 'f2', code: 'CL-DOC', name: 'Lista de verificación de documentación requerida', subtitle: 'Se muestra en Solicitudes › Documentos del cliente', stage: 'Solicitud', version: '1.0', structureType: 'Check list', structureDetail: '6 rubros obligatorios', status: 'Vigente', modifiedDate: '01/02/2026' },
  { id: 'f3', code: 'F-18-AC', name: 'Lista de verificación de campo', subtitle: 'Numeral 10 · NMX-AA-179-SCFI-2018', stage: 'Campo', version: '1.5', structureType: 'Cuestionario con secciones', structureDetail: '6 secciones · 72 puntos', status: 'Vigente', modifiedDate: '15/06/2026' },
  { id: 'f4', code: 'F-18-AC', name: 'Lista de verificación de campo', subtitle: 'Ajuste de criterios sección 4 (opresores y sellos)', stage: 'Campo', version: '1.6', structureType: 'Cuestionario con secciones', structureDetail: '6 secciones · 72 puntos', status: 'En aprobación', modifiedDate: '14/10/2026' },
  { id: 'f5', code: 'F-17-AC', name: 'Dictamen de verificación', subtitle: 'Resultado conforme o inconforme oficial', stage: 'Emisión', version: '2.0', structureType: 'Plantilla Word', structureDetail: 'Firma electrónica y sellos CONAGUA', status: 'Vigente', modifiedDate: '10/05/2026' },
  { id: 'f6', code: 'CL-CAL', name: 'Lista de verificación de calibración de equipos', subtitle: 'Se muestra en Instrumentos › Registrar calibración', stage: 'Calibración', version: '1.0', structureType: 'Check list', structureDetail: '9 pasos normativos', status: 'Vigente', modifiedDate: '20/03/2026' }
];
