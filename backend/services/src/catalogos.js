import { createService, h, need, idOrCode } from '../shared/server.js';
import { api } from '../shared/odoo.js';

createService('catalogos', (r) => {
  // Clientes y aprovechamientos
  r.get('/clientes', h(() => api('get_clientes')));
  r.post('/clientes/sync-aspel', h(() => api('sync_aspel')));
  r.post('/clientes', h((req) => api('create_cliente', { vals: need(req.body, 'name', 'rfc') })));
  r.put('/clientes/:id', h((req) =>
    api('update_cliente', { cliente_id: idOrCode(req.params.id), vals: req.body || {} })));
  r.post('/clientes/:id/pozos', h((req) =>
    api('create_pozo', { cliente_id: idOrCode(req.params.id), vals: need(req.body, 'name') })));

  // Verificadores y usuarios
  r.get('/verificadores', h(() => api('get_verificadores')));
  r.get('/usuarios', h(() => api('get_usuarios')));

  // Mi perfil — el usuario final llega en X-UVA-User (lo fijará el SSO del gateway;
  // hoy el gateway lo vacía y Odoo usa el parámetro uva.usuario_actual).
  const login = (req) => req.get('x-uva-user') || undefined;
  r.get('/perfil', h((req) => api('get_perfil', { login: login(req) })));
  r.put('/perfil', h((req) => api('update_perfil', { login: login(req), vals: req.body || {} })));

  // Formatos
  r.get('/formatos', h(() => api('get_formatos')));
  r.get('/formatos/plantillas-alta', h(() => api('get_alta_formato_defaults')));
  r.post('/formatos', h((req) =>
    api('create_formato', { vals: need(req.body, 'codigo', 'nombre', 'version', 'estructura') })));
  r.post('/formatos/:id/enviar-aprobacion', h((req) =>
    api('formato_enviar_aprobacion', { formato_id: idOrCode(req.params.id) })));
  r.get('/formatos/:id/estructura', h((req) =>
    api('get_formato_estructura', { formato_id: idOrCode(req.params.id) })));
  r.put('/formatos/:id/estructura', h((req) => {
    const { sections = [], points = [] } = req.body || {};
    return api('save_formato_estructura', { formato_id: idOrCode(req.params.id), sections, points });
  }));

  // Tipos de verificación
  r.get('/tipos', h(() => api('get_tipos')));
});
