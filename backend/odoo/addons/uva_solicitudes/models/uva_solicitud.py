# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import api, fields, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut

TIPOS_VERIFICACION = [
    ('inicial', 'Inicial'),
    ('periodica', 'Periódica'),
    ('extraordinaria', 'Extraordinaria'),
]
ESTADOS_SOLICITUD = [
    ('cotizacion', 'En cotización'),
    ('pago', 'Esperando pago'),
    ('documentacion', 'Documentación pendiente'),
    ('lista', 'Lista para programar'),
    ('programada', 'Programada'),
]
ESTADOS_COTIZACION = [('enviada', 'enviada'), ('aprobada', 'aprobada')]

# Rubros del check list CL-DOC v1.0 con los que nace toda solicitud.
DOCUMENTOS_DEFAULT = [
    ('Título de concesión o asignación', True),
    ('Certificado o dictamen de calibración del medidor', True),
    ('Factura del medidor', True),
    ('Identificación del representante legal', True),
    ('Manual de instalación del medidor', True),
    ('Reporte de instalación del equipo', False),
]
PLAZO_PROGRAMACION_DIAS = 14


def clave_seleccion(seleccion, valor):
    if not valor:
        return False
    texto = str(valor).strip().lower()
    for clave, etiqueta in seleccion:
        if texto in (clave.lower(), etiqueta.lower()):
            return clave
    return False


