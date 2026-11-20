// Cliente mínimo para la API externa JSON-2 de Odoo 19.
// POST {ODOO_URL}/json/2/{model}/{method}  — argumentos con nombre en el cuerpo.
import { AsyncLocalStorage } from 'node:async_hooks';

const ODOO_URL = (process.env.ODOO_URL || 'http://odoo:8069').replace(/\/$/, '');
const ODOO_DB = process.env.ODOO_DB || 'uva';
const ODOO_API_KEY = process.env.ODOO_API_KEY || '';
const TIMEOUT_MS = Number(process.env.ODOO_TIMEOUT_MS || 20000);

/** Contexto de la petición HTTP en curso (lo fija server.js): { lectura: true } en GET/HEAD. */
export const peticion = new AsyncLocalStorage();

export class OdooError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

export async function call(model, method, kwargs = {}) {
  if (!ODOO_API_KEY) {
    throw new OdooError('ODOO_API_KEY no configurada en el microservicio', 500);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const enviar = () =>
    fetch(`${ODOO_URL}/json/2/${model}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `bearer ${ODOO_API_KEY}`,
        'X-Odoo-Database': ODOO_DB,
      },
      body: JSON.stringify(kwargs),
      signal: controller.signal,
    });
  let res;
  try {
    try {
      res = await enviar();
    } catch (err) {
      // Bajo carga, Odoo puede cerrar una conexión keep-alive justo cuando se reutiliza ("fetch failed").
      // Se reintenta una vez: en lecturas siempre; en escrituras solo si la conexión ni se abrió (no llegó a Odoo).
      const codigo = err.cause?.code || '';
      const reintentable = err.name !== 'AbortError' && (peticion.getStore()?.lectura || codigo === 'ECONNREFUSED');
      if (!reintentable) throw err;
      console.warn(`[odoo] ${model}.${method}: reintento tras error de conexión (${codigo || err.message})`);
      await new Promise((r) => setTimeout(r, 300));
      res = await enviar();
    }
  } catch (err) {
    throw new OdooError(
      err.name === 'AbortError'
        ? 'Odoo no respondió a tiempo'
        : `No se pudo conectar con Odoo: ${err.message}${err.cause?.code ? ` (${err.cause.code})` : ''}`,
      504,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    // Odoo 19 devuelve {name, message, arguments, context, debug} en errores JSON-2
    const msg = (body && (body.message || body.error?.message)) || `Error ${res.status} de Odoo`;
    // UserError / ValidationError / AccessError → error de negocio para el usuario
    const isUser = body && /UserError|ValidationError|AccessError|MissingError/.test(body.name || '');
    throw new OdooError(msg, isUser ? 422 : res.status === 401 ? 502 : res.status);
  }
  return body;
}

/** Atajo para métodos públicos del modelo abstracto uva.api */
export const api = (method, kwargs = {}) => call('uva.api', method, kwargs);

export async function ping() {
  try {
    const r = await fetch(`${ODOO_URL}/web/health`, { signal: AbortSignal.timeout(3000) });
    return r.ok ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}
