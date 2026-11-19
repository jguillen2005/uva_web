"""Lógica de la App Asercontrol (tablet del verificador) sobre los modelos del Sistema UVA.

Cada método recibe el usuario autenticado de la app y valida que los registros le pertenezcan antes de
leer o escribir. No hay tablas propias de agenda, pozos, instrumentos ni actas: todo vive en los modelos UVA.
"""
import json
import re
from datetime import timedelta

from odoo import api, fields, models
from odoo.exceptions import AccessDenied, UserError

from odoo.addons.uva_dictaminacion.models.uva_expediente import normalizar_respuesta

# Preguntas C / NC / N/A del formato F-18-AC v1.5 que evalúa la app
F18_PREGUNTAS = 61
# Firmas obligatorias: verificador, persona que atiende y los dos testigos (sig-3, capacitación, es opcional)
FIRMAS_OBLIGATORIAS = ('sig-1', 'sig-2', 'sig-4', 'sig-5')
DATA_URL = re.compile(r'^data:(image/(?:jpeg|jpg|png|webp|svg\+xml));base64,(.+)$', re.S)
PDF_URL = re.compile(r'^data:application/pdf;base64,(.+)$', re.S)
PREFIJO_FOTO_APP = 'APP_'

ESTADO_VISITA_APP = {'programada': 'programada', 'confirmada': 'programada', 'en_campo': 'en_proceso', 'realizada': 'completada'}
TIPO_VERIFICACION_APP = {
    'inicial': 'Inicial (Nueva Instalación)',
    'periodica': 'Periódica (2 Años)',
    'extraordinaria': 'Extraordinaria por Modificación',
}
USOS_APP = {'agricola': 'Agrícola', 'industrial': 'Industrial', 'publico urbano': 'Público Urbano', 'servicios': 'Servicios'}
REVISION_APP = {'por_revisar': 'recibida', 'devuelto': 'devuelta', 'autorizado': 'aprobada', 'con_acuse': 'aprobada', 'inconforme': 'aprobada'}
EDITABLES_PERFIL = {
    'phone': 'app_telefono',
    'mobile': 'app_celular',
    'defaultUserName': 'app_atiende_nombre',
    'defaultUserIdType': 'app_atiende_id_tipo',
    'defaultUserIdNumber': 'app_atiende_id_numero',
}


