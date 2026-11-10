# -*- coding: utf-8 -*-
from odoo import api, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut


class UvaApiSolicitudes(models.AbstractModel):
    _inherit = 'uva.api'

    @api.model
    def get_solicitudes(self, **kwargs):
        return [s._uva_json() for s in self.env['uva.solicitud'].search([])]

    @api.model
    def create_solicitud(self, vals=None, **kwargs):
        vals = self._vals(vals)
        cliente = (vals.get('client') or '').strip()
        pozo = (vals.get('well') or '').strip()
        if not cliente or not pozo:
            raise UserError('Capture el cliente y el pozo de la solicitud.')
        tipo = self._seleccion_clave('uva.solicitud', 'tipo', vals.get('kind') or 'Inicial')
        if not tipo:
            raise UserError('Tipo de verificación no válido: «%s».' % vals.get('kind'))
        Partner = self.env['res.partner']
        partner = Partner.search([('uva_es_cliente', '=', True), ('name', '=', cliente)], limit=1) or \
            Partner.search([('uva_es_cliente', '=', True), ('name', 'ilike', cliente)], limit=1)
        pozo_rec = self.env['uva.pozo']
        if partner:
            pozo_rec = pozo_rec.search([('partner_id', '=', partner.id), ('name', 'ilike', pozo)], limit=1)
        datos = {
            'cliente_nombre': cliente,
            'pozo_nombre': pozo,
            'titulo_concesion': (vals.get('title') or '').strip() or pozo_rec.titulo_concesion or False,
            'tipo': tipo,
            'partner_id': partner.id or False,
            'pozo_id': pozo_rec.id or False,
            'fecha_registro': self._hoy(),
        }
        coordinador = self._usuarios_de_grupo('uva_core.group_uva_coordinador')[:1]
        if vals.get('coordinator'):
            datos['coordinador_nombre'] = vals['coordinator']
        elif coordinador:
            datos['coordinador_id'] = coordinador.id
            datos['coordinador_nombre'] = ut.sin_prefijo(coordinador.name)
        solicitud = self.env['uva.solicitud'].create(datos)
        solicitud.action_solicitar_cotizacion_aspel()
        return self._ok('Solicitud %s creada exitosamente.' % ut.corchetes(solicitud.name),
                        solicitud=solicitud._uva_json())

    @api.model
    def solicitud_set_documento(self, solicitud_id=None, documento_id=None, complete=True, filename=None, **kwargs):
        solicitud = self.env['uva.solicitud']._uva_buscar(solicitud_id)
        doc = self.env['uva.solicitud.documento']
        if ut.es_numero(documento_id):
            doc = solicitud.documento_ids.filtered(lambda d: d.id == int(documento_id))
        elif isinstance(documento_id, str) and documento_id[:1] == 'd' and ut.es_numero(documento_id[1:]):
            idx = int(documento_id[1:]) - 1
            doc = solicitud.documento_ids[idx:idx + 1]
        if not doc:
            raise UserError('El documento «%s» no pertenece a la solicitud %s.' % (documento_id, solicitud.name))
        solicitud._uva_marcar_documento(doc, completo=complete, filename=filename)
        mensaje = 'Documento recibido y verificado.' if complete else 'Documento marcado como pendiente.'
        if complete:
            solicitud.message_post(body='Documento recibido: %s (%s).' % (doc.name, doc.filename or ''))
        return self._ok(mensaje, solicitud=solicitud._uva_json())

    @api.model
    def solicitud_set_estado(self, solicitud_id=None, status=None, **kwargs):
        solicitud = self.env['uva.solicitud']._uva_buscar(solicitud_id)
        estado = self._seleccion_clave('uva.solicitud', 'state', status)
        if not estado:
            raise UserError('Estado de solicitud no válido: «%s».' % status)
        solicitud._uva_cambiar_estado(estado)
        if estado == 'lista':
            mensaje = 'Solicitud enviada a programación. Plazo de 2 semanas activado.'
        else:
            mensaje = 'Solicitud %s actualizada a «%s».' % (ut.corchetes(solicitud.name), solicitud._uva_label('state'))
        return self._ok(mensaje, solicitud=solicitud._uva_json())
