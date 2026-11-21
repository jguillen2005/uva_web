# -*- coding: utf-8 -*-
"""Registro de usuarios desde la web del Sistema UVA (sin entrar al Administrador de Odoo).

Solo un Administrador del Sistema UVA (o de Odoo) puede crear usuarios, cambiar sus roles, activarlos o
desactivarlos y restablecer su contraseña. Los roles son grupos de Odoo (GRUPOS_ROL). El rol «Inspector»
habilita además la app de campo: se crea o liga su ficha de verificador.

Toda contraseña asignada por un administrador es temporal: el usuario debe crear una nueva al entrar a la
web la primera vez (uva_cambiar_clave).
"""
import re
import secrets
import string

from odoo import api, models
from odoo.exceptions import UserError

from .api_base import GRUPOS_ROL

RE_CORREO = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
ROL_APP = 'uva_core.group_uva_inspector'      # rol que da acceso a la app de campo
ROL_ADMIN = 'uva_core.group_uva_admin'
DESCRIPCION_ROL = {
    'uva_core.group_uva_admin': 'Todo el sistema y el registro de usuarios',
    'uva_core.group_uva_gerente': 'Revisión técnica y dictámenes',
    'uva_core.group_uva_coordinador': 'Solicitudes y programación de visitas',
    'uva_core.group_uva_inspector': 'Verificador: usa la app de campo y ve sus visitas',
    'uva_core.group_uva_conagua': 'Carga de expedientes a CONAGUA',
    'uva_core.group_uva_equipos': 'Instrumentos y préstamos de equipo',
    'uva_core.group_uva_consulta': 'Solo consulta',
}


def clave_temporal(largo=10):
    """Contraseña temporal fácil de dictar: letras y números sin caracteres que se confunden (0/O, 1/l/I)."""
    alfabeto = ''.join(c for c in string.ascii_letters + string.digits if c not in '0O1lI')
    while True:
        clave = ''.join(secrets.choice(alfabeto) for _ in range(largo))
        if any(c.isdigit() for c in clave) and any(c.isupper() for c in clave) and any(c.islower() for c in clave):
            return clave


