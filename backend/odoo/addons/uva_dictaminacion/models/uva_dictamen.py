# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import api, fields, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut

RESULTADOS = [('conforme', 'Conforme'), ('inconforme', 'Inconforme')]
ESTADOS_CARGA = [
    ('pendiente', 'Pendiente de carga'),
    ('acuse_por_enviar', 'Acuse por enviar al cliente'),
    ('acuse_enviado', 'Acuse enviado'),
]
CARGA_PRESENTACION = {
    'pendiente': ('pend', 'Cargar'),
    'acuse_por_enviar': ('blue', 'Enviar acuse'),
    'acuse_enviado': ('done', 'Ver'),
}
DIAS_AVISO_VIGENCIA = 60
VIGENCIA_MESES = 24


class UvaDictamen(models.Model):
    _name = 'uva.dictamen'
    _description = 'Dictamen de verificación (F-17)'
    _inherit = ['mail.thread']
    _order = 'name desc, id desc'

    name = fields.Char(string='No. de dictamen', required=True, copy=False, index=True, default='Nuevo', tracking=True)
    expediente_id = fields.Many2one('uva.expediente', string='Expediente', ondelete='set null', index=True)
    folio = fields.Char(string='Folio UVA', compute='_compute_desde_expediente', store=True, readonly=False)
    cliente_nombre = fields.Char(string='Cliente', compute='_compute_desde_expediente', store=True, readonly=False)
    pozo_nombre = fields.Char(string='Pozo', compute='_compute_desde_expediente', store=True, readonly=False)
    titulo_concesion = fields.Char(string='Título de concesión', compute='_compute_desde_expediente', store=True,
                                   readonly=False)
    fecha_emision = fields.Date(string='Fecha de emisión', required=True, default=fields.Date.context_today)
    resultado = fields.Selection(RESULTADOS, string='Resultado', required=True, default='conforme', tracking=True)
    nc_count = fields.Integer(string='No conformidades')
    vigencia = fields.Date(string='Vigencia', compute='_compute_vigencia', store=True, readonly=False)
    texto_vigencia = fields.Char(string='Texto de vigencia',
                                 help='Texto a mostrar (opcional). Si se deja vacío se calcula a partir de la vigencia.')
    autorizado_id = fields.Many2one('res.users', string='Autorizó (usuario)')
    autorizado_por = fields.Char(string='Autorizó')
    estado_conagua = fields.Selection([('pendiente', 'Pendiente de carga'), ('con_acuse', 'Con acuse')],
                                      string='Estado CONAGUA', compute='_compute_estado_conagua', store=True,
                                      readonly=False)
    carga_ids = fields.One2many('uva.conagua.carga', 'dictamen_id', string='Cargas a CONAGUA')
    pdf = fields.Binary(string='Dictamen firmado (PDF)', attachment=True)
    pdf_nombre = fields.Char(string='Nombre del archivo')

    @api.depends('expediente_id')
    def _compute_desde_expediente(self):
        for rec in self:
            exp = rec.expediente_id
            rec.folio = exp.name if exp else False
            rec.cliente_nombre = exp.cliente_nombre if exp else False
            rec.pozo_nombre = exp.pozo_nombre if exp else False
            rec.titulo_concesion = exp.titulo_concesion if exp else False

    @api.depends('fecha_emision', 'resultado')
    def _compute_vigencia(self):
        for rec in self:
            rec.vigencia = (ut.sumar_meses(rec.fecha_emision, VIGENCIA_MESES)
                            if rec.fecha_emision and rec.resultado == 'conforme' else False)

    @api.depends('carga_ids.state')
    def _compute_estado_conagua(self):
        for rec in self:
            if rec.carga_ids and all(c.state != 'pendiente' for c in rec.carga_ids):
                rec.estado_conagua = 'con_acuse'
            else:
                rec.estado_conagua = 'pendiente'

    @api.model_create_multi
    def create(self, vals_list):
        seq = self.env['ir.sequence'].sudo()
        for vals in vals_list:
            if not vals.get('name') or vals.get('name') == 'Nuevo':
                vals['name'] = seq.next_by_code('uva.dictamen') or 'Nuevo'
        return super().create(vals_list)

    def _uva_vigencia(self, hoy):
        self.ensure_one()
        if self.resultado != 'conforme' or not self.vigencia:
            return self.texto_vigencia or ut.GUION, False
        dias = (self.vigencia - hoy).days
        aviso = 0 <= dias <= DIAS_AVISO_VIGENCIA
        if self.texto_vigencia:
            return self.texto_vigencia, aviso
        if aviso:
            return 'En %d %s (%s)' % (dias, ut.plural(dias, 'día', 'días'), ut.fdate(self.vigencia)), True
        return ut.fdate(self.vigencia), False

    def _uva_json(self, hoy):
        """Forma de ``DictamenItem``."""
        self.ensure_one()
        due, aviso = self._uva_vigencia(hoy)
        if self.resultado == 'conforme':
            res, res_type = 'Conforme', 'ok'
        else:
            res = 'Inconforme · %d NC' % self.nc_count if self.nc_count else 'Inconforme'
            res_type = 'nc'
        con_acuse = self.estado_conagua == 'con_acuse'
        return {
            'id': str(self.id),
            'no': ut.corchetes(self.name),
            'folio': ut.corchetes(self.folio) if self.folio else '',
            'client': self.cliente_nombre or '',
            'well': self.pozo_nombre or '',
            'title': self.titulo_concesion or '',
            'date': ut.fdate(self.fecha_emision),
            'res': res,
            'resType': res_type,
            'due': due,
            'dueWarning': aviso,
            'cn': 'Con acuse' if con_acuse else 'Pendiente de carga',
            'cnType': 'done' if con_acuse else 'pend',
        }


