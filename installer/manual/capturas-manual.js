// Capturas reales de la web y la app para los manuales de instalación (teléfono emulado y computadora).
// El elemento que hay que tocar se resalta en rojo.
//   node capturas-manual.js <carpeta salida> <clave admin>
const puppeteer = require('puppeteer-core');
const [OUT, ADMIN_PW] = process.argv.slice(2);
const WEB = 'http://localhost:8080', APP = 'https://localhost:8443';
const CORREO = 'jhovani.coss@asercontrol.com', CLAVE = 'asercontrol123456';
// Persona de ejemplo que se registra para las capturas de «Usuarios y roles» (bórrela después en Odoo)
const EJEMPLO = { nombre: 'Ing. Ana López Ruiz', correo: 'ana.lopez@ejemplo.mx' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};
const resaltar = (p, texto, sel = 'button,a') => p.evaluate((t, s) => {
  document.querySelectorAll('[data-resaltado]').forEach((e) => { e.style.outline = ''; e.style.boxShadow = ''; e.removeAttribute('data-resaltado'); });
  const el = [...document.querySelectorAll(s)].find((x) => x.innerText.trim().replace(/\s+/g, ' ').includes(t) && x.offsetParent);
  if (!el) return false;
  el.scrollIntoView({ block: 'center' });
  el.setAttribute('data-resaltado', '1');
  el.style.outline = '4px solid #e11d48'; el.style.outlineOffset = '4px'; el.style.boxShadow = '0 0 0 10px rgba(225,29,72,.18)';
  return true;
}, texto, sel);
const escribir = (p, sel, v) => p.evaluate((s, val) => { const el = document.querySelector(s); if (!el) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
const esperar = async (p, re, ms = 20000) => { for (let i = 0; i < ms / 250; i++) { if (re.test(await p.evaluate(() => document.body.innerText).catch(() => ''))) return true; await sleep(250); } return false; };
const foto = async (p, nombre) => { await sleep(500); await p.screenshot({ path: `${OUT}/${nombre}.png` }); console.log('ok', nombre); };

async function telefono(b, tipo) {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.setUserAgent(UA[tipo]);
  await p.setViewport(tipo === 'android' ? { width: 412, height: 860, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 390, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  return { ctx, p };
}

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, acceptInsecureCerts: true, args: ['--ignore-certificate-errors'] });

  // ---------------- Web en el teléfono (Android): entrar, menú, App de campo
  for (const tipo of ['android', 'iphone']) {
    const { ctx, p } = await telefono(b, tipo);
    await p.goto(WEB + '/', { waitUntil: 'networkidle0' });
    await escribir(p, '#login-email', CORREO); await escribir(p, '#login-password', CLAVE);
    if (tipo === 'android') { await resaltar(p, 'Iniciar sesión', 'button'); await foto(p, 'tel-web-1-entrar'); }
    await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Iniciar sesión').click());
    await esperar(p, /Cerrar sesión|Tablero|Inicio/);
    await sleep(1200);
    if (tipo === 'android') {
      await p.evaluate(() => { const m = [...document.querySelectorAll('button')].find((x) => x.querySelector('svg.lucide-menu')); m?.click(); });
      await sleep(800);
      await resaltar(p, 'App de campo (móvil)', 'a,button');
      await foto(p, 'tel-web-2-menu');
      await p.evaluate(() => [...document.querySelectorAll('a,button')].find((x) => x.innerText.trim() === 'App de campo (móvil)' && x.offsetParent)?.click());
      await sleep(800);
      // si el menú sigue abierto, se cierra con su botón (X)
      await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((b) => b.querySelector('svg.lucide-x') && b.offsetParent); x?.click(); });
      await sleep(600);
    }
    await p.evaluate(() => { window.location.hash = 'AppMovil'; });
    await esperar(p, /Instalar la app en este/);
    await sleep(1000);
    await resaltar(p, 'Descargar permiso de seguridad');
    await foto(p, `tel-web-3-permiso-${tipo}`);
    await resaltar(p, 'Abrir la app');
    await foto(p, `tel-web-4-abrir-${tipo}`);
    await ctx.close();
  }

  // ---------------- App de campo en el teléfono: entrar, preparar, agenda
  {
    const { ctx, p } = await telefono(b, 'android');
    await p.goto(APP + '/', { waitUntil: 'networkidle0' });
    await escribir(p, 'input[name=email]', CORREO); await escribir(p, 'input[name=password]', CLAVE);
    await resaltar(p, 'Iniciar Sesión', 'button');
    await foto(p, 'app-1-entrar');
    await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Iniciar Sesión como Verificador/.test(x.innerText))?.click());
    await esperar(p, /Listo para trabajar sin conexión/, 40000);
    await resaltar(p, 'Comenzar', 'button');
    await foto(p, 'app-2-listo');
    await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^Comenzar$/.test(x.innerText.trim()))?.click());
    await esperar(p, /Citas de Hoy/);
    await sleep(1500);
    await p.evaluate(() => window.scrollTo(0, 0));
    await foto(p, 'app-3-agenda');
    await ctx.close();
  }

  // ---------------- Computadora: entrar a la web y página App de campo
  {
    const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
    await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1.5 });
    await p.goto(WEB + '/', { waitUntil: 'networkidle0' });
    // El usuario del sistema llega ya escrito (desde la base de Odoo)
    for (let i = 0; i < 40 && !(await p.evaluate(() => document.querySelector('#login-password')?.value)); i++) await sleep(250);
    await resaltar(p, 'Iniciar sesión', 'button');
    await foto(p, 'pc-1-entrar');
    await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Iniciar sesión').click());
    await esperar(p, /Cerrar sesión/);
    await sleep(1500);
    await foto(p, 'pc-2-tablero');
    await p.evaluate(() => { window.location.hash = 'AppMovil'; });
    await esperar(p, /Cómo instalar la app en un teléfono o tablet/);
    await sleep(1000);
    await p.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((x) => /Cómo instalar la app/.test(x.innerText)); h?.closest('section')?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -20); });
    await resaltar(p, 'Copiar', 'button');
    await foto(p, 'pc-3-app-de-campo');

    // Cambiar contraseña con el medidor de seguridad (sin guardar)
    await p.evaluate(() => { window.location.hash = 'CambiarClave'; });
    await esperar(p, /Contraseña actual/);
    await escribir(p, '#cc-actual', 'asercontrol123456');
    await escribir(p, '#cc-nueva', 'Rio-Culiacan-2026'); await escribir(p, '#cc-repetir', 'Rio-Culiacan-2026');
    await sleep(500);
    await resaltar(p, 'Cambiar contraseña', 'button[type=submit]');
    await foto(p, 'pc-cambiar-contrasena');

    // Usuarios y roles: lista, formulario «Nuevo usuario» y contraseña temporal (persona de ejemplo)
    await p.evaluate(() => { window.location.hash = 'Usuarios'; });
    await esperar(p, /Usuarios y control de accesos/);
    await sleep(1200);
    await p.evaluate(() => window.scrollTo(0, 0));
    await resaltar(p, 'Nuevo usuario', 'button');
    await foto(p, 'pc-usuarios');
    await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Nuevo usuario')?.click());
    await esperar(p, /Registrar usuario/);
    await escribir(p, '#usr-nombre', EJEMPLO.nombre); await escribir(p, '#usr-correo', EJEMPLO.correo);
    await p.evaluate(() => [...document.querySelectorAll('[role=dialog] label')].find((x) => /^Inspector/.test(x.innerText.trim()))?.querySelector('input')?.click());
    await sleep(400);
    await resaltar(p, 'Registrar usuario', 'button');
    await foto(p, 'pc-nuevo-usuario');
    await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Registrar usuario')?.click());
    await esperar(p, /Contraseña temporal/);
    const temporal = await p.evaluate(() => document.querySelector('[role=dialog] dd.font-mono')?.innerText.trim() || '');
    await foto(p, 'pc-clave-temporal');
    await ctx.close();

    // Primera entrada de esa persona: el sistema le pide crear su contraseña nueva
    const ctx2 = await b.createBrowserContext(); const p2 = await ctx2.newPage();
    await p2.setViewport({ width: 480, height: 860, deviceScaleFactor: 2 });
    await p2.goto(WEB + '/', { waitUntil: 'networkidle0' });
    await escribir(p2, '#login-email', EJEMPLO.correo); await escribir(p2, '#login-password', temporal);
    await p2.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Iniciar sesión').click());
    await esperar(p2, /Cree su contraseña nueva/);
    await escribir(p2, '#clave-actual', temporal);
    await escribir(p2, '#clave-nueva', 'MiClaveNueva2026'); await escribir(p2, '#clave-repetir', 'MiClaveNueva2026');
    await sleep(400);
    await resaltar(p2, 'Guardar y continuar', 'button');
    await foto(p2, 'pc-cambiar-clave');
    await ctx2.close();
  }
  await b.close();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
