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
    # ---- Datos del cliente en Aspel SAE (catálogo de clientes exportado). Se usan los campos estándar de
    # Odoo cuando existen: calle (street), C.P. (zip), población (city), estado (state_id), país (country_id),
    # teléfono (phone), correo (email) y página web (website). Saldos y movimientos no se guardan.
    uva_aspel_estatus = fields.Selection(
        [('A', 'Activo'), ('S', 'Suspendido'), ('B', 'Baja')], string='Estatus en Aspel')
    uva_curp = fields.Char(string='CURP')
    uva_num_exterior = fields.Char(string='Número exterior')
    uva_num_interior = fields.Char(string='Número interior')
    uva_entre_calle = fields.Char(string='Entre calle')
    uva_y_calle = fields.Char(string='Y calle')
    uva_colonia = fields.Char(string='Colonia')
    uva_municipio = fields.Char(string='Municipio')
    uva_nacionalidad = fields.Char(string='Nacionalidad')
    uva_aspel_referencia = fields.Char(string='Referencia (Aspel)')
    uva_fax = fields.Char(string='Fax')
    uva_aspel_clasificacion = fields.Char(string='Clasificación (Aspel)')
    uva_aspel_zona = fields.Char(string='Clave de zona (Aspel)')
    uva_aspel_vendedor = fields.Char(string='Clave de vendedor (Aspel)')
    uva_aspel_tipo_empresa = fields.Char(string='Tipo de empresa (Aspel)')
    uva_aspel_cuenta_contable = fields.Char(string='Cuenta contable (Aspel)')
    uva_aspel_enviar_cfd = fields.Boolean(string='Enviar CFD por correo')
    uva_aspel_con_credito = fields.Boolean(string='Con crédito')
    uva_aspel_dias_credito = fields.Integer(string='Días de crédito')
    uva_aspel_limite_credito = fields.Float(string='Límite de crédito', digits=(16, 2))
    # Domicilio de envío (Aspel)
    uva_envio_calle = fields.Char(string='Calle de envío')
    uva_envio_num_exterior = fields.Char(string='Núm. ext. de envío')
    uva_envio_num_interior = fields.Char(string='Núm. int. de envío')
    uva_envio_entre_calle = fields.Char(string='Entre calle (envío)')
    uva_envio_y_calle = fields.Char(string='Y calle (envío)')
    uva_envio_colonia = fields.Char(string='Colonia de envío')
    uva_envio_poblacion = fields.Char(string='Población de envío')
    uva_envio_municipio = fields.Char(string='Municipio de envío')
    uva_envio_estado = fields.Char(string='Estado de envío')
    uva_envio_pais = fields.Char(string='País de envío')
    uva_envio_cp = fields.Char(string='C.P. de envío')
    uva_envio_zona = fields.Char(string='Clave de zona de envío')
    uva_envio_referencia = fields.Char(string='Referencia de envío')
    uva_aspel_importado = fields.Datetime(string='Última importación desde Aspel', readonly=True)

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

    # Datos de Aspel SAE para la ficha del cliente en la web: (etiqueta, valor) en orden, solo los que tienen dato
    _UVA_CAMPOS_ASPEL = (
        'uva_codigo_aspel', 'uva_aspel_estatus', 'uva_curp', 'uva_nacionalidad', 'street', 'uva_num_exterior',
        'uva_num_interior', 'uva_entre_calle', 'uva_y_calle', 'uva_colonia', 'zip', 'city', 'uva_municipio', 'state_id',
        'country_id', 'uva_aspel_referencia', 'email', 'uva_fax', 'website', 'uva_aspel_clasificacion', 'uva_aspel_zona',
        'uva_aspel_vendedor', 'uva_aspel_tipo_empresa', 'uva_aspel_cuenta_contable', 'uva_aspel_enviar_cfd',
        'uva_aspel_con_credito', 'uva_aspel_dias_credito', 'uva_aspel_limite_credito',
        'uva_envio_calle', 'uva_envio_num_exterior', 'uva_envio_num_interior', 'uva_envio_entre_calle', 'uva_envio_y_calle',
        'uva_envio_colonia', 'uva_envio_cp', 'uva_envio_poblacion', 'uva_envio_municipio', 'uva_envio_estado',
        'uva_envio_pais', 'uva_envio_zona', 'uva_envio_referencia', 'uva_aspel_importado')
    _UVA_ETIQUETAS_ASPEL = {
        'uva_codigo_aspel': 'Clave', 'street': 'Calle', 'zip': 'Código postal', 'city': 'Población', 'state_id': 'Estado',
        'country_id': 'País', 'email': 'Correo', 'website': 'Página web'}

    def _uva_aspel_json(self):
        self.ensure_one()
        if not self.uva_aspel_importado:
            return []
        filas = []
        registro = self.with_context(lang='es_MX')  # nombres de estado y país en español
        for nombre in self._UVA_CAMPOS_ASPEL:
            campo = self._fields[nombre]
            valor = registro[nombre]
            if campo.type == 'boolean':
                texto = 'Sí' if valor else 'No'
            elif campo.type == 'many2one':
                texto = valor.name if valor else ''
            elif campo.type == 'selection':
                texto = dict(campo.selection).get(valor, '') if valor else ''
            elif campo.type == 'datetime':
                texto = fields.Datetime.context_timestamp(self, valor).strftime('%d/%m/%Y %H:%M') if valor else ''
            elif campo.type == 'float':
                texto = '{:,.2f}'.format(valor) if valor else ''
            elif campo.type == 'integer':
                texto = str(valor) if valor else ''
            else:
                texto = valor or ''
            if texto:
                filas.append([self._UVA_ETIQUETAS_ASPEL.get(nombre, campo.string), texto])
        return filas

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
            'aspel': self._uva_aspel_json(),
        }