class UvaConaguaCarga(models.Model):
    _name = 'uva.conagua.carga'
    _description = 'Carga de dictamen al portal CONAGUA'
    _inherit = ['mail.thread']
    _order = 'fecha_lista, id'

    dictamen_id = fields.Many2one('uva.dictamen', string='Dictamen', ondelete='cascade', index=True)
    expediente_id = fields.Many2one(related='dictamen_id.expediente_id', store=True, string='Expediente')
    no_dictamen = fields.Char(string='No. de dictamen', compute='_compute_desde_dictamen', store=True, readonly=False)
    cliente_nombre = fields.Char(string='Cliente', compute='_compute_desde_dictamen', store=True, readonly=False)
    pozo_nombre = fields.Char(string='Pozo', compute='_compute_desde_dictamen', store=True, readonly=False)
    titulo_concesion = fields.Char(string='Título de concesión', compute='_compute_desde_dictamen', store=True,
                                   readonly=False)
    resultado = fields.Selection(RESULTADOS, string='Resultado', compute='_compute_desde_dictamen', store=True,
                                 readonly=False)
    fecha_autorizacion = fields.Date(string='Fecha de autorización', compute='_compute_desde_dictamen', store=True,
                                     readonly=False)
    autorizado_por = fields.Char(string='Autorizó', compute='_compute_desde_dictamen', store=True, readonly=False)
    name = fields.Char(string='Referencia', compute='_compute_name', store=True)
    state = fields.Selection(ESTADOS_CARGA, string='Estado', required=True, default='pendiente', tracking=True,
                             index=True)
    fecha_lista = fields.Date(string='Lista para carga desde', default=fields.Date.context_today)
    modo = fields.Selection([('bot', 'Bot asistido'), ('manual', 'Carga manual')], string='Modo de carga')
    fecha_carga = fields.Date(string='Fecha de carga')
    folio_acuse = fields.Char(string='Folio de acuse CONAGUA')
    acuse = fields.Binary(string='Acuse (PDF)', attachment=True)
    acuse_nombre = fields.Char(string='Nombre del acuse')
    fecha_envio_cliente = fields.Date(string='Acuse enviado al cliente el')

    @api.depends('dictamen_id')
    def _compute_desde_dictamen(self):
        for rec in self:
            d = rec.dictamen_id
            rec.no_dictamen = d.name if d else False
            rec.cliente_nombre = d.cliente_nombre if d else False
            rec.pozo_nombre = d.pozo_nombre if d else False
            rec.titulo_concesion = d.titulo_concesion if d else False
            rec.resultado = d.resultado if d else False
            rec.fecha_autorizacion = d.fecha_emision if d else False
            rec.autorizado_por = d.autorizado_por if d else False

    @api.depends('no_dictamen')
    def _compute_name(self):
        for rec in self:
            rec.name = 'Carga %s' % (rec.no_dictamen or '')

    def _uva_dias(self, hoy):
        self.ensure_one()
        if self.state != 'pendiente' or not self.fecha_lista:
            return ut.GUION, None
        dias = max((hoy - self.fecha_lista).days, 0)
        if dias == 0:
            return '0 días (hoy)', 0
        return '%d %s' % (dias, ut.plural(dias, 'día', 'días')), dias

    def _uva_json(self, hoy):
        """Forma de ``ConaguaItem``."""
        self.ensure_one()
        st_type, accion = CARGA_PRESENTACION.get(self.state, ('pend', 'Ver'))
        dias, _n = self._uva_dias(hoy)
        auth = ut.fdate(self.fecha_autorizacion)
        if self.autorizado_por:
            auth = '%s · %s' % (auth, self.autorizado_por)
        return {
            'id': str(self.id),
            'no': ut.corchetes(self.no_dictamen),
            'client': self.cliente_nombre or '',
            'well': self.pozo_nombre or '',
            'title': self.titulo_concesion or '',
            'res': dict(self._fields['resultado'].selection).get(self.resultado, ''),
            'resType': 'ok' if self.resultado == 'conforme' else 'nc',
            'authDate': auth,
            'days': dias,
            'st': dict(self._fields['state'].selection).get(self.state, ''),
            'stType': st_type,
            'action': accion,
        }

    # ------------------------------------------------------------------
    def action_registrar_carga(self, modo='manual', acuse_nombre=None, folio_acuse=None):
        hoy = ut.hoy(self.env)
        for rec in self:
            if rec.state != 'pendiente':
                raise UserError('El dictamen %s ya fue cargado a CONAGUA.' % (rec.no_dictamen or ''))
            if modo == 'manual' and not acuse_nombre:
                raise UserError('Adjunte el acuse oficial de CONAGUA (PDF) para registrar la carga manual.')
            if modo == 'bot':
                # TODO integración: bot del portal CONAGUA (Playwright / RPA). Requiere e.firma y captcha del usuario.
                acuse_nombre = acuse_nombre or 'Acuse_CONAGUA_%s.pdf' % (rec.no_dictamen or '')
                rec.message_post(body='Bot del portal CONAGUA ejecutado (integración simulada): dictamen capturado '
                                      'y acuse descargado.')
            rec.write({
                'state': 'acuse_por_enviar',
                'modo': modo,
                'fecha_carga': hoy,
                'acuse_nombre': acuse_nombre,
                'folio_acuse': folio_acuse or rec.folio_acuse,
            })
            exp = rec.expediente_id
            if exp:
                doc = exp._uva_doc('05_Acuse')
                if doc:
                    doc.write({'estado': 'listo', 'archivo_nombre': acuse_nombre})
                if exp.state == 'autorizado' or exp.state == 'inconforme':
                    if exp.state == 'autorizado':
                        exp.state = 'con_acuse'
                exp._uva_log('Dictamen cargado a CONAGUA (%s) · acuse %s'
                             % ('bot asistido' if modo == 'bot' else 'carga manual', acuse_nombre))
                # TODO integración: SharePoint (guardar acuse en 05_Acuse)
                exp.message_post(body='Acuse %s guardado en SharePoint (integración simulada).' % acuse_nombre)
        return True

    def action_enviar_acuse(self):
        hoy = ut.hoy(self.env)
        for rec in self:
            if rec.state == 'pendiente':
                raise UserError('Primero registre la carga del dictamen %s en CONAGUA.' % (rec.no_dictamen or ''))
            if rec.state == 'acuse_enviado':
                raise UserError('El acuse del dictamen %s ya fue enviado al cliente.' % (rec.no_dictamen or ''))
            # TODO integración: Microsoft 365 / Outlook (correo al contacto de avisos del cliente)
            rec.write({'state': 'acuse_enviado', 'fecha_envio_cliente': hoy})
            rec.message_post(body='Acuse oficial CONAGUA enviado por correo a %s (integración simulada).'
                                  % (rec.cliente_nombre or ''))
            if rec.expediente_id:
                rec.expediente_id._uva_log('Acuse y dictamen enviados por correo al cliente')
        return True

    def action_registrar_carga_boton(self):
        return self.action_registrar_carga(modo='bot')