class AppError(Exception):
    """Error que la API responde tal cual: código HTTP, mensaje en español y detalle opcional."""

    def __init__(self, status, message, details=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.details = details


# ---------- Conversión de formatos ----------

def hora_ampm(hhmm):
    """'09:30' -> '09:30 a. m.'"""
    m = re.match(r'^\s*(\d{1,2}):(\d{2})', hhmm or '')
    if not m:
        return ''
    h, mi = int(m.group(1)), int(m.group(2))
    sufijo = 'a. m.' if h < 12 else 'p. m.'
    return '%02d:%02d %s' % (h % 12 or 12, mi, sufijo)


def ddmmaaaa(fecha):
    return fecha.strftime('%d/%m/%Y') if fecha else ''


def iso_utc(dt):
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ') if dt else None


def numero(texto):
    m = re.search(r'-?\d+(?:\.\d+)?', str(texto or ''))
    return float(m.group(0)) if m else 0


def coordenadas(texto):
    """'22.7709° N, 102.5832° W' o '24.721480, -107.452390' -> (lat, lng)"""
    partes = re.findall(r'(-?\d+(?:\.\d+)?)\s*°?\s*([NSEWO])?', texto or '', re.I)
    if len(partes) < 2:
        return 0.0, 0.0
    (lat, hemi_lat), (lng, hemi_lng) = partes[0], partes[1]
    lat, lng = float(lat), float(lng)
    if hemi_lat.upper() == 'S':
        lat = -abs(lat)
    if hemi_lng.upper() in ('W', 'O'):
        lng = -abs(lng)
    return lat, lng


def uso_app(uso):
    clave = (uso or '').strip().lower().replace('á', 'a').replace('ú', 'u')
    return USOS_APP.get(clave, (uso or 'Agrícola').strip() or 'Agrícola')


class UvaAppMovil(models.AbstractModel):
    _name = 'uva.app.movil'
    _description = 'API de la App Asercontrol (verificador en campo)'

    # ------------------------------------------------------------------
    # Acceso
    # ------------------------------------------------------------------
    @api.model
    def _verificador(self, user):
        ver = self.env['uva.verificador'].sudo().search([('user_id', '=', user.id)], limit=1)
        if not ver or ver.estado == 'inactivo':
            raise AppError(403, 'El usuario no está dado de alta como verificador activo en el Sistema UVA.')
        return ver

    @api.model
    def _hoy(self, user):
        return fields.Date.context_today(self.with_context(tz=user.tz or 'America/Monterrey'))

    @api.model
    def autenticar(self, login, password, ip):
        """Valida usuario y contraseña de Odoo; aplica bloqueo tras 5 intentos fallidos (por correo e IP)."""
        Acceso = self.env['uva.app.acceso']
        clave = '%s|%s' % (login, ip)
        hasta = Acceso.bloqueado_hasta_de(clave)
        if hasta:
            minutos = max(1, int((hasta - fields.Datetime.now()).total_seconds() // 60) + 1)
            raise AppError(429, 'Acceso bloqueado por intentos fallidos. Intente más tarde (%d min).' % minutos)
        # La app pide el correo: si no es el login de Odoo, se busca al usuario por su correo.
        Users = self.env['res.users'].sudo()
        if '@' in (login or '') and not Users.search_count([('login', '=', login)]):
            por_correo = Users.search([('email', '=ilike', login.strip())], limit=2)
            if len(por_correo) == 1:
                login = por_correo.login
        try:
            info = self.env['res.users'].sudo().authenticate(
                {'type': 'password', 'login': login, 'password': password}, {'interactive': False})
        except AccessDenied:
            Acceso.registrar_fallo(clave)
            raise AppError(401, 'Correo o contraseña incorrectos.')
        user = self.env['res.users'].sudo().browse(info['uid'])
        try:
            ver = self._verificador(user)
        except AppError:
            Acceso.registrar_fallo(clave)
            raise
        Acceso.registrar_exito(clave)
        perfil = self.perfil(user)  # el último acceso mostrado es el anterior
        ver.app_ultimo_acceso = fields.Datetime.now()
        return user, perfil

    @api.model
    def solicitar_restablecimiento(self, login):
        """Correo de restablecimiento de Odoo. No revela si el correo existe."""
        user = self.env['res.users'].sudo().search([('login', '=ilike', login)], limit=1)
        if user and self.env['uva.verificador'].sudo().search_count([('user_id', '=', user.id)]):
            user.action_reset_password()
        return 'Si el correo está registrado como verificador, recibirá un enlace para restablecer su contraseña.'

    # ------------------------------------------------------------------
    # Perfil y empresa
    # ------------------------------------------------------------------
    @api.model
    def perfil(self, user):
        ver = self._verificador(user)
        foto = user.image_256 or b''
        # Sin foto cargada, Odoo genera un avatar SVG: la app muestra sus propias iniciales
        foto = foto.decode() if foto and foto[:4] not in (b'PD94', b'PHN2') else False
        nombre = ver.name or user.name
        iniciales = ''.join(p[0] for p in re.sub(r'^(Ing|Lic|Tec|C|Dr|Arq)\.\s+', '', nombre).split()[:2]).upper()
        Exp = self.env['uva.expediente'].sudo()
        return {
            'id': str(user.id),
            'name': nombre,
            'email': ver.email or user.email or user.login,
            'role': ver.app_puesto or 'Verificador',
            'emaCredential': ver.app_credencial_ema or ver.code or '',
            'accreditationExpiry': ddmmaaaa(ver.fecha_competencia) or ver.texto_competencia or '',
            'avatarInitials': iniciales or 'VA',
            'phone': ver.app_telefono or None,
            'mobile': ver.app_celular or None,
            'cedulaProf': ver.app_cedula_profesional or None,
            'conaguaApproval': self.env.company.app_aprobacion_conagua or None,
            'defaultUserName': ver.app_atiende_nombre or None,
            'defaultUserIdType': ver.app_atiende_id_tipo or None,
            'defaultUserIdNumber': ver.app_atiende_id_numero or None,
            'photoUrl': ('data:image/%s;base64,%s' % ('jpeg' if foto.startswith('/9j/') else 'png', foto)) if foto else None,
            'inspectionsCompleted': Exp.search_count([('verificador_id', '=', ver.id), ('app_version', '>', 0)]),
            'lastLogin': fields.Datetime.context_timestamp(self.with_context(tz=user.tz or 'America/Monterrey'), ver.app_ultimo_acceso).strftime('%d/%m/%Y, %H:%M hrs') if ver.app_ultimo_acceso else None,
        }

    @api.model
    def actualizar_perfil(self, user, valores):
        ver = self._verificador(user)
        no_editables = [k for k in valores if k not in EDITABLES_PERFIL]
        if no_editables:
            raise AppError(422, 'Estos datos los administra la oficina y no se pueden cambiar desde la app', no_editables)
        ver.write({EDITABLES_PERFIL[k]: str(v or '').strip()[:120] for k, v in valores.items()})
        return self.perfil(user)

    @api.model
    def actualizar_foto(self, user, data_url):
        self._verificador(user)
        imagen = False
        if data_url:
            m = DATA_URL.match(data_url)
            if not m or 'svg' in m.group(1):
                raise AppError(422, 'La foto debe ser una imagen JPEG, PNG o WEBP')
            if len(m.group(2)) * 3 / 4 > 2 * 1024 * 1024:
                raise AppError(422, 'La foto excede 2 MB')
            imagen = m.group(2)
        user.sudo().image_1920 = imagen
        return self.perfil(user)

    @api.model
    def cambiar_contrasena(self, user, actual, nueva):
        if not actual or len(nueva or '') < 8:
            raise AppError(422, 'Ingrese su contraseña actual y una nueva de al menos 8 caracteres')
        if actual == nueva:
            raise AppError(422, 'La nueva contraseña debe ser distinta de la actual')
        try:
            self.env(user=user.id)['res.users'].change_password(actual, nueva)
        except AccessDenied:
            raise AppError(403, 'La contraseña actual no es correcta')
        except UserError as e:
            raise AppError(422, str(e))
        return True

    @api.model
    def empresa(self):
        c = self.env.company.sudo()
        domicilio = ' '.join(x for x in [c.street, c.street2, ', '.join(x for x in [c.city, c.state_id.name] if x),
                                         c.country_id.name, ('C.P. %s' % c.zip) if c.zip else ''] if x)
        return {
            'companyName': c.name or '',
            'companySub': c.app_subtitulo or '',
            'rfcCompany': c.vat or '',
            'companyEmail': c.email or '',
            'companyPhone': c.phone or '',
            'emaAccreditation': c.app_acreditacion_ema or '',
            'conaguaApproval': c.app_aprobacion_conagua or '',
            'companyAddress': domicilio,
        }

    # ------------------------------------------------------------------
    # Instrumentos (uva.instrumento)
    # ------------------------------------------------------------------
    @api.model
    def _instrumento_json(self, inst, indice):
        alerta = {'vencido': 'Calibración vencida', 'por_vencer': 'Por vencer', 'fuera_servicio': 'Fuera de servicio',
                  'en_calibracion': 'En calibración'}
        estilos = [('bg-amber-100', 'text-amber-800'), ('bg-sky-100', 'text-sky-800'), ('bg-emerald-100', 'text-emerald-800'),
                   ('bg-violet-100', 'text-violet-800'), ('bg-rose-100', 'text-rose-800')]
        bg, color = estilos[indice % len(estilos)]
        return {
            'id': str(inst.id),
            'number': indice + 1,
            'name': inst.tipo or inst.name or '',
            'description': inst.nombre_corto or inst.tipo or '',
            'brandModel': inst.marca_modelo or '',
            'serialNumber': inst.serie or '',
            'inventoryNumber': inst.codigo or '',
            'calibrationExpiry': ddmmaaaa(inst.fecha_vencimiento),
            'badgeText': alerta.get(inst.status, 'Calibrado'),
            'badgeType': 'alerta' if inst.status in alerta else 'calibrado',
            'icon': 'construction',
            'iconBg': bg,
            'iconColor': color,
        }

    @api.model
    def instrumentos(self, user):
        self._verificador(user)
        insts = self.env['uva.instrumento'].sudo().search([], order='codigo')
        return [self._instrumento_json(i, n) for n, i in enumerate(insts)]

    # ------------------------------------------------------------------
    # Agenda (uva.visita)
    # ------------------------------------------------------------------
    @api.model
    def _visita_json(self, visita, ver):
        sol = visita.solicitud_id
        pozo = sol.pozo_id
        partner = visita.partner_id or sol.partner_id or pozo.partner_id
        lat, lng = coordenadas(pozo.coordenadas)
        prestamos = visita.prestamo_ids.filtered(lambda p: p.state != 'devuelto')
        insts = prestamos.linea_ids.instrumento_id or ver.instrumento_ids
        instrumentos = [self._instrumento_json(i, n) for n, i in enumerate(insts)]
        # Un expediente devuelto en revisión técnica regresa la visita a "en proceso" en la tablet para corregirla
        devuelto = self.env['uva.expediente'].sudo().search_count([('visita_id', '=', visita.id), ('state', '=', 'devuelto')])
        estado = 'en_proceso' if devuelto else ESTADO_VISITA_APP.get(visita.state, 'programada')
        return {
            'id': 'uva-visita-%d' % visita.id,
            'orderFolio': visita.name or '',
            'date': fields.Date.to_string(visita.fecha) if visita.fecha else '',
            'startTime': hora_ampm(visita.hora),
            'endTime': hora_ampm(visita.app_hora_fin),
            'titularName': partner.name or visita.cliente_nombre or sol.cliente_nombre or '',
            'titularRfc': partner.vat or '',
            'concessionTitle': pozo.titulo_concesion or sol.titulo_concesion or '',
            'wellId': pozo.name or visita.sitio or sol.pozo_nombre or '',
            'wellAddress': visita.lugar or partner.contact_address or '',
            'lat': lat,
            'lng': lng,
            'contactPerson': visita.app_contacto_nombre or '',
            'contactPhone': visita.app_contacto_telefono or partner.phone or '',
            'contactRole': visita.app_contacto_cargo or '',
            'contactIdType': visita.app_contacto_id_tipo or '',
            'contactIdNumber': visita.app_contacto_id_numero or '',
            'concessionUse': uso_app(pozo.uso),
            'annualVolume': pozo.volumen_anual or 0,
            'dischargeDiameter': int(numero(pozo.diametro_descarga)),
            'verificationType': TIPO_VERIFICACION_APP.get(visita.tipo_verificacion, 'Periódica (2 Años)'),
            'meterBrand': pozo.medidor_marca or '',
            'meterModel': pozo.medidor_modelo or '',
            'meterDn': int(numero(pozo.medidor_dn)),
            'meterSerial': pozo.medidor_serie or '',
            'status': estado,
            'priority': visita.app_prioridad or 'normal',
            'notes': visita.app_notas or None,
            'verifierId': str(ver.user_id.id),
            'verifierName': ver.name,
            'orderIndex': visita.app_orden_dia or None,
            'instrumentIds': [i['id'] for i in instrumentos],
            'instruments': instrumentos,
        }

    @api.model
    def visitas(self, user):
        ver = self._verificador(user)
        hoy = self._hoy(user)
        visitas = self.env['uva.visita'].sudo().search([
            ('verificador_id', '=', ver.id),
            ('tipo_registro', '=', 'visita'),
            ('state', 'in', tuple(ESTADO_VISITA_APP)),
            ('fecha', '>=', hoy - timedelta(days=7)),
            ('fecha', '<=', hoy + timedelta(days=45)),
        ], order='fecha asc, app_orden_dia asc, hora asc, id asc')
        return [self._visita_json(v, ver) for v in visitas]

    @api.model
    def _visita_propia(self, user, folio):
        ver = self._verificador(user)
        visita = self.env['uva.visita'].sudo().search([('name', '=', folio), ('tipo_registro', '=', 'visita')], limit=1)
        if not visita:
            raise AppError(404, 'No existe la visita %s' % folio)
        if visita.verificador_id != ver:
            raise AppError(403, 'La visita no está asignada a este verificador')
        return visita, ver

    @api.model
    def guardar_orden(self, user, fecha, folios):
        ver = self._verificador(user)
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', fecha or '') or not folios:
            raise AppError(400, 'Indique la fecha y el orden de los folios')
        visitas = self.env['uva.visita'].sudo().search([
            ('verificador_id', '=', ver.id), ('fecha', '=', fecha), ('name', 'in', folios)])
        por_folio = {v.name: v for v in visitas}
        ajenos = [f for f in folios if f not in por_folio]
        if ajenos:
            raise AppError(422, 'Algunas visitas no son de ese día o no están asignadas a usted', ajenos)
        for i, folio in enumerate(folios):
            por_folio[folio].app_orden_dia = i + 1
        return {'fecha': fecha, 'folios': folios}

    @api.model
    def iniciar_visita(self, user, folio):
        """La inspección comenzó en la tablet: visita "en campo" y expediente de campo abierto (flujo UVA)."""
        visita, _ver = self._visita_propia(user, folio)
        if visita.state in ('programada', 'confirmada'):
            visita.state = 'en_campo'
            self.env['uva.api'].sudo()._expediente_campo(visita.name, crear=True)
        return {'folio': folio, 'estado': ESTADO_VISITA_APP.get(visita.state, visita.state)}

    # ------------------------------------------------------------------
    # Acta F-18 -> uva.expediente
    # ------------------------------------------------------------------
    @api.model
    def _validar_acta(self, data, folio, respuestas):
        faltantes = []
        if not isinstance(data, dict):
            return ['El acta no tiene datos']
        if data.get('folio') != folio:
            faltantes.append('El folio del acta no coincide con el del envío')
        if data.get('status') != 'Concluida':
            faltantes.append('El acta no está concluida')
        if not re.match(r'^\d{4}-\d{2}-\d{2}', str(data.get('inspectionDate') or '')):
            faltantes.append('Fecha de inspección inválida')
        for campo, texto in (('currentReading', 'Lectura actual del medidor'),
                             ('verificationLabels', '6.13 Folios de etiquetas de verificación'),
                             ('custodySeals', '6.14 Folios de precintos de verificación')):
            if not str(data.get(campo) or '').strip():
                faltantes.append(texto)
        contestadas = [r for r in respuestas if normalizar_respuesta(r.get('respuesta'))]
        if len(contestadas) < F18_PREGUNTAS:
            faltantes.append('%d pregunta(s) sin responder' % (F18_PREGUNTAS - len(contestadas)))
        firmas = {f.get('id'): f for f in data.get('signatures') or [] if isinstance(f, dict)}
        for fid in FIRMAS_OBLIGATORIAS:
            f = firmas.get(fid)
            if not f or f.get('status') != 'Firmado' or not f.get('signatureImg'):
                faltantes.append('Firma faltante: %s' % ((f or {}).get('role') or fid))
            elif not str(f.get('name') or '').strip():
                faltantes.append('Nombre faltante: %s' % f.get('role'))
        return faltantes

    @api.model
    def _extraer_imagenes(self, data, folio):
        """Separa fotos y firmas (data URL) del acta; en el acta queda la referencia "adjunto:<nombre>"."""
        imagenes = []
        base = re.sub(r'[^A-Za-z0-9._-]+', '-', folio).strip('-')

        def walk(valor, ruta):
            if isinstance(valor, str):
                m = DATA_URL.match(valor)
                if not m:
                    return valor
                mime = m.group(1).replace('image/jpg', 'image/jpeg')
                ext = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg'}[mime]
                nombre = '%s%s_%s.%s' % (PREFIJO_FOTO_APP, base, re.sub(r'[^A-Za-z0-9._-]+', '-', ruta)[:80], ext)
                imagenes.append({'campo': ruta, 'nombre': nombre, 'mime': mime, 'base64': m.group(2)})
                return 'adjunto:%s' % nombre
            if isinstance(valor, list):
                return [walk(v, '%s.%s' % (ruta, v.get('id') if isinstance(v, dict) and v.get('id') else i)) for i, v in enumerate(valor)]
            if isinstance(valor, dict):
                return {k: walk(v, '%s.%s' % (ruta, k) if ruta else k) for k, v in valor.items()}
            return valor

        return walk(data, ''), imagenes

    @api.model
    def recibir_acta(self, user, folio, data, respuestas, observaciones_preguntas, pdf):
        visita, ver = self._visita_propia(user, folio)
        Exp = self.env['uva.expediente'].sudo()
        exp = Exp.search([('name', '=', folio)], order='id desc', limit=1)

        # Reenvío de un acta ya recibida (la tablet no recibió la respuesta): no se duplica.
        # Solo un expediente en campo o devuelto acepta el acta (devuelto = nueva versión corregida).
        if exp and exp.state not in ('en_campo', 'devuelto'):
            return {'folio': folio, 'estado': REVISION_APP.get(exp.state, 'recibida'), 'version': exp.app_version,
                    'syncedAt': iso_utc(exp.app_recibida), 'duplicada': True}

        respuestas = [r for r in respuestas or [] if isinstance(r, dict)]
        faltantes = self._validar_acta(data, folio, respuestas)
        if faltantes:
            raise AppError(422, 'El acta está incompleta', faltantes)

        # Fecha validada con el reloj del servidor, no con el del dispositivo
        fecha_acta = str(data['inspectionDate'])[:10]
        if visita.fecha and fecha_acta != fields.Date.to_string(visita.fecha):
            raise AppError(422, 'La fecha del acta (%s) no coincide con la fecha programada (%s)'
                           % (fecha_acta, fields.Date.to_string(visita.fecha)))
        if fecha_acta > fields.Date.to_string(self._hoy(user)):
            raise AppError(422, 'La fecha del acta es posterior a la fecha del servidor')

        pdf64 = None
        if pdf:
            m = PDF_URL.match(pdf)
            if not m:
                raise AppError(422, 'El acta oficial debe enviarse en PDF')
            pdf64 = m.group(1)

        limpio, imagenes = self._extraer_imagenes(data, folio)
        exp = exp or self.env['uva.api'].sudo()._expediente_campo(folio, crear=True)

        # Puntos de la lista de verificación: respuesta C / NC / N/A y observación de campo
        Punto = self.env['uva.expediente.punto'].sudo()
        formato = exp.formato_id
        for orden, r in enumerate(respuestas, start=1):
            num = str(r.get('numero') or '').strip()
            resp = normalizar_respuesta(r.get('respuesta'))
            if not num or not resp:
                continue
            punto_f = formato.seccion_ids.punto_ids.filtered(lambda p: p.numero == num)[:1] if formato else Punto.browse()
            valores = {'respuesta': resp, 'observacion': (r.get('observacion') or '').strip() or False}
            registro = exp.punto_ids.filtered(lambda p: p.numero == num)[:1]
            if registro:
                registro.write(valores)
            else:
                Punto.create(dict(valores, expediente_id=exp.id, numero=num, seccion=num.split('.')[0], sequence=orden,
                                  punto_formato_id=punto_f.id or False, texto=r.get('texto') or punto_f.pregunta or num))

        # Fotografías y firmas: se reemplazan las de un envío anterior de la app
        Foto = self.env['uva.expediente.foto'].sudo()
        exp.foto_ids.filtered(lambda f: (f.name or '').startswith(PREFIJO_FOTO_APP)).unlink()
        fotos_creadas = 0
        for n, img in enumerate(imagenes, start=1):
            if img['mime'] == 'image/svg+xml':
                # Firmas vectoriales: adjunto del expediente (el campo de imagen solo admite mapas de bits)
                self.env['ir.attachment'].sudo().create({'name': img['nombre'], 'datas': img['base64'], 'mimetype': img['mime'],
                                                         'res_model': 'uva.expediente', 'res_id': exp.id})
                continue
            Foto.create({'expediente_id': exp.id, 'sequence': 1000 + n, 'name': img['nombre'],
                         'descripcion': 'App · %s' % img['campo'], 'imagen': img['base64']})
            fotos_creadas += 1

        # PDF oficial en la carpeta 03_Campo del expediente
        if pdf64:
            Doc = self.env['uva.expediente.documento'].sudo()
            doc = exp._uva_doc('03_Campo') or Doc.create({'expediente_id': exp.id, 'carpeta': '03_Campo',
                                                          'name': 'Lista de verificación F-18 firmada, fotografías'})
            doc.write({'archivo': pdf64, 'archivo_nombre': 'Acta-%s.pdf' % folio, 'estado': 'listo'})

        version = exp.app_version + 1
        notas = '\n'.join('%s: %s' % (n.get('label'), n.get('text')) for n in observaciones_preguntas or [] if isinstance(n, dict))
        exp.write({
            'app_version': version,
            'app_recibida': fields.Datetime.now(),
            'app_hora_inicio': data.get('readingStartTime') or False,
            'app_hora_fin': data.get('readingEndTime') or False,
            'app_lectura': data.get('currentReading') or False,
            'app_numeral10': data.get('numeral10Compliance') is not False,
            'app_folios_etiquetas': data.get('verificationLabels') or False,
            'app_folios_precintos': data.get('custodySeals') or False,
            'app_observaciones_preguntas': notas or False,
            'app_observaciones': data.get('findingsText') or False,
            'app_datos_json': json.dumps(limpio, ensure_ascii=False),
            'nc_count': len(exp.punto_ids.filtered(lambda p: p.respuesta == 'NC')),
            'num_fotos': len(exp.foto_ids),
            'fecha_visita': visita.fecha,
            'verificador_id': ver.id,
        })
        # Flujo UVA: el expediente pasa a revisión técnica y la visita queda realizada
        exp.action_reenviar_revision()
        if version > 1:
            exp._uva_log('Acta corregida reenviada desde la app (versión %d)' % version)
        if visita.state != 'realizada':
            visita.state = 'realizada'
        cumple = exp.nc_count == 0 and data.get('numeral10Compliance') is not False
        return {'folio': folio, 'estado': 'recibida', 'version': version, 'syncedAt': iso_utc(exp.app_recibida),
                'resultado': 'cumple' if cumple else 'no_cumple', 'fotos': fotos_creadas, 'duplicada': False}

    @api.model
    def revisiones(self, user):
        """Revisión técnica de las actas del verificador: recibida, devuelta (con motivo) o aprobada."""
        ver = self._verificador(user)
        exps = self.env['uva.expediente'].sudo().search([
            ('app_version', '>', 0), ('state', 'in', tuple(REVISION_APP)),
            '|', ('verificador_id', '=', ver.id), ('visita_id.verificador_id', '=', ver.id),
        ], order='write_date desc', limit=200)
        salida = []
        for e in exps:
            dictamen = e._uva_dictamen()
            if dictamen:
                resultado = 'cumple' if dictamen.resultado == 'conforme' else 'no_cumple'
            else:
                resultado = 'cumple' if not e.nc_count else 'no_cumple'
            salida.append({
                'folio': e.name,
                'estado': REVISION_APP[e.state],
                'resultado': resultado,
                'syncedAt': iso_utc(e.app_recibida),
                'fechaRevision': iso_utc(e.write_date) if e.state != 'por_revisar' else None,
                'comentarioRevision': e.comentario_revision if e.state == 'devuelto' else None,
                'version': e.app_version,
            })
        return salida
