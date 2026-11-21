"""Inicio de sesión de la web del Sistema UVA con los usuarios de Odoo.

La sesión es una cookie firmada (HMAC-SHA256, HttpOnly) con el usuario de Odoo. El gateway nginx la
valida en cada llamada a la API con auth_request contra /api/sesion/validar y reenvía el login real a
los microservicios en la cabecera X-UVA-User: así aplican los roles y la regla de imparcialidad del
usuario que de verdad está trabajando.
"""
import base64
import hashlib
import hmac
import json
import logging
import time

from odoo import fields, http
from odoo.exceptions import AccessDenied
from odoo.http import request

from odoo.addons.uva_app_movil.models.uva_app_movil import AppError

_logger = logging.getLogger(__name__)

COOKIE = 'uva_sesion'
HORAS = 10  # una jornada de oficina
RUTA = {'type': 'http', 'auth': 'public', 'csrf': False, 'save_session': False}
NO_VALIDA = 'Su sesión venció o no es válida. Inicie sesión nuevamente.'


def _b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def _unb64(texto):
    return base64.urlsafe_b64decode(texto + '=' * (-len(texto) % 4))


def _icp():
    return request.env['ir.config_parameter'].sudo()


def _secreto():
    return _icp().get_param('uva_sesion_web.secreto', '').encode()


def _horas():
    return int(_icp().get_param('uva_sesion_web.horas', HORAS))


def _firmar(user):
    # 'aud' separa las sesiones de la web de los tokens de la app de campo
    datos = {'aud': 'web', 'uid': user.id, 'login': user.login, 'exp': int(time.time()) + _horas() * 3600}
    carga = _b64(json.dumps(datos).encode())
    firma = _b64(hmac.new(_secreto(), carga.encode(), hashlib.sha256).digest())
    return '%s.%s' % (carga, firma)


def _usuario_de_la_cookie():
    """Usuario de Odoo de la sesión, o AppError 401."""
    token = request.httprequest.cookies.get(COOKIE, '')
    try:
        carga, firma = token.split('.')
        esperada = _b64(hmac.new(_secreto(), carga.encode(), hashlib.sha256).digest())
        if not _secreto() or not hmac.compare_digest(firma, esperada):
            raise ValueError
        datos = json.loads(_unb64(carga))
        if datos.get('aud') != 'web' or datos['exp'] < time.time():
            raise ValueError
    except Exception:
        raise AppError(401, NO_VALIDA)
    user = request.env['res.users'].sudo().browse(int(datos['uid'])).exists()
    if not user or not _puede_entrar(user):
        raise AppError(401, NO_VALIDA)
    return user


def _puede_entrar(user):
    """Usuarios internos y activos; nunca usuarios de portal ni el usuario técnico de los microservicios.
    Los datos de demostración marcan también a admin como técnico (para ocultarlo del directorio), así
    que los técnicos con permisos de administrador de Odoo sí pueden entrar."""
    if not user.active or user.share:
        return False
    # El administrador principal de Odoo (admin) entra siempre, aunque esté marcado como técnico.
    if user == request.env.ref('base.user_admin', raise_if_not_found=False):
        return True
    return not user.uva_usuario_tecnico or user.has_group('base.group_system')


def _ip():
    return request.httprequest.remote_addr or ''


def _cuerpo():
    try:
        return json.loads(request.httprequest.get_data() or b'{}')
    except ValueError:
        raise AppError(400, 'El cuerpo de la petición no es JSON válido')


def _login_de(correo):
    """La pantalla pide el correo: si no es el login de Odoo, se busca al usuario por su correo."""
    Users = request.env['res.users'].sudo()
    if Users.search_count([('login', '=ilike', correo)]):
        return Users.search([('login', '=ilike', correo)], limit=1).login
    por_correo = Users.search([('email', '=ilike', correo)], limit=2)
    return por_correo.login if len(por_correo) == 1 else correo


def _perfil(user):
    return request.env['uva.api'].sudo().get_perfil(login=user.login)


def _poner_cookie(respuesta, valor, max_age):
    https = request.httprequest.headers.get('X-Forwarded-Proto', request.httprequest.scheme) == 'https'
    respuesta.set_cookie(COOKIE, valor, max_age=max_age, httponly=True, samesite='Lax', secure=https, path='/')
    return respuesta


def _responder(funcion):
    try:
        return funcion()
    except AppError as e:
        request.env.cr.rollback()
        return request.make_json_response({'error': e.message}, status=e.status)
    except Exception:
        request.env.cr.rollback()
        _logger.exception('Error en el inicio de sesión de la web')
        return request.make_json_response({'error': 'Error interno del servidor'}, status=500)


