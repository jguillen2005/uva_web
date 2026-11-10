# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut
from odoo.addons.uva_solicitudes.models.uva_solicitud import TIPOS_VERIFICACION

ESTADOS_EXPEDIENTE = [
    ('en_campo', 'En campo'),
    ('por_revisar', 'Por revisar'),
    ('devuelto', 'Devuelto'),
    ('autorizado', 'Autorizado'),
    ('con_acuse', 'Con acuse'),
    ('inconforme', 'Dictamen inconforme'),
]
# estado → (stType, acción, pantalla destino)
PRESENTACION_ESTADO = {
    'en_campo': ('review', 'Ver avance', 'Revision'),
    'por_revisar': ('review', 'Revisar', 'Revision'),
    'devuelto': ('back', 'Ver comentarios', 'Revision'),
    'autorizado': ('auth', 'Cargar a CONAGUA', 'Expediente'),
    'con_acuse': ('done', 'Ver dictamen', 'Expediente'),
    'inconforme': ('inconforme', 'Ver dictamen', 'Expediente'),
}
RESPUESTAS = [('C', 'C'), ('NC', 'NC'), ('N/A', 'N/A')]
PLAZO_RESULTADOS_HABILES = 10
CARPETAS_DEFAULT = [
    ('01_Solicitud', 'Solicitud de servicio F-12 firmada'),
    ('02_DocsCliente', 'Documentos del cliente (título, certificado de calibración, factura, manuales)'),
    ('03_Campo', 'Lista de verificación F-18 firmada, fotografías y archivos del interrogador'),
    ('04_Dictamen', 'Dictamen F-17 firmado por el Gerente Técnico'),
    ('05_Acuse', 'Acuse oficial de registro ante CONAGUA'),
]
REVISION_PASOS = ['Solicitud F-12', 'Visita en campo', 'Revisión técnica', 'Dictamen autorizado',
                  'Cargado a CONAGUA', 'Acuse enviado al cliente']


def normalizar_respuesta(valor):
    texto = (valor or '').strip().upper().replace(' ', '')
    if texto in ('C', 'CUMPLE'):
        return 'C'
    if texto in ('NC', 'NOCUMPLE'):
        return 'NC'
    if texto in ('NA', 'N/A', 'NOAPLICA'):
        return 'N/A'
    return False


