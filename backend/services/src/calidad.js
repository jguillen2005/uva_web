import { createService, h, need, idOrCode } from '../shared/server.js';
import { api } from '../shared/odoo.js';

createService('calidad', (r) => {
  r.get('/instrumentos', h(() => api('get_instrumentos')));
  r.post('/instrumentos', h((req) => api('create_instrumento', { vals: need(req.body, 'type', 'serial') })));

  r.get('/calibraciones/actual', h(() => api('get_calibracion_actual')));
  r.put('/calibraciones/:id/pasos', h((req) => api('save_calibracion_pasos', {
    calibracion_id: idOrCode(req.params.id),
    steps: need(req.body, 'steps').steps,
  })));
  r.post('/calibraciones/:id/completar', h((req) => api('completar_calibracion', {
    calibracion_id: idOrCode(req.params.id),
    cert_number: req.body?.cert_number || null,
    lab_name: req.body?.lab_name || null,
    cal_date: req.body?.cal_date || null,
    vigencia: req.body?.vigencia || null,
    notes: req.body?.notes || null,
  })));
});
