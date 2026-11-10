# -*- coding: utf-8 -*-
"""Fachada JSON del Sistema UVA para los microservicios (API externa JSON-2 de Odoo 19).

Todos los métodos públicos son ``@api.model``, reciben argumentos con nombre y devuelven
estructuras JSON simples con exactamente la forma que espera el frontend React
(claves camelCase, fechas como texto ``dd/mm/aaaa``, etiquetas en español).
Las acciones devuelven ``{'ok': True, 'message': '<texto para toast>', ...}``.
"""
from odoo import api, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut

GRUPOS_ROL = [
    # (xmlid, etiqueta en la columna "roles" de UsuariosView)
    ('uva_core.group_uva_gerente', 'Gerente Técnico'),
    ('uva_core.group_uva_coordinador', 'Coordinador'),
    ('uva_core.group_uva_inspector', 'Inspector'),
    ('uva_core.group_uva_conagua', 'Registro CONAGUA'),
    ('uva_core.group_uva_equipos', 'Resp. equipos'),
    ('uva_core.group_uva_admin', 'Administrador'),
    ('uva_core.group_uva_consulta', 'Consulta'),
]


class UvaApi(models.AbstractModel):
    _name = 'uva.api'
    _description = 'API JSON del Sistema UVA'

    # ------------------------------------------------------------------
    # Utilidades internas (privadas: no expuestas por JSON-2)
    # ------------------------------------------------------------------
    @api.model
    def _hoy(self):
        return ut.hoy(self.env)

    @api.model
    def _ind(self):
        return self.env['uva.indicador']

    @api.model
    def _ok(self, message, **datos):
        res = {'ok': True, 'message': message}
        res.update(datos)
        return res

    @api.model
    def _vals(self, vals):
        if vals is None:
            return {}
        if not isinstance(vals, dict):
            raise UserError('Los datos enviados no tienen el formato esperado.')
        return vals

    @api.model
    def _usuarios_de_grupo(self, xmlid):
        grupo = self.env.ref(xmlid, raise_if_not_found=False)
        if not grupo:
            return self.env['res.users']
        return grupo.sudo().user_ids.filtered(lambda u: u.active and not u.uva_usuario_tecnico and not u.share)

    @api.model
    def _seleccion_clave(self, model, field_name, valor):
        """Clave de una selección a partir de su clave o etiqueta (insensible a mayúsculas)."""
        if valor in (None, False, ''):
            return False
        texto = str(valor).strip().lower()
        for clave, etiqueta in self.env[model]._fields[field_name].selection:
            if texto in (str(clave).lower(), str(etiqueta).lower()):
                return clave
        return False
