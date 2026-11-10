# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import api, fields, models

from . import uva_tools as ut

COMP_STATUS = [
    ('vigente', 'Vigente'),
    ('por_vencer', 'Por vencer'),
    ('vencida', 'Vencida'),
]
ESTADO_VERIFICADOR = [
    ('activo', 'Activo'),
    ('vacaciones', 'Vacaciones'),
    ('inactivo', 'Inactivo'),
]
DIAS_AVISO_COMPETENCIA = 30


class UvaVerificador(models.Model):
    _name = 'uva.verificador'
    _description = 'Verificador / inspector'
    _inherit = ['mail.thread']
    _order = 'code, id'

    name = fields.Char(string='Nombre', required=True, tracking=True)
    code = fields.Char(string='Clave', required=True, help='Clave corta del inspector, p. ej. I3.')
    user_id = fields.Many2one('res.users', string='Usuario', ondelete='set null')
    email = fields.Char(string='Correo')
    zona = fields.Char(string='Zona')
    zona_corta = fields.Char(string='Zona (corta)', help='Etiqueta corta de zona usada en la programación.')
    active = fields.Boolean(default=True)
    fecha_competencia = fields.Date(string='Calificación NMX-AA-179 vigente hasta', tracking=True)
    comp_status = fields.Selection(COMP_STATUS, string='Estado de la calificación',
                                   compute='_compute_comp_status', store=True, readonly=False)
    texto_competencia = fields.Char(
        string='Texto de vigencia',
        help='Texto a mostrar (opcional). Si se deja vacío se calcula a partir de la fecha.')
    visitas_mes = fields.Integer(string='Visitas del mes')
    meta_mensual = fields.Integer(string='Meta mensual de visitas', default=5)
    max_visitas_semana = fields.Integer(string='Máx. visitas por semana', default=2)
    estado = fields.Selection(ESTADO_VERIFICADOR, string='Estado', default='activo', required=True, tracking=True)
    equipo_computo = fields.Char(string='Equipo de cómputo')
    vacaciones_inicio = fields.Date(string='Vacaciones desde')
    vacaciones_fin = fields.Date(string='Vacaciones hasta')
    texto_kit = fields.Char(
        string='Texto del kit asignado',
        help='Texto a mostrar (opcional). Si se deja vacío se calcula con los instrumentos asignados.')
    resguardo_ids = fields.One2many('uva.verificador.resguardo', 'verificador_id', string='Equipos en resguardo')

    _code_uniq = models.Constraint('UNIQUE(code)', 'La clave del verificador debe ser única.')

    @api.depends('fecha_competencia')
    def _compute_comp_status(self):
        hoy = ut.hoy(self.env)
        for rec in self:
            if not rec.fecha_competencia or rec.fecha_competencia < hoy:
                rec.comp_status = 'vencida'
            elif rec.fecha_competencia <= hoy + timedelta(days=DIAS_AVISO_COMPETENCIA):
                rec.comp_status = 'por_vencer'
            else:
                rec.comp_status = 'vigente'

    def action_recalcular_competencia(self):
        self._compute_comp_status()
        return True

    # ------------------------------------------------------------------
    def _uva_comp_texto(self):
        self.ensure_one()
        if self.texto_competencia:
            return self.texto_competencia
        if not self.fecha_competencia:
            return 'Sin calificación registrada'
        hoy = ut.hoy(self.env)
        dias = (self.fecha_competencia - hoy).days
        if dias < 0:
            return 'Vencida desde %s' % ut.fdate(self.fecha_competencia)
        if dias <= DIAS_AVISO_COMPETENCIA:
            return 'Vence en %d %s (%s)' % (dias, ut.plural(dias, 'día', 'días'), ut.fdate(self.fecha_competencia))
        return 'Vigente a %s' % ut.fdate(self.fecha_competencia)

    def _uva_kit_texto(self):
        """Resumen del kit; los módulos de instrumentos lo amplían."""
        self.ensure_one()
        return self.texto_kit or 'Completo'

    def _uva_label(self, field_name):
        self.ensure_one()
        return dict(self._fields[field_name].selection).get(self[field_name], '')

    def _uva_json(self):
        """Forma ``VerificadorItem`` del frontend."""
        self.ensure_one()
        data = {
            'id': str(self.id),
            'code': self.code or '',
            'name': self.name or '',
            'email': self.email or '',
            'zone': self.zona or '',
            'compStatus': self._uva_label('comp_status'),
            'compDueText': self._uva_comp_texto(),
            'monthlyVisits': self.visitas_mes,
            'monthlyTarget': self.meta_mensual,
            'assignedKit': self._uva_kit_texto(),
            'status': self._uva_label('estado'),
            'maxWeeklyVisits': self.max_visitas_semana,
            'equipmentDesc': self.equipo_computo or '',
            'activeLoans': [r._uva_json() for r in self.resguardo_ids],
        }
        if self.vacaciones_inicio or self.vacaciones_fin:
            data['vacations'] = ut.frango(self.vacaciones_inicio, self.vacaciones_fin)
        return data

    def _uva_en_vacaciones(self, fecha):
        self.ensure_one()
        return bool(self.vacaciones_inicio and self.vacaciones_fin
                    and self.vacaciones_inicio <= fecha <= self.vacaciones_fin)


class UvaVerificadorResguardo(models.Model):
    _name = 'uva.verificador.resguardo'
    _description = 'Equipo en resguardo del verificador'
    _order = 'verificador_id, sequence, id'

    verificador_id = fields.Many2one('uva.verificador', string='Verificador', required=True, ondelete='cascade')
    sequence = fields.Integer(default=10)
    name = fields.Char(string='Equipo', required=True)
    inventario = fields.Char(string='Inventario', required=True)
    estado = fields.Selection([('vigente', 'Vigente'), ('por_vencer', 'Por vencer')],
                              string='Estado', default='vigente', required=True)

    def _uva_json(self):
        self.ensure_one()
        return {
            'name': self.name or '',
            'inv': self.inventario or '',
            'status': dict(self._fields['estado'].selection).get(self.estado, ''),
        }
