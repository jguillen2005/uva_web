import express from 'express';
import { OdooError, ping } from './odoo.js';

/** Envuelve un handler async y traduce errores a {error} con el status correcto. */
export const h = (fn) => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json(out);
  } catch (err) {
    const status = err instanceof OdooError || err instanceof BadRequest ? err.status : 500;
    if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(status).json({ error: err.message || 'Error interno' });
  }
};

export class BadRequest extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

/** Valida que existan los campos requeridos en el body. */
export function need(body, ...fields) {
  const missing = fields.filter((f) => body?.[f] === undefined || body?.[f] === null || body?.[f] === '');
  if (missing.length) throw new BadRequest(`Faltan campos requeridos: ${missing.join(', ')}`);
  return body;
}

/** Convierte un parámetro de ruta a id numérico de Odoo o lo deja como texto (folio / código). */
export const idOrCode = (v) => (/^\d+$/.test(v) ? Number(v) : v);

export function createService(name, mount) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));
  app.use((req, _res, next) => {
    if (process.env.LOG_REQUESTS !== '0') console.log(`${new Date().toISOString()} ${name} ${req.method} ${req.url}`);
    next();
  });

  app.get('/health', async (_req, res) => {
    res.json({ service: name, status: 'ok', odoo: await ping() });
  });

  const router = express.Router();
  mount(router);
  app.use('/', router);

  app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` }));

  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => console.log(`svc-${name} escuchando en :${port}`));
  return app;
}
