import secrets

from . import controllers
from . import models


def post_init_hook(env):
    # Secreto para firmar los tokens de sesión de la app (uno por instalación)
    ICP = env['ir.config_parameter'].sudo()
    if not ICP.get_param('uva_app_movil.secreto'):
        ICP.set_param('uva_app_movil.secreto', secrets.token_hex(32))
