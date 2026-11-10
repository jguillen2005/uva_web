# -*- coding: utf-8 -*-
import re
from datetime import timedelta

from odoo import api, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut
from .api_base import GRUPOS_ROL

RE_RFC = re.compile(r'^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$')

CAMPOS_CLIENTE = {
    'name': 'name',
    'rfc': 'vat',
    'fiscalAddress': 'uva_domicilio_fiscal',
    'aspelCode': 'uva_codigo_aspel',
    'legalRep': 'uva_representante_legal',
    'noticeContact': 'uva_contacto_avisos',
    'phone': 'phone',
    'sharePointFolder': 'uva_carpeta_sharepoint',
}
CAMPOS_POZO_TEXTO = {
    'name': 'name',
    'concessionTitle': 'titulo_concesion',
    'annex': 'anexo',
    'use': 'uso',
    'coords': 'coordenadas',
    'dischargeDiameter': 'diametro_descarga',
    'meterBrand': 'medidor_marca',
    'meterModel': 'medidor_modelo',
    'meterSerial': 'medidor_serie',
    'meterDN': 'medidor_dn',
    'supplierInvoice': 'factura_proveedor',
    'electronicUnitSerial': 'serie_unidad_electronica',
    'transmissionUnitSerial': 'serie_unidad_transmision',
    'lastInspection': 'ultima_inspeccion',
    'activeFolio': 'folio_activo',
}
CAMPOS_POZO_FECHA = {
    'installationDate': 'fecha_instalacion',
    'lastInspectionDate': 'fecha_ultima_inspeccion',
}
ESTRUCTURA_ALTA = {'checklist': 'checklist', 'word': 'word', 'cuestionario': 'cuestionario'}


