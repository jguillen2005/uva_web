{
    'name': 'Sistema UVA - Operación',
    'summary': 'Programación de visitas, inspectores sugeridos y préstamo de equipos',
    'version': '19.0.1.0.0',
    'category': 'Services',
    'author': 'Sistema UVA',
    'license': 'LGPL-3',
    'depends': ['uva_solicitudes', 'uva_instrumentos'],
    'data': [
        'security/ir.model.access.csv',
        'views/uva_operacion_views.xml',
    ],
    'installable': True,
}
