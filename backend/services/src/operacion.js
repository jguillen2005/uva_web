import { createService, h, need } from '../shared/server.js';
import { api } from '../shared/odoo.js';

createService('operacion', (r) => {
  // Programación de visitas
  r.get('/programacion', h((req) => api('get_programacion', { semana: req.query.semana || null })));
  r.post('/visitas', h((req) => {
    const b = need(req.body, 'folio', 'inspector_code', 'fecha', 'hora');
    return api('confirmar_visita', {
      folio: b.folio,
      inspector_code: b.inspector_code,
      fecha: b.fecha,
      hora: b.hora,
      send_outlook: b.send_outlook !== false,
      send_client_email: b.send_client_email !== false,
      equipo: b.equipo || [],
    });
  }));

  // Préstamos de equipo
  r.get('/prestamos', h(() => api('get_prestamos')));
  r.post('/prestamos/devolucion', h((req) => {
    const b = need(req.body, 'folio');
    return api('registrar_devolucion', { folio: b.folio, items: b.items || [], recibio: b.recibio || null });
  }));

  // App de campo (PWA del verificador)
  r.get('/campo/:folio', h((req) => api('get_campo_sesion', { folio: req.params.folio })));
  r.post('/campo/:folio/respuesta', h((req) => {
    const b = need(req.body, 'punto', 'respuesta');
    return api('registrar_respuesta_campo', {
      folio: req.params.folio,
      punto: b.punto,
      respuesta: b.respuesta,
      fotos: b.fotos || [],
      observacion: b.observacion || null,
    });
  }));
});