class UvaExpediente(models.Model):
    _name = 'uva.expediente'
    _description = 'Expediente de verificación'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'fecha_visita desc, id desc'

    name = fields.Char(string='Folio', required=True, index=True, tracking=True)
    solicitud_id = fields.Many2one('uva.solicitud', string='Solicitud', ondelete='set null')
    visita_id = fields.Many2one('uva.visita', string='Visita', ondelete='set null')
    partner_id = fields.Many2one('res.partner', string='Cliente (contacto)', domain=[('uva_es_cliente', '=', True)])
    pozo_id = fields.Many2one('uva.pozo', string='Pozo (registro)')
    cliente_nombre = fields.Char(string='Cliente', required=True)
    pozo_nombre = fields.Char(string='Pozo')
    titulo_concesion = fields.Char(string='Título de concesión')
    verificador_id = fields.Many2one('uva.verificador', string='Verificador', tracking=True)
    verificador_nombre = fields.Char(string='Verificador (como firma)', compute='_compute_verificador_nombre',
                                     store=True, readonly=False)
    fecha_visita = fields.Date(string='Fecha de visita')
    tipo_verificacion = fields.Selection(TIPOS_VERIFICACION, string='Tipo de verificación', default='inicial')
    formato_id = fields.Many2one('uva.formato', string='Lista de verificación usada')
    state = fields.Selection(ESTADOS_EXPEDIENTE, string='Estado', required=True, default='en_campo', tracking=True,
                             index=True)
    nc_count = fields.Integer(string='No conformidades',
                              help='Se recalcula con las respuestas NC al capturar en campo.')
    num_fotos = fields.Integer(string='Núm. de fotografías', help='Total de fotografías sincronizadas desde campo.')
    num_docs = fields.Integer(string='Documentos', default=0)
    fecha_limite = fields.Date(string='Plazo de resultados', compute='_compute_fecha_limite', store=True,
                               readonly=False, help='10 días hábiles a partir de la visita.')
    gps_actual = fields.Char(string='Última posición GPS del dispositivo')
    comentario_revision = fields.Text(string='Comentario de revisión')
    carpeta_sharepoint = fields.Char(string='Carpeta SharePoint')
    punto_ids = fields.One2many('uva.expediente.punto', 'expediente_id', string='Puntos verificados')
    foto_ids = fields.One2many('uva.expediente.foto', 'expediente_id', string='Fotografías')
    seccion_ids = fields.One2many('uva.expediente.seccion', 'expediente_id', string='Resumen por sección')
    check_ids = fields.One2many('uva.expediente.check', 'expediente_id', string='Validaciones automáticas')
    dato_ids = fields.One2many('uva.expediente.dato', 'expediente_id', string='Ficha del dictamen')
    documento_ids = fields.One2many('uva.expediente.documento', 'expediente_id', string='Documentos del expediente')
    log_ids = fields.One2many('uva.expediente.log', 'expediente_id', string='Bitácora')
    dictamen_ids = fields.One2many('uva.dictamen', 'expediente_id', string='Dictámenes')

    @api.depends('verificador_id')
    def _compute_verificador_nombre(self):
        for rec in self:
            rec.verificador_nombre = rec.verificador_id.name if rec.verificador_id else False

    @api.depends('fecha_visita')
    def _compute_fecha_limite(self):
        for rec in self:
            rec.fecha_limite = (ut.sumar_habiles(rec.fecha_visita, PLAZO_RESULTADOS_HABILES)
                                if rec.fecha_visita else False)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if 'documento_ids' not in vals:
                vals['documento_ids'] = [(0, 0, {'sequence': i, 'carpeta': c, 'name': n, 'estado': 'pendiente'})
                                         for i, (c, n) in enumerate(CARPETAS_DEFAULT, start=1)]
        return super().create(vals_list)

    # ------------------------------------------------------------------
    # Utilidades
    # ------------------------------------------------------------------
    @api.model
    def _uva_buscar(self, folio):
        if not folio:
            raise UserError('Debe indicar el folio del expediente.')
        rec = self.search([('name', '=', ut.sin_corchetes(str(folio)))], order='id desc', limit=1)
        if not rec and ut.es_numero(folio):
            rec = self.browse(int(folio)).exists()
        if not rec:
            raise UserError('No se encontró el expediente «%s».' % ut.sin_corchetes(str(folio)))
        return rec

    def _uva_usuario_firma(self):
        return ut.corchete_al_final(self.env.user.name or '')

    def _uva_log(self, descripcion, usuario=None):
        for rec in self:
            self.env['uva.expediente.log'].create({
                'expediente_id': rec.id,
                'fecha': fields.Datetime.now(),
                'descripcion': descripcion,
                'usuario': usuario or rec._uva_usuario_firma(),
            })

    def _uva_doc(self, carpeta):
        self.ensure_one()
        return self.documento_ids.filtered(lambda d: d.carpeta == carpeta)[:1]

    def _uva_dictamen(self):
        self.ensure_one()
        return self.dictamen_ids.sorted('id', reverse=True)[:1]

    def _uva_label(self, field_name):
        self.ensure_one()
        return dict(self._fields[field_name].selection).get(self[field_name], '')

    def _uva_sla(self, hoy):
        self.ensure_one()
        if self.state not in ('por_revisar', 'devuelto') or not self.fecha_limite:
            return ut.GUION, False, None
        n = ut.dias_habiles_entre(hoy, self.fecha_limite)
        if n < 0:
            return 'Vencido hace %d %s' % (-n, ut.plural(-n, 'día', 'días')), True, n
        return '%d %s' % (n, ut.plural(n, 'día', 'días')), n <= 2, n

    # ------------------------------------------------------------------
    # Decisiones de revisión técnica
    # ------------------------------------------------------------------
    def _uva_validar_revisable(self):
        self.ensure_one()
        if self.state not in ('por_revisar', 'devuelto'):
            raise UserError('El expediente %s no está en revisión técnica (estado: %s).'
                            % (self.name, self._uva_label('state')))

    def action_devolver(self, comentario=None):
        for rec in self:
            rec._uva_validar_revisable()
            if not (comentario or '').strip():
                raise UserError('Indique el motivo de la devolución al verificador.')
            rec.write({'state': 'devuelto', 'comentario_revision': comentario})
            rec._uva_log('Devuelto en revisión: %s' % comentario.strip())
            rec.message_post(body='Expediente devuelto al verificador: %s' % comentario.strip())
        return True

    def action_reenviar_revision(self):
        for rec in self.filtered(lambda e: e.state in ('en_campo', 'devuelto')):
            rec.state = 'por_revisar'
            rec._uva_log('Expediente sincronizado desde app y enviado a revisión técnica')
        return True

    def _uva_emitir_dictamen(self, resultado, comentario=None):
        self.ensure_one()
        self._uva_validar_revisable()
        hoy = ut.hoy(self.env)
        dictamen = self.env['uva.dictamen'].create({
            'expediente_id': self.id,
            'fecha_emision': hoy,
            'resultado': resultado,
            'nc_count': self.nc_count,
            'autorizado_id': self.env.user.id,
            'autorizado_por': ut.sin_prefijo(self.env.user.name or ''),
        })
        self.env['uva.conagua.carga'].create({'dictamen_id': dictamen.id, 'fecha_lista': hoy})
        self.write({
            'state': 'autorizado' if resultado == 'conforme' else 'inconforme',
            'comentario_revision': comentario or self.comentario_revision,
        })
        doc = self._uva_doc('04_Dictamen')
        if doc:
            doc.estado = 'listo'
        self._uva_generar_ficha(dictamen)
        texto = ('Dictamen autorizado y firmado electrónicamente' if resultado == 'conforme'
                 else 'Dictamen inconforme emitido y firmado electrónicamente')
        self._uva_log(texto)
        self.message_post(body='%s: %s.' % (texto, dictamen.name))
        if self.pozo_id:
            self.pozo_id.write({
                'ultima_inspeccion': 'Conforme' if resultado == 'conforme' else 'Inconforme',
                'fecha_ultima_inspeccion': hoy,
                'folio_activo': False,
            })
        return dictamen

    def _uva_generar_ficha(self, dictamen):
        """Congela en la ficha los datos oficiales del dictamen (usuario, aprovechamiento, medición)."""
        self.ensure_one()
        self.dato_ids.unlink()
        partner = self.partner_id
        pozo = self.pozo_id
        vigencia = ('%s · 2 años' % ut.fdate(dictamen.vigencia)) if dictamen.vigencia else 'No aplica (inconforme)'
        filas = [
            ('Dictamen oficial', 'No. de dictamen', dictamen.name),
            ('Dictamen oficial', 'Fecha de emisión', ut.fdate(dictamen.fecha_emision)),
            ('Dictamen oficial', 'Vigencia oficial', vigencia),
            ('Usuario y aprovechamiento', 'Razón social', partner.name or self.cliente_nombre or ''),
            ('Usuario y aprovechamiento', 'RFC', partner.vat or ''),
            ('Usuario y aprovechamiento', 'Título de concesión',
             '%s · anexo %s' % (self.titulo_concesion or pozo.titulo_concesion or '', pozo.anexo or '—')),
            ('Usuario y aprovechamiento', 'Identificador del pozo',
             '%s (%s)' % (ut.sin_corchetes(pozo.identificador or ''), ut.sin_corchetes(pozo.name or self.pozo_nombre or ''))),
            ('Usuario y aprovechamiento', 'Uso / fuente', '%s · %s' % (pozo.uso or '', pozo._uva_fuente_label() if pozo else '')),
            ('Usuario y aprovechamiento', 'Volumen concesionado', '%s anuales' % ut.fmt_volumen(pozo.volumen_anual)),
        ]
        if pozo:
            filas += [
                ('Sistema de medición', 'Medidor', '%s %s · NSM %s' % (pozo.medidor_marca or '', pozo.medidor_modelo or '',
                                                                      pozo.medidor_serie or '')),
                ('Sistema de medición', 'Unidad electrónica', pozo.serie_unidad_electronica or ''),
                ('Sistema de medición', 'Unidad de transmisión', pozo.serie_unidad_transmision or ''),
                ('Sistema de medición', 'Diámetro nominal', pozo.diametro_descarga or pozo.medidor_dn or ''),
                ('Sistema de medición', 'Coordenadas WGS84', pozo.coordenadas or ''),
            ]
        self.env['uva.expediente.dato'].create([
            {'expediente_id': self.id, 'sequence': i, 'grupo': g, 'clave': k, 'valor': v}
            for i, (g, k, v) in enumerate(filas, start=1)
        ])

    # ------------------------------------------------------------------
    # Serialización
    # ------------------------------------------------------------------
    def _uva_resultado_campo(self):
        self.ensure_one()
        if self.nc_count:
            return '%d NC' % self.nc_count, 'nc'
        return 'Cumple', 'ok'

    def _uva_bandeja_json(self, hoy):
        self.ensure_one()
        st_type, accion, destino = PRESENTACION_ESTADO.get(self.state, ('review', 'Ver', 'Revision'))
        res, res_type = self._uva_resultado_campo()
        sla, urgente, _n = self._uva_sla(hoy)
        sitio = ' · '.join(x for x in [self.titulo_concesion, self.pozo_nombre] if x)
        return {
            'id': str(self.id),
            'folio': ut.corchetes(self.name),
            'rawFolio': ut.sin_corchetes(self.name),
            'client': self.cliente_nombre or '',
            'site': sitio,
            'who': self.verificador_nombre or '',
            'date': ut.fdate(self.fecha_visita),
            'kind': self._uva_label('tipo_verificacion'),
            'res': res,
            'resType': res_type,
            'ev': '%d fotos · %d docs' % (self.num_fotos, self.num_docs),
            'st': self._uva_label('state'),
            'stType': st_type,
            'sla': sla,
            'slaUrgent': bool(urgente),
            'action': accion,
            'target': destino,
        }

    def _uva_pasos_revision(self):
        self.ensure_one()
        carga = self._uva_dictamen().carga_ids.sorted('id', reverse=True)[:1]
        if self.state == 'en_campo':
            activo = 1
        elif self.state in ('por_revisar', 'devuelto'):
            activo = 2
        elif carga and carga.state == 'acuse_enviado':
            activo = len(REVISION_PASOS)
        elif carga and carga.state == 'acuse_por_enviar':
            activo = 5
        else:
            activo = 4
        pasos = []
        for i, nombre in enumerate(REVISION_PASOS):
            estado = 'done' if i < activo else ('active' if i == activo else 'pending')
            pasos.append({'name': nombre, 'state': estado})
        return pasos

    def _uva_resumen_secciones(self):
        self.ensure_one()
        if self.seccion_ids:
            return [{'n': s.numero, 'name': s.name, 'stat': s.resumen or ''} for s in self.seccion_ids]
        grupos = {}
        for p in self.punto_ids:
            grupos.setdefault(p.seccion or (p.numero or '').split('.')[0], []).append(p)
        resultado = []
        for numero in sorted(grupos, key=lambda x: int(x) if x.isdigit() else 0):
            puntos = grupos[numero]
            partes = []
            for clave in ('C', 'NC', 'N/A'):
                n = len([p for p in puntos if p.respuesta == clave])
                if n:
                    partes.append('%d %s' % (n, clave))
            notas = len([p for p in puntos if p.nota])
            if notas:
                partes.append('%d %s' % (notas, ut.plural(notas, 'nota', 'notas')))
            resultado.append({'n': numero, 'name': 'Sección %s' % numero, 'stat': ' · '.join(partes) or 'Sin capturar'})
        return resultado


