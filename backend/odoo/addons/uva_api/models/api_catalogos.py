# -*- coding: utf-8 -*-
import base64
import csv
import io
import re
import unicodedata
from datetime import timedelta

from odoo import api, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut
from .api_base import GRUPOS_ROL

RE_RFC = re.compile(r'^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$')
# RFC genéricos del SAT (público en general y extranjeros): no identifican a un cliente
RFC_GENERICOS = {'XAXX010101000', 'XEXX010101000'}

# Importación de clientes exportados de Aspel SAE (Excel o CSV). Los encabezados cambian según la versión
# y la configuración de la exportación: se reconocen por sinónimos, sin acentos, espacios ni signos.
COLUMNAS_ASPEL = {
    'clave': ('CLAVE', 'CVE', 'CLAVECLIENTE', 'CVECLIENTE', 'NOCLIENTE', 'NUMCLIENTE', 'CODIGOCLIENTE', 'CLIENTE'),
    'nombre': ('NOMBRE', 'RAZONSOCIAL', 'NOMBRECLIENTE', 'NOMBREORAZONSOCIAL', 'NOMBRERAZONSOCIAL', 'CLIENTENOMBRE'),
    'rfc': ('RFC', 'RFCCLIENTE'),
    'calle': ('CALLE', 'DOMICILIO', 'DIRECCION', 'CALLEYNUMERO'),
    'numext': ('NUMEXT', 'NUMEROEXTERIOR', 'NOEXT', 'NUMEXTERIOR', 'NOEXTERIOR', 'EXTERIOR'),
    'numint': ('NUMINT', 'NUMEROINTERIOR', 'NOINT', 'NUMINTERIOR', 'NOINTERIOR', 'INTERIOR'),
    'colonia': ('COLONIA',),
    'municipio': ('MUNICIPIO', 'DELEGACION', 'MUNICIPIODELEGACION', 'DELEGACIONMUNICIPIO'),
    'ciudad': ('CIUDAD', 'LOCALIDAD', 'POBLACION'),
    'estado': ('ESTADO', 'ENTIDAD', 'ENTIDADFEDERATIVA'),
    'cp': ('CP', 'CODIGO', 'CODIGOPOSTAL', 'CODPOSTAL', 'CPOSTAL'),
    'telefono': ('TELEFONO', 'TELEFONOS', 'TEL', 'TELEFONO1'),
    'email': ('EMAIL', 'CORREO', 'CORREOELECTRONICO', 'MAIL', 'EMAILPRED', 'EMAILPREDETERMINADO', 'EMAILCLIENTE'),
    'contacto': ('CONTACTO', 'ATENCION', 'ATENCIONA', 'NOMBRECONTACTO'),
}
MAX_FILAS_ASPEL = 20000


def _normalizar_encabezado(texto):
    texto = unicodedata.normalize('NFKD', str(texto or '')).encode('ascii', 'ignore').decode()
    return re.sub(r'[^A-Z0-9]', '', texto.upper())


