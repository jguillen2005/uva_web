{
    'name': 'Sistema UVA - Inicio de sesión web',
    'version': '19.0.1.0.0',
    'category': 'Services',
    'summary': 'Inicio de sesión de la web del Sistema UVA con los usuarios de Odoo y recuperación de contraseña',
    'description': """
Inicio de sesión de la web del Sistema UVA
==========================================
* /api/sesion/login, /recuperar, /salir y /yo: sesión con el usuario y la contraseña de Odoo en una
  cookie firmada (HttpOnly).
* /api/sesion/validar: el gateway nginx (auth_request) valida la cookie en cada llamada a la API y
  reenvía el usuario real a los microservicios (X-UVA-User).
* Bloqueo de 5 minutos tras 5 intentos fallidos por usuario e IP (modelo uva.app.acceso).
""",
    'author': 'APInterfaces',
    'license': 'LGPL-3',
    'depends': ['uva_api', 'uva_app_movil', 'auth_signup'],
    'data': [],
    'post_init_hook': 'post_init_hook',
    'installable': True,
    'application': False,
}
