# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut

ETAPAS = [
    ('solicitud', 'Solicitud'),
    ('contratacion', 'Contratación'),
    ('campo', 'Campo'),
    ('emision', 'Emisión'),
    ('calibracion', 'Calibración'),
]
ESTRUCTURAS = [
    ('checklist', 'Check list'),
    ('word', 'Plantilla Word'),
    ('cuestionario', 'Cuestionario con secciones'),
]
ESTADOS = [
    ('borrador', 'Borrador'),
    ('en_aprobacion', 'En aprobación'),
    ('vigente', 'Vigente'),
    ('obsoleto', 'Obsoleto'),
]
TIPO_VERIFICACION = [
    ('visual', 'Visual'),
    ('medicion', 'Medición'),
    ('documental', 'Documental'),
]
EVIDENCIA = [
    ('obligatoria', 'Foto obligatoria'),
    ('si_nc', 'Foto si NC'),
    ('ninguna', 'Sin foto'),
]


def _clave_de(seleccion, valor):
    """Acepta la clave o la etiqueta de una selección y devuelve la clave."""
    if not valor:
        return False
    for clave, etiqueta in seleccion:
        if valor in (clave, etiqueta) or str(valor).lower() == etiqueta.lower():
            return clave
    return False


class UvaFormato(models.Model):
    _name = 'uva.formato'
    _description = 'Formato del sistema de gestión'
    _inherit = ['mail.thread']
    _order = 'sequence, codigo, version, id'

    sequence = fields.Integer(default=10)
    codigo = fields.Char(string='Código', required=True, index=True, tracking=True)
    name = fields.Char(string='Nombre', required=True, tracking=True)
    subtitulo = fields.Char(string='Descripción / uso')
    etapa = fields.Selection(ETAPAS, string='Etapa del proceso', required=True, default='campo')
    version = fields.Char(string='Versión', required=True, default='1.0', tracking=True)
    tipo_estructura = fields.Selection(ESTRUCTURAS, string='Estructura', required=True, default='checklist')
    detalle_estructura = fields.Char(string='Detalle de estructura',
                                     help='Si se deja vacío se calcula al crear el formato o con el botón «Recalcular».')
    state = fields.Selection(ESTADOS, string='Estado', required=True, default='borrador', tracking=True)
    fecha_modificacion = fields.Date(string='Última modificación', default=fields.Date.context_today)
    seccion_ids = fields.One2many('uva.formato.seccion', 'formato_id', string='Secciones')
    rubro_ids = fields.One2many('uva.formato.rubro', 'formato_id', string='Rubros / pasos')
    campo_ids = fields.One2many('uva.formato.campo', 'formato_id', string='Campos de plantilla Word')
    plantilla = fields.Binary(string='Plantilla Word', attachment=True)
    plantilla_nombre = fields.Char(string='Nombre del archivo')
    punto_count = fields.Integer(string='Puntos', compute='_compute_punto_count')

    _codigo_version_uniq = models.Constraint('UNIQUE(codigo, version)',
                                             'Ya existe ese código de formato con la misma versión.')

    def _uva_detalle_auto(self):
        self.ensure_one()
        if self.tipo_estructura == 'checklist':
            return '%d rubros obligatorios' % len(self.rubro_ids.filtered('requerido'))
        if self.tipo_estructura == 'cuestionario':
            return '%d secciones · %d puntos' % (len(self.seccion_ids), len(self.seccion_ids.punto_ids))
        return '%d variables de plantilla' % len(self.campo_ids)

    def action_recalcular_detalle(self):
        for rec in self:
            rec.detalle_estructura = rec._uva_detalle_auto()
        return True

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for rec in records.filtered(lambda r: not r.detalle_estructura):
            rec.detalle_estructura = rec._uva_detalle_auto()
        return records

    @api.depends('seccion_ids.punto_ids')
    def _compute_punto_count(self):
        for rec in self:
            rec.punto_count = len(rec.seccion_ids.punto_ids)

    @api.depends('codigo', 'version', 'name')
    def _compute_display_name(self):
        for rec in self:
            rec.display_name = '%s v%s · %s' % (rec.codigo or '', rec.version or '', rec.name or '')

    def write(self, vals):
        if 'fecha_modificacion' not in vals and set(vals) - {'state', 'message_main_attachment_id'}:
            vals = dict(vals, fecha_modificacion=fields.Date.context_today(self))
        return super().write(vals)

    # ------------------------------------------------------------------
    # Flujo de aprobación
    # ------------------------------------------------------------------
    def action_enviar_aprobacion(self):
        for rec in self:
            if rec.state != 'borrador':
                raise UserError('Solo los formatos en borrador pueden enviarse a aprobación (%s v%s está «%s»).'
                                % (rec.codigo, rec.version, rec._uva_label('state')))
            rec.state = 'en_aprobacion'
            rec.message_post(body='Formato enviado a aprobación del Gerente Técnico.')
        return True

    def action_aprobar(self):
        for rec in self:
            if rec.state != 'en_aprobacion':
                raise UserError('Solo se pueden aprobar formatos en aprobación.')
            anteriores = self.search([('codigo', '=', rec.codigo), ('state', '=', 'vigente'), ('id', '!=', rec.id)])
            anteriores.write({'state': 'obsoleto'})
            rec.state = 'vigente'
            rec.message_post(body='Formato aprobado y publicado como vigente.')
        return True

    def action_regresar_borrador(self):
        self.write({'state': 'borrador'})
        return True

    # ------------------------------------------------------------------
    @api.model
    def _uva_buscar(self, formato_id):
        """``formato_id`` numérico → id de registro; si no, código (versión más reciente)."""
        if formato_id in (None, '', False):
            raise UserError('Debe indicar el formato.')
        if ut.es_numero(formato_id):
            rec = self.browse(int(formato_id)).exists()
        else:
            candidatos = self.search([('codigo', '=', str(formato_id).strip())])
            rec = candidatos.sorted(key=lambda f: f._uva_version_key(), reverse=True)[:1]
        if not rec:
            raise UserError('No se encontró el formato «%s».' % formato_id)
        return rec

    @api.model
    def _uva_vigente(self, codigo):
        candidatos = self.search([('codigo', '=', codigo), ('state', '=', 'vigente')])
        if not candidatos:
            candidatos = self.search([('codigo', '=', codigo)])
        return candidatos.sorted(key=lambda f: f._uva_version_key(), reverse=True)[:1]

    def _uva_version_key(self):
        partes = []
        for p in (self.version or '0').split('.'):
            partes.append(int(p) if p.isdigit() else 0)
        return tuple(partes)

    def _uva_label(self, field_name):
        self.ensure_one()
        return dict(self._fields[field_name].selection).get(self[field_name], '')

    def _uva_json(self):
        """Forma ``FormatoItem`` del frontend."""
        self.ensure_one()
        return {
            'id': str(self.id),
            'code': self.codigo or '',
            'name': self.name or '',
            'subtitle': self.subtitulo or '',
            'stage': self._uva_label('etapa'),
            'version': self.version or '',
            'structureType': self._uva_label('tipo_estructura'),
            'structureDetail': self.detalle_estructura or '',
            'status': self._uva_label('state'),
            'modifiedDate': ut.fdate(self.fecha_modificacion),
        }


