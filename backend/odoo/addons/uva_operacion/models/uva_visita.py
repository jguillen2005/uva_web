# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import api, fields, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut
from odoo.addons.uva_solicitudes.models.uva_solicitud import TIPOS_VERIFICACION, PLAZO_PROGRAMACION_DIAS

ESTADOS_VISITA = [
    ('por_programar', 'Por programar'),
    ('propuesta', 'Propuesta'),
    ('programada', 'Programada'),
    ('confirmada', 'Confirmada'),
    ('en_campo', 'En campo'),
    ('realizada', 'Realizada'),
    ('cancelada', 'Cancelada'),
]
SLOT_TIPO = {'propuesta': 'prop', 'programada': 'prog', 'confirmada': 'conf', 'en_campo': 'conf', 'realizada': 'conf'}
DIAS_AVISO_PLAZO = 7


class UvaVisita(models.Model):
    _name = 'uva.visita'
    _description = 'Visita de verificación / evento de agenda'
    _inherit = ['mail.thread']
    _order = 'fecha, hora, id'

    name = fields.Char(string='Folio', index=True, help='Folio UVA de la visita (vacío para ausencias).')
    tipo_registro = fields.Selection([('visita', 'Visita'), ('ausencia', 'Ausencia / capacitación')],
                                     string='Tipo de registro', required=True, default='visita')
    solicitud_id = fields.Many2one('uva.solicitud', string='Solicitud', ondelete='set null', index=True)
    partner_id = fields.Many2one('res.partner', string='Cliente (contacto)', domain=[('uva_es_cliente', '=', True)])
    cliente_nombre = fields.Char(string='Cliente')
    cliente_corto = fields.Char(string='Cliente (etiqueta corta)', help='Etiqueta corta usada en la agenda.')
    sitio = fields.Char(string='Sitio / pozo')
    lugar = fields.Char(string='Localidad')
    tipo_verificacion = fields.Selection(TIPOS_VERIFICACION, string='Tipo de verificación', default='inicial')
    descripcion = fields.Char(string='Descripción', help='Para ausencias: motivo (p. ej. «Capacitación EMA»).')
    detalle = fields.Char(string='Detalle', help='Para ausencias: duración (p. ej. «Todo el día»).')
    verificador_id = fields.Many2one('uva.verificador', string='Inspector', tracking=True, index=True)
    fecha = fields.Date(string='Fecha', tracking=True, index=True)
    hora = fields.Char(string='Hora', help='Formato HH:MM.')
    state = fields.Selection(ESTADOS_VISITA, string='Estado', required=True, default='por_programar', tracking=True,
                             index=True)
    programar_antes = fields.Date(string='Programar antes del')
    fecha_docs_completos = fields.Date(string='Documentación completa desde')
    fecha_instalacion = fields.Date(string='Fecha de instalación del medidor')
    texto_plazo = fields.Char(string='Texto de plazo',
                              help='Texto a mostrar (opcional). Si se deja vacío se calcula con «Programar antes del».')
    sugerencia_ids = fields.One2many('uva.visita.sugerencia', 'visita_id', string='Inspectores sugeridos')
    prestamo_ids = fields.One2many('uva.prestamo', 'visita_id', string='Préstamos de equipo')

    @api.depends('name', 'descripcion', 'tipo_registro')
    def _compute_display_name(self):
        for rec in self:
            if rec.tipo_registro == 'ausencia':
                rec.display_name = rec.descripcion or 'Ausencia'
            else:
                rec.display_name = '%s · %s' % (rec.name or '', rec.cliente_nombre or '')

    @api.constrains('hora')
    def _check_hora(self):
        for rec in self:
            if rec.hora:
                partes = rec.hora.split(':')
                if len(partes) != 2 or not all(p.isdigit() for p in partes) or int(partes[0]) > 23 or int(partes[1]) > 59:
                    raise UserError('La hora debe tener el formato HH:MM (24 h).')

    # ------------------------------------------------------------------
    def _uva_label(self, field_name):
        self.ensure_one()
        return dict(self._fields[field_name].selection).get(self[field_name], '')

    def _uva_fecha_limite_instalacion(self):
        self.ensure_one()
        if self.tipo_verificacion == 'inicial' and self.fecha_instalacion:
            return self.fecha_instalacion + timedelta(days=30)
        return None

    def _uva_plazo(self, hoy):
        """Devuelve (texto, tipo) del plazo de programación."""
        self.ensure_one()
        tipo = 'normal'
        texto = ''
        if self.programar_antes:
            dias = (self.programar_antes - hoy).days
            if dias < 0:
                tipo = 'urgent'
                texto = 'Vencida hace %d %s' % (-dias, ut.plural(-dias, 'día', 'días'))
            else:
                tipo = 'warning' if dias <= DIAS_AVISO_PLAZO else 'normal'
                texto = 'Programar antes del %s' % ut.fdia_mes(self.programar_antes)
        return (self.texto_plazo or texto or 'Sin fecha límite'), tipo

    def _uva_fuera_de_ventana(self, hoy):
        self.ensure_one()
        return bool(self.fecha_docs_completos and (hoy - self.fecha_docs_completos).days > PLAZO_PROGRAMACION_DIAS)

    def _uva_queue_json(self, hoy):
        self.ensure_one()
        due, due_type = self._uva_plazo(hoy)
        limite = self._uva_fecha_limite_instalacion()
        return {
            'folio': ut.corchetes(self.name),
            'rawFolio': ut.sin_corchetes(self.name),
            'kind': self._uva_label('tipo_verificacion'),
            'client': self.cliente_nombre or '',
            'place': self.lugar or '',
            'due': due,
            'dueType': due_type,
            'instNote': ('Instalación + 30 días naturales: %s' % ut.fdia_mes(limite)) if limite else None,
        }

    def _uva_slot_json(self):
        self.ensure_one()
        if self.tipo_registro == 'ausencia':
            return {'type': 'off', 'text': self.descripcion or 'Ausencia', 'client': self.detalle or ''}
        tipo = SLOT_TIPO.get(self.state, 'prog')
        cliente = self.cliente_corto or self.cliente_nombre or ''
        if tipo == 'prop':
            cliente = 'Propuesta · %s' % cliente
        texto = ut.corchetes(self.name)
        if self.hora:
            texto = '%s · %s' % (texto, self.hora)
        return {'type': tipo, 'text': texto, 'client': cliente}

    @api.model
    def _uva_buscar_folio(self, folio, estados=None):
        domain = [('name', '=', ut.sin_corchetes(folio)), ('tipo_registro', '=', 'visita')]
        if estados:
            domain.append(('state', 'in', estados))
        return self.search(domain, order='id desc', limit=1)

    def action_confirmar(self):
        for rec in self:
            if not rec.verificador_id or not rec.fecha:
                raise UserError('Asigne inspector y fecha antes de confirmar la visita.')
            rec.state = 'confirmada'
        return True

    def action_proponer(self):
        self.filtered(lambda v: v.state == 'por_programar').write({'state': 'propuesta'})
        return True


