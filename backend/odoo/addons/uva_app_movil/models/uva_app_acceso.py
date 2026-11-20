from datetime import timedelta

from odoo import api, fields, models

MAX_INTENTOS = 5
BLOQUEO_MINUTOS = 5


class UvaAppAcceso(models.Model):
    """Intentos fallidos de inicio de sesión en la app (compartido entre los procesos de Odoo)."""

    _name = 'uva.app.acceso'
    _description = 'Intentos de acceso a la app móvil'

    clave = fields.Char('Correo y dirección IP', required=True, index=True)
    fallos = fields.Integer(default=0)
    bloqueado_hasta = fields.Datetime()

    _clave_unica = models.Constraint('unique(clave)', 'Clave de acceso repetida.')

    @api.model
    def bloqueado_hasta_de(self, clave):
        rec = self.sudo().search([('clave', '=', clave)], limit=1)
        if rec.bloqueado_hasta and rec.bloqueado_hasta > fields.Datetime.now():
            return rec.bloqueado_hasta
        return False

    @api.model
    def registrar_fallo(self, clave):
        # En su propia transacción: después se responde con un error («contraseña incorrecta») que deshace la
        # transacción de la petición; si el intento se guardara en ella, el bloqueo nunca se activaría.
        with self.env.registry.cursor() as cr:
            Acceso = self.with_env(self.env(cr=cr, su=True))
            rec = Acceso.search([('clave', '=', clave)], limit=1) or Acceso.create({'clave': clave})
            fallos = rec.fallos + 1
            if fallos >= MAX_INTENTOS:
                rec.write({'fallos': 0, 'bloqueado_hasta': fields.Datetime.now() + timedelta(minutes=BLOQUEO_MINUTOS)})
            else:
                rec.write({'fallos': fallos})

    @api.model
    def registrar_exito(self, clave):
        self.sudo().search([('clave', '=', clave)]).unlink()
