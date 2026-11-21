import { createService, h, need, idOrCode } from '../shared/server.js';
import { api } from '../shared/odoo.js';

createService('catalogos', (r) => {
  // Clientes y aprovechamientos
  r.get('/clientes', h(() => api('get_clientes')));
  // Importación de clientes desde el archivo exportado de Aspel SAE (vista previa o confirmar)
  r.post('/clientes/importar-aspel', h((req) => {
    const b = need(req.body, 'contenido');
    return api('importar_clientes_aspel', {
      nombre_archivo: b.nombre || null,
      contenido_base64: b.contenido,
      confirmar: b.confirmar === true,
    });
  }));
  r.post('/clientes', h((req) => api('create_cliente', { vals: need(req.body, 'name', 'rfc') })));
  r.put('/clientes/:id', h((req) =>
    api('update_cliente', { cliente_id: idOrCode(req.params.id), vals: req.body || {} })));
  r.post('/clientes/:id/pozos', h((req) =>
    api('create_pozo', { cliente_id: idOrCode(req.params.id), vals: need(req.body, 'name') })));

  // Usuario final de la petición: el gateway lo fija en X-UVA-User tras validar la sesión.
  const login = (req) => req.get('x-uva-user') || undefined;

  // Verificadores y usuarios
  r.get('/verificadores', h(() => api('get_verificadores')));
  r.get('/usuarios', h(() => api('get_usuarios')));
  r.get('/usuarios/roles', h(() => api('get_roles_usuario')));
  // Registro de usuarios y roles (solo Administrador; Odoo lo verifica con el login)
  r.post('/usuarios', h((req) =>
    api('create_usuario', { login: login(req), vals: need(req.body, 'name', 'email', 'roles') })));
  r.put('/usuarios/:id', h((req) =>
    api('update_usuario', { login: login(req), usuario_id: Number(req.params.id), vals: req.body || {} })));
  r.post('/usuarios/:id/restablecer-clave', h((req) =>
    api('restablecer_clave_usuario', { login: login(req), usuario_id: Number(req.params.id) })));

  // Mi perfil
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
