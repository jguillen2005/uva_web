import { createService, h, need, idOrCode, BadRequest } from '../shared/server.js';
import { api } from '../shared/odoo.js';

const DECISIONS = ['autorizar', 'devolver', 'inconforme'];

createService('dictaminacion', (r) => {
  r.get('/bandeja', h(() => api('get_bandeja')));

  r.get('/revision/:folio', h((req) => api('get_revision', { folio: req.params.folio })));
  r.post('/revision/:folio/decision', h((req) => {
    const { decision, comentario = '' } = need(req.body, 'decision');
    if (!DECISIONS.includes(decision)) throw new BadRequest(`Decisión inválida: ${decision}`);
    return api('registrar_decision', { folio: req.params.folio, decision, comentario });
  }));

  r.get('/dictamenes', h(() => api('get_dictamenes')));

  r.get('/conagua', h(() => api('get_conagua')));
  r.post('/conagua/:id/acuse', h((req) => api('conagua_enviar_acuse', { carga_id: idOrCode(req.params.id) })));

  r.get('/expedientes/:folio', h((req) => api('get_expediente', { folio: req.params.folio })));
  r.post('/expedientes/:folio/carga-conagua', h((req) => api('expediente_carga_conagua', {
    folio: req.params.folio,
    modo: req.body?.modo === 'manual' ? 'manual' : 'bot',
    acuse_filename: req.body?.acuse_filename || null,
  })));
});