class UvaFormatoSeccion(models.Model):
    _name = 'uva.formato.seccion'
    _description = 'Sección de formato (cuestionario)'
    _order = 'formato_id, sequence, id'

    formato_id = fields.Many2one('uva.formato', string='Formato', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    numero = fields.Char(string='Número', required=True)
    name = fields.Char(string='Nombre', required=True)
    etiqueta_conteo = fields.Char(string='Etiqueta de conteo',
                                  help='Texto que acompaña a la sección (p. ej. «7», «4 bloques», «Ap. B»).')
    tipos_respuesta = fields.Text(string='Tipos de respuesta usados',
                                  help='Resumen de los tipos de respuesta que cubren la sección.')
    punto_ids = fields.One2many('uva.formato.punto', 'seccion_id', string='Puntos')

    def _uva_json(self):
        self.ensure_one()
        return {'n': self.numero or '', 'name': self.name or '',
                'count': self.etiqueta_conteo or str(len(self.punto_ids))}


class UvaFormatoPunto(models.Model):
    _name = 'uva.formato.punto'
    _description = 'Punto normativo de formato'
    _order = 'seccion_id, sequence, id'

    seccion_id = fields.Many2one('uva.formato.seccion', string='Sección', required=True, ondelete='cascade', index=True)
    formato_id = fields.Many2one(related='seccion_id.formato_id', store=True, string='Formato')
    sequence = fields.Integer(default=10)
    numero = fields.Char(string='Número', required=True)
    pregunta = fields.Text(string='Pregunta / texto del punto', required=True)
    referencia = fields.Char(string='Referencia normativa', help='Numeral de la NMX-AA-179, p. ej. 7.1 a')
    tipo_verificacion = fields.Selection(TIPO_VERIFICACION, string='Tipo de verificación', default='visual')
    tipo_respuesta_id = fields.Many2one('uva.formato.tipo', string='Tipo de respuesta')
    evidencia = fields.Selection(EVIDENCIA, string='Evidencia', default='obligatoria')
    min_fotos = fields.Integer(string='Mínimo de fotos', default=1)
    criterio = fields.Text(string='Criterio de aceptación')
    aplica_inicial = fields.Boolean(string='Aplica en inicial', default=True)
    aplica_periodica = fields.Boolean(string='Aplica en periódica', default=True)
    aplica_extraordinaria = fields.Boolean(string='Aplica en extraordinaria', default=True)

    def _uva_label(self, field_name):
        self.ensure_one()
        return dict(self._fields[field_name].selection).get(self[field_name], '')

    def _uva_json(self):
        """Forma de ``points`` de EditorView (con propiedades adicionales del punto)."""
        self.ensure_one()
        tipo = self.tipo_respuesta_id
        data = {
            'id': str(self.id),
            'section': self.seccion_id.numero or '',
            'n': self.numero or '',
            'text': self.pregunta or '',
            'kind': self._uva_label('tipo_verificacion'),
            'ref': ut.corchetes(self.referencia) if self.referencia else '',
            'resp': (tipo.etiqueta_corta or '') if tipo else '',
            'ev': self._uva_label('evidencia'),
            'normRef': self.referencia or '',
            'verifType': self._uva_label('tipo_verificacion'),
            'responseType': tipo._uva_nombre_simple() if tipo else '',
            'photoRequired': self.evidencia == 'obligatoria',
            'minPhotos': self.min_fotos,
            'appliesInicial': self.aplica_inicial,
            'appliesPeriodica': self.aplica_periodica,
            'appliesExtra': self.aplica_extraordinaria,
        }
        if self.criterio:
            data['criterion'] = self.criterio
        return data


class UvaFormatoRubro(models.Model):
    _name = 'uva.formato.rubro'
    _description = 'Rubro de check list / paso normativo'
    _order = 'formato_id, sequence, id'

    formato_id = fields.Many2one('uva.formato', string='Formato', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    name = fields.Char(string='Rubro', required=True)
    requerido = fields.Boolean(string='Obligatorio', default=True)
    pide_fecha = fields.Boolean(string='Pide fecha', default=True)
    pide_comentario = fields.Boolean(string='Pide comentario', default=True)
    pide_archivo = fields.Boolean(string='Pide archivo', default=True)

    def _uva_json(self, idx=None):
        self.ensure_one()
        return {
            'id': idx if idx is not None else self.id,
            'text': self.name or '',
            'req': self.requerido,
            'date': self.pide_fecha,
            'comment': self.pide_comentario,
            'file': self.pide_archivo,
        }


class UvaFormatoCampo(models.Model):
    _name = 'uva.formato.campo'
    _description = 'Variable de plantilla Word'
    _order = 'formato_id, sequence, id'

    formato_id = fields.Many2one('uva.formato', string='Formato', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    clave = fields.Char(string='Variable', required=True)
    mapeo = fields.Char(string='Se llena con', required=True)

    def _uva_json(self):
        self.ensure_one()
        return {'key': self.clave or '', 'mapTo': self.mapeo or ''}


class UvaFormatoTipo(models.Model):
    _name = 'uva.formato.tipo'
    _description = 'Tipo de respuesta (NMX-AA-179)'
    _order = 'sequence, id'

    sequence = fields.Integer(default=10)
    name = fields.Char(string='Tipo de respuesta', required=True)
    etiqueta_corta = fields.Char(string='Etiqueta corta', help='Texto corto en la lista de puntos, p. ej. «Option box · C/NC/NA».')
    clase = fields.Selection([('opciones', 'Opciones'), ('texto', 'Texto libre'), ('grupo', 'Grupo de campos')],
                             string='Clase', required=True, default='opciones')
    valores = fields.Text(string='Valores', help='Un valor por línea.')
    campos = fields.Text(string='Campos del grupo', help='Un campo por línea con el formato «Etiqueta|longitud máxima».')
    con_evaluacion = fields.Boolean(string='Evaluación C/NC/NA por grupo')
    etiqueta_evaluacion = fields.Char(string='Etiqueta de evaluación')
    por_campo = fields.Boolean(string='Evaluación C/NC/NA por campo')
    usos = fields.Text(string='Usos en el F-18')

    def _uva_nombre_simple(self):
        """``1. Una sola opción (option box)`` → ``Una sola opción (option box)``."""
        self.ensure_one()
        nombre = self.name or ''
        if '. ' in nombre[:4]:
            return nombre.split('. ', 1)[1]
        return nombre

    def _uva_json(self):
        """Forma de ``panels`` de TiposView (solo se incluyen las banderas verdaderas)."""
        self.ensure_one()
        data = {'type': self.name or ''}
        if self.clase == 'opciones':
            data['isOptions'] = True
            data['values'] = [v.strip() for v in (self.valores or '').splitlines() if v.strip()]
        elif self.clase == 'texto':
            data['isText'] = True
        else:
            data['isGroup'] = True
            if self.con_evaluacion:
                data['hasEval'] = True
                data['evalLabel'] = self.etiqueta_evaluacion or ''
            if self.por_campo:
                data['perField'] = True
            campos = []
            for linea in (self.campos or '').splitlines():
                if not linea.strip():
                    continue
                etiqueta, _sep, maximo = linea.partition('|')
                campos.append({'label': etiqueta.strip(), 'max': int(maximo) if maximo.strip().isdigit() else 0})
            data['fields'] = campos
        data['uses'] = self.usos or ''
        return data
