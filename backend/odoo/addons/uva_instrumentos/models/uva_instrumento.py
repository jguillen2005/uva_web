# -*- coding: utf-8 -*-
import re
from datetime import timedelta

from odoo import api, fields, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut

ESTADO_FISICO = [
    ('operativo', 'Operativo'),
    ('en_calibracion', 'En calibración'),
    ('fuera_servicio', 'Fuera de servicio'),
]
STATUS = [
    ('vigente', 'Vigente'),
    ('por_vencer', 'Por vencer'),
    ('vencido', 'Vencido'),
    ('disponible', 'Disponible'),
    ('fuera_servicio', 'Fuera de servicio'),
    ('en_calibracion', 'En calibración'),
]
DIAS_AVISO_CALIBRACION = 30

# Pasos del check list CL-CAL v1.0 (9 pasos normativos).
PASOS_CALIBRACION = [
    ('Retirar el equipo de servicio y marcarlo "En calibración"', True),
    ('Revisar estado físico, transductores, accesorios y cables', True),
    ('Respaldar configuración de parámetros y mediciones previas', False),
    ('Enviar al laboratorio acreditado (registrar guía o entrega directa)', True),
    ('Recibir equipo de regreso y paquete con certificado oficial', True),
    ('Revisar que el número de serie del certificado coincida con el instrumento', True),
    ('Revisar que los errores de medición estén dentro de la tolerancia de la NMX-AA-179', True),
    ('Colocar etiqueta física de calibración vigente en el equipo', False),
    ('Realizar prueba de encendido y funcionamiento antes de liberar', True),
]


class UvaInstrumento(models.Model):
    _name = 'uva.instrumento'
    _description = 'Instrumento de medición'
    _inherit = ['mail.thread']
    _order = 'codigo, id'

    codigo = fields.Char(string='Código de inventario', required=True, index=True, tracking=True)
    tipo = fields.Char(string='Tipo de instrumento', required=True, tracking=True)
    marca_modelo = fields.Char(string='Marca / modelo')
    nombre_corto = fields.Char(string='Nombre corto', help='Etiqueta corta usada al reservar equipo (p. ej. «Fluke 87V»).')
    serie = fields.Char(string='Número de serie', required=True)
    verificador_id = fields.Many2one('uva.verificador', string='Asignado a', tracking=True, ondelete='set null')
    estado = fields.Selection(ESTADO_FISICO, string='Estado físico', required=True, default='operativo', tracking=True)
    fecha_vencimiento = fields.Date(string='Vencimiento de calibración', tracking=True)
    status = fields.Selection(STATUS, string='Estatus', compute='_compute_status', store=True, readonly=False,
                              tracking=True)
    laboratorio = fields.Char(string='Laboratorio de la última calibración')
    certificado = fields.Char(string='Certificado vigente')
    fecha_calibracion = fields.Date(string='Fecha de la última calibración')
    calibracion_ids = fields.One2many('uva.calibracion', 'instrumento_id', string='Calibraciones')
    active = fields.Boolean(default=True)
    name = fields.Char(string='Nombre', compute='_compute_name', store=True)

    _codigo_uniq = models.Constraint('UNIQUE(codigo)', 'El código de inventario debe ser único.')

    @api.depends('codigo', 'tipo')
    def _compute_name(self):
        for rec in self:
            rec.name = '%s · %s' % (rec.codigo or '', rec.tipo or '')

    @api.depends('estado', 'fecha_vencimiento', 'verificador_id')
    def _compute_status(self):
        hoy = ut.hoy(self.env)
        for rec in self:
            if rec.estado == 'fuera_servicio':
                rec.status = 'fuera_servicio'
            elif rec.estado == 'en_calibracion':
                rec.status = 'en_calibracion'
            elif not rec.fecha_vencimiento or rec.fecha_vencimiento < hoy:
                rec.status = 'vencido'
            elif rec.fecha_vencimiento <= hoy + timedelta(days=DIAS_AVISO_CALIBRACION):
                rec.status = 'por_vencer'
            elif not rec.verificador_id:
                rec.status = 'disponible'
            else:
                rec.status = 'vigente'

    def action_recalcular_estatus(self):
        self._compute_status()
        return True

    def action_iniciar_calibracion(self):
        for rec in self:
            if rec.calibracion_ids.filtered(lambda c: c.state == 'en_curso'):
                raise UserError('El instrumento %s ya tiene una calibración en curso.' % rec.codigo)
            self.env['uva.calibracion'].create({
                'instrumento_id': rec.id,
                'vencimiento_anterior': rec.fecha_vencimiento,
            })
            rec.estado = 'en_calibracion'
            rec.message_post(body='Calibración iniciada; el equipo se retira de servicio.')
        return True

    def _uva_status_label(self):
        self.ensure_one()
        return dict(self._fields['status'].selection).get(self.status, '')

    def _uva_asignado_texto(self):
        self.ensure_one()
        if self.verificador_id:
            return self.verificador_id.name
        if self.estado == 'en_calibracion' or self.status == 'en_calibracion':
            return 'En calibración (Lab Externo)'
        if self.estado == 'fuera_servicio':
            return 'Fuera de servicio (almacén)'
        return 'Sin asignar (en almacén)'

    def _uva_calibracion_en_curso(self):
        self.ensure_one()
        return self.calibracion_ids.filtered(lambda c: c.state == 'en_curso')[:1]

    def _uva_tipo_corto(self):
        """``Flujómetro ultrasónico portátil`` → ``Flujómetro``."""
        self.ensure_one()
        return (self.tipo or '').split(' ')[0]

    def _uva_json(self):
        """Forma ``InstrumentItem`` del frontend (con ``calHistory``; ``usage`` lo agrega uva_operacion)."""
        self.ensure_one()
        historial = self.calibracion_ids.filtered(lambda c: c.state == 'completada').sorted(
            key=lambda c: c.fecha_calibracion or fields.Date.to_date('1900-01-01'), reverse=True)
        return {
            'id': str(self.id),
            'type': self.tipo or '',
            'brandModel': self.marca_modelo or '',
            'serial': self.serie or '',
            'invCode': self.codigo or '',
            'assignedTo': self._uva_asignado_texto(),
            'calDueDate': ut.fdate(self.fecha_vencimiento),
            'status': self._uva_status_label(),
            'labName': self.laboratorio or '',
            'certNumber': self.certificado or ('En proceso' if self.estado == 'en_calibracion' else ''),
            'calDate': ut.fdate(self.fecha_calibracion),
            'calHistory': [{'date': ut.fdate(c.fecha_calibracion), 'lab': c.laboratorio_corto or c.laboratorio or ''}
                           for c in historial],
            'usage': [],
        }


