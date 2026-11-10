{
    'name': 'Sistema UVA - Dictaminación',
    'summary': 'Expedientes de campo, revisión técnica, dictámenes F-17 y carga a CONAGUA',
    'version': '19.0.1.0.0',
    'category': 'Services',
    'author': 'Sistema UVA',
    'license': 'LGPL-3',
    'depends': ['uva_operacion', 'uva_formatos'],
    'data': [
        'security/ir.model.access.csv',
        'data/ir_sequence_data.xml',
        'views/uva_expediente_views.xml',
        'views/uva_dictamen_views.xml',
    ],
    'installable': True,
}
