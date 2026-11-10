# -*- coding: utf-8 -*-
from odoo import api, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut

BOT_PASOS = [
    (1, 'Preparar datos', 'Valida que el dictamen esté autorizado y arma la trama para el portal.'),
    (2, 'Iniciar sesión en portal CONAGUA', 'Espera a que el usuario cargue la e.firma y resuelva el captcha.'),
    (3, 'Capturar y adjuntar', 'Llena el formulario con los datos del dictamen y adjunta el PDF.'),
    (4, 'Descargar acuse', 'Guarda el acuse oficial en 05_Acuse y registra el folio de carga.'),
    (5, 'Enviar al cliente', 'Envía el acuse y el dictamen por correo al contacto del cliente.'),
]
ORDEN_CARGA = {'pendiente': 0, 'acuse_por_enviar': 1, 'acuse_enviado': 2}


class UvaApiDictaminacion(models.AbstractModel):
    _inherit = 'uva.api'

    # ==================================================================
    # Bandeja de revisión técnica
    # ==================================================================
    @api.model
    def get_bandeja(self, **kwargs):
        hoy = self._hoy()
        ind = self._ind()
        Exp = self.env['uva.expediente']
        Carga = self.env['uva.conagua.carga']
        inicio_mes = hoy.replace(day=1)

        def kpi(label, code, n):
            return {'label': label, 'count': ind._uva_valor(code, n), 'id': label}

        kpis = [
            kpi('Por revisar', 'bandeja_revisar', Exp.search_count([('state', '=', 'por_revisar')])),
            kpi('Devueltos al verificador', 'bandeja_devueltos', Exp.search_count([('state', '=', 'devuelto')])),
            kpi('Autorizados', 'bandeja_autorizados', Exp.search_count([('state', '=', 'autorizado')])),
            kpi('Pendientes de carga CONAGUA', 'bandeja_pendientes', Carga.search_count([('state', '=', 'pendiente')])),
            kpi('Con acuse este mes', 'bandeja_acuse',
                Carga.search_count([('state', '=', 'acuse_enviado'), ('fecha_envio_cliente', '>=', inicio_mes)])),
        ]
        expedientes = Exp.search([('state', '!=', 'en_campo')])
        return {'kpis': kpis, 'expedientes': [e._uva_bandeja_json(hoy) for e in expedientes]}

    @api.model
    def get_revision(self, folio=None, **kwargs):
        exp = self.env['uva.expediente']._uva_buscar(folio)
        return {
            'steps': exp._uva_pasos_revision(),
            'sectionsSummary': exp._uva_resumen_secciones(),
            'pointsList': [p._uva_json() for p in exp.punto_ids],
            'checks': [c._uva_json() for c in exp.check_ids],
        }

    @api.model
    def registrar_decision(self, folio=None, decision=None, comentario=None, **kwargs):
        exp = self.env['uva.expediente']._uva_buscar(folio)
        decision = (decision or '').strip().lower()
        hoy = self._hoy()
        if decision == 'autorizar':
            if exp.nc_count:
                raise UserError('El expediente %s tiene %d no conformidad(es); emita dictamen inconforme o devuélvalo '
                                'al verificador.' % (exp.name, exp.nc_count))
            dictamen = exp._uva_emitir_dictamen('conforme', comentario)
            return self._ok('Dictamen %s firmado electrónicamente y autorizado. Folio oficial generado.' % dictamen.name,
                            dictamen=dictamen._uva_json(hoy))
        if decision == 'inconforme':
            dictamen = exp._uva_emitir_dictamen('inconforme', comentario)
            return self._ok('Dictamen inconforme %s emitido y firmado electrónicamente.' % dictamen.name,
                            dictamen=dictamen._uva_json(hoy))
        if decision == 'devolver':
            exp.action_devolver(comentario)
            return self._ok('Expediente %s devuelto al verificador para corrección.' % exp.name)
        raise UserError('Decisión no válida: «%s». Use autorizar, devolver o inconforme.' % decision)

    # ==================================================================
    # Dictámenes y CONAGUA
    # ==================================================================
    @api.model
    def get_dictamenes(self, **kwargs):
        hoy = self._hoy()
        return [d._uva_json(hoy) for d in self.env['uva.dictamen'].search([])]

    @api.model
    def get_conagua(self, **kwargs):
        hoy = self._hoy()
        cargas = self.env['uva.conagua.carga'].search([]).sorted(
            key=lambda c: (ORDEN_CARGA.get(c.state, 9), c.fecha_lista or hoy, c.id))
        return [c._uva_json(hoy) for c in cargas]

    @api.model
    def conagua_enviar_acuse(self, carga_id=None, **kwargs):
        Carga = self.env['uva.conagua.carga']
        carga = Carga.browse(int(carga_id)).exists() if ut.es_numero(carga_id) else Carga.browse()
        if not carga:
            carga = Carga.search([('no_dictamen', '=', ut.sin_corchetes(str(carga_id or '')))], limit=1)
        if not carga:
            raise UserError('No se encontró la carga a CONAGUA «%s».' % carga_id)
        carga.action_enviar_acuse()
        return self._ok('Acuse oficial CONAGUA enviado por correo a %s' % (carga.cliente_nombre or ''),
                        item=carga._uva_json(self._hoy()))

    @api.model
    def get_expediente(self, folio=None, **kwargs):
        exp = self.env['uva.expediente']._uva_buscar(folio)
        grupos = []
        indice = {}
        for dato in exp.dato_ids:
            if dato.grupo not in indice:
                indice[dato.grupo] = {'title': dato.grupo, 'items': []}
                grupos.append(indice[dato.grupo])
            indice[dato.grupo]['items'].append({'k': dato.clave, 'v': dato.valor or ''})
        carga = exp._uva_dictamen().carga_ids.sorted('id', reverse=True)[:1]
        acuse = exp._uva_doc('05_Acuse')
        return {
            'groups': grupos,
            'docs': [d._uva_json() for d in exp.documento_ids],
            'botSteps': [{'n': n, 'title': t, 'desc': d} for n, t, d in BOT_PASOS],
            'logEntries': [l._uva_json() for l in exp.log_ids],
            'acuseStatus': 'Listo' if acuse and acuse.estado == 'listo' else 'Pendiente',
            'cargaState': carga.state if carga else None,
        }

    @api.model
    def expediente_carga_conagua(self, folio=None, modo='bot', acuse_filename=None, **kwargs):
        exp = self.env['uva.expediente']._uva_buscar(folio)
        dictamen = exp._uva_dictamen()
        if not dictamen:
            raise UserError('El expediente %s aún no tiene dictamen autorizado.' % exp.name)
        carga = dictamen.carga_ids.filtered(lambda c: c.state == 'pendiente')[:1]
        if not carga:
            raise UserError('El dictamen %s ya fue cargado a CONAGUA.' % dictamen.name)
        modo = 'manual' if (modo or '').lower() == 'manual' else 'bot'
        carga.action_registrar_carga(modo=modo, acuse_nombre=acuse_filename)
        if modo == 'bot':
            carga.action_enviar_acuse()
            return self._ok('Acuse CONAGUA guardado en SharePoint y enviado por correo al cliente.')
        return self._ok('Acuse PDF adjuntado correctamente')
