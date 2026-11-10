import { createService, h, need, idOrCode, BadRequest } from '../shared/server.js';
import { api } from '../shared/odoo.js';

const KINDS = ['Inicial', 'Periódica', 'Extraordinaria'];
const STATUSES = ['En cotización', 'Esperando pago', 'Documentación pendiente', 'Lista para programar', 'Programada'];

createService('solicitudes', (r) => {
  r.get('/', h(() => api('get_solicitudes')));

  r.post('/', h((req) => {
    const vals = need(req.body, 'client', 'well', 'title', 'kind');
    if (!KINDS.includes(vals.kind)) throw new BadRequest(`Tipo de verificación inválido: ${vals.kind}`);
    return api('create_solicitud', { vals });
  }));

  r.patch('/:id/documentos/:docId', h((req) => api('solicitud_set_documento', {
    solicitud_id: idOrCode(req.params.id),
    documento_id: idOrCode(req.params.docId),
    complete: req.body?.complete !== false,
    filename: req.body?.filename || null,
  })));

  r.patch('/:id/estado', h((req) => {
    const { status } = need(req.body, 'status');
    if (!STATUSES.includes(status)) throw new BadRequest(`Estado inválido: ${status}`);
    return api('solicitud_set_estado', { solicitud_id: idOrCode(req.params.id), status });
  }));
});
