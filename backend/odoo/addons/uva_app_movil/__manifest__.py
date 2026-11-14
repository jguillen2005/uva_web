{
    'name': 'Sistema UVA - App móvil de campo',
    'summary': 'API de la App Asercontrol (tablet del verificador) directo sobre los modelos del Sistema UVA',
    'description': """
Conecta la App Asercontrol (PWA de campo, NMX-AA-179 / F-18-AC) con el Sistema UVA sin duplicar datos:

* Agenda del verificador desde uva.visita (pozo de la solicitud, instrumentos del préstamo).
* Orden de recorrido y estado "en campo" al iniciar la inspección.
* El acta F-18 llega como uva.expediente: puntos C / NC / N/A con su observación, fotografías,
  firmas y PDF, y pasa a revisión técnica con el flujo de UVA (devolver, autorizar, dictamen).
* Perfil del verificador (uva.verificador + usuario), foto, contraseña y recuperación por correo.
* Endpoints /api/app/* servidos por Odoo, con token por verificador y bloqueo por intentos fallidos.
""",
    'version': '19.0.1.0.0',
    'category': 'Services',
    'author': 'AP Interfaces',
    'license': 'LGPL-3',
    'depends': ['uva_api', 'auth_signup'],
    'data': [
        'security/ir.model.access.csv',
        'views/uva_app_movil_views.xml',
    ],
    'post_init_hook': 'post_init_hook',
    'installable': True,
}