class UvaApiCatalogos(models.AbstractModel):
    _inherit = 'uva.api'

    # ==================================================================
    # Clientes y pozos
    # ==================================================================
    @api.model
    def get_clientes(self, **kwargs):
        clientes = self.env['res.partner'].search([('uva_es_cliente', '=', True)], order='name, id')
        return [c._uva_json() for c in clientes]

    @api.model
    def _cliente(self, cliente_id):
        rec = self.env['res.partner']
        if ut.es_numero(cliente_id):
            rec = rec.browse(int(cliente_id)).exists()
        if not rec or not rec.uva_es_cliente:
            raise UserError('No se encontró el cliente «%s».' % cliente_id)
        return rec

    @api.model
    def _cliente_vals(self, vals, nuevo=False):
        vals = self._vals(vals)
        res = {}
        for clave, campo in CAMPOS_CLIENTE.items():
            if clave in vals:
                res[campo] = (vals[clave] or '').strip() if isinstance(vals[clave], str) else vals[clave]
        if 'fiscalType' in vals:
            tipo = self._seleccion_clave('res.partner', 'uva_tipo_fiscal', vals['fiscalType'])
            if not tipo:
                raise UserError('Tipo fiscal no válido: «%s». Use «Persona moral» o «Persona física».' % vals['fiscalType'])
            res['uva_tipo_fiscal'] = tipo
        if 'vat' in res and res['vat']:
            res['vat'] = res['vat'].upper()
            if not RE_RFC.match(res['vat']):
                raise UserError('El RFC «%s» no tiene un formato válido.' % res['vat'])
        if nuevo:
            if not res.get('name'):
                raise UserError('Capture la razón social del cliente.')
            if not res.get('vat'):
                raise UserError('Capture el RFC del cliente.')
        return res

    @api.model
    def create_cliente(self, vals=None, **kwargs):
        datos = self._cliente_vals(vals, nuevo=True)
        Partner = self.env['res.partner']
        if Partner.search_count([('uva_es_cliente', '=', True), ('vat', '=', datos['vat'])]):
            raise UserError('Ya existe un cliente con el RFC %s.' % datos['vat'])
        datos.update({'uva_es_cliente': True, 'is_company': datos.get('uva_tipo_fiscal', 'moral') == 'moral'})
        cliente = Partner.create(datos)
        cliente.message_post(body='Cliente registrado desde el Sistema UVA.')
        return self._ok('Cliente %s registrado correctamente.' % cliente.name, cliente=cliente._uva_json())

    @api.model
    def update_cliente(self, cliente_id=None, vals=None, **kwargs):
        cliente = self._cliente(cliente_id)
        datos = self._cliente_vals(vals)
        if datos.get('vat') and self.env['res.partner'].search_count(
                [('uva_es_cliente', '=', True), ('vat', '=', datos['vat']), ('id', '!=', cliente.id)]):
            raise UserError('Ya existe otro cliente con el RFC %s.' % datos['vat'])
        if datos:
            cliente.write(datos)
        return self._ok('Datos fiscales de %s actualizados.' % cliente.name, cliente=cliente._uva_json())

    @api.model
    def create_pozo(self, cliente_id=None, vals=None, **kwargs):
        cliente = self._cliente(cliente_id)
        vals = self._vals(vals)
        datos = {'partner_id': cliente.id}
        for clave, campo in CAMPOS_POZO_TEXTO.items():
            if vals.get(clave) not in (None, ''):
                datos[campo] = vals[clave]
        if not datos.get('name'):
            raise UserError('Capture el nombre del pozo.')
        hoy = self._hoy()
        for clave, campo in CAMPOS_POZO_FECHA.items():
            if vals.get(clave) not in (None, '', ut.GUION):
                fecha = ut.parse_fecha(vals[clave], hoy)
                if not fecha:
                    raise UserError('La fecha «%s» no es válida (use dd/mm/aaaa).' % vals[clave])
                datos[campo] = fecha
        if vals.get('source'):
            datos['fuente'] = self._seleccion_clave('uva.pozo', 'fuente', vals['source']) or 'subterranea'
        if vals.get('annualVolume') not in (None, ''):
            datos['volumen_anual'] = ut.parse_volumen(vals['annualVolume'])
        if vals.get('id'):
            datos['identificador'] = vals['id']
        else:
            datos['identificador'] = '[ID-%03d]' % (len(cliente.with_context(active_test=False).uva_pozo_ids) + 1)
        pozo = self.env['uva.pozo'].create(datos)
        return self._ok('Pozo %s registrado para %s.' % (pozo.name, cliente.name), pozo=pozo._uva_json())

    @api.model
    def sync_aspel(self, **kwargs):
        clientes = self.env['res.partner'].search([('uva_es_cliente', '=', True)])
        # TODO integración: Aspel SAE (sincronizar clientes y catálogo de cuentas)
        self.env.company.partner_id.sudo().message_post(
            body='Sincronización con Aspel SAE solicitada para %d clientes (integración simulada).' % len(clientes))
        return self._ok('Sincronizando %d clientes y catálogos de cuentas desde Aspel SAE' % len(clientes))

    # ==================================================================
    # Verificadores y usuarios
    # ==================================================================
    @api.model
    def get_verificadores(self, **kwargs):
        return [v._uva_json() for v in self.env['uva.verificador'].search([], order='code, id')]

    @api.model
    def get_usuarios(self, **kwargs):
        hoy = self._hoy()
        grupos = []
        for xmlid, etiqueta in GRUPOS_ROL:
            g = self.env.ref(xmlid, raise_if_not_found=False)
            if g:
                grupos.append((g.sudo(), etiqueta))
        ids_grupos = [g.id for g, _e in grupos]
        Users = self.env['res.users'].sudo()
        usuarios = Users.search([('share', '=', False), ('uva_usuario_tecnico', '=', False)], order='id')
        filas = []
        for u in usuarios:
            propios = u.group_ids.filtered(lambda g: g.id in ids_grupos)
            if not propios:
                continue
            roles = [e for g, e in sorted(grupos, key=lambda x: (x[0].sequence, x[0].id)) if g in propios]
            filas.append({
                'name': u.name or '',
                'email': u.email or u.login or '',
                'roles': roles,
                'date': self._fecha_acceso(u, hoy),
                'st': 'Activo' if u.active else 'Inactivo',
            })
        Matriz = self.env['uva.matriz.permiso']
        return {
            'users': filas,
            'rolesHeaders': Matriz._uva_headers(),
            'matrix': [m._uva_json() for m in Matriz.search([])],
        }

    @api.model
    def _fecha_acceso(self, usuario, hoy):
        candidatos = [d for d in (getattr(usuario, 'login_date', False), usuario.uva_ultimo_acceso) if d]
        if not candidatos:
            return 'Sin acceso'
        local = ut.a_local(self.env, max(candidatos))
        if local.date() == hoy:
            return 'Hoy %s' % local.strftime('%H:%M')
        if local.date() == hoy - timedelta(days=1):
            return 'Ayer %s' % local.strftime('%H:%M')
        return ut.fdate(local.date())

    # ==================================================================
    # Formatos
    # ==================================================================
    @api.model
    def get_formatos(self, **kwargs):
        return [f._uva_json() for f in self.env['uva.formato'].search([])]

    @api.model
    def create_formato(self, vals=None, **kwargs):
        vals = self._vals(vals)
        Formato = self.env['uva.formato']
        codigo = (vals.get('codigo') or '').strip()
        nombre = (vals.get('nombre') or '').strip()
        version = (str(vals.get('version') or '1.0')).strip()
        if not codigo or not nombre:
            raise UserError('Capture el código y el nombre del formato.')
        etapa = self._seleccion_clave('uva.formato', 'etapa', vals.get('etapa')) or 'solicitud'
        estructura = ESTRUCTURA_ALTA.get(vals.get('estructura')) or self._seleccion_clave(
            'uva.formato', 'tipo_estructura', vals.get('estructura')) or 'checklist'
        if Formato.search_count([('codigo', '=', codigo), ('version', '=', version)]):
            raise UserError('Ya existe el formato %s en la versión %s.' % (codigo, version))
        datos = {
            'codigo': codigo, 'name': nombre, 'version': version, 'etapa': etapa,
            'tipo_estructura': estructura, 'state': 'borrador',
            'sequence': (max(Formato.search([]).mapped('sequence') or [0]) + 1),
        }
        if estructura == 'checklist':
            datos['rubro_ids'] = [(0, 0, {
                'sequence': i,
                'name': (r.get('text') or '').strip() or 'Rubro %d' % i,
                'requerido': bool(r.get('req', True)),
                'pide_fecha': bool(r.get('date', True)),
                'pide_comentario': bool(r.get('comment', True)),
                'pide_archivo': bool(r.get('file', True)),
            }) for i, r in enumerate(vals.get('checklistItems') or [], start=1)]
        elif estructura == 'cuestionario':
            datos['seccion_ids'] = [(0, 0, {
                'sequence': i,
                'numero': str(s.get('n') or i),
                'name': s.get('name') or 'Sección %d' % i,
                'etiqueta_conteo': s.get('count') or '',
            }) for i, s in enumerate(vals.get('sections') or [], start=1)]
        formato = Formato.create(datos)
        return self._ok('Borrador del formato %s v%s guardado.' % (codigo, version), formato=formato._uva_json())

    @api.model
    def formato_enviar_aprobacion(self, formato_id=None, **kwargs):
        formato = self.env['uva.formato']._uva_buscar(formato_id)
        if formato.state == 'borrador':
            formato.action_enviar_aprobacion()
        elif formato.state != 'en_aprobacion':
            raise UserError('El formato %s v%s está «%s»; solo los borradores se envían a aprobación.'
                            % (formato.codigo, formato.version, formato._uva_label('state')))
        return self._ok('Formato %s enviado a aprobación del Gerente Técnico.' % formato.codigo,
                        formato=formato._uva_json())

    @api.model
    def get_formato_estructura(self, formato_id=None, **kwargs):
        formato = self.env['uva.formato']._uva_buscar(formato_id)
        puntos = formato.seccion_ids.punto_ids
        seccion_default = puntos[:1].seccion_id or formato.seccion_ids[:1]
        punto_default = seccion_default.punto_ids[1:2] or seccion_default.punto_ids[:1]
        return {
            'sections': [s._uva_json() for s in formato.seccion_ids],
            'points': [p._uva_json() for p in puntos],
            'formato': {
                'id': str(formato.id),
                'code': formato.codigo,
                'shortCode': '-'.join((formato.codigo or '').split('-')[:2]),
                'name': formato.name,
                'version': formato.version,
                'status': formato._uva_label('state'),
                'defaultSection': seccion_default.numero or '',
                'defaultPoint': punto_default.numero or '',
            },
        }

    @api.model
    def save_formato_estructura(self, formato_id=None, sections=None, points=None, **kwargs):
        formato = self.env['uva.formato']._uva_buscar(formato_id)
        if formato.state in ('vigente', 'obsoleto'):
            raise UserError('El formato %s v%s está «%s» y no puede editarse; cree una nueva versión.'
                            % (formato.codigo, formato.version, formato._uva_label('state')))
        Seccion = self.env['uva.formato.seccion']
        Punto = self.env['uva.formato.punto']
        Tipo = self.env['uva.formato.tipo']
        if sections is not None:
            vistos = set()
            for i, s in enumerate(sections or [], start=1):
                numero = str(s.get('n') or i)
                vistos.add(numero)
                sec = formato.seccion_ids.filtered(lambda x: x.numero == numero)[:1]
                datos = {'sequence': i, 'name': s.get('name') or 'Sección %s' % numero}
                if s.get('count') not in (None, ''):
                    datos['etiqueta_conteo'] = s['count']
                if sec:
                    sec.write(datos)
                else:
                    datos.update({'formato_id': formato.id, 'numero': numero})
                    Seccion.create(datos)
            formato.seccion_ids.filtered(lambda x: x.numero not in vistos).unlink()
        if points is not None:
            por_seccion = {}
            for p in points or []:
                numero = str(p.get('n') or '').strip()
                if not numero:
                    raise UserError('Todos los puntos deben tener número (p. ej. 3.2).')
                sec_num = str(p.get('section') or numero.split('.')[0])
                por_seccion.setdefault(sec_num, []).append((numero, p))
            for sec_num, lista in por_seccion.items():
                sec = formato.seccion_ids.filtered(lambda x: x.numero == sec_num)[:1]
                if not sec:
                    sec = Seccion.create({'formato_id': formato.id, 'numero': sec_num, 'name': 'Sección %s' % sec_num,
                                          'sequence': len(formato.seccion_ids) + 1})
                numeros = set()
                for orden, (numero, p) in enumerate(lista, start=1):
                    numeros.add(numero)
                    datos = {'sequence': orden, 'pregunta': p.get('text') or numero}
                    tipo_verif = self._seleccion_clave('uva.formato.punto', 'tipo_verificacion', p.get('kind'))
                    if tipo_verif:
                        datos['tipo_verificacion'] = tipo_verif
                    evid = self._seleccion_clave('uva.formato.punto', 'evidencia', p.get('ev'))
                    if evid:
                        datos['evidencia'] = evid
                    if 'ref' in p:
                        datos['referencia'] = ut.sin_corchetes(p.get('ref') or '') or False
                    if p.get('resp'):
                        tipo = Tipo.search([('etiqueta_corta', '=', p['resp'])], limit=1) or \
                            Tipo.search([('name', 'ilike', p['resp'])], limit=1)
                        if tipo:
                            datos['tipo_respuesta_id'] = tipo.id
                    if 'criterion' in p:
                        datos['criterio'] = p.get('criterion') or False
                    punto = sec.punto_ids.filtered(lambda x: x.numero == numero)[:1]
                    if punto:
                        punto.write(datos)
                    else:
                        datos.update({'seccion_id': sec.id, 'numero': numero})
                        Punto.create(datos)
                sec.punto_ids.filtered(lambda x: x.numero not in numeros).unlink()
        formato.write({'fecha_modificacion': self._hoy()})
        formato.message_post(body='Estructura del formato actualizada desde el editor.')
        return self._ok('Estructura de %s v%s guardada.' % (formato.codigo, formato.version))

    @api.model
    def get_alta_formato_defaults(self, **kwargs):
        Formato = self.env['uva.formato']
        cl_doc = Formato._uva_vigente('CL-DOC')
        f17 = Formato._uva_vigente('F-17-AC')
        f18 = Formato._uva_vigente('F-18-AC')
        return {
            'checklistItems': [r._uva_json(idx=i) for i, r in enumerate(cl_doc.rubro_ids, start=1)],
            'wordFields': [c._uva_json() for c in f17.campo_ids],
            'sections': [s._uva_json() for s in f18.seccion_ids],
        }

    @api.model
    def get_tipos(self, **kwargs):
        Formato = self.env['uva.formato']
        f18 = Formato.search([('codigo', '=', 'F-18-AC')]).sorted(key=lambda f: f._uva_version_key(), reverse=True)[:1]
        return {
            'panels': [t._uva_json() for t in self.env['uva.formato.tipo'].search([])],
            'coverage': [{'s': '%s · %s' % (s.numero, s.name), 't': s.tipos_respuesta or ''}
                         for s in f18.seccion_ids if s.tipos_respuesta],
        }
