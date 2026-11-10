import type { ProcesoStep } from '../types';

/** Pasos del mapa del proceso (contenido estático, sin endpoint). */
export const procesoSteps: ProcesoStep[] = [
  {
    num: '1',
    role: 'Coordinador',
    title: 'Solicitud y cotización',
    desc: 'Alta del cliente y su pozo, generación de solicitud F-12, cotización en Aspel SAE, firma digital del contrato y registro de pago.',
    target: 'Solicitudes',
    targetLabel: 'Ir a Solicitudes'
  },
  {
    num: '2',
    role: 'Coordinador',
    title: 'Documentación del cliente',
    desc: 'Checklist CL-DOC (6 rubros). Al completarse todos los documentos obligatorios, la solicitud pasa a programación y corren las 2 semanas límite.',
    target: 'Solicitudes',
    targetLabel: 'Ver checklist CL-DOC'
  },
  {
    num: '3',
    role: 'Coordinador',
    title: 'Programación y reserva de equipo',
    desc: 'El sistema sugiere inspector por zona y carga; se asigna fecha y equipo con calibración vigente. Se envía cita al Outlook del inspector y a su app.',
    target: 'Programacion',
    targetLabel: 'Ir a Programación'
  },
  {
    num: '4',
    role: 'Responsable de equipos',
    title: 'Entrega del equipo',
    desc: 'El inspector recoge en almacén el equipo reservado (flexómetro, multímetro, GPS, flujómetro) y confirma la entrega con su firma en la app.',
    target: 'Prestamos',
    targetLabel: 'Entrega de equipos'
  },
  {
    num: '5',
    role: 'Inspector / Verificador',
    title: 'Verificación en campo',
    desc: 'Cuestionario F-18 en la app móvil funcionando sin señal de red, captura de fotos con GPS y firmas en sitio. Al tener red se sincroniza a SharePoint.',
    target: 'Preview',
    targetLabel: 'Simular app de campo'
  },
  {
    num: '6',
    role: 'Responsable de equipos',
    title: 'Devolución del equipo',
    desc: 'Se revisa el estado físico y accesorios; los equipos limpios vuelven a Disponible. Si hay daño se envían a fuera de servicio o calibración.',
    target: 'Prestamos',
    targetLabel: 'Registrar devolución'
  },
  {
    num: '7',
    role: 'Gerente Técnico',
    title: 'Revisión y autorización técnica',
    desc: 'Revisa evidencias fotográficas y validaciones automáticas; autoriza el dictamen F-17 (conforme o inconforme) con firma electrónica o lo devuelve.',
    target: 'Bandeja',
    targetLabel: 'Bandeja de revisión'
  },
  {
    num: '8',
    role: 'Encargado de registro CONAGUA',
    title: 'Carga a CONAGUA y acuse oficial',
    desc: 'Carga del dictamen en el portal de CONAGUA (manual en Fase 1, bot asistido en Fase 2), resguardo del acuse en SharePoint y notificación al cliente.',
    target: 'Expediente',
    targetLabel: 'Carga a CONAGUA'
  }
];
