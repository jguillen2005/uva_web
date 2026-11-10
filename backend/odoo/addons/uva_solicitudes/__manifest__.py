{
    'name': 'Sistema UVA - Solicitudes',
    'summary': 'Solicitudes de servicio F-12, cotización y documentación del cliente (CL-DOC)',
    'version': '19.0.1.0.0',
    'category': 'Services',
    'author': 'Sistema UVA',
    'license': 'LGPL-3',
    'depends': ['uva_core'],
    'data': [
        'security/ir.model.access.csv',
        'data/ir_sequence_data.xml',
        'views/uva_solicitud_views.xml',
    ],
    'installable': True,
}
