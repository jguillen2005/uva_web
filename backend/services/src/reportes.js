import { createService, h } from '../shared/server.js';
import { api } from '../shared/odoo.js';

createService('reportes', (r) => {
  r.get('/tablero', h(() => api('get_tablero')));

  r.get('/estadisticas', h((req) => api('get_estadisticas', { periodo: req.query.periodo || null })));

  r.get('/estadisticas/export', h(async (req, res) => {
    const { filename, content } = await api('export_estadisticas_csv', { periodo: req.query.periodo || null });
    const safeName = String(filename || 'estadisticas.csv').replace(/"/g, '');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send('﻿' + content); // BOM para que Excel respete acentos
  }));
});
