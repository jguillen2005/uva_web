// Datos mock del servicio reportes (antes inline en EstadisticasView / TableroView).
import type { EstadisticasData, TableroData } from '../types';
import { mockAlerts, mockKPIs, mockStages, mockTodayVisits } from './mockData';

export const mockTablero: TableroData = {
  kpis: mockKPIs,
  alerts: mockAlerts,
  stages: mockStages,
  todayVisits: mockTodayVisits
};

export const mockEstadisticas: EstadisticasData = {
  months: [
    { label: 'May', value: 21 },
    { label: 'Jun', value: 24 },
    { label: 'Jul', value: 27 },
    { label: 'Ago', value: 25 },
    { label: 'Sep', value: 31 },
    { label: 'Oct', value: 18 }
  ],
  stages: [
    { label: 'Solicitud → documentación completa', days: 9, max: 25 },
    { label: 'Documentación → visita en campo', days: 8, max: 25 },
    { label: 'Visita → autorización técnica', days: 4, max: 25 },
    { label: 'Autorización → acuse CONAGUA', days: 2, max: 25 },
    { label: 'Total solicitud → acuse', days: 23, max: 25, isTotal: true }
  ],
  nonConformities: [
    { label: '4.29 Material desecante en gabinete', count: 7, max: 8 },
    { label: '3.4 Longitud de tramos rectos (L1, L2)', count: 5, max: 8 },
    { label: '4.27 Opresores glandulares sin sello', count: 4, max: 8 },
    { label: '6.12 Envío correcto de trama a CONAGUA', count: 3, max: 8 },
    { label: '4.21 Baterías de respaldo agotadas', count: 3, max: 8 },
    { label: '2.7 Certificado de calibración ilegible', count: 2, max: 8 }
  ],
  inspectors: [
    { name: '[Inspector 1] Raúl Sánchez', count: 22, returned: 1 },
    { name: '[Inspector 2] Ana María Torres', count: 24, returned: 3 },
    { name: '[Inspector 3] Carlos Mendoza', count: 19, returned: 0 },
    { name: '[Inspector 4] Laura Valdés', count: 21, returned: 2 },
    { name: '[Inspector 5] Jorge Morales', count: 20, returned: 1 },
    { name: '[Inspector 6] Diana Domínguez', count: 25, returned: 2 },
    { name: '[Inspector 7] Héctor Beltrán', count: 15, returned: 0 }
  ]
};
