// Páginas legales publicadas en el sitio web de Odoo (módulo uva_legal).
// El gateway (y el proxy de Vite en desarrollo) las reenvía a Odoo; el área jurídica las edita
// desde Odoo › Sitio web, sin cambios de código.
export const LEGAL_LINKS = {
  terminos: { href: '/terminos-y-condiciones', label: 'Términos y Condiciones de uso' },
  privacidad: { href: '/aviso-de-privacidad', label: 'Aviso de Privacidad' },
} as const;
