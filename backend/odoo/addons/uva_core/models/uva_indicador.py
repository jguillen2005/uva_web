# -*- coding: utf-8 -*-
from odoo import api, fields, models

from . import uva_tools as ut

COLUMNAS = ['p_admin', 'p_coordinador', 'p_inspector', 'p_gerente', 'p_conagua', 'p_equipos', 'p_consulta']
PERMISO = [('V', 'V · Ver'), ('E', 'E · Editar'), ('A', 'A · Aprobar'), ('—', '— · Sin acceso')]


class UvaIndicador(models.Model):
    """Ajustes de indicadores del tablero.

    Los KPIs, etapas y alertas se calculan con los registros reales. Cuando parte del
    histórico no vive en el sistema (p. ej. expedientes previos a la puesta en marcha),
    aquí se captura un ajuste numérico y, opcionalmente, un texto que sustituye al calculado.
    """
    _name = 'uva.indicador'
    _description = 'Ajuste de indicador del tablero'
    _order = 'code'

    code = fields.Char(string='Código', required=True, index=True)
    name = fields.Char(string='Descripción', required=True)
    ajuste = fields.Integer(string='Ajuste', help='Se suma al valor calculado con los registros.')
    texto = fields.Char(string='Texto principal', help='Si se captura, sustituye al subtítulo o título calculado.')
    texto2 = fields.Char(string='Texto secundario', help='Si se captura, sustituye a la descripción calculada.')
    active = fields.Boolean(default=True)

    _code_uniq = models.Constraint('UNIQUE(code)', 'El código del indicador debe ser único.')

    @api.model
    def _uva_get(self, code):
        return self.search([('code', '=', code)], limit=1)

    @api.model
    def _uva_valor(self, code, calculado):
        ind = self._uva_get(code)
        return calculado + (ind.ajuste if ind else 0)

    @api.model
    def _uva_texto(self, code, calculado, campo='texto'):
        ind = self._uva_get(code)
        return (ind[campo] if ind and ind[campo] else calculado)


class UvaEstadisticaMes(models.Model):
    _name = 'uva.estadistica.mes'
    _description = 'Verificaciones históricas por mes'
    _order = 'fecha'

    fecha = fields.Date(string='Mes', required=True, help='Primer día del mes.')
    name = fields.Char(string='Etiqueta', compute='_compute_name', store=True)
    verificaciones = fields.Integer(string='Verificaciones')
    meta = fields.Integer(string='Meta', default=30)

    _fecha_uniq = models.Constraint('UNIQUE(fecha)', 'Ya existe un registro para ese mes.')

    @api.depends('fecha')
    def _compute_name(self):
        for rec in self:
            rec.name = ('%s %s' % (ut.MESES_CAP[rec.fecha.month - 1], rec.fecha.year)) if rec.fecha else False


class UvaEstadisticaDato(models.Model):
    _name = 'uva.estadistica.dato'
    _description = 'Dato estadístico (tiempos, hallazgos, productividad)'
    _order = 'tipo, sequence, id'

    tipo = fields.Selection([
        ('etapa', 'Tiempo por etapa (días)'),
        ('nc', 'No conformidad frecuente'),
        ('inspector', 'Productividad por inspector'),
    ], string='Tipo', required=True)
    sequence = fields.Integer(default=10)
    name = fields.Char(string='Etiqueta', required=True)
    valor = fields.Integer(string='Valor', help='Días, número de hallazgos o verificaciones según el tipo.')
    valor2 = fields.Integer(string='Devueltos', help='Solo productividad: expedientes devueltos.')
    maximo = fields.Integer(string='Máximo de la escala')
    es_total = fields.Boolean(string='Es total')
    verificador_id = fields.Many2one('uva.verificador', string='Verificador')


class UvaMatrizPermiso(models.Model):
    _name = 'uva.matriz.permiso'
    _description = 'Matriz de permisos por módulo y rol'
    _order = 'sequence, id'

    sequence = fields.Integer(default=10)
    name = fields.Char(string='Módulo', required=True)
    p_admin = fields.Selection(PERMISO, string='Admin.', default='—', required=True)
    p_coordinador = fields.Selection(PERMISO, string='Coordinador', default='—', required=True)
    p_inspector = fields.Selection(PERMISO, string='Inspector', default='—', required=True)
    p_gerente = fields.Selection(PERMISO, string='Gerente Técnico', default='—', required=True)
    p_conagua = fields.Selection(PERMISO, string='Registro CONAGUA', default='—', required=True)
    p_equipos = fields.Selection(PERMISO, string='Resp. equipos', default='—', required=True)
    p_consulta = fields.Selection(PERMISO, string='Consulta', default='—', required=True)

    @api.model
    def _uva_headers(self):
        return [self._fields[c].string for c in COLUMNAS]

    def _uva_json(self):
        self.ensure_one()
        return {'mod': self.name, 'vals': [self[c] for c in COLUMNAS]}