class SesionWebController(http.Controller):

    @http.route('/api/sesion/login', methods=['POST'], **RUTA)
    def login(self):
        def operar():
            body = _cuerpo()
            correo = str(body.get('email') or '').strip().lower()
            password = str(body.get('password') or '')
            if not correo or not password:
                raise AppError(400, 'Escriba su correo y su contraseña.')
            Acceso = request.env['uva.app.acceso'].sudo()
            clave = 'web|%s|%s' % (correo, _ip())
            hasta = Acceso.bloqueado_hasta_de(clave)
            if hasta:
                minutos = max(1, int((hasta - fields.Datetime.now()).total_seconds() // 60) + 1)
                raise AppError(429, 'Acceso bloqueado por intentos fallidos. Intente de nuevo en %d min.' % minutos)
            try:
                info = request.env['res.users'].sudo().authenticate(
                    {'type': 'password', 'login': _login_de(correo), 'password': password}, {'interactive': False})
            except AccessDenied:
                Acceso.registrar_fallo(clave)
                raise AppError(401, 'Correo o contraseña incorrectos.')
            user = request.env['res.users'].sudo().browse(info['uid'])
            if not _puede_entrar(user):
                Acceso.registrar_fallo(clave)
                raise AppError(403, 'Este usuario no tiene acceso a la web del Sistema UVA.')
            Acceso.registrar_exito(clave)
            user.uva_ultimo_acceso = fields.Datetime.now()
            respuesta = request.make_json_response({'ok': True, 'perfil': _perfil(user)})
            return _poner_cookie(respuesta, _firmar(user), _horas() * 3600)
        return _responder(operar)

    @http.route('/api/sesion/recuperar', methods=['POST'], **RUTA)
    def recuperar(self):
        def operar():
            correo = str(_cuerpo().get('email') or '').strip().lower()
            if not correo:
                raise AppError(400, 'Escriba su correo electrónico.')
            user = request.env['res.users'].sudo().search(
                ['|', ('login', '=ilike', correo), ('email', '=ilike', correo)], limit=1)
            if user and _puede_entrar(user):
                try:
                    user.action_reset_password()
                except Exception:
                    # Sin servidor de correo configurado: se registra, pero no se revela al usuario
                    _logger.exception('No se pudo enviar el correo de restablecimiento a %s', user.login)
            # El mismo mensaje siempre: no revela qué correos existen
            return request.make_json_response({
                'ok': True,
                'message': 'Si el correo está registrado, recibirá un enlace para restablecer su contraseña.',
            })
        return _responder(operar)

    @http.route('/api/sesion/salir', methods=['POST'], **RUTA)
    def salir(self):
        respuesta = request.make_json_response({'ok': True})
        return _poner_cookie(respuesta, '', 0)

    @http.route('/api/sesion/yo', methods=['GET'], **RUTA)
    def yo(self):
        return _responder(lambda: request.make_json_response({'perfil': _perfil(_usuario_de_la_cookie())}))

    @http.route(['/api/sesion/acceso-predeterminado', '/api/app/acceso-predeterminado'], methods=['GET'], **RUTA)
    def acceso_predeterminado(self):
        """Usuario del sistema con que se prellena el inicio de sesión de la web y de la app.

        Los datos viven en la base de Odoo (parámetros uva.usuario_sistema / uva.clave_sistema, que fija el
        instalador), no en el código. La contraseña solo se entrega mientras siga siendo la original: si el
        cliente la cambió, se devuelve únicamente el correo."""
        def operar():
            icp = _icp()
            correo = (icp.get_param('uva.usuario_sistema') or '').strip()
            clave = icp.get_param('uva.clave_sistema') or ''
            user = request.env['res.users'].sudo().search([('login', '=', correo)], limit=1) if correo else None
            if not user or not _puede_entrar(user):
                return request.make_json_response({'correo': '', 'clave': ''})
            vigente = False
            if clave:
                try:
                    request.env['res.users'].sudo().authenticate(
                        {'type': 'password', 'login': correo, 'password': clave}, {'interactive': False})
                    vigente = True
                except AccessDenied:
                    vigente = False
            return request.make_json_response({'correo': correo, 'clave': clave if vigente else ''},
                                              headers=[('Cache-Control', 'no-store')])
        return _responder(operar)

    @http.route('/api/sesion/cambiar-clave', methods=['POST'], **RUTA)
    def cambiar_clave(self):
        """Contraseña nueva del usuario de la sesión (obligatoria si su contraseña es inicial o temporal)."""
        def operar():
            user = _usuario_de_la_cookie()
            body = _cuerpo()
            actual = str(body.get('actual') or '')
            nueva = str(body.get('nueva') or '')
            if len(nueva) < 8 or not any(c.isdigit() for c in nueva) or not any(c.isalpha() for c in nueva):
                raise AppError(400, 'La contraseña nueva debe tener al menos 8 caracteres, con letras y números.')
            if nueva == actual:
                raise AppError(400, 'La contraseña nueva debe ser distinta de la actual.')
            try:
                request.env['res.users'].sudo().authenticate(
                    {'type': 'password', 'login': user.login, 'password': actual}, {'interactive': False})
            except AccessDenied:
                raise AppError(401, 'La contraseña actual no es correcta.')
            user.sudo().write({'password': nueva, 'uva_cambiar_clave': False})
            return request.make_json_response({'ok': True, 'message': 'Contraseña actualizada.', 'perfil': _perfil(user)})
        return _responder(operar)

    @http.route('/api/sesion/validar', methods=['GET'], **RUTA)
    def validar(self):
        """Para el auth_request del gateway: 200 con el login en X-UVA-Login, o 401.
        Con contraseña inicial o temporal (uva_cambiar_clave) responde 403: primero debe crear una nueva."""
        try:
            user = _usuario_de_la_cookie()
        except AppError:
            return request.make_response('', status=401)
        if user.uva_cambiar_clave:
            return request.make_response('', status=403)
        return request.make_response('', headers=[('X-UVA-Login', user.login)])
