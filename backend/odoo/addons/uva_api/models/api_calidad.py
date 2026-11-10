# -*- coding: utf-8 -*-
from odoo import api, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut
from odoo.addons.uva_instrumentos.models.uva_instrumento import parse_meses


class UvaApiCalidad(models.AbstractModel):
    _inherit = 'uva.api'

    @api.model
    def get_instrumentos(self, **kwargs):
        return [i._uva_json() for i in self.env['uva.instrumento'].search([])]

    @api.model
    def create_instrumento(self, vals=None, **kwargs):
        vals = self._vals(vals)
        tipo = (vals.get('type') or '').strip()
        serie = (vals.get('serial') or '').strip()
        codigo = (vals.get('invCode') or '').strip()
        if not tipo or not serie or not codigo:
            raise UserError('Capture tipo, número de serie y código de inventario del instrumento.')
        Inst = self.env['uva.instrumento']
        if Inst.with_context(active_test=False).search_count([('codigo', '=', codigo)]):
            raise UserError('Ya existe un instrumento con el código %s.' % codigo)
        hoy = self._hoy()
        datos = {'tipo': tipo, 'serie': serie, 'codigo': codigo, 'marca_modelo': vals.get('brandModel') or False}
        for clave, campo in (('calDueDate', 'fecha_vencimiento'), ('calDate', 'fecha_calibracion')):
            if vals.get(clave) not in (None, '', ut.GUION):
                fecha = ut.parse_fecha(vals[clave], hoy)
                if not fecha:
                    raise UserError('La fecha «%s» no es válida (use dd/mm/aaaa).' % vals[clave])
                datos[campo] = fecha
        if vals.get('labName'):
            datos['laboratorio'] = vals['labName']
        if vals.get('certNumber'):
            datos['certificado'] = vals['certNumber']
        asignado = (vals.get('assignedTo') or '').strip()
        if asignado:
            ver = self.env['uva.verificador'].search(['|', ('code', '=ilike', asignado), ('name', '=', asignado)], limit=1)
            if ver:
                datos['verificador_id'] = ver.id
        inst = Inst.create(datos)
        inst.message_post(body='Instrumento dado de alta desde el Sistema UVA.')
        return self._ok('Instrumento %s registrado.' % inst.codigo, instrumento=inst._uva_json())

    @api.model
    def _calibracion(self, calibracion_id):
        Cal = self.env['uva.calibracion']
        cal = Cal.browse()
        if ut.es_numero(calibracion_id):
            cal = Cal.browse(int(calibracion_id)).exists()
        if not cal:
            raise UserError('No se encontró la calibración «%s».' % calibracion_id)
        return cal

    @api.model
    def get_calibracion_actual(self, **kwargs):
        cal = self.env['uva.calibracion'].search([('state', '=', 'en_curso')], order='id desc', limit=1)
        if not cal:
            return {'id': None, 'instrument': None, 'steps': []}
        inst = cal.instrumento_id
        data = {
            'id': str(cal.id),
            'instrument': {
                'id': str(inst.id),
                'invCode': inst.codigo or '',
                'type': inst.tipo or '',
                'brandModel': inst.marca_modelo or '',
                'serial': inst.serie or '',
                'statusLabel': 'En calibración · no disponible para visitas',
                'previousDueDate': ut.fdate(cal.vencimiento_anterior),
            },
            'steps': [p._uva_json() for p in cal.paso_ids],
        }
        if cal.laboratorio or cal.certificado or cal.fecha_calibracion:
            data['certificate'] = {
                'labName': cal.laboratorio or '',
                'certNumber': cal.certificado or '',
                'calDate': ut.fdate(cal.fecha_calibracion) if cal.fecha_calibracion else '',
                'vigencia': '%d meses' % (cal.vigencia_meses or 12),
                'newDueDate': ut.fdate(cal.nuevo_vencimiento) if cal.nuevo_vencimiento else '',
                'fileName': cal.archivo_nombre or None,
                'notes': cal.notas or '',
            }
        return data

    @api.model
    def save_calibracion_pasos(self, calibracion_id=None, steps=None, **kwargs):
        cal = self._calibracion(calibracion_id)
        if cal.state != 'en_curso':
            raise UserError('La calibración ya fue cerrada.')
        hoy = self._hoy()
        pasos = cal.paso_ids
        for idx, s in enumerate(steps or []):
            paso = pasos.filtered(lambda p: p.id == s.get('id'))[:1] if s.get('id') is not None else pasos.browse()
            if not paso and ut.es_numero(s.get('id')):
                paso = pasos.filtered(lambda p: p.id == int(s['id']))[:1] or pasos[int(s['id']) - 1:int(s['id'])]
            if not paso:
                paso = pasos[idx:idx + 1]
            if not paso:
                continue
            hecho = bool(s.get('done'))
            datos = {'realizado': hecho}
            if hecho:
                datos['fecha'] = ut.parse_fecha(s.get('date'), hoy) or paso.fecha or hoy
            else:
                datos['fecha'] = False
            if 'comment' in s:
                datos['comentario'] = s.get('comment') or False
            paso.write(datos)
        return self._ok('Avance del checklist guardado')

    @api.model
    def completar_calibracion(self, calibracion_id=None, cert_number=None, lab_name=None, cal_date=None,
                              vigencia=None, notes=None, **kwargs):
        cal = self._calibracion(calibracion_id)
        if not (cert_number or cal.certificado) or not (lab_name or cal.laboratorio):
            raise UserError('Capture el laboratorio y el folio del certificado para cerrar la calibración.')
        fecha = ut.parse_fecha(cal_date, self._hoy()) if cal_date else None
        if cal_date and not fecha:
            raise UserError('La fecha de calibración «%s» no es válida.' % cal_date)
        cal.action_completar(certificado=cert_number, laboratorio=lab_name, fecha=fecha,
                             vigencia_meses=parse_meses(vigencia) if vigencia else None, notas=notes)
        return self._ok('Calibración completada con éxito. Instrumento %s liberado como DISPONIBLE.'
                        % cal.instrumento_id.codigo)
