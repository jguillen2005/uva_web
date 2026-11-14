"""Endpoints /api/app/* de la App Asercontrol, servidos directo por Odoo (sin capa de microservicios).

El gateway nginx del Sistema UVA publica solo /api/app/*; el backoffice de Odoo sigue interno.
Autenticación: token firmado (HMAC-SHA256) que se obtiene en /api/app/auth/login con el usuario y
contraseña de Odoo del verificador. Cada endpoint opera solo sobre las visitas y expedientes del verificador.
"""
import base64
import hashlib
import hmac
import json
import logging
import time

from odoo import http
from odoo.exceptions import AccessError, UserError
from odoo.http import request

from ..models.uva_app_movil import AppError

_logger = logging.getLogger(__name__)

TOKEN_HORAS = 24  # debe cubrir una jornada en campo sin señal
RUTA = {'type': 'http', 'auth': 'public', 'csrf': False, 'save_session': False}


def _b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def _unb64(texto):
    return base64.urlsafe_b64decode(texto + '=' * (-len(texto) % 4))


def _secreto():
    return request.env['ir.config_parameter'].sudo().get_param('uva_app_movil.secreto', '').encode()


def _firmar(uid, login):
    horas = int(request.env['ir.config_parameter'].sudo().get_param('uva_app_movil.token_horas', TOKEN_HORAS))
    carga = _b64(json.dumps({'uid': uid, 'login': login, 'exp': int(time.time()) + horas * 3600}).encode())
    firma = _b64(hmac.new(_secreto(), carga.encode(), hashlib.sha256).digest())
    return '%s.%s' % (carga, firma), horas


def _usuario_del_token():
    cabecera = request.httprequest.headers.get('Authorization', '')
    token = cabecera[7:] if cabecera.startswith('Bearer ') else ''
    try:
        carga, firma = token.split('.')
        esperada = _b64(hmac.new(_secreto(), carga.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(firma, esperada):
            raise ValueError
        datos = json.loads(_unb64(carga))
        if datos['exp'] < time.time():
            raise ValueError
    except Exception:
        raise AppError(401, 'Sesión no válida o vencida. Inicie sesión nuevamente.')
    user = request.env['res.users'].sudo().browse(int(datos['uid'])).exists()
    if not user or not user.active:
        raise AppError(401, 'Sesión no válida o vencida. Inicie sesión nuevamente.')
    return user


def _cuerpo():
    try:
        return json.loads(request.httprequest.get_data() or b'{}')
    except ValueError:
        raise AppError(400, 'El cuerpo de la petición no es JSON válido')


def _api():
    return request.env['uva.app.movil'].sudo()


def _responder(funcion):
    """Ejecuta la operación y convierte errores en respuestas JSON con su código HTTP."""
    try:
        return request.make_json_response(funcion())
    except AppError as e:
        request.env.cr.rollback()
        cuerpo = {'error': e.message}
        if e.details:
            cuerpo['details'] = e.details
        return request.make_json_response(cuerpo, status=e.status)
    except AccessError as e:
        request.env.cr.rollback()
        return request.make_json_response({'error': str(e)}, status=403)
    except UserError as e:
        request.env.cr.rollback()
        return request.make_json_response({'error': str(e)}, status=422)
    except Exception:
        request.env.cr.rollback()
        _logger.exception('Error en la API de la app móvil')
        return request.make_json_response({'error': 'Error interno del servidor'}, status=500)


class AppMovilController(http.Controller):

    @http.route('/api/app/health', methods=['GET'], **RUTA)
    def health(self):
        return request.make_json_response({'ok': True, 'servicio': 'app-movil', 'odoo': True})

    # ---------- Acceso ----------
    @http.route('/api/app/auth/login', methods=['POST'], **RUTA)
    def login(self):
        def operar():
            body = _cuerpo()
            login = str(body.get('email') or '').strip().lower()
            password = str(body.get('password') or '')
            if not login or not password:
                raise AppError(400, 'Ingrese su correo y contraseña')
            user, perfil = _api().autenticar(login, password, request.httprequest.remote_addr)
            token, horas = _firmar(user.id, user.login)
            return {'token': token, 'expiresInHours': horas, 'user': perfil, 'company': _api().empresa()}
        return _responder(operar)

    @http.route('/api/app/auth/recuperar', methods=['POST'], **RUTA)
    def recuperar(self):
        def operar():
            login = str(_cuerpo().get('email') or '').strip().lower()
            if not login:
                raise AppError(400, 'Ingrese su correo')
            return {'ok': True, 'mensaje': _api().solicitar_restablecimiento(login)}
        return _responder(operar)

    # ---------- Agenda ----------
    @http.route('/api/app/visitas', methods=['GET'], **RUTA)
    def visitas(self):
        return _responder(lambda: _api().visitas(_usuario_del_token()))

    @http.route('/api/app/visitas/orden', methods=['PUT'], **RUTA)
    def orden(self):
        def operar():
            user = _usuario_del_token()
            body = _cuerpo()
            return _api().guardar_orden(user, body.get('fecha'), [str(f) for f in body.get('folios') or []])
        return _responder(operar)

    @http.route('/api/app/visitas/<string:folio>/estado', methods=['POST'], **RUTA)
    def estado(self, folio):
        def operar():
            user = _usuario_del_token()
            if _cuerpo().get('estado') != 'en_proceso':
                raise AppError(400, 'Estado no permitido desde la app')
            return _api().iniciar_visita(user, folio)
        return _responder(operar)

    # ---------- Actas ----------
    @http.route('/api/app/actas', methods=['POST'], **RUTA)
    def recibir_acta(self):
        def operar():
            user = _usuario_del_token()
            body = _cuerpo()
            if not body.get('folio') or not body.get('data'):
                raise AppError(400, 'Falta el folio o los datos del acta')
            resultado = _api().recibir_acta(user, str(body['folio']), body['data'], body.get('respuestas'),
                                            body.get('observacionesPreguntas'), body.get('pdf'))
            return resultado
        return _responder(operar)

    @http.route('/api/app/actas', methods=['GET'], **RUTA)
    def revisiones(self):
        return _responder(lambda: _api().revisiones(_usuario_del_token()))

    # ---------- Perfil ----------
    @http.route('/api/app/perfil', methods=['GET'], **RUTA)
    def perfil(self):
        return _responder(lambda: _api().perfil(_usuario_del_token()))

    @http.route('/api/app/perfil', methods=['PATCH'], **RUTA)
    def actualizar_perfil(self):
        return _responder(lambda: _api().actualizar_perfil(_usuario_del_token(), _cuerpo()))

    @http.route('/api/app/perfil/foto', methods=['PUT'], **RUTA)
    def foto(self):
        return _responder(lambda: _api().actualizar_foto(_usuario_del_token(), _cuerpo().get('photoUrl')))

    @http.route('/api/app/perfil/contrasena', methods=['POST'], **RUTA)
    def contrasena(self):
        def operar():
            user = _usuario_del_token()
            body = _cuerpo()
            _api().cambiar_contrasena(user, str(body.get('actual') or ''), str(body.get('nueva') or ''))
            return {'ok': True}
        return _responder(operar)

    # ---------- Catálogos ----------
    @http.route('/api/app/instrumentos', methods=['GET'], **RUTA)
    def instrumentos(self):
        return _responder(lambda: _api().instrumentos(_usuario_del_token()))

    @http.route('/api/app/empresa', methods=['GET'], **RUTA)
    def empresa(self):
        def operar():
            _usuario_del_token()
            return _api().empresa()
        return _responder(operar)
