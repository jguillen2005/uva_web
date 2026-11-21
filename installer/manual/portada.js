// Portada del manual: degradado de la web de AP Interfaces (violeta › azul › cian) con el logo blanco y el título.
// Word no admite degradados de fondo, así que la portada se genera como imagen (marca/portada.png).
//   node portada.js <versión> <node_modules con puppeteer-core>
const path = require('path');
const fs = require('fs');
// La versión del manual se mantiene siempre en 1.0.0 (no es la versión del software)
const [VERSION = '1.0.0', NM = path.join(__dirname, 'node_modules')] = process.argv.slice(2);
const puppeteer = require(path.join(NM, 'puppeteer-core'));
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'marca', 'logo-ap-blanco.png')).toString('base64');
// Logo del producto (el mismo de la web y del ícono «Sistema UVA» que crea el instalador)
const logoUVA = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'marca', 'icono-sistema-uva.png')).toString('base64');

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1280px;height:760px;font-family:"Segoe UI",Inter,Arial,sans-serif}
.p{position:relative;width:1280px;height:760px;overflow:hidden;color:#fff;padding:80px 96px;
  background:linear-gradient(115deg,#9162ff 0%,#7a2df0 18%,#6f1ce6 32%,#3a3fe0 46%,#0058ce 58%,#0a8fd8 70%,#00c8d6 84%,#00ffd7 100%)}
.arco{position:absolute;left:-380px;top:-1020px;width:1500px;height:1240px;border-radius:50%;
  background:linear-gradient(110deg,rgba(150,110,255,.75),rgba(40,110,230,.55))}
.uva{position:absolute;right:96px;top:80px;width:220px;height:220px;border-radius:44px;background:#fff;box-shadow:0 18px 50px rgba(8,20,60,.35);display:flex;align-items:center;justify-content:center;flex-direction:column}
.uva img{width:150px;margin:0}
.uva span{color:#0b3fa8;font-weight:800;font-size:22px;margin-top:6px}
.brillo{position:absolute;right:-200px;bottom:-260px;width:820px;height:620px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,255,215,.35),transparent)}
.c{position:relative}
img{width:300px;display:block;margin-bottom:70px}
h1{font-size:88px;font-weight:800;letter-spacing:-1px;line-height:1.05}
h2{font-size:40px;font-weight:400;margin-top:14px;color:#e8fffb}
p{font-size:24px;margin-top:40px;color:#eaf2ff;letter-spacing:.3px}
</style></head><body><div class="p"><div class="arco"></div><div class="brillo"></div><div class="uva"><img src="${logoUVA}" alt="Sistema UVA"><span>Sistema UVA</span></div>
<div class="c">
<img src="${logo}" alt="AP Interfaces">
<h1>Manual de instalación</h1>
<h2>Sistema UVA y App de campo Asercontrol</h2>
<p>Manual versión ${VERSION} &nbsp;·&nbsp; Windows · Mac · Linux · Android · iPhone · iPad</p>
</div></div></body></html>`;

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 760, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'load' });
  await p.screenshot({ path: path.join(__dirname, 'marca', 'portada.png') });
  await b.close();
  console.log('ok portada');
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
