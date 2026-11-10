# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import api, fields, models

from . import uva_tools as ut


class UvaPozo(models.Model):
    _name = 'uva.pozo'
    _description = 'Pozo / aprovechamiento'
    _inherit = ['mail.thread']
    _order = 'partner_id, identificador, id'

    name = fields.Char(string='Nombre del pozo', required=True, tracking=True)
    identificador = fields.Char(string='Identificador', required=True, default='ID-001',
                                help='Identificador del aprovechamiento dentro del título (p. ej. ID-001).')
    partner_id = fields.Many2one('res.partner', string='Cliente', required=True, ondelete='cascade',
                                 index=True, domain=[('uva_es_cliente', '=', True)])
    active = fields.Boolean(default=True)
    titulo_concesion = fields.Char(string='Título de concesión', tracking=True)
    anexo = fields.Char(string='Anexo')
    uso = fields.Char(string='Uso')
    fuente = fields.Selection([('subterranea', 'Subterránea'), ('superficial', 'Superficial')],
                              string='Fuente', default='subterranea')
    volumen_anual = fields.Float(string='Volumen anual concesionado (m³)', digits=(16, 0))
    coordenadas = fields.Char(string='Coordenadas WGS84')
    diametro_descarga = fields.Char(string='Diámetro de descarga')
    medidor_marca = fields.Char(string='Marca del medidor')
    medidor_modelo = fields.Char(string='Modelo del medidor')
    medidor_serie = fields.Char(string='Número de serie del medidor')
    medidor_dn = fields.Char(string='Diámetro nominal (DN)')
    fecha_instalacion = fields.Date(string='Fecha de instalación')
    factura_proveedor = fields.Char(string='Proveedor / factura')
    serie_unidad_electronica = fields.Char(string='NS unidad electrónica')
    serie_unidad_transmision = fields.Char(string='NS unidad de transmisión')
    ultima_inspeccion = fields.Char(string='Resultado última verificación', default='Sin verificación previa')
    fecha_ultima_inspeccion = fields.Date(string='Fecha última verificación')
    proxima_inspeccion = fields.Date(string='Próxima verificación periódica',
                                     compute='_compute_proxima_inspeccion', store=True, readonly=False)
    texto_proxima_inspeccion = fields.Char(
        string='Texto próxima verificación',
        help='Texto a mostrar (opcional). Si se deja vacío se calcula a partir de la fecha.')
    proxima_urgente = fields.Boolean(string='Próxima verificación urgente',
                                     compute='_compute_proxima_urgente', store=True, readonly=False)
    folio_activo = fields.Char(string='Folio en proceso')

    @api.depends('fecha_ultima_inspeccion')
    def _compute_proxima_inspeccion(self):
        for pozo in self:
            pozo.proxima_inspeccion = (ut.sumar_meses(pozo.fecha_ultima_inspeccion, 24)
                                       if pozo.fecha_ultima_inspeccion else False)

    @api.depends('proxima_inspeccion')
    def _compute_proxima_urgente(self):
        hoy = ut.hoy(self.env)
        for pozo in self:
            pozo.proxima_urgente = bool(
                pozo.proxima_inspeccion and hoy <= pozo.proxima_inspeccion <= hoy + timedelta(days=15))

    @api.depends('identificador', 'name')
    def _compute_display_name(self):
        for pozo in self:
            pozo.display_name = '%s · %s' % (pozo.identificador or '', pozo.name or '')

    # ------------------------------------------------------------------
    # Serialización para uva.api (forma WellSite del frontend)
    # ------------------------------------------------------------------
    def _uva_fuente_label(self):
        self.ensure_one()
        return dict(self._fields['fuente'].selection).get(self.fuente, '')

    def _uva_proxima_texto(self):
        self.ensure_one()
        if self.texto_proxima_inspeccion:
            return self.texto_proxima_inspeccion
        if self.folio_activo:
            return 'Inicial en proceso (%s)' % ut.corchetes(self.folio_activo)
        if self.proxima_inspeccion:
            return 'Periódica: %s' % ut.fdate(self.proxima_inspeccion)
        return ut.GUION

    def _uva_json(self):
        self.ensure_one()
        data = {
            'id': self.identificador or '',
            'recordId': str(self.id),
            'name': self.name or '',
            'concessionTitle': self.titulo_concesion or '',
            'annex': self.anexo or '',
            'use': self.uso or '',
            'source': self._uva_fuente_label(),
            'annualVolume': ut.fmt_volumen(self.volumen_anual),
            'coords': self.coordenadas or '',
            'dischargeDiameter': self.diametro_descarga or '',
            'meterBrand': self.medidor_marca or '',
            'meterModel': self.medidor_modelo or '',
            'meterSerial': self.medidor_serie or '',
            'meterDN': self.medidor_dn or '',
            'installationDate': ut.fdate(self.fecha_instalacion),
            'supplierInvoice': self.factura_proveedor or '',
            'electronicUnitSerial': self.serie_unidad_electronica or '',
            'transmissionUnitSerial': self.serie_unidad_transmision or '',
            'lastInspection': self.ultima_inspeccion or '',
            'lastInspectionDate': ut.fdate(self.fecha_ultima_inspeccion),
            'nextInspectionDue': self._uva_proxima_texto(),
        }
        if self.proxima_urgente:
            data['nextInspectionUrgent'] = True
        if self.folio_activo:
            data['activeFolio'] = self.folio_activo
        return data
