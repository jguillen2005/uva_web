# -*- coding: utf-8 -*-
"""Mi perfil: datos del usuario en sesión, permisos efectivos y preferencias."""
import re

from odoo import api, models
from odoo.exceptions import UserError

from .api_base import GRUPOS_ROL

# Rol (xmlid) → columna de uva.matriz.permiso
COLUMNA_ROL = {
    'uva_core.group_uva_admin': 'p_admin',
    'uva_core.group_uva_coordinador': 'p_coordinador',
    'uva_core.group_uva_inspector': 'p_inspector',
    'uva_core.group_uva_gerente': 'p_gerente',
    'uva_core.group_uva_conagua': 'p_conagua',
    'uva_core.group_uva_equipos': 'p_equipos',
    'uva_core.group_uva_consulta': 'p_consulta',
}
RANGO = {'—': 0, 'V': 1, 'E': 2, 'A': 3}
PREFS = {
    'correo': 'uva_notif_correo',
    'teams': 'uva_notif_teams',
    'vencimientos': 'uva_notif_vencimientos',
    'resumenDiario': 'uva_resumen_diario',
}
RE_TEL = re.compile(r'^[0-9+()\-\s.]{7,25}$')
RE_ETIQUETA = re.compile(r'^\s*\[([^\]]+)\]\s*(.*)$')


class UvaApiPerfil(models.AbstractModel):
    _inherit = 'uva.api'

    @api.model
    def _usuario_actual(self, login=None):
        """Usuario final de la petición.

        Mientras no haya SSO en el gateway, el login llega vacío y se usa el parámetro
        ``uva.usuario_actual`` (por omisión ``gtorres``, el usuario de la maqueta).
        """
        Users = self.env['res.users'].sudo()
        login = (login or '').strip() or \
            self.env['ir.config_parameter'].sudo().get_param('uva.usuario_actual', 'gtorres')
        usuario = Users.search(['|', ('login', '=', login), ('email', '=ilike', login),
                                ('share', '=', False)], limit=1)
        if not usuario:
            raise UserError('No se encontró el usuario "%s" en el Sistema UVA.' % login)
        return usuario

    @api.model
    def _perfil_json(self, u):
        m = RE_ETIQUETA.match(u.name or '')
        puesto, nombre = (m.group(1), m.group(2)) if m else ('', u.name or '')
        palabras = [p for p in re.sub(r'^(Ing|Lic|Dr|Dra|Téc|Mtro|Mtra)\.\s*', '', nombre).split() if p]
        iniciales = ''.join(p[0] for p in palabras[:1] + palabras[-1:]).upper() if palabras else '?'

        propios = []
        columnas = []
        for xmlid, etiqueta in GRUPOS_ROL:
            g = self.env.ref(xmlid, raise_if_not_found=False)
            if g and g in u.group_ids:
                propios.append(etiqueta)
                if xmlid in COLUMNA_ROL:
                    columnas.append(COLUMNA_ROL[xmlid])

        permisos = []
        for fila in self.env['uva.matriz.permiso'].sudo().search([]):
            mejor = max((fila[c] or '—' for c in columnas), key=lambda v: RANGO.get(v, 0), default='—')
            permisos.append({'mod': fila.name, 'val': mejor})

        verificador = self.env['uva.verificador'].sudo().search(
            [('email', '=ilike', u.email or u.login)], limit=1)
        return {
            'name': nombre,
            'initials': iniciales,
            'title': puesto or (propios[0] if propios else 'Usuario'),
            'email': u.email or u.login or '',
            'login': u.login or '',
            'phone': u.partner_id.phone or '',
            'tz': u.tz or 'America/Mexico_City',
            'roles': propios,
            'lastAccess': self._fecha_acceso(u, self._hoy()),
            'identityProvider': 'Microsoft 365 (Entra ID)',
            'verificadorCode': verificador.code or '' if verificador else '',
            'prefs': {clave: bool(u[campo]) for clave, campo in PREFS.items()},
            'permisos': permisos,
        }

    @api.model
    def get_perfil(self, login=None, **kwargs):
        return self._perfil_json(self._usuario_actual(login))

    @api.model
    def update_perfil(self, login=None, vals=None, **kwargs):
        vals = self._vals(vals)
        u = self._usuario_actual(login)
        escribir = {}
        if 'phone' in vals:
            tel = (vals.get('phone') or '').strip()
            if tel and not RE_TEL.match(tel):
                raise UserError('El teléfono solo puede contener números, espacios, +, guiones y paréntesis.')
            u.partner_id.sudo().phone = tel or False
        prefs = vals.get('prefs') or {}
        if not isinstance(prefs, dict):
            raise UserError('Las preferencias no tienen el formato esperado.')
        for clave, valor in prefs.items():
            if clave in PREFS:
                escribir[PREFS[clave]] = bool(valor)
        if escribir:
            u.sudo().write(escribir)
        return self._ok('Perfil actualizado', perfil=self._perfil_json(u))
