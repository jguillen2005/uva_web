// Arranca todos los microservicios en local (sin Docker) en los puertos 4001-4006.
// Uso: ODOO_URL=http://localhost:8069 ODOO_API_KEY=... node dev-all.js
import { spawn } from 'node:child_process';

const services = ['reportes', 'catalogos', 'solicitudes', 'operacion', 'calidad', 'dictaminacion'];
services.forEach((name, i) => {
  const p = spawn(process.execPath, [`src/${name}.js`], {
    env: { ...process.env, PORT: String(4001 + i) },
    stdio: 'inherit',
  });
  p.on('exit', (code) => console.log(`svc-${name} terminó (${code})`));
});
