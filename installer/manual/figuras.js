// Ilustraciones para los manuales de instalación (ventanas de Windows/Mac/Linux, ajustes de Android/iPhone)
// y marcos de teléfono para las capturas reales. Cada figura se guarda como PNG.
//   node figuras.js <carpeta capturas> <carpeta salida> <node_modules con puppeteer-core>
const path = require('path');
const fs = require('fs');
const [CAPT, OUT, NM] = process.argv.slice(2);
const puppeteer = require(path.join(NM, 'puppeteer-core'));
const img = (n) => 'data:image/png;base64,' + fs.readFileSync(path.join(CAPT, n + '.png')).toString('base64');

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Segoe UI",system-ui,-apple-system,sans-serif;background:#fff;padding:18px;display:inline-block}
#fig{display:inline-block;position:relative}
.hl{outline:3px solid #e11d48;outline-offset:3px;box-shadow:0 0 0 9px rgba(225,29,72,.16);border-radius:6px}
.tag{position:absolute;background:#e11d48;color:#fff;font-weight:700;font-size:13px;padding:5px 10px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.tag:after{content:"";position:absolute;width:0;height:0;border:7px solid transparent}
.tag.izq:after{left:-12px;top:50%;margin-top:-7px;border-right-color:#e11d48}
.tag.arr:after{top:-12px;left:18px;border-bottom-color:#e11d48}
.tag.aba:after{bottom:-12px;left:18px;border-top-color:#e11d48}
/* Windows */
.win{width:560px;background:#fff;border:1px solid #9aa4b2;box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:13px;color:#1f2937}
.win .tb{height:32px;display:flex;align-items:center;padding:0 10px;font-size:12px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;gap:8px}
.win .tb .x{margin-left:auto;letter-spacing:18px;color:#6b7280}
.btn{display:inline-block;padding:6px 18px;border:1px solid #9aa4b2;background:#f9fafb;border-radius:3px;font-size:13px;min-width:86px;text-align:center}
.btn.pri{background:#2563eb;border-color:#1d4ed8;color:#fff}
.fila{display:flex;align-items:center;gap:10px;padding:7px 12px;border-bottom:1px solid #f1f5f9}
.ico{width:22px;height:22px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff}
/* Mac */
.mac{width:560px;background:#fff;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.22);overflow:hidden;font-size:13px;color:#1f2937;border:1px solid #d1d5db}
.mac .tb{height:34px;display:flex;align-items:center;gap:7px;padding:0 12px;background:#f5f5f7;border-bottom:1px solid #e5e7eb;font-size:12.5px;font-weight:600;color:#374151}
.dot{width:12px;height:12px;border-radius:50%;display:inline-block}
.alerta{width:300px;background:#f6f6f6;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.28);padding:18px 18px 14px;text-align:center;font-size:12.5px;color:#111;border:1px solid #d4d4d4}
.alerta b{display:block;font-size:13.5px;margin:10px 0 6px}
.mbtn{display:block;width:100%;padding:6px;border-radius:7px;background:#e5e5e5;margin-top:7px;font-size:13px}
.mbtn.pri{background:#2f7cf6;color:#fff}
.term{background:#1e1e1e;color:#e5e7eb;font-family:Menlo,Consolas,monospace;font-size:12px;padding:12px 14px;line-height:1.55;min-height:200px}
.term .c{color:#22d3ee}.term .o{color:#4ade80}.term .y{color:#facc15}
/* Teléfono */
.tel{width:300px;border:10px solid #111827;border-radius:36px;overflow:hidden;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.25);position:relative}
.tel .barra{height:24px;background:#fff;font-size:11px;font-weight:700;display:flex;justify-content:space-between;align-items:center;padding:0 16px;color:#111}
.tel .url{margin:4px 10px 6px;background:#f1f3f4;border-radius:999px;padding:6px 12px;font-size:12px;color:#202124;display:flex;align-items:center;gap:6px}
.tel .cont{height:520px;overflow:hidden;position:relative}
.tel .cont img{width:100%;display:block}
.aj{font-size:13px;color:#111}
.aj .tit{font-size:20px;font-weight:800;padding:14px 16px 8px}
.aj .grupo{background:#fff;border-radius:12px;margin:8px 12px;overflow:hidden}
.aj .it{padding:12px 14px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:10px}
.aj .it:last-child{border-bottom:0}
.sw{margin-left:auto;width:42px;height:24px;border-radius:999px;background:#34c759;position:relative}
.sw:after{content:"";position:absolute;right:2px;top:2px;width:20px;height:20px;border-radius:50%;background:#fff}
.nota{font-size:11px;color:#6b7280;padding:4px 16px}
`;

const telefono = (contenido, { url = '', fondo = '#fff' } = {}) => `
<div class="tel"><div class="barra"><span>9:41</span><span>▮▮▮ ◔</span></div>
${url ? `<div class="url">🔒 <span>${url}</span></div>` : ''}
<div class="cont" style="background:${fondo}">${contenido}</div></div>`;
const capturaTel = (n, url, alto = 520) => telefono(`<img src="${img(n)}" style="height:${alto}px;object-fit:cover;object-position:top">`, { url });

const F = {};
// ============================================================ WINDOWS
F['w-1-descargas'] = `<div class="win"><div class="tb">📁 Descargas<span class="x">— ☐ ✕</span></div>
<div style="display:flex"><div style="width:150px;background:#f8fafc;padding:10px;font-size:12px;line-height:2;color:#475569">⭐ Acceso rápido<br>🖥️ Escritorio<br><b style="color:#1d4ed8">⬇️ Descargas</b><br>📄 Documentos</div>
<div style="flex:1"><div class="fila" style="font-size:11px;color:#64748b">Nombre</div>
<div class="fila hl" style="background:#dbeafe;margin:6px"><span class="ico" style="background:#2563eb">UVA</span><b>SistemaUVA-Instalador-Windows-1.1.1.exe</b></div>
<div class="fila">📄 Guia-rápida-instalación.pdf</div></div></div></div>
<span class="tag izq" style="left:575px;top:84px">Doble clic aquí</span>`;
F['w-2-protegio'] = `<div style="width:520px;background:#1e4fa3;color:#fff;padding:26px 28px;font-size:13.5px;box-shadow:0 8px 24px rgba(0,0,0,.25)">
<div style="font-size:24px;font-weight:300;margin-bottom:14px">Windows protegió su PC</div>
<div style="line-height:1.5">Windows SmartScreen impidió el inicio de una aplicación no reconocida. Si ejecuta esta aplicación, podría poner en riesgo su PC.</div>
<div style="margin-top:10px"><span class="hl" style="text-decoration:underline;padding:2px 4px">Más información</span></div>
<div style="text-align:right;margin-top:40px"><span class="btn" style="background:transparent;color:#fff;border-color:#fff">No ejecutar</span></div></div>
<span class="tag izq" style="left:170px;top:122px">1. Clic aquí</span>`;
F['w-3-ejecutar'] = `<div style="width:520px;background:#1e4fa3;color:#fff;padding:26px 28px;font-size:13.5px;box-shadow:0 8px 24px rgba(0,0,0,.25)">
<div style="font-size:24px;font-weight:300;margin-bottom:14px">Windows protegió su PC</div>
<div style="line-height:1.5">Windows SmartScreen impidió el inicio de una aplicación no reconocida.</div>
<div style="margin-top:12px;line-height:1.7">Aplicación: SistemaUVA-Instalador-Windows-1.1.1.exe<br>Editor: Editor desconocido</div>
<div style="text-align:right;margin-top:30px;display:flex;gap:10px;justify-content:flex-end"><span class="btn hl" style="background:transparent;color:#fff;border-color:#fff">Ejecutar de todas formas</span><span class="btn" style="background:transparent;color:#fff;border-color:#fff">No ejecutar</span></div></div>
<span class="tag aba" style="left:250px;top:150px">2. Clic aquí</span>`;
F['w-4-demo'] = `<div class="win" style="width:440px"><div class="tb">Instalador Sistema UVA 1.1.1<span class="x">✕</span></div>
<div style="padding:18px 20px;display:flex;gap:14px;line-height:1.55"><span style="font-size:28px">❔</span><div>¿Cargar datos de demostración?<br><br><b>Sí</b>: clientes, expedientes y usuarios de ejemplo para conocer el sistema.<br><b>No</b>: base de datos vacía, lista para operar.</div></div>
<div style="background:#f3f4f6;padding:12px;text-align:right;display:flex;gap:8px;justify-content:flex-end"><span class="btn">Sí</span><span class="btn hl">No</span><span class="btn">Cancelar</span></div></div>
<span class="tag aba" style="left:250px;top:150px">Para trabajar de verdad: No</span>`;
F['w-5-progreso'] = `<div class="win" style="width:600px"><div class="tb">⬛ Instalador Sistema UVA 1.1.1<span class="x">— ☐ ✕</span></div>
<div class="term" style="min-height:230px">  ==============================================<br>    Sistema UVA 1.1.1 - Instalador<br>  ==============================================<br><br>
<span class="c">&gt; Revisando requisitos del equipo</span><br>  Windows 10.0.19045 · RAM 16 GB · disco libre 80 GB<br><span class="c">&gt; Copiando archivos</span><br>  Archivos copiados.<br>
<span class="c">&gt; Creando la base 'uva' e instalando módulos. Tarda varios minutos...</span><br>  <span class="y">▌</span></div></div>
<span class="tag arr fijo" style="left:300px;top:250px">No cierre esta ventana: espere (10 a 20 minutos)</span>`;
F['w-6-certificado'] = `<div class="win" style="width:470px"><div class="tb">Advertencia de seguridad<span class="x">✕</span></div>
<div style="padding:18px 20px;display:flex;gap:14px;line-height:1.5"><span style="font-size:28px">⚠️</span><div>Está a punto de instalar un certificado desde una entidad de certificación que afirma representar a:<br><br><b>Asercontrol CA local</b><br><br>¿Desea instalar este certificado?</div></div>
<div style="background:#f3f4f6;padding:12px;text-align:right;display:flex;gap:8px;justify-content:flex-end"><span class="btn hl">Sí</span><span class="btn">No</span></div></div>
<span class="tag aba" style="left:250px;top:180px">Clic en Sí</span>`;
F['w-7-telefonos'] = `<div class="win" style="width:470px"><div class="tb">Instalador Sistema UVA 1.1.1<span class="x">✕</span></div>
<div style="padding:18px 20px;display:flex;gap:14px;line-height:1.5"><span style="font-size:28px">❔</span><div><b>Último paso: permitir que los teléfonos y tablets se conecten a esta computadora.</b><br><br>Al elegir Sí, Windows mostrará una ventana que pregunta «¿Quiere permitir que esta aplicación haga cambios en el dispositivo?». Elija Sí.</div></div>
<div style="background:#f3f4f6;padding:12px;text-align:right;display:flex;gap:8px;justify-content:flex-end"><span class="btn hl">Sí</span><span class="btn">No</span></div></div>
<span class="tag aba" style="left:270px;top:170px">1. Clic en Sí</span>`;
F['w-8-uac'] = `<div style="width:440px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.3);font-size:13px">
<div style="background:#1f6fb2;color:#fff;padding:14px 18px;font-size:14px">Control de cuentas de usuario</div>
<div style="padding:16px 18px"><div style="font-size:17px;margin-bottom:12px">¿Quiere permitir que esta aplicación haga cambios en el dispositivo?</div>
<div style="display:flex;gap:10px;align-items:center"><span class="ico" style="background:#1e3a8a">PS</span><b>Windows PowerShell</b></div>
<div style="color:#6b7280;margin-top:6px">Editor comprobado: Microsoft Windows</div></div>
<div style="display:flex;gap:8px;padding:0 18px 18px"><span class="btn pri hl" style="flex:1">Sí</span><span class="btn" style="flex:1">No</span></div></div>
<span class="tag aba" style="left:40px;top:120px">2. Clic en Sí</span>`;
F['w-9-credenciales'] = `<div class="win" style="width:520px"><div class="tb">📝 CREDENCIALES.txt: Bloc de notas<span class="x">— ☐ ✕</span></div>
<div style="padding:12px 14px;font-family:Consolas,monospace;font-size:11.5px;line-height:1.55;background:#fff;white-space:pre">SISTEMA UVA · SUS DATOS DE ACCESO
Guarde este archivo en un lugar seguro: contiene contraseñas.

1. PARA ENTRAR AL SISTEMA EN ESTA COMPUTADORA
   Haga doble clic en el ícono «Sistema UVA» del escritorio

<span class="hl" style="padding:2px">   Usuario:     admin
   Contraseña:  Xk7p-2qL9-wR4m</span>

2. DIRECCIÓN PARA LOS TELÉFONOS Y LAS DEMÁS COMPUTADORAS
<span class="hl" style="padding:2px">   http://192.168.1.50:8080</span>

3. VERIFICADOR DE PRUEBA (para probar la app)
   Correo:      jhovani.coss@asercontrol.com
   Contraseña:  asercontrol123456

4. INSTRUCCIONES COMPLETAS
   «Manual de instalacion Sistema UVA» (PDF)</div></div>
<span class="tag izq" style="left:330px;top:150px">Guarde este archivo en un lugar seguro</span>`;
F['w-10-escritorio'] = `<div style="width:520px;height:170px;border-radius:8px;background:linear-gradient(135deg,#1e3a8a,#0ea5e9);position:relative;padding:18px;display:flex;gap:26px;color:#fff;font-size:12px;text-align:center">
<div class="hl" style="width:90px;padding:6px"><div style="width:52px;height:52px;margin:0 auto 6px;border-radius:12px;background:#fff;color:#1d4ed8;font-weight:900;font-size:20px;display:flex;align-items:center;justify-content:center">UVA</div>Sistema UVA</div>
<div style="width:90px;padding:6px"><div style="width:52px;height:52px;margin:0 auto 6px;border-radius:12px;background:#fff;color:#0f766e;font-weight:900;font-size:20px;display:flex;align-items:center;justify-content:center">📱</div>App de campo Asercontrol</div></div>
<span class="tag izq" style="left:140px;top:44px">Doble clic para abrir el sistema</span>`;

// ============================================================ MAC
const finder = (titulo, filas, ancho = 560) => `<div class="mac" style="width:${ancho}px"><div class="tb"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span><span style="margin-left:14px">${titulo}</span></div>
<div style="display:flex"><div style="width:140px;background:#f5f5f7;padding:10px;font-size:12px;line-height:2;color:#475569">Favoritos<br>🖥️ Escritorio<br><b style="color:#2563eb">⬇️ Descargas</b><br>📄 Documentos<br>🅰️ Aplicaciones</div><div style="flex:1;padding:6px 0">${filas}</div></div></div>`;
F['m-1-zip'] = finder('Descargas', `<div class="fila hl" style="margin:6px;background:#dbeafe">🗜️ <b>SistemaUVA-Instalador-Mac-1.1.1.zip</b></div><div class="fila">📁 Instalador Sistema UVA</div>`) + `<span class="tag izq" style="left:575px;top:58px">Doble clic: se descomprime</span>`;
F['m-2-app'] = finder('Instalador Sistema UVA', `<div class="fila hl" style="margin:6px;background:#dbeafe"><span class="ico" style="background:#1d4ed8">💧</span><b>Instalar Sistema UVA</b><span style="margin-left:auto;color:#6b7280">Aplicación</span></div><div class="fila">📄 LEEME.txt</div>`) + `<span class="tag izq" style="left:575px;top:58px">Doble clic aquí</span>`;
F['m-3-bloqueo'] = `<div class="alerta"><div style="font-size:34px">⚠️</div><b>No se puede abrir «Instalar Sistema UVA» porque Apple no puede comprobar si contiene software malicioso.</b>Esta aplicación es de un desarrollador no identificado.<span class="mbtn pri">Aceptar</span><span class="mbtn">Trasladar a la papelera</span></div>
<span class="tag arr fijo" style="left:30px;top:300px">Si ve este aviso: Aceptar y siga el paso de abajo</span>`;
F['m-4-clic-derecho'] = finder('Instalador Sistema UVA', `<div class="fila" style="margin:6px;background:#dbeafe"><span class="ico" style="background:#1d4ed8">💧</span><b>Instalar Sistema UVA</b></div><div class="fila">📄 LEEME.txt</div>
<div style="position:absolute;left:250px;top:62px;width:190px;background:#fff;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 8px 20px rgba(0,0,0,.18);padding:4px;font-size:12.5px;line-height:1.9">
<div class="hl" style="padding:0 10px;background:#2f7cf6;color:#fff">Abrir</div><div style="padding:0 10px">Mostrar contenido del paquete</div><div style="padding:0 10px">Trasladar a la papelera</div><div style="padding:0 10px">Obtener información</div></div>`) + `<span class="tag izq" style="left:455px;top:66px">Clic derecho › Abrir</span>`;
F['m-5-abrir'] = `<div class="alerta"><div style="font-size:34px">⚠️</div><b>macOS no puede comprobar el desarrollador de «Instalar Sistema UVA». ¿Seguro que quieres abrirla?</b>Al abrir esta aplicación, se anulará la protección del sistema.<span class="mbtn">Cancelar</span><span class="mbtn pri hl">Abrir</span></div>
<span class="tag izq" style="left:330px;top:212px">Clic en Abrir</span>`;
F['m-6-privacidad'] = `<div class="mac" style="width:560px"><div class="tb"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span><span style="margin-left:14px">Privacidad y seguridad</span></div>
<div style="padding:16px 20px;line-height:1.6"><b>Seguridad</b><div style="background:#f5f5f7;border-radius:10px;padding:12px 14px;margin-top:8px">Se ha bloqueado el uso de «Instalar Sistema UVA» porque no es de un desarrollador identificado.<div style="text-align:right;margin-top:8px"><span class="btn hl">Abrir igualmente</span></div></div></div></div>
<span class="tag aba" style="left:300px;top:70px">En macOS reciente: aquí</span>`;
F['m-7-opciones'] = `<div class="alerta" style="width:470px;text-align:left"><b style="margin-top:0">Instalador Sistema UVA 1.1.1</b>Se detectó el Sistema UVA ya instalado. ¿Qué desea hacer?
<div style="background:#fff;border:1px solid #d4d4d4;border-radius:6px;margin-top:8px;font-size:12px">
<div class="hl" style="padding:7px 9px;background:#2f7cf6;color:#fff">Actualizar todo: instala la versión 1.1.1 y conserva clientes, visitas y usuarios.</div>
<div style="padding:7px 9px">Reinstalar desde cero: respaldo en Documentos, borra todo e instala limpio.</div>
<div style="padding:7px 9px">Solo la app: actualiza solo la app de campo.</div>
<div style="padding:7px 9px">Cancelar: salir sin hacer cambios.</div></div>
<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><span class="mbtn" style="width:90px">Cancelar</span><span class="mbtn pri" style="width:90px">Continuar</span></div></div>`;
F['m-8-demo'] = `<div class="alerta" style="width:340px"><div style="font-size:30px">❔</div><b>¿Cargar datos de demostración?</b>Sí: clientes y usuarios de ejemplo para conocer el sistema.<br>No: base de datos vacía, lista para operar.
<div style="display:flex;gap:6px;margin-top:10px"><span class="mbtn">Cancelar</span><span class="mbtn pri hl">No</span><span class="mbtn">Sí</span></div></div>
<span class="tag arr" style="left:120px;top:210px">Para trabajar de verdad: No</span>`;
F['m-9-terminal'] = `<div class="mac" style="width:600px"><div class="tb"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span><span style="margin-left:14px">Terminal — instalar.command</span></div>
<div class="term">  Sistema UVA 1.1.1 - Instalador para Mac<br><br><span class="c">&gt; Revisando requisitos del equipo</span><br>  macOS 15.5 · chip Apple (arm64) · RAM 16 GB · disco libre 80 GB<br><span class="c">&gt; Copiando archivos a /Users/oficina/SistemaUVA</span><br>  Archivos copiados.<br><span class="c">&gt; Creando la base 'uva' e instalando módulos. Tarda varios minutos...</span><br>  <span class="y">▌</span></div></div>
<span class="tag arr fijo" style="left:280px;top:250px">No cierre esta ventana: espere (10 a 20 minutos)</span>`;
F['m-10-contrasena'] = `<div class="alerta" style="width:320px"><div style="font-size:30px">🔒</div><b>Estás haciendo cambios en la configuración de confianza de certificados.</b>Introduce tu contraseña para permitirlo.
<div style="background:#fff;border:1px solid #cfcfcf;border-radius:6px;padding:6px;margin-top:10px;text-align:left;color:#9ca3af">Contraseña de la Mac</div>
<span class="mbtn">Cancelar</span><span class="mbtn pri hl">Actualizar configuración</span></div>
<span class="tag izq" style="left:350px;top:180px">Escriba la contraseña de la Mac</span>`;
F['m-11-credenciales'] = `<div class="mac" style="width:560px"><div class="tb"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span><span style="margin-left:14px">CREDENCIALES.txt</span></div>
<div style="padding:12px 14px;font-family:Menlo,Consolas,monospace;font-size:12px;line-height:1.6">Sistema UVA - datos de acceso<br><br>Sistema (web):      http://localhost:8080<br>Desde otros equipos: http://192.168.1.50:8080<br><br><span class="hl" style="padding:2px">Usuario: admin<br>Contraseña: Xk7p-2qL9-wR4m</span></div></div>
<span class="tag izq" style="left:330px;top:150px">Guarde este archivo en un lugar seguro</span>`;

// ============================================================ LINUX
F['l-1-extraer'] = `<div class="win" style="width:560px;border-radius:10px;overflow:hidden"><div class="tb" style="background:#2b2b2b;color:#fff">Descargas<span class="x">✕</span></div>
<div style="padding:8px;position:relative;height:150px"><div class="fila" style="background:#e5e7eb;border-radius:6px">🗜️ <b>SistemaUVA-Instalador-Linux-1.1.1.tar.gz</b></div>
<div style="position:absolute;left:250px;top:30px;width:200px;background:#fff;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 8px 20px rgba(0,0,0,.18);padding:4px;font-size:12.5px;line-height:1.9">
<div style="padding:0 10px">Abrir con Gestor de archivadores</div><div class="hl" style="padding:0 10px;background:#e95420;color:#fff">Extraer aquí</div><div style="padding:0 10px">Mover a la papelera</div></div></div></div>
<span class="tag izq" style="left:470px;top:84px">Clic derecho › Extraer aquí</span>`;
F['l-2-terminal'] = `<div class="win" style="width:560px;border-radius:10px;overflow:hidden"><div class="tb" style="background:#2b2b2b;color:#fff">Descargas<span class="x">✕</span></div>
<div style="padding:8px;position:relative;height:150px"><div class="fila" style="background:#e5e7eb;border-radius:6px">📁 <b>Instalador Sistema UVA</b></div>
<div style="position:absolute;left:250px;top:30px;width:200px;background:#fff;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 8px 20px rgba(0,0,0,.18);padding:4px;font-size:12.5px;line-height:1.9">
<div style="padding:0 10px">Abrir</div><div class="hl" style="padding:0 10px;background:#e95420;color:#fff">Abrir en una terminal</div><div style="padding:0 10px">Copiar</div></div></div></div>
<span class="tag izq" style="left:470px;top:84px">Clic derecho › Abrir en una terminal</span>`;
F['l-3-comando'] = `<div class="win" style="width:620px;border-radius:10px;overflow:hidden"><div class="tb" style="background:#2b2b2b;color:#fff">Terminal<span class="x">✕</span></div>
<div class="term" style="background:#300a24">oficina@pc:~/Descargas/Instalador Sistema UVA$ <span class="hl" style="color:#fff;padding:1px 4px">bash "Instalar Sistema UVA.sh"</span><br><br>  Sistema UVA 1.1.1 - Instalador para Linux<br><span class="c">&gt; Revisando requisitos del equipo</span><br><br>¿Cargar datos de demostración?<br><br>   1) Cancelar<br>   2) No<br>   3) Sí (Enter)<br><br>Elija una opción [1-3]: <span class="y">2</span></div></div>
<span class="tag aba" style="left:230px;top:8px">Escriba esto y presione Enter</span>`;
F['l-4-sudo'] = `<div class="win" style="width:620px;border-radius:10px;overflow:hidden"><div class="tb" style="background:#2b2b2b;color:#fff">Terminal<span class="x">✕</span></div>
<div class="term" style="background:#300a24;min-height:120px"><span class="c">&gt; Instalando el certificado de confianza</span><br>[sudo] contraseña para oficina: <span class="hl" style="padding:1px 30px"> </span><br><br><span class="y">(al escribir la contraseña no aparecen letras: es normal)</span></div></div>
<span class="tag aba" style="left:200px;top:40px">Escriba su contraseña y presione Enter</span>`;

// ============================================================ ANDROID
const ajustesAndroid = (contenido) => telefono(`<div class="aj" style="background:#f2f4f7;height:100%">${contenido}</div>`);
F['a-1-buscar'] = ajustesAndroid(`<div class="tit">Ajustes</div><div style="margin:4px 12px 10px;background:#fff;border-radius:999px;padding:9px 14px;color:#111">🔍 certificado</div>
<div class="grupo"><div class="it hl" style="margin:4px;font-weight:700">🔐 Certificado de CA<div style="font-size:11px;color:#6b7280;font-weight:400;margin-left:auto">Seguridad</div></div><div class="it">🔐 Certificado de usuario de VPN y aplicaciones</div><div class="it">🔐 Certificado de Wi-Fi</div></div>`) + `<span class="tag izq" style="left:300px;top:150px">Toque «Certificado de CA»</span>`;
F['a-2-aviso'] = ajustesAndroid(`<div style="padding:40px 22px;font-size:13px;line-height:1.55"><div style="font-size:18px;font-weight:800;margin-bottom:12px">Tus datos no serán privados</div>Las autoridades de certificación (CA) garantizan la identidad de los sitios web… Instala solo los certificados de organizaciones en las que confíes.
<div style="margin-top:30px;display:flex;flex-direction:column;gap:12px"><span style="color:#1a73e8;font-weight:700;text-align:right">No instalar</span><span class="hl" style="color:#1a73e8;font-weight:700;text-align:right;padding:4px">Instalar de todos modos</span></div></div>`) + `<span class="tag izq" style="left:300px;top:250px">Toque aquí</span>`;
F['a-3-archivo'] = ajustesAndroid(`<div class="tit">Descargas</div><div class="grupo"><div class="it hl" style="margin:4px">📄 <div><b>Certificado-Android-Asercontrol.crt</b><div style="font-size:11px;color:#6b7280">1.2 kB · hoy</div></div></div><div class="it">📄 Otro archivo.pdf</div></div>`) + `<span class="tag izq" style="left:300px;top:110px">Elija este archivo</span>`;
F['a-4-instalar'] = telefono(`<img src="${img('app-1-entrar')}" style="height:520px;object-fit:cover;object-position:top;filter:brightness(.55)">
<div style="position:absolute;left:14px;right:14px;bottom:20px;background:#fff;border-radius:18px;padding:16px;box-shadow:0 -4px 20px rgba(0,0,0,.25)"><div style="display:flex;gap:10px;align-items:center"><span class="ico" style="background:#1d4ed8;width:38px;height:38px">💧</span><div><b>Instalar app</b><div style="font-size:11px;color:#6b7280">App Asercontrol · 192.168.1.50</div></div></div>
<div style="display:flex;justify-content:flex-end;gap:16px;margin-top:14px;font-weight:700;color:#1a73e8;font-size:13px"><span>Cancelar</span><span class="hl" style="padding:3px 8px">Instalar</span></div></div>`, { url: '192.168.1.50:8443' }) + `<span class="tag izq" style="left:300px;top:540px">Toque Instalar</span>`;
F['a-5-icono'] = telefono(`<div style="background:linear-gradient(160deg,#0f172a,#1e40af);height:100%;padding:30px 18px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px;color:#fff;font-size:10px;text-align:center;align-content:start">
${['📷 Cámara', '💬 Mensajes', '🌐 Chrome', '⚙️ Ajustes', '📞 Teléfono', '📧 Correo'].map((x) => `<div><div style="font-size:26px">${x.split(' ')[0]}</div>${x.split(' ')[1]}</div>`).join('')}
<div class="hl" style="padding:2px"><div style="width:44px;height:44px;margin:0 auto 3px;border-radius:12px;background:#fff;color:#1d4ed8;font-size:22px;display:flex;align-items:center;justify-content:center">💧</div>Asercontrol</div></div>`) + `<span class="tag izq" style="left:300px;top:150px">Su app instalada</span>`;
// ============================================================ iPHONE / iPAD
const ajustesIos = (contenido) => telefono(`<div class="aj" style="background:#f2f2f7;height:100%">${contenido}</div>`);
F['i-1-permitir'] = telefono(`<img src="${img('tel-web-3-permiso-iphone')}" style="height:520px;object-fit:cover;object-position:top;filter:brightness(.55)">
<div style="position:absolute;left:24px;right:24px;top:170px;background:#f2f2f2;border-radius:14px;text-align:center;font-size:12.5px;overflow:hidden"><div style="padding:16px 14px"><b>Este sitio web intenta descargar un perfil de configuración. ¿Quieres permitirlo?</b></div>
<div style="display:flex;border-top:1px solid #d1d1d6"><span style="flex:1;padding:10px;color:#0a84ff">Ignorar</span><span class="hl" style="flex:1;padding:10px;color:#0a84ff;font-weight:700;border-left:1px solid #d1d1d6">Permitir</span></div></div>`, { url: '192.168.1.50:8080' }) + `<span class="tag izq" style="left:300px;top:300px">Toque Permitir</span>`;
F['i-2-perfil'] = ajustesIos(`<div class="tit">Ajustes</div><div class="grupo"><div class="it">👤 <div><b>Su nombre</b><div style="font-size:11px;color:#6b7280">Cuenta de Apple</div></div></div></div>
<div class="grupo"><div class="it hl" style="margin:4px;font-weight:700">Perfil descargado <span style="margin-left:auto;color:#9ca3af">›</span></div></div><div class="grupo"><div class="it">✈️ Modo avión</div><div class="it">📶 Wi-Fi</div><div class="it">⚙️ General</div></div>`) + `<span class="tag izq" style="left:300px;top:160px">Toque «Perfil descargado»</span>`;
F['i-3-instalar'] = ajustesIos(`<div style="display:flex;justify-content:space-between;padding:14px 16px;font-size:14px"><span style="color:#0a84ff">Cancelar</span><b>Instalar perfil</b><span class="hl" style="color:#0a84ff;font-weight:700;padding:2px 6px">Instalar</span></div>
<div class="grupo" style="padding:14px;text-align:center"><div style="font-size:34px">🛡️</div><b>Asercontrol CA local</b><div style="font-size:11px;color:#ef4444;margin-top:4px">No verificado</div></div><div class="nota">Le pedirá el código de desbloqueo del iPhone. Luego toque Instalar otra vez.</div>`) + `<span class="tag izq" style="left:300px;top:40px">Toque Instalar</span>`;
F['i-4-confianza'] = ajustesIos(`<div style="padding:12px 16px;font-size:12px;color:#0a84ff">‹ Información</div><div class="tit" style="font-size:17px">Ajustes de confianza de certificados</div>
<div class="nota">ACTIVAR LA CONFIANZA TOTAL PARA LOS CERTIFICADOS RAÍZ</div><div class="grupo"><div class="it hl" style="margin:4px"><b>Asercontrol CA local</b><span class="sw"></span></div></div>
<div class="nota">Para llegar aquí: Ajustes › General › Información › (hasta abajo) Ajustes de confianza de certificados.</div>`) + `<span class="tag izq" style="left:300px;top:150px">Enciéndalo (verde)</span>`;
F['i-5-compartir'] = telefono(`<img src="${img('app-1-entrar')}" style="height:470px;object-fit:cover;object-position:top">
<div style="position:absolute;left:0;right:0;bottom:0;height:50px;background:#f7f7f7;border-top:1px solid #ddd;display:flex;justify-content:space-around;align-items:center;font-size:20px;color:#0a84ff"><span>‹</span><span>›</span><span class="hl" style="padding:0 6px">⬆️</span><span>📖</span><span>⧉</span></div>`, { url: '192.168.1.50:8443' }) + `<span class="tag izq" style="left:300px;top:545px">Botón Compartir</span>`;
F['i-6-agregar'] = telefono(`<div style="background:#000;opacity:.5;position:absolute;inset:0"></div>
<div style="position:absolute;left:0;right:0;bottom:0;background:#f2f2f7;border-radius:14px 14px 0 0;padding:12px" class="aj">
<div class="grupo" style="margin:6px 0"><div class="it">📋 Copiar</div><div class="it">📑 Añadir a la lista de lectura</div><div class="it hl" style="margin:4px;font-weight:700">➕ Agregar a pantalla de inicio</div><div class="it">🔖 Añadir marcador</div></div></div>`) + `<span class="tag izq" style="left:300px;top:420px">Toque aquí y luego «Agregar»</span>`;

// ============================================================ capturas reales en marco de teléfono
F['t-1-entrar'] = capturaTel('tel-web-1-entrar', '192.168.1.50:8080');
F['t-2-menu'] = capturaTel('tel-web-2-menu', '192.168.1.50:8080');
F['t-3-permiso-android'] = capturaTel('tel-web-3-permiso-android', '192.168.1.50:8080');
F['t-4-abrir-android'] = capturaTel('tel-web-4-abrir-android', '192.168.1.50:8080');
F['t-3-permiso-iphone'] = capturaTel('tel-web-3-permiso-iphone', '192.168.1.50:8080');
F['t-4-abrir-iphone'] = capturaTel('tel-web-4-abrir-iphone', '192.168.1.50:8080');
F['t-5-app-entrar'] = capturaTel('app-1-entrar', '');
F['t-6-app-listo'] = capturaTel('app-2-listo', '');
F['t-7-app-agenda'] = capturaTel('app-3-agenda', '');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage();
  await p.setViewport({ width: 1000, height: 900, deviceScaleFactor: 2 });
  for (const [id, html] of Object.entries(F)) {
    await p.setContent(`<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="fig">${html}</div></body></html>`, { waitUntil: 'load' });
    // Etiquetas: a la derecha de la ventana/teléfono, a la altura del elemento resaltado (no tapan nada)
    await p.evaluate(() => {
      const fig = document.querySelector('#fig'), f = fig.getBoundingClientRect();
      const marco = fig.firstElementChild.getBoundingClientRect();
      document.querySelectorAll('#fig .tag:not(.fijo)').forEach((t, i) => {
        const hl = document.querySelectorAll('#fig .hl')[i] || document.querySelector('#fig .hl');
        if (!hl) return;
        const h = hl.getBoundingClientRect();
        if (fig.firstElementChild.classList.contains('tel')) {
          // Teléfonos: etiqueta debajo, centrada (todas las figuras de teléfono quedan del mismo ancho)
          t.className = 'tag arr';
          t.style.whiteSpace = 'normal'; t.style.maxWidth = (marco.width - 10) + 'px'; t.style.textAlign = 'center';
          t.style.left = (marco.left - f.left + (marco.width - t.offsetWidth) / 2) + 'px';
          t.style.top = (marco.bottom - f.top + 14) + 'px';
        } else {
          t.className = 'tag izq';
          t.style.left = (marco.right - f.left + 16) + 'px';
          t.style.top = (h.top - f.top + h.height / 2 - t.offsetHeight / 2) + 'px';
        }
      });
    });
    // el área incluye las etiquetas rojas que sobresalen de la figura
    const caja = await p.evaluate(() => {
      const r = [...document.querySelectorAll('#fig, #fig *')].map((e) => e.getBoundingClientRect()).filter((x) => x.width && x.height);
      const x0 = Math.min(...r.map((x) => x.left)), y0 = Math.min(...r.map((x) => x.top)), x1 = Math.max(...r.map((x) => x.right)), y1 = Math.max(...r.map((x) => x.bottom));
      return { x: Math.max(0, x0 - 14), y: Math.max(0, y0 - 14), width: x1 - x0 + 28, height: y1 - y0 + 28 };
    });
    await p.screenshot({ path: path.join(OUT, id + '.png'), clip: caja });
  }
  await b.close();
  console.log(Object.keys(F).length, 'figuras');
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
