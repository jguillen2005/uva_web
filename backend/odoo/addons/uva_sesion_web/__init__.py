import secrets

from . import controllers


def post_init_hook(env):
    """Clave propia para firmar las sesiones de la web (distinta de la de la app de campo)."""
    ICP = env['ir.config_parameter'].sudo()
    if not ICP.get_param('uva_sesion_web.secreto'):
        ICP.set_param('uva_sesion_web.secreto', secrets.token_hex(32))
