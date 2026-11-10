import type { CalibracionActual, InstrumentDetail } from '../types';
import { mockInstruments } from './mockData';

/** Historial y trazabilidad que el prototipo muestra en el panel de cada instrumento. */
const mockCalHistory = [
  { date: '12/11/2025', lab: 'Krohne Calibration' },
  { date: '10/11/2024', lab: 'Metrología EMA' }
];

const mockUsage = [
  { folio: '[UVA-0012]', label: 'AgroBajío', date: 'Programado 21 oct' },
  { folio: '[UVA-0009]', label: 'Lácteos', date: '15/10/2026' }
];

export const mockInstrumentDetails: InstrumentDetail[] = mockInstruments.map((i) => ({
  ...i,
  calHistory: mockCalHistory,
  usage: mockUsage
}));

export const mockCalibracionActual: CalibracionActual = {
  id: 'cal-0004',
  instrument: {
    id: 'i4',
    invCode: 'INV-[0004]',
    type: 'Flujómetro ultrasónico portátil',
    brandModel: 'Flexim FLUXUS F601',
    serial: 'FX-601-8841',
    statusLabel: 'En calibración · no disponible para visitas',
    previousDueDate: '12/10/2026'
  },
  steps: [
    { id: 1, title: 'Retirar el equipo de servicio y marcarlo "En calibración"', req: true, done: true, date: '10/10/2026', comment: 'Enviado a almacén' },
    { id: 2, title: 'Revisar estado físico, transductores, accesorios y cables', req: true, done: true, date: '10/10/2026', comment: 'Sin daño visible' },
    { id: 3, title: 'Respaldar configuración de parámetros y mediciones previas', req: false, done: true, date: '10/10/2026', comment: 'Respaldo en nube' },
    { id: 4, title: 'Enviar al laboratorio acreditado (registrar guía o entrega directa)', req: true, done: true, date: '11/10/2026', comment: 'Guía DHL 94810293' },
    { id: 5, title: 'Recibir equipo de regreso y paquete con certificado oficial', req: true, done: true, date: '18/10/2026', comment: 'Recibido en almacén' },
    { id: 6, title: 'Revisar que el número de serie del certificado coincida con el instrumento', req: true, done: false, date: '', comment: '' },
    { id: 7, title: 'Revisar que los errores de medición estén dentro de la tolerancia de la NMX-AA-179', req: true, done: false, date: '', comment: '' },
    { id: 8, title: 'Colocar etiqueta física de calibración vigente en el equipo', req: false, done: false, date: '', comment: '' },
    { id: 9, title: 'Realizar prueba de encendido y funcionamiento antes de liberar', req: true, done: false, date: '', comment: '' }
  ],
  certificate: {
    labName: 'Laboratorio Metrológico de Flujo EMA, S.A.',
    certNumber: 'EMA-FLUX-2026-9921',
    calDate: '18/10/2026',
    vigencia: '12 meses',
    newDueDate: '18/10/2027',
    fileName: 'Certificado_EMA_2026.pdf',
    notes: 'Calibración anual programada conforme a NMX-AA-179-SCFI-2018.'
  }
};