def _texto_celda(valor):
    if valor is None:
        return ''
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    return re.sub(r'\s+', ' ', str(valor)).strip()

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
        raise UserError('Use «Importar de Aspel» con el archivo de clientes exportado de Aspel SAE.')

    # ------------------------------------------------------------------ importación desde Aspel SAE
    def _filas_archivo_aspel(self, nombre, contenido):
        """Filas (listas de textos) del archivo exportado: Excel .xlsx, Excel .xls o CSV/texto."""
        nombre = (nombre or '').lower()
        if contenido[:2] == b'PK' or nombre.endswith('.xlsx'):
            try:
                import openpyxl
                libro = openpyxl.load_workbook(io.BytesIO(contenido), read_only=True, data_only=True)
            except Exception:
                raise UserError('No se pudo leer el archivo de Excel. Vuelva a exportarlo de Aspel o guárdelo como .xlsx o .csv.')
            hoja = libro.worksheets[0]
            return [[_texto_celda(c) for c in fila] for _i, fila in zip(range(MAX_FILAS_ASPEL + 50), hoja.iter_rows(values_only=True))]
        if contenido[:4] == b'\xd0\xcf\x11\xe0' or nombre.endswith('.xls'):
            try:
                import xlrd
                hoja = xlrd.open_workbook(file_contents=contenido).sheet_by_index(0)
            except Exception:
                raise UserError('No se pudo leer el archivo de Excel (.xls). Guárdelo como .xlsx o .csv e intente de nuevo.')
            return [[_texto_celda(c) for c in hoja.row_values(i)] for i in range(min(hoja.nrows, MAX_FILAS_ASPEL + 50))]
        # CSV o texto: UTF-8 (con o sin BOM) o Windows-1252, que es como exporta Aspel en español
        for codificacion in ('utf-8-sig', 'cp1252', 'latin-1'):
            try:
                texto = contenido.decode(codificacion)
                break
            except UnicodeDecodeError:
                continue
        muestra = texto[:5000]
        try:
            dialecto = csv.Sniffer().sniff(muestra, delimiters=',;\t|')
            separador = dialecto.delimiter
        except csv.Error:
            separador = max(',;\t|', key=muestra.count)
        lector = csv.reader(io.StringIO(texto), delimiter=separador)
        return [[_texto_celda(c) for c in fila] for _i, fila in zip(range(MAX_FILAS_ASPEL + 50), lector)]

    def _columnas_aspel(self, filas):
        """Fila de encabezados (Aspel puede poner títulos antes) y columna de cada dato."""
        for indice, fila in enumerate(filas[:20]):
            normalizados = [_normalizar_encabezado(c) for c in fila]
            columnas = {}
            for campo, sinonimos in COLUMNAS_ASPEL.items():
                for pos, enc in enumerate(normalizados):
                    if enc in sinonimos and pos not in columnas.values():
                        columnas[campo] = pos
                        break
            if 'rfc' in columnas and 'nombre' in columnas:
                return indice, columnas
        raise UserError('No se encontraron las columnas de RFC y nombre del cliente. Exporte de Aspel el catálogo de '
                        'clientes incluyendo al menos la clave, el nombre y el RFC.')

    @api.model
    def importar_clientes_aspel(self, nombre_archivo=None, contenido_base64=None, confirmar=False, **kwargs):
        """Clientes exportados de Aspel SAE. Sin ``confirmar`` solo devuelve la vista previa (no guarda nada).
        Se empata por RFC: los existentes se actualizan y los nuevos se dan de alta."""
        if not contenido_base64:
            raise UserError('Seleccione el archivo de clientes exportado de Aspel.')
        try:
            contenido = base64.b64decode(contenido_base64)
        except Exception:
            raise UserError('El archivo no se recibió correctamente; intente de nuevo.')
        filas = self._filas_archivo_aspel(nombre_archivo, contenido)
        if not filas:
            raise UserError('El archivo está vacío.')
        inicio, columnas = self._columnas_aspel(filas)
        datos = filas[inicio + 1:]
        if len(datos) > MAX_FILAS_ASPEL:
            raise UserError('El archivo tiene más de %d renglones; divídalo en partes.' % MAX_FILAS_ASPEL)

        Partner = self.env['res.partner']
        existentes = {p.vat: p for p in Partner.with_context(active_test=False).search(
            [('uva_es_cliente', '=', True), ('vat', '!=', False)])}
        valor = lambda fila, campo: fila[columnas[campo]] if campo in columnas and columnas[campo] < len(fila) else ''
        nuevos, actualizar, errores, vistos = [], [], [], {}
        sin_cambios = 0
        for numero, fila in enumerate(datos, start=inicio + 2):
            if not any(fila):
                continue
            nombre = valor(fila, 'nombre')
            rfc = re.sub(r'[\s\-_.]', '', valor(fila, 'rfc')).upper()
            if not nombre and not rfc:
                continue
            if not rfc:
                errores.append({'fila': numero, 'nombre': nombre, 'motivo': 'Sin RFC'})
                continue
            if rfc in RFC_GENERICOS:
                errores.append({'fila': numero, 'nombre': nombre, 'rfc': rfc, 'motivo': 'RFC genérico (público en general o extranjero)'})
                continue
            if not RE_RFC.match(rfc):
                errores.append({'fila': numero, 'nombre': nombre, 'rfc': rfc, 'motivo': 'RFC con formato no válido'})
                continue
            if not nombre:
                errores.append({'fila': numero, 'rfc': rfc, 'motivo': 'Sin nombre o razón social'})
                continue
            if rfc in vistos:
                errores.append({'fila': numero, 'nombre': nombre, 'rfc': rfc, 'motivo': 'RFC repetido en el archivo (fila %d)' % vistos[rfc]})
                continue
            vistos[rfc] = numero
            calle = ' '.join(x for x in (valor(fila, 'calle'), valor(fila, 'numext')) if x)
            if valor(fila, 'numint'):
                calle += ' Int. %s' % valor(fila, 'numint')
            partes = [calle,
                      'Col. %s' % valor(fila, 'colonia') if valor(fila, 'colonia') else '',
                      valor(fila, 'municipio') or valor(fila, 'ciudad'),
                      valor(fila, 'estado'),
                      'C.P. %s' % valor(fila, 'cp') if valor(fila, 'cp') else '']
            vals = {
                'name': nombre,
                'vat': rfc,
                'uva_tipo_fiscal': 'moral' if len(rfc) == 12 else 'fisica',
                'uva_codigo_aspel': valor(fila, 'clave') or False,
                'uva_domicilio_fiscal': ', '.join(x for x in partes if x) or False,
                'phone': valor(fila, 'telefono') or False,
                'email': valor(fila, 'email') or False,
                'uva_contacto_avisos': valor(fila, 'contacto') or valor(fila, 'email') or False,
                'zip': valor(fila, 'cp') or False,
            }
            resumen = {'fila': numero, 'rfc': rfc, 'nombre': nombre, 'clave': vals['uva_codigo_aspel'] or ''}
            cliente = existentes.get(rfc)
            if cliente:
                # Solo se escriben los datos que Aspel trae (no se borra lo capturado en el Sistema UVA)
                cambios = {k: v for k, v in vals.items() if v and (cliente[k] or False) != v}
                if cambios:
                    actualizar.append((cliente, cambios, dict(resumen, campos=sorted(cambios))))
                else:
                    sin_cambios += 1
            else:
                nuevos.append((vals, resumen))

        if confirmar:
            for vals, _r in nuevos:
                vals.update({'uva_es_cliente': True, 'is_company': vals['uva_tipo_fiscal'] == 'moral'})
                Partner.create(vals)
            for cliente, cambios, _r in actualizar:
                cliente.write(dict(cambios, uva_es_cliente=True))
            mensaje = 'Importación desde Aspel: %d cliente(s) nuevo(s), %d actualizado(s), %d sin cambios, %d con error.' % (
                len(nuevos), len(actualizar), sin_cambios, len(errores))
            self.env.company.partner_id.sudo().message_post(body='%s Archivo: %s' % (mensaje, nombre_archivo or ''))
            return self._ok(mensaje, nuevos=len(nuevos), actualizados=len(actualizar), sinCambios=sin_cambios,
                            errores=len(errores), clientes=self.get_clientes())
        etiquetas = {v: k for k, v in columnas.items()}
        return self._ok(
            'Vista previa: %d nuevo(s), %d por actualizar, %d sin cambios, %d con error.' % (len(nuevos), len(actualizar), sin_cambios, len(errores)),
            columnas=[{'campo': etiquetas[pos], 'encabezado': filas[inicio][pos]} for pos in sorted(etiquetas)],
            filaEncabezados=inicio + 1,
            nuevos=[r for _v, r in nuevos[:200]], totalNuevos=len(nuevos),
            actualizar=[r for _c, _v, r in actualizar[:200]], totalActualizar=len(actualizar),
            sinCambios=sin_cambios, errores=errores[:200], totalErrores=len(errores))

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