class UvaSolicitud(models.Model):
    _name = 'uva.solicitud'
    _description = 'Solicitud de servicio (F-12)'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'name desc, id desc'

    name = fields.Char(string='Folio', required=True, copy=False, readonly=True, index=True,
                       default=lambda self: 'Nuevo')
    partner_id = fields.Many2one('res.partner', string='Cliente', tracking=True,
                                 domain=[('uva_es_cliente', '=', True)])
    pozo_id = fields.Many2one('uva.pozo', string='Pozo', domain="[('partner_id', '=', partner_id)]")
    cliente_nombre = fields.Char(string='Cliente (como se capturó)', required=True, tracking=True)
    pozo_nombre = fields.Char(string='Pozo (como se capturó)', required=True)
    titulo_concesion = fields.Char(string='Título de concesión')
    tipo = fields.Selection(TIPOS_VERIFICACION, string='Tipo de verificación', required=True, default='inicial',
                            tracking=True)
    cotizacion = fields.Char(string='Cotización Aspel', copy=False)
    cotizacion_estado = fields.Selection(ESTADOS_COTIZACION, string='Estado de la cotización', default='enviada',
                                         tracking=True)
    state = fields.Selection(ESTADOS_SOLICITUD, string='Estado', required=True, default='cotizacion',
                             tracking=True, index=True)
    fecha_registro = fields.Date(string='Fecha de registro', default=fields.Date.context_today, required=True)
    fecha_programada = fields.Date(string='Fecha de visita programada', tracking=True)
    fecha_docs_completos = fields.Date(string='Documentación completa desde')
    coordinador_id = fields.Many2one('res.users', string='Coordinador (usuario)', default=lambda self: self.env.user)
    coordinador_nombre = fields.Char(string='Coordinador', compute='_compute_coordinador_nombre',
                                     store=True, readonly=False)
    documento_ids = fields.One2many('uva.solicitud.documento', 'solicitud_id', string='Documentos del cliente',
                                    copy=True)
    docs_count = fields.Integer(string='Documentos recibidos', compute='_compute_docs', store=True)
    total_docs = fields.Integer(string='Documentos totales', compute='_compute_docs', store=True)
    docs_requeridos_completos = fields.Boolean(string='Obligatorios completos', compute='_compute_docs', store=True)

    @api.depends('coordinador_id')
    def _compute_coordinador_nombre(self):
        for rec in self:
            rec.coordinador_nombre = rec.coordinador_id.name if rec.coordinador_id else False

    @api.depends('documento_ids.completo', 'documento_ids.requerido')
    def _compute_docs(self):
        for rec in self:
            rec.total_docs = len(rec.documento_ids)
            rec.docs_count = len(rec.documento_ids.filtered('completo'))
            rec.docs_requeridos_completos = all(rec.documento_ids.filtered('requerido').mapped('completo'))

    @api.onchange('partner_id')
    def _onchange_partner_id(self):
        if self.partner_id:
            self.cliente_nombre = self.partner_id.name

    @api.onchange('pozo_id')
    def _onchange_pozo_id(self):
        if self.pozo_id:
            self.pozo_nombre = self.pozo_id.name
            self.titulo_concesion = self.pozo_id.titulo_concesion

    @api.model_create_multi
    def create(self, vals_list):
        seq = self.env['ir.sequence'].sudo()
        for vals in vals_list:
            if not vals.get('name') or vals.get('name') == 'Nuevo':
                vals['name'] = seq.next_by_code('uva.folio') or 'Nuevo'
            if 'documento_ids' not in vals:
                vals['documento_ids'] = [
                    (0, 0, {'sequence': i, 'name': nombre, 'requerido': req})
                    for i, (nombre, req) in enumerate(DOCUMENTOS_DEFAULT, start=1)
                ]
        records = super().create(vals_list)
        for rec in records:
            if rec.pozo_id and not rec.pozo_id.folio_activo:
                rec.pozo_id.folio_activo = rec.name
        return records

    # ------------------------------------------------------------------
    # Flujo
    # ------------------------------------------------------------------
    def _uva_cambiar_estado(self, nuevo):
        hoy = ut.hoy(self.env)
        for rec in self:
            if nuevo == rec.state:
                continue
            if nuevo == 'lista':
                faltan = rec.documento_ids.filtered(lambda d: d.requerido and not d.completo)
                if faltan:
                    raise UserError('La solicitud %s no puede pasar a programación; faltan documentos obligatorios: %s.'
                                    % (rec.name, ', '.join(faltan.mapped('name'))))
                vals = {'state': 'lista'}
                if not rec.fecha_docs_completos:
                    vals['fecha_docs_completos'] = hoy
                rec.write(vals)
                rec._uva_on_lista_para_programar()
            else:
                rec.write({'state': nuevo})
        return True

    def _uva_on_lista_para_programar(self):
        """Gancho: uva_operacion crea aquí la visita por programar."""
        return True

    def action_lista_para_programar(self):
        return self._uva_cambiar_estado('lista')

    def action_aprobar_cotizacion(self):
        self.write({'cotizacion_estado': 'aprobada'})
        for rec in self.filtered(lambda s: s.state == 'cotizacion'):
            rec.state = 'pago'
        return True

    def action_registrar_pago(self):
        for rec in self.filtered(lambda s: s.state in ('cotizacion', 'pago')):
            rec.state = 'documentacion'
        return True

    def _uva_marcar_documento(self, documento, completo=True, filename=None):
        self.ensure_one()
        vals = {'completo': bool(completo)}
        if completo:
            vals['filename'] = filename or documento.filename or 'Documento_%s.pdf' % (documento.name or '')[:15]
        else:
            vals['filename'] = False
        documento.write(vals)
        if self.state == 'documentacion' and self.total_docs and self.docs_count == self.total_docs:
            self._uva_cambiar_estado('lista')
        return True

    def action_solicitar_cotizacion_aspel(self):
        """Stub: genera la cotización en Aspel SAE."""
        # TODO integración: Aspel SAE (alta de cotización y cliente)
        for rec in self:
            if not rec.cotizacion:
                rec.cotizacion = self.env['ir.sequence'].sudo().next_by_code('uva.cotizacion') or False
            rec.message_post(body='Cotización %s registrada en Aspel SAE (integración simulada).' % (rec.cotizacion or ''))
        return True

    # ------------------------------------------------------------------
    @api.model
    def _uva_buscar(self, solicitud_id):
        rec = self.browse()
        if ut.es_numero(solicitud_id):
            rec = self.browse(int(solicitud_id)).exists()
        if not rec and solicitud_id:
            rec = self.search([('name', '=', ut.sin_corchetes(str(solicitud_id)))], limit=1)
        if not rec:
            raise UserError('No se encontró la solicitud «%s».' % solicitud_id)
        return rec

    def _uva_label(self, field_name):
        self.ensure_one()
        return dict(self._fields[field_name].selection).get(self[field_name], '')

    def _uva_json(self):
        """Forma ``Solicitud`` del frontend."""
        self.ensure_one()
        cot_estado = self.cotizacion_estado or 'enviada'
        data = {
            'id': str(self.id),
            'folio': ut.corchetes(self.name),
            'client': self.cliente_nombre or '',
            'well': self.pozo_nombre or '',
            'title': self.titulo_concesion or '',
            'kind': self._uva_label('tipo'),
            'quote': ('%s · %s' % (self.cotizacion, cot_estado)) if self.cotizacion else 'Sin cotización · %s' % cot_estado,
            'quoteStatus': cot_estado,
            'docsCount': self.docs_count,
            'totalDocs': self.total_docs,
            'status': self._uva_label('state'),
            'registeredDate': ut.fdate(self.fecha_registro),
            'coordinator': self.coordinador_nombre or '',
            'docs': [d._uva_json() for d in self.documento_ids],
        }
        if self.fecha_programada:
            data['dateStr'] = ut.fdia_semana(self.fecha_programada)
        return data


class UvaSolicitudDocumento(models.Model):
    _name = 'uva.solicitud.documento'
    _description = 'Documento del cliente (check list CL-DOC)'
    _order = 'solicitud_id, sequence, id'

    solicitud_id = fields.Many2one('uva.solicitud', string='Solicitud', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    name = fields.Char(string='Documento', required=True)
    requerido = fields.Boolean(string='Obligatorio', default=True)
    completo = fields.Boolean(string='Recibido y verificado')
    filename = fields.Char(string='Nombre del archivo')
    archivo = fields.Binary(string='Archivo', attachment=True)
    fecha = fields.Date(string='Fecha de recepción')
    comentario = fields.Char(string='Comentario')

    def _uva_json(self):
        self.ensure_one()
        data = {
            'id': str(self.id),
            'name': self.name or '',
            'complete': self.completo,
            'required': self.requerido,
        }
        if self.filename:
            data['filename'] = self.filename
        return data