class UvaCalibracion(models.Model):
    _name = 'uva.calibracion'
    _description = 'Calibración de instrumento'
    _inherit = ['mail.thread']
    _order = 'id desc'

    name = fields.Char(string='Referencia', compute='_compute_name', store=True)
    instrumento_id = fields.Many2one('uva.instrumento', string='Instrumento', required=True, ondelete='cascade',
                                     index=True, tracking=True)
    state = fields.Selection([('en_curso', 'En curso'), ('completada', 'Completada'), ('cancelada', 'Cancelada')],
                             string='Estado', required=True, default='en_curso', tracking=True)
    laboratorio = fields.Char(string='Laboratorio acreditado', tracking=True)
    laboratorio_corto = fields.Char(string='Laboratorio (nombre corto)')
    certificado = fields.Char(string='Folio del certificado', tracking=True)
    fecha_calibracion = fields.Date(string='Fecha de calibración')
    vigencia_meses = fields.Integer(string='Vigencia (meses)', default=12)
    nuevo_vencimiento = fields.Date(string='Nuevo vencimiento', compute='_compute_nuevo_vencimiento', store=True)
    vencimiento_anterior = fields.Date(string='Vencimiento anterior')
    archivo = fields.Binary(string='Certificado (PDF)', attachment=True)
    archivo_nombre = fields.Char(string='Nombre del archivo')
    notas = fields.Text(string='Comentarios generales')
    paso_ids = fields.One2many('uva.calibracion.paso', 'calibracion_id', string='Pasos', copy=True)
    pasos_hechos = fields.Integer(string='Pasos realizados', compute='_compute_pasos')
    pasos_total = fields.Integer(string='Pasos totales', compute='_compute_pasos')

    @api.depends('instrumento_id.codigo', 'fecha_calibracion')
    def _compute_name(self):
        for rec in self:
            rec.name = 'CAL %s %s' % (rec.instrumento_id.codigo or '', ut.fdate(rec.fecha_calibracion)
                                      if rec.fecha_calibracion else '')

    @api.depends('fecha_calibracion', 'vigencia_meses')
    def _compute_nuevo_vencimiento(self):
        for rec in self:
            rec.nuevo_vencimiento = (ut.sumar_meses(rec.fecha_calibracion, rec.vigencia_meses or 12)
                                     if rec.fecha_calibracion else False)

    @api.depends('paso_ids.realizado')
    def _compute_pasos(self):
        for rec in self:
            rec.pasos_total = len(rec.paso_ids)
            rec.pasos_hechos = len(rec.paso_ids.filtered('realizado'))

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if 'paso_ids' not in vals:
                vals['paso_ids'] = [(0, 0, {'sequence': i, 'name': titulo, 'requerido': req})
                                    for i, (titulo, req) in enumerate(PASOS_CALIBRACION, start=1)]
        return super().create(vals_list)

    def action_completar(self, certificado=None, laboratorio=None, fecha=None, vigencia_meses=None, notas=None):
        hoy = ut.hoy(self.env)
        for rec in self:
            if rec.state != 'en_curso':
                raise UserError('La calibración ya no está en curso.')
            faltan = rec.paso_ids.filtered(lambda p: p.requerido and not p.realizado)
            if faltan:
                raise UserError('No se puede cerrar la calibración: faltan pasos obligatorios (%s).'
                                % ', '.join(faltan.mapped('name')))
            vals = {'state': 'completada'}
            if certificado:
                vals['certificado'] = certificado
            if laboratorio:
                vals['laboratorio'] = laboratorio
            if fecha:
                vals['fecha_calibracion'] = fecha
            elif not rec.fecha_calibracion:
                vals['fecha_calibracion'] = hoy
            if vigencia_meses:
                vals['vigencia_meses'] = vigencia_meses
            if notas:
                vals['notas'] = notas
            rec.write(vals)
            if not rec.certificado or not rec.laboratorio:
                raise UserError('Capture el laboratorio y el folio del certificado para cerrar la calibración.')
            inst = rec.instrumento_id
            inst.write({
                'estado': 'operativo',
                'laboratorio': rec.laboratorio,
                'certificado': rec.certificado,
                'fecha_calibracion': rec.fecha_calibracion,
                'fecha_vencimiento': rec.nuevo_vencimiento,
                'verificador_id': False,
            })
            inst.status = 'disponible'
            inst.message_post(body='Calibración completada (certificado %s, %s). Instrumento liberado como disponible.'
                              % (rec.certificado, rec.laboratorio))
        return True

    def action_completar_boton(self):
        return self.action_completar()


