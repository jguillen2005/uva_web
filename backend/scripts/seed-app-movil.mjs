// Carga en la base "uva" los datos de la App Asercontrol (tablet del verificador) usando los modelos del
// Sistema UVA, sin duplicar: busca primero por RFC (clientes), serie del medidor (pozos), código de
// inventario (instrumentos), folio (visitas) y usuario (verificador), y solo crea lo que no existe.
//   node scripts/seed-app-movil.mjs
// Variables: ODOO_URL (http://localhost:8169), ODOO_DB (uva), ODOO_ADMIN_PASSWORD (admin), TZ_OPERACION.
// Solo para desarrollo y demostración: crea el verificador de la app con contraseña conocida.
import { readFileSync } from 'node:fs';

const URL_ODOO = process.env.ODOO_URL || 'http://localhost:8169';
const DB = process.env.ODOO_DB || 'uva';
const ADMIN_PASSWORD = process.env.ODOO_ADMIN_PASSWORD || 'admin';
const TZ = process.env.TZ_OPERACION || 'America/Monterrey';
const datos = JSON.parse(readFileSync(new URL('./datos-app-movil.json', import.meta.url), 'utf8'));

let id = 0;
const rpc = async (service, method, args) => {
  const res = await fetch(`${URL_ODOO}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: ++id, params: { service, method, args } }),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.data?.message || body.error.message);
  return body.result;
};
const uid = await rpc('common', 'authenticate', [DB, 'admin', ADMIN_PASSWORD, {}]);
if (!uid) throw new Error('No se pudo entrar a Odoo como administrador');
const call = (model, method, args, kwargs = {}) => rpc('object', 'execute_kw', [DB, uid, ADMIN_PASSWORD, model, method, args, kwargs]);

const xmlid = async (full) => {
  const [module, name] = full.split('.');
  const [r] = await call('ir.model.data', 'search_read', [[['module', '=', module], ['name', '=', name]]], { fields: ['res_id'], limit: 1 });
  if (!r) throw new Error(`No existe ${full}`);
  return r.res_id;
};
// Busca por dominio; si existe lo actualiza, si no lo crea
const upsert = async (model, domain, values) => {
  const [found] = await call(model, 'search', [domain], { limit: 1, context: { active_test: false } });
  if (found) {
    await call(model, 'write', [[found], values]);
    return found;
  }
  return call(model, 'create', [values]);
};

const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const plusDays = (n) => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// '04:00 p. m.' -> '16:00' (formato HH:MM de uva.visita)
const hhmm = (s) => {
  const m = String(s).match(/(\d{1,2}):(\d{2})\s*([ap])/i);
  if (!m) return false;
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'p') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};
const fechaIso = (s) => {
  const all = [...String(s).matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
  const m = all[all.length - 1];
  return m ? `${m[3]}-${m[2]}-${m[1]}` : false;
};
const TIPO = { 'Inicial (Nueva Instalación)': 'inicial', 'Periódica (2 Años)': 'periodica', 'Extraordinaria por Modificación': 'extraordinaria' };

// ---------- Unidad Verificadora (encabezado del acta) ----------
const [companyId] = await call('res.company', 'search', [[]], { limit: 1, order: 'id asc' });
await call('res.company', 'write', [[companyId], {
  name: 'Asercontrol, S.A. de C.V.',
  vat: 'ASE1602169K7',
  email: 'uva@asercontrol.com',
  phone: '(81) 2473-5218',
  street: 'Orizaba 301 Col. Mitras Norte',
  city: 'Monterrey',
  zip: '64320',
  app_subtitulo: 'Unidad de Inspección Acreditada',
  app_acreditacion_ema: 'MVA-001',
  app_aprobacion_conagua: 'B00.9/12/2020.-900',
}]);

// ---------- Verificador de la app (usuario Inspector del Sistema UVA) ----------
const grupoInspector = await xmlid('uva_core.group_uva_inspector');
const usuario = await upsert('res.users', [['login', '=', 'jhovani.coss@asercontrol.com']], {
  name: 'Eduardo Jhovani Jaime Coss',
  login: 'jhovani.coss@asercontrol.com',
  email: 'jhovani.coss@asercontrol.com',
  password: 'Asercontrol20246*',
  tz: TZ,
  group_ids: [[4, grupoInspector]],
});
const verificador = await upsert('uva.verificador', [['user_id', '=', usuario]], {
  name: 'Eduardo Jhovani Jaime Coss',
  code: 'JC',
  user_id: usuario,
  email: 'jhovani.coss@asercontrol.com',
  zona: 'Culiacán, Sinaloa',
  zona_corta: 'Culiacán',
  fecha_competencia: '2027-12-31',
  estado: 'activo',
  app_puesto: 'Verificador Oficial Acreditado (Inspector Líder)',
  app_credencial_ema: 'VER-NMX-0842',
  app_cedula_profesional: 'CED-PROF-7392814',
  app_telefono: '(81) 42735218',
  app_celular: '81 2200 6455',
  app_atiende_nombre: 'Ing. Manuel González Estrada',
  app_atiende_id_tipo: 'INE / IFE',
  app_atiende_id_numero: 'IDMEX-1894921029',
});

// ---------- Instrumentos (uva.instrumento, por código de inventario) ----------
const instrumentos = [];
for (const i of datos.instrumentos) {
  instrumentos.push({
    codigo: i.inventoryNumber,
    nombre: i.name,
    id: await upsert('uva.instrumento', [['codigo', '=', i.inventoryNumber]], {
      codigo: i.inventoryNumber,
      tipo: i.name,
      nombre_corto: i.description,
      marca_modelo: i.brandModel,
      serie: i.serialNumber,
      fecha_vencimiento: fechaIso(i.calibrationExpiry),
      estado: 'operativo',
    }),
  });
}

// ---------- Clientes, pozos, solicitudes, visitas y préstamo de equipo ----------
const crearVisita = async (v, verificadorId) => {
  const cliente = await upsert('res.partner', [['vat', '=', v.titularRfc]], {
    name: v.titularName,
    vat: v.titularRfc,
    is_company: true,
    uva_es_cliente: true,
  });
  const pozo = await upsert('uva.pozo', [['medidor_serie', '=', v.meterSerial]], {
    name: v.wellId,
    identificador: v.concessionTitle.split('/')[0] || 'ID-001',
    partner_id: cliente,
    titulo_concesion: v.concessionTitle,
    uso: v.concessionUse,
    fuente: 'subterranea',
    volumen_anual: v.annualVolume,
    coordenadas: `${v.lat}, ${v.lng}`,
    diametro_descarga: String(v.dischargeDiameter),
    medidor_marca: v.meterBrand,
    medidor_modelo: v.meterModel,
    medidor_serie: v.meterSerial,
    medidor_dn: String(v.meterDn),
  });
  const solicitud = await upsert('uva.solicitud', [['pozo_id', '=', pozo], ['cliente_nombre', '=', v.titularName]], {
    partner_id: cliente,
    pozo_id: pozo,
    cliente_nombre: v.titularName,
    pozo_nombre: v.wellId,
    titulo_concesion: v.concessionTitle,
    tipo: TIPO[v.verificationType] || 'periodica',
    state: 'programada',
    fecha_programada: plusDays(v.diasDesdeHoy),
  });
  const visita = await upsert('uva.visita', [['name', '=', v.orderFolio]], {
    name: v.orderFolio,
    tipo_registro: 'visita',
    solicitud_id: solicitud,
    partner_id: cliente,
    cliente_nombre: v.titularName,
    cliente_corto: v.titularName.split(',')[0].slice(0, 30),
    sitio: v.wellId,
    lugar: v.wellAddress,
    tipo_verificacion: TIPO[v.verificationType] || 'periodica',
    verificador_id: verificadorId,
    fecha: plusDays(v.diasDesdeHoy),
    hora: hhmm(v.startTime),
    state: v.status === 'completada' ? 'realizada' : 'confirmada',
    app_hora_fin: hhmm(v.endTime),
    app_orden_dia: 0,
    app_prioridad: v.priority || 'normal',
    app_notas: v.notes || false,
    app_contacto_nombre: v.contactPerson,
    app_contacto_telefono: v.contactPhone,
    app_contacto_cargo: v.contactRole,
    app_contacto_id_tipo: v.contactIdType,
    app_contacto_id_numero: v.contactIdNumber,
  });
  // Equipo entregado al inspector para la visita (de ahí salen los instrumentos de la tablet)
  if (!(await call('uva.prestamo', 'search_count', [[['visita_id', '=', visita]]]))) {
    await call('uva.prestamo', 'create', [{
      visita_id: visita,
      state: 'entregado',
      linea_ids: instrumentos.map((i) => [0, 0, { name: i.nombre, inventario: i.codigo }]),
    }]);
  }
  return visita;
};

const visitas = [];
for (const v of datos.visitas) visitas.push(await crearVisita(v, verificador));

// Una visita de hoy asignada a otro inspector del Sistema UVA (no debe aparecer en la agenda de la app)
const [otro] = await call('uva.verificador', 'search', [[['code', '=', 'I1']]], { limit: 1 });
const base = datos.visitas.find((v) => v.diasDesdeHoy === 0);
visitas.push(await crearVisita({ ...base, orderFolio: 'ORD-2026-CUL-099', meterSerial: 'AJENA-0099', wellId: 'POZO DE OTRO INSPECTOR' }, otro));

console.log(JSON.stringify({ hoy: today, usuario, verificador, visitas: visitas.length, instrumentos: instrumentos.length }, null, 2));
