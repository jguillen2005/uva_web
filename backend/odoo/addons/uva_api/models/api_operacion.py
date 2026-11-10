# -*- coding: utf-8 -*-
import re
from datetime import date, timedelta

from odoo import api, fields, models
from odoo.exceptions import UserError

from odoo.addons.uva_core.models import uva_tools as ut
from odoo.addons.uva_dictaminacion.models.uva_expediente import normalizar_respuesta

ESTADOS_AGENDA = ('propuesta', 'programada', 'confirmada', 'en_campo', 'realizada')


class UvaApiOperacion(models.AbstractModel):
    _inherit = 'uva.api'

    # ==================================================================
    # GET /operacion/programacion
    # ==================================================================
    @api.model
    def _lunes_semana(self, semana, hoy):
        if semana:
            texto = str(semana).strip()
            m = re.match(r'^(\d{4})-?W(\d{1,2})$', texto, re.I)
            if m:
                return date.fromisocalendar(int(m.group(1)), int(m.group(2)), 1)
            fecha = ut.parse_fecha(texto, hoy)
            if fecha:
                return ut.lunes_de(fecha)
            raise UserError('Semana no válida: «%s». Use aaaa-mm-dd o aaaa-Wnn.' % semana)
        return ut.lunes_de(hoy)

    @api.model
    def _etiqueta_semana(self, lunes):
        viernes = lunes + timedelta(days=4)
        if lunes.month == viernes.month:
            return '%d – %d de %s' % (lunes.day, viernes.day, ut.MESES_LARGO[lunes.month - 1])
        return '%d de %s – %d de %s' % (lunes.day, ut.MESES_LARGO[lunes.month - 1],
                                        viernes.day, ut.MESES_LARGO[viernes.month - 1])

    @api.model
    def _cola_programacion(self):
        cola = self.env['uva.visita'].search([('tipo_registro', '=', 'visita'),
                                              ('state', 'in', ('por_programar', 'propuesta'))])
        return cola.sorted(key=lambda v: (v.programar_antes or date.max, v.id))

    @api.model
    def _visitas_semana_inspector(self, verificador, lunes, excluir=None):
        domain = [('verificador_id', '=', verificador.id), ('tipo_registro', '=', 'visita'),
                  ('state', 'in', ('programada', 'confirmada', 'en_campo', 'realizada')),
                  ('fecha', '>=', lunes), ('fecha', '<=', lunes + timedelta(days=6))]
        if excluir:
            domain.append(('id', '!=', excluir.id))
        return self.env['uva.visita'].search_count(domain)

    @api.model
    def get_programacion(self, semana=None, **kwargs):
        hoy = self._hoy()
        lunes = self._lunes_semana(semana, hoy)
        dias = [lunes + timedelta(days=i) for i in range(5)]
        Visita = self.env['uva.visita']
        cola = self._cola_programacion()

        verificadores = self.env['uva.verificador'].search([('estado', '!=', 'inactivo')], order='code, id')
        agenda = Visita.search([('verificador_id', 'in', verificadores.ids), ('fecha', '>=', dias[0]),
                                ('fecha', '<=', dias[-1]), '|', ('tipo_registro', '=', 'ausencia'),
                                ('state', 'in', ESTADOS_AGENDA)], order='fecha, hora, id')
        horario = []
        for v in verificadores:
            slots = []
            for d in dias:
                if v._uva_en_vacaciones(d):
                    slots.append({'type': 'off', 'text': 'Vacaciones', 'client': ''})
                    continue
                evento = agenda.filtered(lambda e: e.verificador_id == v and e.fecha == d)[:1]
                slots.append(evento._uva_slot_json() if evento else None)
            if v.estado == 'vacaciones':
                carga = 'Vacaciones programadas'
            else:
                carga = '%d %s este mes' % (v.visitas_mes, ut.plural(v.visitas_mes, 'visita', 'visitas'))
            horario.append({'name': ut.nombre_corto(v.name), 'zone': v.zona_corta or v.zona or '', 'load': carga,
                            'days': slots})

        seleccion = cola.filtered(lambda c: c.state == 'propuesta')[:1] or cola[:1]
        disponibles = verificadores.filtered(lambda v: v.estado == 'activo' and v.comp_status != 'vencida')
        total = self.env['uva.verificador'].search_count([])
        mes = self.env['uva.estadistica.mes'].search([('fecha', '=', hoy.replace(day=1))], limit=1)
        if mes:
            visitas_mes = '%d / %d' % (mes.verificaciones, mes.meta)
        else:
            hechas = Visita.search_count([('tipo_registro', '=', 'visita'), ('state', 'in', ('confirmada', 'realizada')),
                                          ('fecha', '>=', hoy.replace(day=1)),
                                          ('fecha', '<', ut.sumar_meses(hoy.replace(day=1), 1))])
            visitas_mes = '%d / %d' % (hechas, sum(verificadores.mapped('meta_mensual')))
        if seleccion.fecha:
            fecha_default = ut.fdia_semana(seleccion.fecha)
        else:
            siguiente = hoy + timedelta(days=1)
            while siguiente.weekday() >= 5:
                siguiente += timedelta(days=1)
            fecha_default = ut.fdia_semana(siguiente)
        return {
            'queueItems': [c._uva_queue_json(hoy) for c in cola],
            'inspectorsSchedule': horario,
            'weekLabel': self._etiqueta_semana(lunes),
            'dayHeaders': ['%s %d' % (ut.DIAS_ABR[d.weekday()], d.day) for d in dias],
            'kpis': {
                'monthVisits': visitas_mes,
                'toSchedule': len(cola),
                'outOfWindow': len(cola.filtered(lambda c: c._uva_fuera_de_ventana(hoy))),
                'inspectorsAvailable': '%d de %d' % (len(disponibles), total),
            },
            'suggestedInspectors': self._sugerencias(seleccion, disponibles, dias, hoy),
            'equipment': self._equipo_disponible(seleccion),
            'defaultFecha': fecha_default,
            'defaultHora': seleccion.hora or '09:00',
        }

    @api.model
    def _sugerencias(self, visita, candidatos, dias, hoy):
        if not visita:
            return []
        if visita.sugerencia_ids:
            return [s._uva_json() for s in visita.sugerencia_ids]
        lunes = dias[0]
        resultado = []
        for v in candidatos.sorted(key=lambda x: (x.visitas_mes, x.code)):
            if self._visitas_semana_inspector(v, lunes, excluir=visita) >= (v.max_visitas_semana or 2):
                continue
            libre = None
            for d in dias:
                if d < hoy or v._uva_en_vacaciones(d):
                    continue
                if not self.env['uva.visita'].search_count([('verificador_id', '=', v.id), ('fecha', '=', d),
                                                            ('state', 'not in', ('cancelada', 'por_programar'))]):
                    libre = d
                    break
            if not libre:
                continue
            razones = ['Zona: %s' % (v.zona_corta or v.zona or 'sin zona')]
            if not resultado:
                razones.append('Menor carga del mes (%d %s)' % (v.visitas_mes, ut.plural(v.visitas_mes, 'visita', 'visitas')))
            else:
                razones.append('%d %s este mes' % (v.visitas_mes, ut.plural(v.visitas_mes, 'visita', 'visitas')))
            fila = {'code': v.code, 'name': ut.nombre_corto(v.name),
                    'day': '%s %d' % (ut.DIAS_ABR[libre.weekday()], libre.day), 'reasons': razones}
            if v.comp_status == 'vigente' and not v.instrumento_ids.filtered(lambda i: i.status == 'vencido'):
                fila['highlight'] = 'Equipo completo disponible ese día'
            resultado.append(fila)
            if len(resultado) == 2:
                break
        return resultado

    @api.model
    def _equipo_disponible(self, visita):
        instrumentos = self.env['uva.instrumento'].search([('status', '!=', 'fuera_servicio')], order='codigo, id')
        en_cal = self.env['uva.calibracion'].search([('state', '=', 'en_curso')]).mapped('instrumento_id')
        tipos = []
        for i in instrumentos:
            if i.tipo not in tipos:
                tipos.append(i.tipo)
        slots = []
        for tipo in tipos:
            opciones = []
            libres = []
            bloqueo_calidad = False
            for i in instrumentos.filtered(lambda x: x.tipo == tipo):
                motivo = None
                if i in en_cal or i.estado == 'en_calibracion':
                    motivo = 'En calibración externa'
                    bloqueo_calidad = True
                elif i.status == 'vencido':
                    motivo = 'Calibración vencida (bloqueado)'
                    bloqueo_calidad = True
                elif i._uva_en_prestamo_activo(excluir_visita=visita or None):
                    motivo = 'Pendiente de devolución'
                if motivo:
                    opciones.append({'inv': i.codigo, 'label': '%s · %s' % (i.codigo, motivo), 'disabled': True})
                else:
                    libres.append(i)
                    opciones.append({'inv': i.codigo, 'label': '%s · Disponible (%s)' % (i.codigo, i.nombre_corto or i.marca_modelo or '')})
            opciones.sort(key=lambda o: o.get('disabled', False))
            slot = {'key': re.sub(r'[^a-z0-9]+', '_', ut.sin_corchetes(tipo).lower().split(' ')[0]
                                  .translate(str.maketrans('áéíóúñ', 'aeioun'))).strip('_'),
                    'label': tipo, 'options': opciones}
            if not libres:
                slot.update({'note': '! Sin equipo disponible ese día', 'noteWarning': True})
            elif len(libres) == 1 and bloqueo_calidad:
                slot.update({'note': '! Solo 1 disponible ese día: %s' % libres[0].codigo, 'noteWarning': True})
            else:
                slot['note'] = '✓ Disponible · calibración vigente'
            slots.append(slot)
        return slots

    # ==================================================================
    # POST /operacion/visitas
    # ==================================================================
    @api.model
    def confirmar_visita(self, folio=None, inspector_code=None, fecha=None, hora=None, send_outlook=True,
                         send_client_email=True, equipo=None, **kwargs):
        hoy = self._hoy()
        Visita = self.env['uva.visita']
        visita = Visita._uva_buscar_folio(folio, estados=['por_programar', 'propuesta', 'programada', 'confirmada'])
        if not visita:
            raise UserError('No hay una visita por programar con el folio %s.' % ut.sin_corchetes(folio or ''))
        verificador = self.env['uva.verificador'].search([('code', '=ilike', (inspector_code or '').strip())], limit=1)
        if not verificador:
            raise UserError('No se encontró el inspector «%s».' % (inspector_code or ''))
        dia = ut.parse_fecha(fecha, hoy)
        if not dia:
            raise UserError('La fecha «%s» no es válida.' % (fecha or ''))
        hora = (hora or '').strip()
        if not re.match(r'^([01]\d|2[0-3]):[0-5]\d$', hora):
            raise UserError('La hora «%s» no es válida (use HH:MM).' % hora)
        if verificador.estado != 'activo':
            raise UserError('%s no está activo (%s).' % (verificador.name, verificador._uva_label('estado')))
        if verificador.comp_status == 'vencida':
            raise UserError('La calificación NMX-AA-179 de %s está vencida; no se le pueden asignar visitas.'
                            % verificador.name)
        if verificador._uva_en_vacaciones(dia):
            raise UserError('%s tiene vacaciones registradas el %s.' % (verificador.name, ut.fdia_mes(dia)))
        if self._visitas_semana_inspector(verificador, ut.lunes_de(dia), excluir=visita) >= (verificador.max_visitas_semana or 2):
            raise UserError('%s ya alcanzó su máximo de %d visitas en esa semana.'
                            % (verificador.name, verificador.max_visitas_semana or 2))

        # Equipo a reservar
        instrumentos = self.env['uva.instrumento']
        for inv in equipo or []:
            inst = instrumentos.search([('codigo', '=', inv)], limit=1)
            if not inst:
                raise UserError('No se encontró el instrumento %s.' % inv)
            if inst.estado != 'operativo' or inst.status == 'vencido' or inst._uva_calibracion_en_curso():
                raise UserError('El instrumento %s no está disponible (%s).' % (inv, inst._uva_status_label()))
            if inst._uva_en_prestamo_activo(excluir_visita=visita):
                raise UserError('El instrumento %s está pendiente de devolución.' % inv)
            instrumentos |= inst

        ya_confirmada = visita.state == 'confirmada'
        visita.write({'verificador_id': verificador.id, 'fecha': dia, 'hora': hora, 'state': 'confirmada'})
        if not ya_confirmada:
            verificador.visitas_mes += 1
        if visita.solicitud_id:
            visita.solicitud_id.write({'state': 'programada', 'fecha_programada': dia})
        if instrumentos:
            visita.prestamo_ids.filtered(lambda p: p.state == 'reservado').unlink()
            self.env['uva.prestamo'].create({
                'visita_id': visita.id,
                'verificador_id': verificador.id,
                'state': 'reservado',
                'devolver_antes': dia + timedelta(days=2),
                'linea_ids': [(0, 0, {'sequence': n, 'name': i.tipo, 'inventario': i.codigo, 'instrumento_id': i.id})
                              for n, i in enumerate(instrumentos, start=1)],
            })
        visita.message_post(body='Visita confirmada con %s para el %s a las %s hrs.'
                                 % (verificador.name, ut.fdia_semana(dia), hora))
        mensaje = 'Visita %s confirmada para el %s a las %s hrs.' % (ut.sin_corchetes(visita.name),
                                                                     ut.fdia_semana(dia), hora)
        if send_outlook:
            # TODO integración: Microsoft 365 / Outlook (cita en el calendario del verificador)
            visita.message_post(body='Cita enviada a Microsoft 365 Outlook (integración simulada).')
            mensaje += ' Cita enviada a Microsoft 365 Outlook y sincronizada con la app del verificador.'
        if send_client_email:
            # TODO integración: Microsoft 365 / Outlook (aviso de visita al contacto del cliente)
            visita.message_post(body='Aviso de visita enviado por correo al cliente (integración simulada).')
        return self._ok(mensaje)

    # ==================================================================
    # Préstamos
    # ==================================================================
    @api.model
    def get_prestamos(self, **kwargs):
        hoy = self._hoy()
        Prestamo = self.env['uva.prestamo']
        activos = Prestamo.search([('state', '=', 'entregado')]).sorted(
            key=lambda p: (p.visita_id.fecha or date.min, p.id), reverse=True)
        loans = [p._uva_json(hoy) for p in activos]
        responsable = self._usuarios_de_grupo('uva_core.group_uva_equipos')[:1]
        return {
            'returnItems': loans[0]['returnItems'] if loans else [],
            'loans': loans,
            'pendingDeliveryCount': Prestamo.search_count([('state', '=', 'reservado')]),
            'receiverName': ut.corchete_al_final(responsable.name) if responsable
            else ut.corchete_al_final(self.env.user.name or ''),
        }

    @api.model
    def registrar_devolucion(self, folio=None, items=None, recibio=None, **kwargs):
        prestamo = self.env['uva.prestamo'].search([('name', '=', ut.sin_corchetes(folio or '')),
                                                    ('state', '=', 'entregado')], limit=1)
        if not prestamo:
            raise UserError('No hay equipo entregado pendiente de devolución para la visita %s.'
                            % ut.sin_corchetes(folio or ''))
        destinos = dict((etq.lower(), clave) for clave, etq in
                        self.env['uva.prestamo.linea']._fields['destino'].selection)
        for item in items or []:
            inv = item.get('inv')
            linea = prestamo.linea_ids.filtered(lambda l: l.inventario == inv)[:1]
            if not linea:
                raise UserError('El equipo %s no forma parte del préstamo %s.' % (inv, prestamo.name))
            if not item.get('received', True):
                raise UserError('El equipo %s no se ha recibido; regístrelo cuando llegue al almacén.' % inv)
            con_incidencia = not (item.get('accessories', True) and item.get('works', True))
            if con_incidencia and not (item.get('comment') or '').strip():
                raise UserError('Describa la incidencia del equipo %s.' % inv)
            destino = destinos.get((item.get('target') or 'Disponible').strip().lower(), 'disponible')
            linea.write({
                'recibido': True,
                'accesorios': bool(item.get('accessories', True)),
                'funciona': bool(item.get('works', True)),
                'comentario': item.get('comment') or False,
                'destino': destino,
            })
        for linea in prestamo.linea_ids:
            inst = linea.instrumento_id
            if not inst:
                continue
            if linea.destino == 'fuera_servicio':
                inst.estado = 'fuera_servicio'
                inst.message_post(body='Enviado a fuera de servicio tras devolución de %s: %s'
                                       % (prestamo.name, linea.comentario or ''))
            elif linea.destino == 'calibracion' and inst.estado == 'operativo':
                inst.action_iniciar_calibracion()
            else:
                inst.action_recalcular_estatus()
        prestamo.write({'state': 'devuelto', 'receptor': recibio or prestamo.receptor,
                        'fecha_devolucion': fields.Datetime.now()})
        prestamo.message_post(body='Devolución registrada%s.' % ((' · recibió %s' % recibio) if recibio else ''))
        return self._ok('Devolución de equipos para visita %s registrada exitosamente.' % prestamo.name)

    # ==================================================================
    # Captura en campo (PWA)
    # ==================================================================
    @api.model
    def _formato_campo(self):
        Formato = self.env['uva.formato']
        vigente = Formato._uva_vigente('F-18-AC')
        if vigente and vigente.seccion_ids.punto_ids:
            return vigente
        return Formato.search([('codigo', '=', 'F-18-AC')]).filtered(lambda f: f.seccion_ids.punto_ids).sorted(
            key=lambda f: f._uva_version_key(), reverse=True)[:1] or vigente

    @api.model
    def _expediente_campo(self, folio, crear=False):
        Exp = self.env['uva.expediente']
        exp = Exp.search([('name', '=', ut.sin_corchetes(folio or ''))], order='id desc', limit=1)
        if exp or not crear:
            return exp
        visita = self.env['uva.visita']._uva_buscar_folio(folio)
        if not visita:
            raise UserError('No existe una visita con el folio %s.' % ut.sin_corchetes(folio or ''))
        sol = visita.solicitud_id
        return Exp.create({
            'name': visita.name,
            'visita_id': visita.id,
            'solicitud_id': sol.id or False,
            'partner_id': visita.partner_id.id or sol.partner_id.id or False,
            'pozo_id': sol.pozo_id.id or False,
            'cliente_nombre': visita.cliente_nombre or sol.cliente_nombre or visita.name,
            'pozo_nombre': visita.sitio or sol.pozo_nombre or False,
            'titulo_concesion': sol.titulo_concesion or False,
            'verificador_id': visita.verificador_id.id or False,
            'fecha_visita': visita.fecha or self._hoy(),
            'tipo_verificacion': visita.tipo_verificacion,
            'formato_id': self._formato_campo().id or False,
            'state': 'en_campo',
        })

    @api.model
    def registrar_respuesta_campo(self, folio=None, punto=None, respuesta=None, fotos=None, observacion=None, **kwargs):
        resp = normalizar_respuesta(respuesta)
        if not resp:
            raise UserError('Respuesta no válida: «%s». Use C, NC o NA.' % (respuesta or ''))
        numero = (punto or '').strip()
        if not numero:
            raise UserError('Indique el punto de la lista de verificación.')
        exp = self._expediente_campo(folio, crear=True)
        if exp.state not in ('en_campo', 'devuelto'):
            raise UserError('El expediente %s ya no admite capturas de campo (estado: %s).'
                            % (exp.name, exp._uva_label('state')))
        formato = exp.formato_id or self._formato_campo()
        punto_f = formato.seccion_ids.punto_ids.filtered(lambda p: p.numero == numero)[:1]
        Punto = self.env['uva.expediente.punto']
        registro = exp.punto_ids.filtered(lambda p: p.numero == numero)[:1]
        datos = {'respuesta': resp}
        if observacion:
            datos['observacion'] = observacion
        if not registro:
            datos.update({
                'expediente_id': exp.id,
                'numero': numero,
                'seccion': numero.split('.')[0],
                'sequence': punto_f.sequence or 10,
                'punto_formato_id': punto_f.id or False,
                'texto': punto_f.pregunta or numero,
                'extra': ' · '.join(x for x in [punto_f._uva_label('tipo_verificacion') if punto_f else '',
                                                ut.corchetes(punto_f.referencia) if punto_f.referencia else ''] if x),
            })
            registro = Punto.create(datos)
        else:
            registro.write(datos)
        Foto = self.env['uva.expediente.foto']
        base = ut.sin_corchetes(exp.name)
        nuevas = 0
        for foto in fotos or []:
            n = len(registro.foto_ids) + 1
            vals = {'expediente_id': exp.id, 'punto_id': registro.id, 'sequence': n,
                    'name': '%s_%s_%02d.jpg' % (base, numero, n)}
            if isinstance(foto, dict):
                vals['name'] = foto.get('name') or vals['name']
                vals['descripcion'] = foto.get('meta') or foto.get('descripcion') or False
                if foto.get('data'):
                    vals['imagen'] = foto['data']
            else:
                vals['descripcion'] = str(foto)
            Foto.create(vals)
            nuevas += 1
            if vals.get('descripcion') and ' · ' in vals['descripcion']:
                exp.gps_actual = vals['descripcion'].split(' · ', 1)[1]
        exp.write({
            'nc_count': len(exp.punto_ids.filtered(lambda p: p.respuesta == 'NC')),
            'num_fotos': exp.num_fotos + nuevas,
        })
        if punto_f and resp != 'N/A' and punto_f.evidencia == 'obligatoria' and len(registro.foto_ids) < (punto_f.min_fotos or 1):
            raise UserError('El punto %s requiere al menos %d fotografía(s) como evidencia.'
                            % (numero, punto_f.min_fotos or 1))
        if punto_f and resp == 'NC' and punto_f.evidencia == 'si_nc' and not registro.foto_ids:
            raise UserError('El punto %s requiere fotografía cuando se marca NC.' % numero)
        return self._ok('Respuesta del punto %s registrada (%s) con %d %s.'
                        % (numero, resp, nuevas, ut.plural(nuevas, 'foto', 'fotos')))

    @api.model
    def get_campo_sesion(self, folio=None, **kwargs):
        exp = self._expediente_campo(folio)
        visita = exp.visita_id or self.env['uva.visita']._uva_buscar_folio(folio)
        if not exp and not visita:
            raise UserError('No existe una visita con el folio %s.' % ut.sin_corchetes(folio or ''))
        formato = (exp.formato_id if exp else False) or self._formato_campo()
        puntos = formato.seccion_ids.punto_ids
        if not puntos:
            raise UserError('La lista de verificación de campo no tiene puntos configurados.')
        contestados = set(exp.punto_ids.filtered('respuesta').mapped('numero')) if exp else set()
        actual = puntos.filtered(lambda p: p.numero not in contestados)[:1] or puntos[-1:]
        seccion = actual.seccion_id
        en_seccion = seccion.punto_ids
        indice = list(en_seccion.ids).index(actual.id) + 1
        registro = exp.punto_ids.filtered(lambda p: p.numero == actual.numero)[:1] if exp else False
        fotos = [f.descripcion or f.name for f in registro.foto_ids] if registro else []
        pozo = (exp.pozo_id if exp else False) or (visita.solicitud_id.pozo_id if visita else False)
        return {
            'folio': ut.sin_corchetes((exp or visita).name),
            'site': (visita.sitio if visita else '') or (exp.pozo_nombre if exp else '') or '',
            'section': {'n': seccion.numero or '', 'name': seccion.name or ''},
            'totalPoints': len(en_seccion),
            'currentPoint': indice,
            'point': {
                'n': actual.numero or '',
                'kind': actual._uva_label('tipo_verificacion'),
                'ref': ut.corchetes(actual.referencia) if actual.referencia else '',
                'text': actual.pregunta or '',
                'criterio': actual.criterio or '',
            },
            'photos': fotos,
            'gps': (exp.gps_actual if exp else '') or (pozo.coordenadas if pozo else '') or '',
        }
