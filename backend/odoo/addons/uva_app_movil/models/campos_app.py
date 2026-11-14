from odoo import fields, models


class UvaVerificador(models.Model):
    """Datos del verificador que muestra la app (Mi perfil y firma del acta F-18)."""

    _inherit = 'uva.verificador'

    app_puesto = fields.Char('Puesto (app)', default='Verificador')
    app_credencial_ema = fields.Char('Credencial EMA')
    app_cedula_profesional = fields.Char('Cédula profesional')
    # Editables desde la app por el propio verificador
    app_telefono = fields.Char('Teléfono de oficina')
    app_celular = fields.Char('Celular')
    app_atiende_nombre = fields.Char('Persona que atiende (predeterminada)')
    app_atiende_id_tipo = fields.Char('Tipo de identificación (predeterminado)')
    app_atiende_id_numero = fields.Char('Folio de identificación (predeterminado)')
    app_ultimo_acceso = fields.Datetime('Último acceso desde la app', readonly=True)


class UvaVisita(models.Model):
    """Datos de la visita que necesita la tablet y que la agenda web no captura."""

    _inherit = 'uva.visita'

    app_orden_dia = fields.Integer('Orden en el día (app)', default=0, help='Orden de recorrido definido por el verificador en la app.')
    app_hora_fin = fields.Char('Hora de término', help='Formato HH:MM.')
    app_prioridad = fields.Selection([('normal', 'Normal'), ('alta', 'Alta'), ('urgente', 'Urgente')], string='Prioridad', default='normal')
    app_notas = fields.Text('Indicaciones para el verificador')
    app_contacto_nombre = fields.Char('Persona que atiende')
    app_contacto_telefono = fields.Char('Teléfono de contacto')
    app_contacto_cargo = fields.Char('Cargo de quien atiende')
    app_contacto_id_tipo = fields.Char('Tipo de identificación', default='INE / IFE')
    app_contacto_id_numero = fields.Char('Folio de identificación')


class UvaExpediente(models.Model):
    """Datos del acta F-18 capturada en la app que no son puntos de la lista de verificación."""

    _inherit = 'uva.expediente'

    app_version = fields.Integer('Versión del acta (app)', default=0, readonly=True,
                                 help='Aumenta cada vez que el verificador reenvía el acta corregida.')
    app_recibida = fields.Datetime('Acta recibida desde la app', readonly=True)
    app_hora_inicio = fields.Char('Hora de inicio', readonly=True)
    app_hora_fin = fields.Char('Hora de fin', readonly=True)
    app_lectura = fields.Char('Lectura del medidor', readonly=True)
    app_numeral10 = fields.Boolean('Cumple numeral 10', readonly=True)
    app_folios_etiquetas = fields.Char('6.13 Folios de etiquetas', readonly=True)
    app_folios_precintos = fields.Char('6.14 Folios de precintos', readonly=True)
    app_observaciones_preguntas = fields.Text('Observaciones por pregunta', readonly=True)
    app_observaciones = fields.Text('Observaciones del usuario', readonly=True)
    app_datos_json = fields.Text('Datos completos del acta (app)', readonly=True)


class ResCompany(models.Model):
    """Encabezado del acta F-18 en la app."""

    _inherit = 'res.company'

    app_subtitulo = fields.Char('Subtítulo en el acta', default='Unidad de Inspección Acreditada')
    app_acreditacion_ema = fields.Char('Acreditación EMA')
    app_aprobacion_conagua = fields.Char('Aprobación CONAGUA')