class UvaExpedientePunto(models.Model):
    _name = 'uva.expediente.punto'
    _description = 'Respuesta a punto de verificación'
    _order = 'expediente_id, sequence, id'

    expediente_id = fields.Many2one('uva.expediente', string='Expediente', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    seccion = fields.Char(string='Sección')
    numero = fields.Char(string='Punto', required=True)
    punto_formato_id = fields.Many2one('uva.formato.punto', string='Punto del formato', ondelete='set null')
    texto = fields.Text(string='Texto del punto')
    extra = fields.Char(string='Detalle / mediciones')
    respuesta = fields.Selection(RESPUESTAS, string='Respuesta')
    observacion = fields.Text(string='Observación de campo')
    nota = fields.Text(string='Nota de revisión')
    foto_ids = fields.One2many('uva.expediente.foto', 'punto_id', string='Fotografías')

    def _uva_json(self):
        self.ensure_one()
        return {
            'section': self.seccion or (self.numero or '').split('.')[0],
            'n': self.numero or '',
            'text': self.texto or '',
            'extra': self.extra or '',
            'ans': self.respuesta or '',
            'photos': self.foto_ids.mapped('name'),
            'hasNote': bool(self.nota),
            'note': self.nota or '',
        }


class UvaExpedienteFoto(models.Model):
    _name = 'uva.expediente.foto'
    _description = 'Fotografía de evidencia'
    _order = 'expediente_id, punto_id, sequence, id'

    expediente_id = fields.Many2one('uva.expediente', string='Expediente', required=True, ondelete='cascade', index=True)
    punto_id = fields.Many2one('uva.expediente.punto', string='Punto', ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    name = fields.Char(string='Archivo', required=True)
    descripcion = fields.Char(string='Sello de tiempo y GPS')
    imagen = fields.Image(string='Imagen', max_width=1920, max_height=1920)


class UvaExpedienteSeccion(models.Model):
    _name = 'uva.expediente.seccion'
    _description = 'Resumen por sección del expediente'
    _order = 'expediente_id, sequence, id'

    expediente_id = fields.Many2one('uva.expediente', string='Expediente', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    numero = fields.Char(string='Número', required=True)
    name = fields.Char(string='Sección', required=True)
    resumen = fields.Char(string='Resumen')


class UvaExpedienteCheck(models.Model):
    _name = 'uva.expediente.check'
    _description = 'Validación automática del expediente'
    _order = 'expediente_id, sequence, id'

    expediente_id = fields.Many2one('uva.expediente', string='Expediente', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    name = fields.Char(string='Validación', required=True)
    detalle = fields.Char(string='Detalle')
    ok = fields.Boolean(string='Correcto', default=True)
    aviso = fields.Boolean(string='Advertencia')

    def _uva_json(self):
        self.ensure_one()
        data = {'ok': self.ok, 'label': self.name or '', 'detail': self.detalle or ''}
        if self.aviso:
            data['warn'] = True
        return data


class UvaExpedienteDato(models.Model):
    _name = 'uva.expediente.dato'
    _description = 'Dato de la ficha del dictamen'
    _order = 'expediente_id, sequence, id'

    expediente_id = fields.Many2one('uva.expediente', string='Expediente', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    grupo = fields.Char(string='Grupo', required=True)
    clave = fields.Char(string='Dato', required=True)
    valor = fields.Char(string='Valor')


class UvaExpedienteDocumento(models.Model):
    _name = 'uva.expediente.documento'
    _description = 'Documento del expediente (carpeta SharePoint)'
    _order = 'expediente_id, sequence, id'

    expediente_id = fields.Many2one('uva.expediente', string='Expediente', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    carpeta = fields.Char(string='Carpeta', required=True)
    name = fields.Char(string='Contenido', required=True)
    estado = fields.Selection([('listo', 'Listo'), ('pendiente', 'Pendiente')], string='Estado', required=True,
                              default='pendiente')
    archivo = fields.Binary(string='Archivo', attachment=True)
    archivo_nombre = fields.Char(string='Nombre del archivo')

    def _uva_json(self):
        self.ensure_one()
        listo = self.estado == 'listo'
        return {
            'folder': self.carpeta or '',
            'name': self.name or '',
            'st': 'Listo' if listo else 'Pendiente',
            'action': 'Ver' if listo else 'Subir manual',
        }


class UvaExpedienteLog(models.Model):
    _name = 'uva.expediente.log'
    _description = 'Bitácora oficial del expediente'
    _order = 'fecha desc, id desc'

    expediente_id = fields.Many2one('uva.expediente', string='Expediente', required=True, ondelete='cascade', index=True)
    fecha = fields.Datetime(string='Fecha', required=True, default=fields.Datetime.now)
    descripcion = fields.Char(string='Evento', required=True)
    usuario = fields.Char(string='Usuario')

    def _uva_json(self):
        self.ensure_one()
        local = ut.a_local(self.env, self.fecha)
        return {
            'when': local.strftime('%d/%m %H:%M') if local else '',
            'what': self.descripcion or '',
            'who': self.usuario or '',
        }
