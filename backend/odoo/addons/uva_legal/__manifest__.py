{
    'name': 'Sistema UVA - Páginas legales (sitio web)',
    'summary': 'Términos y Condiciones de uso y Aviso de Privacidad como páginas editables del sitio web de Odoo',
    'version': '19.0.1.0.0',
    'category': 'Website',
    'author': 'Sistema UVA',
    'license': 'LGPL-3',
    'depends': ['website'],
    'data': [
        'data/website_config.xml',
        'data/website_layout.xml',
        'data/website_pages.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'uva_legal/static/src/scss/legal.scss',
        ],
    },
    'installable': True,
}
