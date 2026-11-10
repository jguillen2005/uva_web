# -*- coding: utf-8 -*-
from datetime import date, timedelta

from odoo import api, fields, models

from odoo.addons.uva_core.models import uva_tools as ut

FLUJO_ESTADOS_ACTIVOS = ('propuesta', 'programada', 'confirmada', 'en_campo')


class UvaApiReportes(models.AbstractModel):
    _inherit = 'uva.api'

    # ==================================================================
    # GET /reportes/tablero
    # ==================================================================
    @api.model
    def get_tablero(self, **kwargs):
        hoy = self._hoy()
        return {
            'kpis': self._tablero_kpis(hoy),
            'alerts': self._tablero_alertas(hoy),
            'stages': self._tablero_etapas(hoy),
            'todayVisits': self._tablero_visitas_hoy(hoy),
        }

    @api.model
    def _tablero_kpis(self, hoy):
        ind = self._ind()
        Sol = self.env['uva.solicitud']
        Visita = self.env['uva.visita']
        lunes = ut.lunes_de(hoy)

        # 1. Solicitudes activas
        solicitudes = Sol.search([])
        esperando = solicitudes.filtered(
            lambda s: s.state in ('cotizacion', 'pago', 'documentacion') and s.docs_count < s.total_docs)
        k1_val = ind._uva_valor('kpi_solicitudes', len(solicitudes))
        k1_sub = ind._uva_texto('kpi_solicitudes', '%d esperando documentos' % len(esperando))

        # 2. Visitas de la semana
        visitas = Visita.search([
            ('tipo_registro', '=', 'visita'),
            ('state', 'in', ('programada', 'confirmada', 'en_campo', 'realizada')),
            ('fecha', '>=', lunes), ('fecha', '<=', lunes + timedelta(days=6)),
        ])
        sin_equipo = visitas.filtered(
            lambda v: v.fecha >= hoy and not v.prestamo_ids.filtered(lambda p: p.state != 'devuelto'))
        k2_val = ind._uva_valor('kpi_visitas', len(visitas))
        k2_sub = ind._uva_texto('kpi_visitas', ('%d sin equipo asignado' % len(sin_equipo)) if sin_equipo
                                else 'Todas con equipo asignado')

        # 3. Por revisar
        exps = self.env['uva.expediente'].search([('state', '=', 'por_revisar')])
        urgentes = []
        for e in exps:
            _t, urg, n = e._uva_sla(hoy)
            if urg and n is not None:
                urgentes.append(n)
        k3_val = ind._uva_valor('kpi_revisar', len(exps))
        if urgentes:
            k3_sub = '%d %s en %d %s hábiles' % (len(urgentes), ut.plural(len(urgentes), 'vence', 'vencen'),
                                                min(urgentes), ut.plural(min(urgentes), 'día', 'días'))
        else:
            k3_sub = 'Todos dentro de plazo'
        k3_sub = ind._uva_texto('kpi_revisar', k3_sub)

        # 4. Por cargar a CONAGUA
        cargas = self.env['uva.conagua.carga'].search([('state', '=', 'pendiente')])
        dias = [c._uva_dias(hoy)[1] for c in cargas]
        dias = [d for d in dias if d is not None]
        if dias:
            mayor = max(dias)
            k4_sub = 'Más antiguo: %s' % ('hoy' if mayor == 0 else '%d %s' % (mayor, ut.plural(mayor, 'día', 'días')))
        else:
            k4_sub = 'Sin pendientes'
        k4_val = ind._uva_valor('kpi_conagua', len(cargas))
        k4_sub = ind._uva_texto('kpi_conagua', k4_sub)

        # 5. Equipos por devolver
        prestamos = self.env['uva.prestamo'].search([('state', '=', 'entregado')])
        vencidos = prestamos.filtered(lambda p: p._uva_vencido(hoy))
        k5_val = ind._uva_valor('kpi_equipos', len(prestamos))
        if vencidos:
            k5_sub = '%d %s' % (len(vencidos), ut.plural(len(vencidos), 'devolución vencida', 'devoluciones vencidas'))
        else:
            k5_sub = 'Sin devoluciones vencidas'
        k5_sub = ind._uva_texto('kpi_equipos', k5_sub)

        def kpi(label, valor, sub, warning, target):
            data = {'label': label, 'value': str(valor), 'sub': sub, 'targetScreen': target}
            if warning:
                data['warning'] = True
            return data

        return [
            kpi('Solicitudes activas', k1_val, k1_sub, False, 'Solicitudes'),
            kpi('Visitas esta semana', k2_val, k2_sub, bool(sin_equipo), 'Programacion'),
            kpi('Por revisar', k3_val, k3_sub, bool(urgentes), 'Bandeja'),
            kpi('Por cargar a CONAGUA', k4_val, k4_sub, False, 'Conagua'),
            kpi('Equipos por devolver', k5_val, k5_sub, bool(vencidos), 'Prestamos'),
        ]

    @api.model
    def _tablero_alertas(self, hoy):
        ind = self._ind()
        alertas = []

        def agregar(code, tag, severity, title, desc, action, target):
            alertas.append({
                'id': 'a%d' % (len(alertas) + 1),
                'tag': tag,
                'severity': severity,
                'title': ind._uva_texto(code, title, 'texto'),
                'desc': ind._uva_texto(code, desc, 'texto2'),
                'actionText': action,
                'targetScreen': target,
            })

        # Plazo de 10 días hábiles para resultados
        candidatos = []
        for e in self.env['uva.expediente'].search([('state', 'in', ('por_revisar', 'devuelto'))]):
            _t, urg, n = e._uva_sla(hoy)
            if urg and n is not None:
                candidatos.append((n, e))
        if candidatos:
            n, e = sorted(candidatos, key=lambda x: x[0])[0]
            agregar('alerta_plazo', 'Plazo 10 días', 'red',
                    '%s vence su plazo de resultados en %d %s hábiles' % (ut.corchetes(e.name), n,
                                                                         ut.plural(n, 'día', 'días')),
                    'En revisión técnica · %s' % ut.prefijo(e.cliente_nombre),
                    'Revisar', 'Revision')

        # Más de 2 semanas sin programar
        Visita = self.env['uva.visita']
        cola = Visita.search([('tipo_registro', '=', 'visita'), ('state', 'in', ('por_programar', 'propuesta'))])
        fuera = cola.filtered(lambda v: v._uva_fuera_de_ventana(hoy)).sorted('fecha_docs_completos')
        if fuera:
            v = fuera[0]
            agregar('alerta_programacion', 'Programación', 'red',
                    '%s lleva más de 2 semanas sin programar' % ut.corchetes(v.name),
                    'Documentación completa desde %s' % ut.fdate(v.fecha_docs_completos),
                    'Programar', 'Programacion')

        # Verificaciones iniciales: instalación + 30 días naturales
        iniciales = []
        for v in Visita.search([('tipo_registro', '=', 'visita'), ('tipo_verificacion', '=', 'inicial'),
                                ('state', 'not in', ('realizada', 'cancelada'))]):
            limite = v._uva_fecha_limite_instalacion()
            if limite and hoy <= limite <= hoy + timedelta(days=10):
                iniciales.append((limite, v))
        if iniciales:
            limite, v = sorted(iniciales, key=lambda x: x[0])[0]
            if v.fecha:
                desc = 'Visita programada el %s · %s' % (ut.fdia_mes(v.fecha), ut.prefijo(v.cliente_nombre))
            else:
                desc = 'Sin visita programada · %s' % ut.prefijo(v.cliente_nombre)
            agregar('alerta_30dias', '30 días', 'amber',
                    '%s verificación inicial: la instalación cumple 30 días el %s' % (ut.corchetes(v.name),
                                                                                     ut.fdia_mes(limite)),
                    desc, 'Ver', 'Programacion')

        # Devoluciones de equipo vencidas
        vencidos = self.env['uva.prestamo'].search([('state', '=', 'entregado')]).filtered(
            lambda p: p._uva_vencido(hoy))
        if vencidos:
            p = vencidos.sorted('devolver_antes')[0]
            if p.requerido_el:
                titulo = 'Equipo de %s no se ha devuelto y está reservado para el %s' % (
                    ut.corchetes(p.name), ut.fdia_mes(p.requerido_el))
            else:
                titulo = 'Equipo de %s no se ha devuelto (vencía el %s)' % (ut.corchetes(p.name),
                                                                         ut.fdia_mes(p.devolver_antes))
            equipos = p.equipos_texto or ''
            equipos = (equipos[:1].lower() + equipos[1:]) if equipos and not equipos.split(',')[0].isupper() else equipos
            agregar('alerta_devolucion', 'Devolución', 'amber', titulo,
                    '%s · %s' % (ut.prefijo(p.verificador_id.name or ''), equipos), 'Registrar', 'Prestamos')

        # Calibraciones en curso y equipos vencidos
        Inst = self.env['uva.instrumento']
        en_cal = self.env['uva.calibracion'].search([('state', '=', 'en_curso')]).mapped('instrumento_id')
        vencidos_i = Inst.search([('status', '=', 'vencido')])
        partes = ['%s %s en calibración' % (i._uva_tipo_corto(), i.codigo) for i in en_cal]
        partes += ['%s %s vencido' % (i._uva_tipo_corto(), i.codigo) for i in vencidos_i - en_cal]
        if partes:
            ref = (en_cal or vencidos_i)[0]
            mismos = Inst.search([('tipo', '=', ref.tipo)]).filtered(
                lambda i: i not in en_cal and i.status in ('vigente', 'por_vencer', 'disponible'))
            agregar('alerta_calibracion', 'Calibración', 'amber', '; '.join(partes),
                    'Quedan %d %s disponibles' % (len(mismos), ref._uva_tipo_corto().lower() + 's'),
                    'Ver equipos', 'Instrumentos')

        # Calificación de inspectores por vencer
        por_vencer = self.env['uva.verificador'].search([('comp_status', '=', 'por_vencer'), ('estado', '!=', 'inactivo')])
        if por_vencer:
            if len(por_vencer) == 1:
                v = por_vencer[0]
                dias = (v.fecha_competencia - hoy).days if v.fecha_competencia else 0
                titulo = '%s: calificación vence en %d %s' % (ut.prefijo(v.name), dias, ut.plural(dias, 'día', 'días'))
            else:
                titulo = '%d inspectores con calificación por vencer' % len(por_vencer)
            agregar('alerta_competencia', 'Competencia', 'amber', titulo,
                    'Si vence, no se le pueden asignar visitas', 'Ver', 'Verificadores')

        # Oportunidad comercial: dictámenes por vencer
        dictamenes = self.env['uva.dictamen'].search([
            ('resultado', '=', 'conforme'), ('vigencia', '>=', hoy), ('vigencia', '<=', hoy + timedelta(days=60))])
        n = ind._uva_valor('alerta_oportunidad', len(dictamenes))
        if n > 0:
            agregar('alerta_oportunidad', 'Oportunidad', 'blue',
                    '%d %s de clientes %s en los próximos 60 días' % (n, ut.plural(n, 'dictamen', 'dictámenes'),
                                                                     ut.plural(n, 'vence', 'vencen')),
                    'Proponer verificación periódica conforme a NMX-AA-179', 'Ver clientes', 'Clientes')
        return alertas

    @api.model
    def _tablero_etapas(self, hoy):
        ind = self._ind()
        lunes = ut.lunes_de(hoy)
        inicio_mes = hoy.replace(day=1)
        Visita = self.env['uva.visita']
        Exp = self.env['uva.expediente']
        Carga = self.env['uva.conagua.carga']
        conteos = [
            ('Documentación pendiente', 'etapa_documentacion',
             self.env['uva.solicitud'].search_count([('state', 'in', ('cotizacion', 'pago', 'documentacion'))])),
            ('Por programar', 'etapa_por_programar',
             Visita.search_count([('tipo_registro', '=', 'visita'), ('state', 'in', ('por_programar', 'propuesta'))])),
            ('Programadas', 'etapa_programadas',
             Visita.search_count([('tipo_registro', '=', 'visita'), ('state', 'in', ('programada', 'confirmada')),
                                  ('fecha', '>=', lunes)])),
            ('En campo / sincronizar', 'etapa_campo', Exp.search_count([('state', '=', 'en_campo')])),
            ('En revisión técnica', 'etapa_revision', Exp.search_count([('state', '=', 'por_revisar')])),
            ('Por cargar a CONAGUA', 'etapa_conagua', Carga.search_count([('state', '=', 'pendiente')])),
            ('Acuse enviado (mes)', 'etapa_acuse',
             Carga.search_count([('state', '=', 'acuse_enviado'), ('fecha_envio_cliente', '>=', inicio_mes)])),
        ]
        valores = [(nombre, ind._uva_valor(code, n)) for nombre, code, n in conteos]
        maximo = max([v for _n, v in valores] + [1])
        return [{'name': nombre, 'count': v, 'max': maximo} for nombre, v in valores]

    @api.model
    def _tablero_visitas_hoy(self, hoy):
        visitas = self.env['uva.visita'].search([
            ('tipo_registro', '=', 'visita'), ('fecha', '=', hoy), ('state', 'in', FLUJO_ESTADOS_ACTIVOS)],
            order='hora, id')
        return [{
            'time': v.hora or '',
            'folio': ut.sin_corchetes(v.name),
            'client': ut.corchete_al_final(v.partner_id.name or v.cliente_nombre or ''),
            'inspector': ut.corchete_al_final(v.verificador_id.name or ''),
        } for v in visitas]

    # ==================================================================
    # GET /reportes/estadisticas
    # ==================================================================
    @api.model
    def _meses_periodo(self, periodo, hoy):
        actual = hoy.replace(day=1)
        if periodo and 'año' in str(periodo).lower():
            return [date(hoy.year, m, 1) for m in range(1, hoy.month + 1)]
        meses = []
        for i in range(5, -1, -1):
            meses.append(ut.sumar_meses(actual, -i))
        return meses

    @api.model
    def _estadistica_meses(self, periodo):
        hoy = self._hoy()
        Mes = self.env['uva.estadistica.mes']
        Dict = self.env['uva.dictamen']
        filas = []
        for inicio in self._meses_periodo(periodo, hoy):
            registro = Mes.search([('fecha', '=', inicio)], limit=1)
            if registro:
                valor, meta = registro.verificaciones, registro.meta
            else:
                fin = ut.sumar_meses(inicio, 1)
                valor = Dict.search_count([('fecha_emision', '>=', inicio), ('fecha_emision', '<', fin)])
                meta = 30
            filas.append({'label': ut.MESES_CAP[inicio.month - 1], 'value': valor, 'meta': meta})
        return filas

    @api.model
    def get_estadisticas(self, periodo=None, **kwargs):
        Dato = self.env['uva.estadistica.dato']
        stages = []
        for d in Dato.search([('tipo', '=', 'etapa')]):
            fila = {'label': d.name, 'days': d.valor, 'max': d.maximo}
            if d.es_total:
                fila['isTotal'] = True
            stages.append(fila)
        ncs = [{'label': d.name, 'count': d.valor, 'max': d.maximo} for d in Dato.search([('tipo', '=', 'nc')])]
        inspectores = [{
            'name': d.name or ut.nombre_corto(d.verificador_id.name or ''),
            'count': d.valor,
            'returned': d.valor2,
        } for d in Dato.search([('tipo', '=', 'inspector')])]
        meses = [{'label': m['label'], 'value': m['value']} for m in self._estadistica_meses(periodo)]
        return {'months': meses, 'stages': stages, 'nonConformities': ncs, 'inspectors': inspectores}

    @api.model
    def export_estadisticas_csv(self, periodo=None, **kwargs):
        lineas = ['Mes,Verificaciones,Meta']
        for m in self._estadistica_meses(periodo):
            lineas.append('%s,%d,%d' % (m['label'], m['value'], m['meta']))
        return {
            'filename': 'Estadisticas_UVA_%s.csv' % fields.Date.context_today(self).isoformat(),
            'content': '\n'.join(lineas) + '\n',
        }
