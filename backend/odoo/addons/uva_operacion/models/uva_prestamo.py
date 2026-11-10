# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut

DESTINOS = [
    ('disponible', 'Disponible'),
    ('liberar', 'Liberar como disponible'),
    ('calibracion', 'Enviar a calibración'),
    ('fuera_servicio', 'Enviar a fuera de servicio'),
]


class UvaPrestamo(models.Model):
    _name = 'uva.prestamo'
    _description = 'Préstamo de equipo para visita'
    _inherit = ['mail.thread']
    _order = 'fecha_entrega desc, id desc'

    name = fields.Char(string='Folio', compute='_compute_name', store=True)
    visita_id = fields.Many2one('uva.visita', string='Visita', required=True, ondelete='cascade', index=True)
    verificador_id = fields.Many2one('uva.verificador', string='Inspector', compute='_compute_verificador',
                                     store=True, readonly=False)
    state = fields.Selection([('reservado', 'Reservado'), ('entregado', 'Entregado al inspector'),
                              ('devuelto', 'Devuelto y revisado')],
                             string='Estado', required=True, default='reservado', tracking=True, index=True)
    fecha_entrega = fields.Datetime(string='Entregado el')
    devolver_antes = fields.Date(string='Devolver antes de')
    requerido_el = fields.Date(string='Equipo requerido el', help='Fecha en que el equipo está reservado para otra visita.')
    equipos_texto = fields.Char(string='Equipos asignados', compute='_compute_equipos_texto', store=True,
                                readonly=False)
    receptor = fields.Char(string='Recibió en almacén')
    fecha_devolucion = fields.Datetime(string='Devuelto el')
    linea_ids = fields.One2many('uva.prestamo.linea', 'prestamo_id', string='Equipos')

    @api.depends('visita_id.name')
    def _compute_name(self):
        for rec in self:
            rec.name = rec.visita_id.name or False

    @api.depends('visita_id.verificador_id')
    def _compute_verificador(self):
        for rec in self:
            rec.verificador_id = rec.visita_id.verificador_id

    @api.depends('linea_ids.name')
    def _compute_equipos_texto(self):
        for rec in self:
            nombres = [n.split(' ')[0] for n in rec.linea_ids.mapped('name') if n]
            nombres = [n if n.isupper() else n.lower() for n in nombres]
            texto = ', '.join(nombres)
            rec.equipos_texto = (texto[:1].upper() + texto[1:]) if texto else False

    def _uva_vencido(self, hoy):
        self.ensure_one()
        return bool(self.state == 'entregado' and self.devolver_antes and self.devolver_antes < hoy)

    def action_entregar(self):
        for rec in self:
            if rec.state != 'reservado':
                raise UserError('Solo se pueden entregar préstamos reservados.')
            rec.write({'state': 'entregado', 'fecha_entrega': fields.Datetime.now()})
        return True

    def _uva_json(self, hoy):
        self.ensure_one()
        entrega = ut.a_local(self.env, self.fecha_entrega)
        visita = self.visita_id
        insp = ut.sin_corchetes(ut.prefijo(self.verificador_id.name or ''))
        vencido = self._uva_vencido(hoy)
        if vencido:
            due = 'Vencido · se requiere el %s' % ut.fdia_mes(self.requerido_el or self.devolver_antes)
        else:
            due = ut.fdia_mes(self.devolver_antes)
        data = {
            'id': str(self.id),
            'folio': ut.sin_corchetes(self.name),
            'visitLabel': 'Visita %s' % ut.fdia_mes(visita.fecha),
            'inspector': ut.nombre_corto(self.verificador_id.name or ''),
            'equipment': self.equipos_texto or '',
            'delivered': ('%s hrs' % entrega.strftime('%d/%m %H:%M')) if entrega else ut.GUION,
            'dueText': due,
            'detail': '%s · Visita del %s · entregado a las %s' % (
                insp, ut.fdia_mes(visita.fecha), ('%s hrs' % entrega.strftime('%H:%M')) if entrega else ut.GUION),
            'returnItems': [l._uva_json() for l in self.linea_ids],
        }
        if vencido:
            data['overdue'] = True
        return data


class UvaPrestamoLinea(models.Model):
    _name = 'uva.prestamo.linea'
    _description = 'Equipo prestado'
    _order = 'prestamo_id, sequence, id'

    prestamo_id = fields.Many2one('uva.prestamo', string='Préstamo', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    name = fields.Char(string='Equipo', required=True)
    inventario = fields.Char(string='Inventario', required=True)
    instrumento_id = fields.Many2one('uva.instrumento', string='Instrumento', compute='_compute_instrumento',
                                     store=True, readonly=False)
    recibido = fields.Boolean(string='Recibido', default=True)
    accesorios = fields.Boolean(string='Accesorios completos', default=True)
    funciona = fields.Boolean(string='Funciona bien', default=True)
    comentario = fields.Char(string='Observación')
    destino = fields.Selection(DESTINOS, string='Destino', required=True, default='disponible')
    con_incidencia = fields.Boolean(string='Con incidencia', compute='_compute_con_incidencia')

    @api.depends('inventario')
    def _compute_instrumento(self):
        Inst = self.env['uva.instrumento']
        for rec in self:
            rec.instrumento_id = Inst.search([('codigo', '=', rec.inventario)], limit=1) if rec.inventario else False

    @api.depends('accesorios', 'funciona', 'recibido')
    def _compute_con_incidencia(self):
        for rec in self:
            rec.con_incidencia = not (rec.accesorios and rec.funciona and rec.recibido)

    def _uva_json(self):
        self.ensure_one()
        return {
            'name': self.name or '',
            'inv': self.inventario or '',
            'received': self.recibido,
            'accessories': self.accesorios,
            'works': self.funciona,
            'issue': self.con_incidencia,
            'comment': self.comentario or '',
            'target': dict(self._fields['destino'].selection).get(self.destino, ''),
        }


class UvaInstrumento(models.Model):
    _inherit = 'uva.instrumento'

    prestamo_linea_ids = fields.One2many('uva.prestamo.linea', 'instrumento_id', string='Préstamos')

    def _uva_json(self):
        data = super()._uva_json()
        hoy = ut.hoy(self.env)
        usos = []
        for linea in self.prestamo_linea_ids.sorted(key=lambda l: l.prestamo_id.visita_id.fecha or hoy, reverse=True):
            visita = linea.prestamo_id.visita_id
            if visita.fecha and visita.fecha >= hoy and visita.state not in ('realizada', 'cancelada'):
                fecha = 'Programado %s' % ut.fdia_mes(visita.fecha)
            else:
                fecha = ut.fdate(visita.fecha)
            usos.append({
                'folio': ut.corchetes(visita.name),
                'label': visita.cliente_corto or visita.cliente_nombre or '',
                'date': fecha,
            })
        data['usage'] = usos
        return data

    def _uva_en_prestamo_activo(self, excluir_visita=None):
        self.ensure_one()
        lineas = self.prestamo_linea_ids.filtered(
            lambda l: l.prestamo_id.state in ('reservado', 'entregado')
            and (not excluir_visita or l.prestamo_id.visita_id != excluir_visita))
        return bool(lineas)
