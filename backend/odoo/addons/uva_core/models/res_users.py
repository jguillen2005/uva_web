# -*- coding: utf-8 -*-
from odoo import fields, models


class ResUsers(models.Model):
    _inherit = 'res.users'

    uva_usuario_tecnico = fields.Boolean(
        string='Usuario técnico UVA',
        help='Los usuarios técnicos (integración, administración) no se muestran en el directorio '
             'de usuarios del Sistema UVA.')
    uva_ultimo_acceso = fields.Datetime(
        string='Último acceso (UVA)',
        help='Último acceso registrado desde la aplicación web del Sistema UVA.')
    uva_cambiar_clave = fields.Boolean(
        string='Debe cambiar su contraseña',
        help='La contraseña es inicial o temporal: al entrar a la web, el sistema le pide crear una nueva '
             'antes de dejarle usar el sistema o la app de campo.')

    # Preferencias de notificación (pantalla "Mi perfil" del frontend)
    uva_notif_correo = fields.Boolean(string='Avisos por correo (Outlook)', default=True)
    uva_notif_teams = fields.Boolean(string='Avisos en Microsoft Teams', default=True)
    uva_notif_vencimientos = fields.Boolean(
        string='Alertas de vencimiento', default=True,
        help='Plazos de solicitudes, calibraciones y competencias por vencer.')
    uva_resumen_diario = fields.Boolean(string='Resumen diario a las 08:00', default=False)