class UvaVisitaSugerencia(models.Model):
    _name = 'uva.visita.sugerencia'
    _description = 'Inspector sugerido para una visita'
    _order = 'visita_id, sequence, id'

    visita_id = fields.Many2one('uva.visita', string='Visita', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    verificador_id = fields.Many2one('uva.verificador', string='Inspector', required=True, ondelete='cascade')
    fecha = fields.Date(string='Día sugerido')
    razones = fields.Text(string='Razones', help='Una razón por línea.')
    destacado = fields.Char(string='Razón destacada')

    def _uva_json(self):
        self.ensure_one()
        data = {
            'code': self.verificador_id.code or '',
            'name': ut.nombre_corto(self.verificador_id.name),
            'day': ('%s %d' % (ut.DIAS_ABR[self.fecha.weekday()], self.fecha.day)) if self.fecha else '',
            'reasons': [r.strip() for r in (self.razones or '').splitlines() if r.strip()],
        }
        if self.destacado:
            data['highlight'] = self.destacado
        return data


class UvaSolicitud(models.Model):
    _inherit = 'uva.solicitud'

    visita_ids = fields.One2many('uva.visita', 'solicitud_id', string='Visitas')

    def _uva_on_lista_para_programar(self):
        res = super()._uva_on_lista_para_programar()
        hoy = ut.hoy(self.env)
        Visita = self.env['uva.visita']
        for rec in self:
            if rec.visita_ids.filtered(lambda v: v.state not in ('cancelada', 'realizada')):
                continue
            Visita.create({
                'name': rec.name,
                'solicitud_id': rec.id,
                'partner_id': rec.partner_id.id,
                'cliente_nombre': rec.cliente_nombre,
                'sitio': rec.pozo_nombre,
                'tipo_verificacion': rec.tipo,
                'state': 'por_programar',
                'fecha_docs_completos': rec.fecha_docs_completos or hoy,
                'programar_antes': (rec.fecha_docs_completos or hoy) + timedelta(days=PLAZO_PROGRAMACION_DIAS),
                'fecha_instalacion': rec.pozo_id.fecha_instalacion,
            })
            rec.message_post(body='Solicitud enviada a programación. Plazo de 2 semanas activado.')
        return res
