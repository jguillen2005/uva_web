import type { SolicitudDocumento } from '../types';

// La lista de solicitudes vive en `mockData.ts` (`mockSolicitudes`).

/** Rubros del checklist CL-DOC v1.0 con los que nace toda solicitud nueva. */
export const mockSolicitudDocsTemplate: SolicitudDocumento[] = [
  { id: 'd1', name: 'Título de concesión o asignación', complete: false, required: true },
  { id: 'd2', name: 'Certificado o dictamen de calibración del medidor', complete: false, required: true },
  { id: 'd3', name: 'Factura del medidor', complete: false, required: true },
  { id: 'd4', name: 'Identificación del representante legal', complete: false, required: true },
  { id: 'd5', name: 'Manual de instalación del medidor', complete: false, required: true },
  { id: 'd6', name: 'Reporte de instalación del equipo', complete: false, required: false }
];

/** Título de concesión que el prototipo asigna a las solicitudes nuevas. */
export const mockNuevaSolicitudTitle = '08EXP102938/12CONAGUA';

/** Coordinador que registra las solicitudes en el prototipo. */
export const mockCoordinador = 'Ing. Roberto Silva';