class UvaApiUsuarios(models.AbstractModel):
    _inherit = 'uva.api'

    # ------------------------------------------------------------------ permisos
    @api.model
    def _es_admin_uva(self, usuario):
        return bool(usuario) and (usuario.has_group(ROL_ADMIN) or usuario.has_group('base.group_system'))

    @api.model
    def _exigir_admin(self, login):
        actor = self._usuario_actual(login)
        if not self._es_admin_uva(actor):
            raise UserError('Solo un Administrador puede registrar usuarios o cambiar sus roles.')
        return actor

    @api.model
    def _roles_disponibles(self):
        roles = []
        for xmlid, etiqueta in GRUPOS_ROL:
            g = self.env.ref(xmlid, raise_if_not_found=False)
            if g:
                roles.append({
                    'clave': xmlid.split('.')[-1], 'nombre': etiqueta,
                    'descripcion': DESCRIPCION_ROL.get(xmlid, ''), 'app': xmlid == ROL_APP,
                })
        return roles

    @api.model
    def _grupos_de(self, claves):
        """Grupos de Odoo de los roles elegidos (claves cortas como 'group_uva_inspector')."""
        validas = {xmlid.split('.')[-1]: xmlid for xmlid, _e in GRUPOS_ROL}
        grupos = self.env['res.groups']
        for clave in claves or []:
            if clave not in validas:
                raise UserError('Rol no válido: %s' % clave)
            grupos |= self.env.ref(validas[clave])
        if not grupos:
            raise UserError('Elija al menos un rol.')
        return grupos

    @api.model
    def _usuario_json(self, u):
        claves = [xmlid.split('.')[-1] for xmlid, _e in GRUPOS_ROL
                  if (g := self.env.ref(xmlid, raise_if_not_found=False)) and g in u.group_ids]
        ver = self.env['uva.verificador'].sudo().with_context(active_test=False).search([('user_id', '=', u.id)], limit=1)
        return {
            'id': u.id, 'name': u.name or '', 'email': u.email or u.login or '', 'login': u.login or '',
            'roleKeys': claves, 'active': bool(u.active), 'cambiarClave': bool(u.uva_cambiar_clave),
            'verificadorCode': ver.code or '' if ver else '',
        }

    # ------------------------------------------------------------------ verificador de la app
    @api.model
    def _ligar_verificador(self, u):
        """Rol Inspector: ficha de verificador ligada al usuario (la crea o liga la que tenga su correo)."""
        Ver = self.env['uva.verificador'].sudo().with_context(active_test=False)
        ver = Ver.search([('user_id', '=', u.id)], limit=1)
        if not ver:
            ver = Ver.search([('email', '=ilike', u.email or u.login), ('user_id', '=', False)], limit=1)
            if ver:
                ver.user_id = u.id
        if not ver:
            palabras = [p for p in re.split(r'\s+', u.name or '') if p]
            base = ''.join(p[0] for p in palabras[:1] + palabras[-1:]).upper() or 'V'
            code, n = base, 1
            while Ver.search_count([('code', '=', code)]):
                n += 1
                code = '%s%d' % (base, n)
            ver = Ver.create({'name': u.name, 'code': code, 'user_id': u.id, 'email': u.email or u.login, 'estado': 'activo'})
        if not ver.active:
            ver.active = True
        return ver

    # ------------------------------------------------------------------ API
    @api.model
    def get_roles_usuario(self, **kwargs):
        return self._roles_disponibles()

    @api.model
    def create_usuario(self, login=None, vals=None, **kwargs):
        self._exigir_admin(login)
        vals = vals or {}
        nombre = (vals.get('name') or '').strip()
        correo = (vals.get('email') or '').strip().lower()
        if len(nombre) < 3:
            raise UserError('Escriba el nombre completo.')
        if not RE_CORREO.match(correo):
            raise UserError('Escriba un correo electrónico válido.')
        Users = self.env['res.users'].sudo().with_context(active_test=False, no_reset_password=True)
        if Users.search_count(['|', ('login', '=ilike', correo), ('email', '=ilike', correo)]):
            raise UserError('Ya existe un usuario con el correo %s.' % correo)
        grupos = self._grupos_de(vals.get('roles'))
        clave = (vals.get('password') or '').strip() or clave_temporal()
        if len(clave) < 8:
            raise UserError('La contraseña inicial debe tener al menos 8 caracteres.')
        u = Users.create({
            'name': nombre, 'login': correo, 'email': correo, 'password': clave,
            'lang': 'es_MX', 'tz': 'America/Mexico_City', 'uva_cambiar_clave': True,
            'group_ids': [(6, 0, (self.env.ref('base.group_user') | grupos).ids)],
        })
        if self.env.ref(ROL_APP) in grupos:
            self._ligar_verificador(u)
        return self._ok('Usuario %s registrado.' % nombre, usuario=self._usuario_json(u), claveTemporal=clave)

    @api.model
    def update_usuario(self, login=None, usuario_id=None, vals=None, **kwargs):
        actor = self._exigir_admin(login)
        vals = vals or {}
        u = self.env['res.users'].sudo().with_context(active_test=False).browse(int(usuario_id or 0)).exists()
        if not u or u.share:
            raise UserError('No se encontró el usuario.')
        cambios = {}
        if 'name' in vals:
            nombre = (vals.get('name') or '').strip()
            if len(nombre) < 3:
                raise UserError('Escriba el nombre completo.')
            cambios['name'] = nombre
        if 'roles' in vals:
            propios = self.env['res.groups']
            for xmlid, _e in GRUPOS_ROL:
                g = self.env.ref(xmlid, raise_if_not_found=False)
                if g:
                    propios |= g
            nuevos = self._grupos_de(vals.get('roles'))
            if u == actor and self.env.ref(ROL_ADMIN) not in nuevos and not actor.has_group('base.group_system'):
                raise UserError('No puede quitarse a sí mismo el rol de Administrador.')
            cambios['group_ids'] = [(3, g.id) for g in propios - nuevos] + [(4, g.id) for g in nuevos]
        if 'active' in vals:
            if u == actor and not vals['active']:
                raise UserError('No puede desactivar su propio usuario.')
            if u == self.env.ref('base.user_admin') and not vals['active']:
                raise UserError('El usuario admin no se puede desactivar.')
            cambios['active'] = bool(vals['active'])
        if cambios:
            u.write(cambios)
        ver = self.env['uva.verificador'].sudo().with_context(active_test=False).search([('user_id', '=', u.id)], limit=1)
        if u.has_group(ROL_APP) and u.active:
            self._ligar_verificador(u)
        elif ver and ver.active and (not u.active or not u.has_group(ROL_APP)):
            ver.active = False   # sin rol de verificador (o desactivado): ya no aparece para programar visitas
        return self._ok('Usuario %s actualizado.' % u.name, usuario=self._usuario_json(u))

    @api.model
    def restablecer_clave_usuario(self, login=None, usuario_id=None, **kwargs):
        self._exigir_admin(login)
        u = self.env['res.users'].sudo().with_context(active_test=False).browse(int(usuario_id or 0)).exists()
        if not u or u.share:
            raise UserError('No se encontró el usuario.')
        clave = clave_temporal()
        u.write({'password': clave, 'uva_cambiar_clave': True})
        return self._ok('Contraseña temporal creada para %s.' % u.name, usuario=self._usuario_json(u), claveTemporal=clave)
