# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    uva_es_cliente = fields.Boolean(string='Cliente UVA', index=True)
    uva_tipo_fiscal = fields.Selection(
        [('moral', 'Persona moral'), ('fisica', 'Persona física')],
        string='Tipo fiscal', default='moral')
    uva_domicilio_fiscal = fields.Char(string='Domicilio fiscal')
    uva_codigo_aspel = fields.Char(string='Código Aspel SAE', index=True)
    uva_representante_legal = fields.Char(string='Representante legal')
    uva_contacto_avisos = fields.Char(string='Contacto para avisos')
    uva_carpeta_sharepoint = fields.Char(
        string='Carpeta SharePoint', compute='_compute_uva_carpeta_sharepoint',
        store=True, readonly=False)
    uva_pozo_ids = fields.One2many('uva.pozo', 'partner_id', string='Pozos / aprovechamientos')
    uva_pozo_count = fields.Integer(string='Núm. de pozos', compute='_compute_uva_pozo_count')

    @api.depends('vat')
    def _compute_uva_carpeta_sharepoint(self):
        for partner in self:
            partner.uva_carpeta_sharepoint = ('/Clientes/%s' % partner.vat) if partner.vat else False

    @api.depends('uva_pozo_ids')
    def _compute_uva_pozo_count(self):
        for partner in self:
            partner.uva_pozo_count = len(partner.uva_pozo_ids)

    def _uva_tipo_fiscal_label(self):
        self.ensure_one()
        return dict(self._fields['uva_tipo_fiscal'].selection).get(self.uva_tipo_fiscal, '')

    def _uva_json(self):
        """Forma ``ClientItem`` del frontend."""
        self.ensure_one()
        return {
            'id': str(self.id),
            'name': self.name or '',
            'rfc': self.vat or '',
            'fiscalType': self._uva_tipo_fiscal_label(),
            'fiscalAddress': self.uva_domicilio_fiscal or '',
            'aspelCode': self.uva_codigo_aspel or '',
            'legalRep': self.uva_representante_legal or '',
            'noticeContact': self.uva_contacto_avisos or '',
            'phone': self.phone or '',
            'sharePointFolder': self.uva_carpeta_sharepoint or '',
            'wells': [pozo._uva_json() for pozo in self.uva_pozo_ids],
        }