class UvaCalibracionPaso(models.Model):
    _name = 'uva.calibracion.paso'
    _description = 'Paso del check list de calibración'
    _order = 'calibracion_id, sequence, id'

    calibracion_id = fields.Many2one('uva.calibracion', string='Calibración', required=True, ondelete='cascade',
                                     index=True)
    sequence = fields.Integer(default=10)
    name = fields.Char(string='Paso normativo', required=True)
    requerido = fields.Boolean(string='Obligatorio', default=True)
    realizado = fields.Boolean(string='Hecho')
    fecha = fields.Date(string='Fecha de realización')
    comentario = fields.Char(string='Comentarios / guía')

    def _uva_json(self):
        self.ensure_one()
        return {
            'id': self.id,
            'title': self.name or '',
            'req': self.requerido,
            'done': self.realizado,
            'date': ut.fdate(self.fecha) if self.fecha else '',
            'comment': self.comentario or '',
        }


class UvaVerificador(models.Model):
    _inherit = 'uva.verificador'

    instrumento_ids = fields.One2many('uva.instrumento', 'verificador_id', string='Instrumentos asignados')

    def _uva_kit_texto(self):
        self.ensure_one()
        if self.texto_kit:
            return self.texto_kit
        vencidos = self.instrumento_ids.filtered(lambda i: i.status == 'vencido')
        if vencidos:
            return '%s %s' % (vencidos[0]._uva_tipo_corto(), 'vencido')
        por_vencer = self.instrumento_ids.filtered(lambda i: i.status == 'por_vencer')
        if por_vencer:
            return '%d por vencer' % len(por_vencer)
        return 'Completo'


def parse_meses(texto, default=12):
    """``'12 meses'`` → 12."""
    if texto in (None, '', False):
        return default
    if isinstance(texto, int):
        return texto
    m = re.search(r'\d+', str(texto))
    return int(m.group(0)) if m else default
