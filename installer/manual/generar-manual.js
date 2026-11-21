// Genera el «Manual de instalacion Sistema UVA» (Word): el único documento de instrucciones que acompaña a
// los instaladores de Windows, Mac y Linux (reemplaza a los LEEME.txt). Lenguaje claro, para personas que
// no son del área de sistemas, con una imagen por paso (carpeta fig/).
//
//   cd installer/manual && npm install && node generar-manual.js
//   Después se convierte a PDF con Word (ver README.md).
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  HeadingLevel, AlignmentType, LevelFormat, Footer, Header, PageNumber, ImageRun, PageBreak, TableOfContents,
  HeightRule, TabStopType, ExternalHyperlink,
} = require('docx');

const FIG = path.join(__dirname, 'fig');
const MARCA = path.join(__dirname, 'marca');
const SALIDA = path.join(__dirname, 'Manual de instalacion Sistema UVA.docx');
const VERSION = process.argv[2] || '1.1.1';
// Formato y paleta de AP Interfaces (sitio web: azul marino, cian y violeta; tipografía Inter / Segoe UI)
const FONT = 'Segoe UI';
const AZUL = '071326';        // azul marino
const VIOLETA = '7657FF';
const CIAN = '19D3D1';
const CIAN_OSCURO = '0E8F8D';
const TEXTO = '152238';
const GRIS = '52657C';
const LINEA = 'C6D6E8';
const ROJO = 'E11D48';
const WEB = 'https://www.apinterfaces.mx/';
const WEB_TEXTO = 'www.apinterfaces.mx';
const ANCHO = 9638;               // A4 con márgenes de 2 cm (twips)
const ANCHO_PX = 640;             // ancho útil aproximado en píxeles (96 ppp)

// ------------------------------------------------------------------ utilidades de formato
const sinBorde = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const borde = { style: BorderStyle.SINGLE, size: 4, color: LINEA };
const run = (x) => (typeof x === 'string' ? new TextRun({ text: x, font: FONT, size: 22, color: TEXTO }) : new TextRun({ font: FONT, size: 22, color: TEXTO, ...x }));
const p = (parts, opts = {}) => new Paragraph({ spacing: { after: 140, line: 300 }, ...opts, children: (Array.isArray(parts) ? parts : [parts]).map(run) });
const b = (text) => ({ text, bold: true });
const rojo = (text) => ({ text, bold: true, color: ROJO });
const titulo = (t) => new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(t)] });
const capitulo = (t) => [new Paragraph({ children: [new PageBreak()] }), new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] })];
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const vineta = (parts) => p(parts, { numbering: { reference: 'vinetas', level: 0 }, spacing: { after: 80, line: 300 } });
const refs = [];
const lista = () => { const r = `l${refs.length + 1}`; refs.push(r); return (parts) => p(parts, { numbering: { reference: r, level: 0 }, spacing: { after: 90, line: 300 } }); };
const espacio = () => new Paragraph({ spacing: { after: 80 }, children: [] });

const medidas = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
const imagen = (nombre, anchoPx, altoPx) => {
  const data = fs.readFileSync(path.join(FIG, nombre + '.png'));
  const m = medidas(data);
  let w = Math.min(anchoPx, ANCHO_PX), h = Math.round(m.h * w / m.w);
  if (altoPx) { h = altoPx; w = Math.round(m.w * h / m.h); if (w > anchoPx) { w = anchoPx; h = Math.round(m.h * w / m.w); } }
  return new ImageRun({ type: 'png', data, transformation: { width: w, height: h } });
};
const leyenda = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: t, font: FONT, size: 18, italics: true, color: GRIS })] });
const fig = (nombre, anchoPx, texto) => [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: texto ? 40 : 200 }, keepNext: !!texto, children: [imagen(nombre, anchoPx)] }),
  ...(texto ? [leyenda(texto)] : []),
];
// Imágenes lado a lado, todas del mismo alto (teléfonos, ventanas pequeñas)
const lado = (items, altoPx = 300) => new Table({
  width: { size: ANCHO, type: WidthType.DXA },
  columnWidths: items.map(() => Math.floor(ANCHO / items.length)),
  borders: { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde, insideHorizontal: sinBorde, insideVertical: sinBorde },
  rows: [new TableRow({ cantSplit: true, children: items.map(([n, t]) => new TableCell({
    width: { size: Math.floor(ANCHO / items.length), type: WidthType.DXA },
    borders: { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [imagen(n, Math.floor(ANCHO_PX / items.length) - 12, altoPx)] }), leyenda(t)],
  })) })],
});
const celda = (contenido, ancho, { header = false, fill } = {}) => new TableCell({
  width: { size: ancho, type: WidthType.DXA },
  borders: { top: borde, bottom: borde, left: borde, right: borde },
  shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: AZUL } : fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
  margins: { top: 90, bottom: 90, left: 140, right: 140 },
  children: (Array.isArray(contenido) ? contenido : [contenido]).map((linea) => new Paragraph({
    spacing: { after: 60, line: 280 },
    children: (Array.isArray(linea) ? linea : [linea]).map((x) => (typeof x === 'string'
      ? new TextRun({ text: x, font: FONT, size: 21, bold: header, color: header ? 'FFFFFF' : undefined })
      : x.link
        ? new ExternalHyperlink({ link: x.link, children: [new TextRun({ text: x.text, font: FONT, size: x.size || 21, bold: true, color: VIOLETA, underline: {} })] })
        : new TextRun({ font: FONT, size: 21, ...x }))),
  })),
});
const tabla = (anchos, encabezado, filas) => new Table({
  width: { size: anchos.reduce((a, c) => a + c, 0), type: WidthType.DXA },
  columnWidths: anchos,
  rows: [
    new TableRow({ tableHeader: true, children: encabezado.map((t, i) => celda(t, anchos[i], { header: true })) }),
    ...filas.map((f) => new TableRow({ cantSplit: true, children: f.map((t, i) => celda(t, anchos[i])) })),
  ],
});
const recuadro = (tituloR, lineas, fill = 'EDF3FA') => new Table({
  width: { size: ANCHO, type: WidthType.DXA }, columnWidths: [ANCHO],
  rows: [new TableRow({ cantSplit: true, children: [celda([[b(tituloR)], ...lineas], ANCHO, { fill })] })],
});
const importante = (lineas) => recuadro('Importante', lineas, 'F1EDFF');
const consejo = (lineas) => recuadro('Consejo', lineas, 'E6FAF9');
const logo = (nombre, anchoPx) => {
  const data = fs.readFileSync(path.join(MARCA, nombre + '.png'));
  const m = medidas(data);
  return new ImageRun({ type: 'png', data, transformation: { width: anchoPx, height: Math.round(m.h * anchoPx / m.w) } });
};
const nada = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const sinBordes = { top: nada, bottom: nada, left: nada, right: nada };
// Portada: bloque azul marino con el logo blanco y una franja violeta/cian (como el degradado del sitio)
const portadaMarca = () => [
  new Table({
    width: { size: ANCHO, type: WidthType.DXA }, columnWidths: [ANCHO], borders: { ...sinBordes, insideHorizontal: nada, insideVertical: nada },
    rows: [new TableRow({ children: [new TableCell({
      width: { size: ANCHO, type: WidthType.DXA }, borders: sinBordes,
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: AZUL }, margins: { top: 700, bottom: 700, left: 600, right: 600 },
      children: [
        new Paragraph({ spacing: { after: 500 }, children: [logo('logo-ap-blanco', 190)] }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Manual de instalación', font: FONT, size: 60, bold: true, color: 'FFFFFF' })] }),
        new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: 'Sistema UVA y App de campo Asercontrol', font: FONT, size: 32, color: CIAN })] }),
        new Paragraph({ children: [new TextRun({ text: `Versión ${VERSION}  ·  Windows · Mac · Linux · Android · iPhone · iPad`, font: FONT, size: 20, color: LINEA })] }),
      ],
    })] })],
  }),
  new Table({
    width: { size: ANCHO, type: WidthType.DXA }, columnWidths: [ANCHO / 2, ANCHO / 2], borders: { ...sinBordes, insideHorizontal: nada, insideVertical: nada },
    rows: [new TableRow({ height: { value: 110, rule: HeightRule.EXACT }, children: [VIOLETA, CIAN].map((fill) => new TableCell({
      width: { size: ANCHO / 2, type: WidthType.DXA }, borders: sinBordes, shading: { type: ShadingType.CLEAR, color: 'auto', fill }, children: [new Paragraph({ children: [] })],
    })) })],
  }),
  espacio(),
];
const mono = (text) => ({ text, font: 'Consolas', size: 21 });

// ------------------------------------------------------------------ contenido
function contenido() {
  const hijos = [];
  const add = (...x) => hijos.push(...x.flat());

  // ===== Portada
  add(
    portadaMarca(),
    recuadro('Este es el único documento que necesita', [
      ['Aquí están todas las instrucciones: cómo instalar el sistema en la computadora de la oficina, qué significa el archivo ', b('CREDENCIALES.txt'), ' que se crea al terminar y cómo instala cada verificador la app en su teléfono.'],
      ['Está escrito para personas que ', b('no son del área de sistemas'), '. Siga los pasos en orden y fíjese en las imágenes: lo marcado en ', rojo('rojo'), ' es donde debe hacer clic o tocar.'],
    ]),
    espacio(),
    h2('¿Qué capítulo leo?'),
    tabla([4200, 5438], ['Si usted es…', 'Lea'], [
      ['La persona que instala el sistema en la oficina', [['Capítulo 1 y ', b('solo uno'), ' de los capítulos 2, 3 o 4 (el de su computadora). Después, los capítulos 5, 6 y 8.']]],
      ['Un verificador que va a usar la app en campo', [[b('Capítulo 7'), ': instalar la app en su teléfono o tablet.']]],
      ['Quien da soporte técnico', 'El anexo «Información para soporte técnico», al final.'],
    ]),
    new Paragraph({ children: [new PageBreak()] }),
    h2('Contenido'),
    new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-1' }),
  );

  // ===== 1. Antes de empezar
  add(capitulo('1. Antes de empezar'),
    p(['El Sistema UVA se instala en ', b('una sola computadora de la oficina'), ' (en este manual le decimos «computadora principal»). Las demás computadoras, los teléfonos y las tablets de los verificadores se conectan a ella por el ', b('Wi-Fi de la oficina'), '.']),
    h2('Elija su instalador'),
    tabla([2300, 4000, 3338], ['Su computadora', 'Archivo que debe usar', 'Capítulo'], [
      [[[b('Windows 10 u 11')]], 'SistemaUVA-Instalador-Windows-' + VERSION + '.exe', 'Capítulo 2'],
      [[[b('Mac')]], 'SistemaUVA-Instalador-Mac-' + VERSION + '.zip', 'Capítulo 3'],
      [[[b('Linux (Ubuntu)')]], 'SistemaUVA-Instalador-Linux-' + VERSION + '.tar.gz', 'Capítulo 4'],
    ]),
    espacio(),
    h2('Lo que necesita'),
    vineta([b('La computadora principal'), ' con al menos 8 GB de memoria y 15 GB libres en el disco.']),
    vineta([b('Internet'), ' durante la instalación: el instalador descarga lo que necesita.']),
    vineta([b('Docker Desktop'), ' (Windows y Mac) o Docker (Linux): un programa gratuito que el Sistema UVA necesita para funcionar. Cada capítulo explica cómo instalarlo.']),
    vineta([b('Entre 30 y 45 minutos'), '. La mayor parte es esperar.']),
    vineta(['En Mac y Linux, ', b('la contraseña'), ' con la que entra a la computadora.']),
    espacio(),
    consejo([['Use una computadora que esté ', b('encendida todo el horario de trabajo'), ' y conectada siempre al Wi-Fi de la oficina. Si se apaga, los verificadores no podrán enviar su información hasta que vuelva a encenderse (no se pierde: se envía después).']]),
  );

  // ===== 2. Windows
  const W = [lista(), lista(), lista(), lista(), lista()];
  add(capitulo('2. Instalar en Windows'),
    h2('Paso 1 · Instale Docker Desktop (solo si no lo tiene)'),
    p('Si no está seguro de tenerlo, pase al paso 2: el instalador le avisará si falta.'),
    W[0](['Cuando el instalador diga que falta Docker Desktop, elija ', b('Sí'), '. Si Windows pide permiso, elija ', b('Sí'), '.']),
    W[0](['Puede que Windows pida ', b('reiniciar la computadora'), '. Hágalo.']),
    W[0](['Abra ', b('Docker Desktop'), ' desde el menú Inicio, acepte sus condiciones y espere a que diga ', b('«Engine running»'), ' (abajo a la izquierda).']),
    W[0](['En Docker Desktop abra ', b('Settings › General'), ' y active ', b('«Start Docker Desktop when you sign in»'), '. Así el sistema se abre solo cada día.']),
    h2('Paso 2 · Abra el instalador'),
    W[1](['Abra la carpeta ', b('Descargas'), ' y haga ', b('doble clic'), ' en ', b('SistemaUVA-Instalador-Windows-' + VERSION + '.exe'), '.']),
    fig('w-1-descargas', 470),
    W[1](['Si aparece una pantalla azul que dice ', b('«Windows protegió su PC»'), ', es normal con programas nuevos. Haga clic en ', b('Más información'), ' y luego en ', b('Ejecutar de todas formas'), '.']),
    lado([['w-2-protegio', '1. Clic en «Más información»'], ['w-3-ejecutar', '2. Clic en «Ejecutar de todas formas»']], 170),
    h2('Paso 3 · Responda las preguntas'),
    p(['La primera vez pregunta si desea ', b('datos de demostración'), '. Elija ', b('No'), ' si va a trabajar con sus datos reales (', b('Sí'), ' agrega clientes de ejemplo, útil solo para practicar).']),
    fig('w-4-demo', 420),
    p(['Si el Sistema UVA ya estaba instalado, verá esta ventana. Vea qué elegir en el ', b('capítulo 5'), '.']),
    fig('w-opciones', 460),
    h2('Paso 4 · Espere a que termine'),
    p(['Se abre una ventana negra con mensajes. ', b('No tiene que hacer nada'), ': solo espere entre 10 y 20 minutos. No la cierre ni apague la computadora.']),
    fig('w-5-progreso', 470),
    p(['Si Windows pregunta si desea instalar un certificado de ', b('«Asercontrol CA local»'), ', elija ', b('Sí'), '. Es el permiso de seguridad del sistema.']),
    fig('w-6-certificado', 420),
    h2('Paso 5 · Permita que los teléfonos se conecten'),
    W[2](['Al final, el instalador pregunta si desea permitir que los teléfonos se conecten. Elija ', b('Sí'), '.']),
    W[2](['Windows pregunta ', b('«¿Quiere permitir que esta aplicación haga cambios en el dispositivo?»'), '. Elija ', b('Sí'), '.']),
    lado([['w-7-telefonos', '1. Elija «Sí»'], ['w-8-uac', '2. Elija «Sí» otra vez']], 170),
    consejo([['Si eligió No por error: vuelva a abrir el instalador y elija «Solo la app»; le preguntará de nuevo.']]),
    h2('Paso 6 · ¡Listo!'),
    p(['Se abren el ', b('Sistema UVA'), ' en el navegador y el archivo ', b('CREDENCIALES.txt'), ' con su usuario y contraseña. Siga con el ', b('capítulo 6'), '.']),
    p(['En adelante, abra el sistema con el ícono ', b('Sistema UVA'), ' del escritorio. Todo lo demás está en ', b('Inicio › Sistema UVA'), ': este manual, sus datos de acceso, copias de seguridad, etc.']),
    fig('w-10-escritorio', 420),
  );

  // ===== 3. Mac
  const M = [lista(), lista(), lista(), lista()];
  add(capitulo('3. Instalar en Mac'),
    h2('Paso 1 · Instale Docker Desktop'),
    M[0](['En Safari entre a ', b('docker.com/products/docker-desktop'), ' y descargue Docker Desktop para Mac. Elija la versión de su Mac: ', b('Apple'), ' (chip M1, M2, M3…) o ', b('Intel'), '. Lo ve en el menú de la manzana › Acerca de esta Mac.']),
    M[0](['Abra el archivo descargado y arrastre Docker a la carpeta ', b('Aplicaciones'), '.']),
    M[0](['Abra Docker, acepte sus condiciones y espere a que diga ', b('«Engine running»'), '.']),
    M[0](['En Docker abra ', b('Settings › General'), ' y active ', b('«Start Docker Desktop when you sign in»'), '.']),
    h2('Paso 2 · Descomprima el instalador'),
    M[1](['En ', b('Descargas'), ', haga doble clic en ', b('SistemaUVA-Instalador-Mac-' + VERSION + '.zip'), '. Aparece la carpeta ', b('Instalador Sistema UVA'), '.']),
    fig('m-1-zip', 470),
    M[1](['Recomendado: ', b('arrastre esa carpeta al Escritorio'), '. Así macOS la abre sin problemas. Si ya tenía una carpeta anterior con el mismo nombre, bórrela primero.']),
    h2('Paso 3 · Abra el instalador'),
    M[2](['Abra la carpeta y haga doble clic en ', b('Instalar Sistema UVA'), ' (ícono azul).']),
    fig('m-2-app', 470),
    M[2](['La primera vez macOS puede mostrar un aviso porque el instalador es nuevo. Es normal: haga clic en ', b('Aceptar'), ' y después:']),
    fig('m-3-bloqueo', 250),
    vineta([b('Clic derecho'), ' (o Control + clic) en ', b('Instalar Sistema UVA'), ' › ', b('Abrir'), ', y otra vez ', b('Abrir'), '.']),
    lado([['m-4-clic-derecho', 'Clic derecho › Abrir'], ['m-5-abrir', 'Clic en «Abrir»']], 190),
    vineta(['En macOS más reciente: ', b('Ajustes del Sistema › Privacidad y seguridad'), ', baje hasta ', b('Seguridad'), ', haga clic en ', b('Abrir igualmente'), ' y vuelva a abrir el instalador.']),
    fig('m-6-privacidad', 430),
    h2('Paso 4 · Responda las preguntas y espere'),
    p(['Pregunta si desea ', b('datos de demostración'), ': elija ', b('No'), ' para trabajar con datos reales. Si el sistema ya estaba instalado verá una lista de opciones (capítulo 5).']),
    lado([['m-8-demo', 'Datos de demostración: No'], ['m-7-opciones', 'Si ya estaba instalado: elija y «Continuar»']], 200),
    p(['Se abre la ventana de ', b('Terminal'), ' (fondo negro). ', b('No escriba nada'), ': espere entre 10 y 20 minutos y no la cierre.']),
    fig('m-9-terminal', 470),
    p(['A la mitad macOS le pide ', b('la contraseña de la Mac'), ' para instalar el permiso de seguridad. Escríbala y haga clic en ', b('Actualizar configuración'), '.']),
    fig('m-10-contrasena', 270),
    h2('Paso 5 · ¡Listo!'),
    vineta(['Se abren el ', b('Sistema UVA'), ' en el navegador y ', b('CREDENCIALES.txt'), ' (capítulo 6). En la Terminal presione ', b('Enter'), ' para cerrarla.']),
    vineta(['Para que la Mac atienda a los teléfonos: ', b('que no se duerma'), ' (Ajustes del Sistema › Batería › Opciones › «Evitar el reposo automático cuando la pantalla esté apagada») y, si macOS pregunta «¿Permitir conexiones entrantes?» para Docker, elija ', b('Permitir'), '.']),
    vineta(['Sus accesos (abrir el sistema, este manual, datos de acceso, copias de seguridad) están en la carpeta ', b('Aplicaciones › Sistema UVA'), ' de su carpeta de usuario, y en el Escritorio.']),
  );

  // ===== 4. Linux
  const X = [lista(), lista()];
  add(capitulo('4. Instalar en Linux (Ubuntu)'),
    p(['Funciona en Ubuntu 22.04 o 24.04. En Linux hay que escribir ', b('una sola línea'), ' en la Terminal; aquí se muestra exactamente cuál.']),
    h2('Paso 1 · Descomprima el instalador'),
    X[0](['Abra ', b('Archivos › Descargas'), '.']),
    X[0](['Clic derecho en ', b('SistemaUVA-Instalador-Linux-' + VERSION + '.tar.gz'), ' › ', b('Extraer aquí'), '. Aparece la carpeta ', b('Instalador Sistema UVA'), '.']),
    fig('l-1-extraer', 470),
    h2('Paso 2 · Abra el instalador'),
    X[1](['Clic derecho en la carpeta ', b('Instalador Sistema UVA'), ' › ', b('Abrir en una terminal'), '.']),
    fig('l-2-terminal', 470),
    X[1](['Escriba esta línea (o cópiela y péguela con Ctrl + Mayús + V) y presione ', b('Enter'), ':']),
    recuadro('Escriba:', [[{ text: 'bash "Instalar Sistema UVA.sh"', font: 'Consolas', size: 24, bold: true }]], 'F2F2F2'),
    espacio(),
    fig('l-3-comando', 500),
    h2('Paso 3 · Responda las preguntas y espere'),
    vineta(['Las preguntas tienen opciones numeradas: ', b('escriba el número y presione Enter'), '. A «¿Cargar datos de demostración?» responda ', b('No'), ' para trabajar con datos reales. Si falta Docker, el instalador ofrece instalarlo: acepte.']),
    vineta(['Cuando pida ', b('su contraseña'), ', escríbala y presione Enter. Al escribirla ', b('no aparecen letras'), ': es normal.']),
    fig('l-4-sudo', 500),
    vineta(['Espere entre 10 y 20 minutos sin cerrar la ventana. Al terminar se abren el ', b('Sistema UVA'), ' y ', b('CREDENCIALES.txt'), ' (capítulo 6).']),
    vineta(['Sus accesos están en el menú de aplicaciones: busque ', b('«Sistema UVA»'), '.']),
  );

  // ===== 5. Ya instalado
  add(capitulo('5. Si el Sistema UVA ya estaba instalado'),
    p('Si vuelve a abrir el instalador en una computadora que ya tiene el sistema (por ejemplo, para instalar una versión nueva), le pregunta qué desea hacer:'),
    tabla([2800, 6838], ['Opción', 'Qué hace'], [
      [[[b('Actualizar todo')]], 'Instala la versión nueva y CONSERVA todo: clientes, visitas, actas y usuarios. Antes guarda una copia de seguridad. Es la opción recomendada.'],
      [[[b('Reinstalar desde cero')]], 'Guarda una copia de seguridad en su carpeta Documentos, BORRA la instalación anterior con todos sus datos e instala la versión nueva vacía. Pide confirmación antes de borrar.'],
      [[[b('Solo la app')]], 'Actualiza solo la app de los teléfonos. El sistema de la oficina y sus datos no cambian.'],
      [[[b('Cancelar')]], 'Sale sin hacer ningún cambio.'],
    ]),
    p([{ text: 'Si no está seguro, elija «Actualizar todo».', bold: true }]),
    consejo([['Los teléfonos ', b('no'), ' tienen que volver a instalar nada en ninguna de estas opciones.']]),
  );

  // ===== 6. Datos de acceso
  add(capitulo('6. Sus datos de acceso (CREDENCIALES.txt)'),
    p(['Al terminar la instalación se abre el archivo ', b('CREDENCIALES.txt'), '. Es el único archivo que se crea con sus datos: ', b('guárdelo en un lugar seguro'), ' (por ejemplo, imprímalo y guárdelo bajo llave) y no lo comparta.']),
    fig('w-9-credenciales', 470),
    tabla([3200, 6438], ['Parte del archivo', 'Para qué sirve'], [
      [[[b('1. Para entrar al sistema')]], 'El usuario (admin) y la contraseña con que entra por primera vez.'],
      [[[b('2. Dirección para los teléfonos')]], 'La que escriben los verificadores en su teléfono para instalar la app (capítulo 7) y las demás computadoras de la oficina para usar el sistema.'],
      [[[b('3. Verificador de prueba')]], 'Un usuario para probar la app antes de dar de alta a sus verificadores.'],
      [[[b('Datos técnicos')]], 'Solo para soporte técnico. No los necesita para el uso diario.'],
    ]),
    espacio(),
    p(['¿Lo perdió? Ábralo otra vez desde ', b('Datos de acceso'), ' en los accesos del sistema (Windows: Inicio › Sistema UVA).']),
    h2('Primer ingreso'),
    vineta(['Abra el ícono ', b('Sistema UVA'), ', escriba el usuario ', b('admin'), ' y la contraseña de CREDENCIALES.txt, y haga clic en ', b('Iniciar sesión'), '.']),
    fig('pc-1-entrar', 500),
    vineta(['Pida a soporte que cree un usuario para cada persona de la oficina y para cada verificador. No comparta el usuario admin.']),
  );

  // ===== 7. Teléfono
  const T = [lista(), lista(), lista(), lista(), lista(), lista()];
  add(capitulo('7. Instalar la app en el teléfono o tablet'),
    recuadro('Para cada verificador', [['Se hace ', b('una sola vez'), ' y toma unos 5 minutos. Esta parte del manual se puede enviar sola a los verificadores.']]),
    espacio(),
    h2('Antes de empezar'),
    vineta(['Esté en la oficina, con el teléfono conectado al ', b('Wi-Fi de la oficina'), '.']),
    vineta(['Tenga a la mano ', b('su correo y su contraseña'), ' del Sistema UVA.']),
    vineta(['Pida al encargado del sistema ', b('la dirección de la oficina'), ' (está en CREDENCIALES.txt, parte 2, y en el Sistema UVA, menú ', b('App de campo (móvil)'), '). Se ve así: ', b('http://192.168.1.50:8080'), '.']),
    vineta(['Use ', b('Chrome'), ' en Android, o ', b('Safari'), ' en iPhone o iPad.']),
    h2('Paso 1 · Entre al Sistema UVA desde el teléfono'),
    T[0](['Abra Chrome o Safari y escriba la dirección de la oficina ', b('completa, con http://'), ' al inicio. Si dice «La conexión no es segura», toque ', b('Continuar al sitio'), '.']),
    T[0](['Escriba su correo y contraseña y toque ', b('Iniciar sesión'), '.']),
    T[0](['Toque el menú ', b('☰'), ' y elija ', b('App de campo (móvil)'), '. Verá ', b('«Instalar la app en este teléfono»'), ' con 3 pasos y sus botones.']),
    lado([['t-1-entrar', 'Escriba la dirección y entre'], ['t-2-menu', 'Menú ☰ › App de campo (móvil)']], 300),
    p(['Siga el paso 2A si su teléfono es ', b('Android'), ' (Samsung, Motorola, Xiaomi…) o el 2B si es ', b('iPhone o iPad'), '.']),
    h2('Paso 2A · Android'),
    h3('Dar el permiso de seguridad (solo la primera vez)'),
    p('Sirve para que su teléfono confíe en el Sistema UVA de su oficina.'),
    T[1](['Toque ', b('Descargar permiso de seguridad'), '.']),
    T[1](['Abra ', b('Ajustes'), ', toque la lupa y escriba ', b('certificado'), '. Toque ', b('Certificado de CA'), '.']),
    T[1](['Si aparece «Tus datos no serán privados», toque ', b('Instalar de todos modos'), ' (es el aviso normal de Android).']),
    T[1](['Elija el archivo ', b('Certificado-Android-Asercontrol'), ' (está en Descargas).']),
    lado([['t-3-permiso-android', '1. Descargar permiso'], ['a-1-buscar', '2. Ajustes › Certificado de CA']], 300),
    lado([['a-2-aviso', '3. Instalar de todos modos'], ['a-3-archivo', '4. Elija el archivo']], 300),
    h3('Instalar la app'),
    T[2](['Regrese a Chrome y toque ', b('Abrir la app'), '.']),
    T[2](['Toque ', b('Instalar'), '. Si no aparece: tres puntos ', b('⋮'), ' › ', b('Instalar aplicación'), '.']),
    T[2](['Aparece el ícono ', b('Asercontrol'), ' en su pantalla. Siga con el paso 3.']),
    lado([['t-4-abrir-android', '1. Abrir la app'], ['a-4-instalar', '2. Instalar'], ['a-5-icono', '3. Su app instalada']], 300),
    h2('Paso 2B · iPhone o iPad'),
    h3('Dar el permiso de seguridad (solo la primera vez)'),
    T[3](['Toque ', b('Descargar permiso de seguridad'), ' y luego ', b('Permitir'), '.']),
    T[3](['Abra ', b('Ajustes'), ' › ', b('Perfil descargado'), ' › ', b('Instalar'), '. Le pedirá el código de su iPhone; toque Instalar otra vez.']),
    T[3](['En ', b('Ajustes › General › Información'), ', baje hasta el final, toque ', b('Ajustes de confianza de certificados'), ' y ', b('encienda «Asercontrol CA local»'), '.']),
    lado([['t-3-permiso-iphone', '1. Descargar permiso'], ['i-1-permitir', '2. Permitir']], 300),
    lado([['i-2-perfil', '3. Perfil descargado'], ['i-3-instalar', '4. Instalar'], ['i-4-confianza', '5. Enciéndalo']], 300),
    h3('Instalar la app'),
    T[4](['Regrese a Safari y toque ', b('Abrir la app'), '.']),
    T[4](['Toque ', b('Compartir'), ' (el cuadrito con una flecha hacia arriba) › ', b('Agregar a pantalla de inicio'), ' › ', b('Agregar'), '.']),
    lado([['t-4-abrir-iphone', '1. Abrir la app'], ['i-5-compartir', '2. Compartir'], ['i-6-agregar', '3. Agregar a pantalla de inicio']], 300),
    h2('Paso 3 · Entre a la app (todos los teléfonos)'),
    T[5](['Abra la app desde el ícono ', b('Asercontrol'), ' (en iPhone, no desde Safari).']),
    T[5](['Escriba su correo y contraseña y toque ', b('Iniciar Sesión como Verificador'), '.']),
    T[5](['Espere ', b('«Listo para trabajar sin conexión»'), ' y toque ', b('Comenzar'), '.']),
    lado([['t-5-app-entrar', '1. Entre con su correo'], ['t-6-app-listo', '2. Toque Comenzar'], ['t-7-app-agenda', '3. Su agenda']], 300),
    recuadro('¡Listo!', [
      ['Ya puede trabajar en campo ', b('aunque no haya señal'), '. Todo lo que capture se guarda en su teléfono y, cuando vuelva a tener conexión con la oficina, la app ', b('lo envía sola'), '. En la agenda, «Envío automático» dice «Todo enviado a la oficina» cuando ya se envió.'],
      ['No borre la app ni los datos del navegador mientras tenga actas sin enviar.'],
    ], 'EAF6EC'),
  );

  // ===== 8. Uso diario
  add(capitulo('8. Uso diario'),
    vineta(['La computadora principal debe estar ', b('encendida y conectada al Wi-Fi'), ' en horario de trabajo. El sistema se abre solo al encenderla.']),
    vineta(['Las demás computadoras de la oficina usan el sistema escribiendo en su navegador la ', b('dirección de la parte 2 de CREDENCIALES.txt'), '.']),
    h2('Dónde están los accesos del sistema'),
    tabla([2200, 7438], ['Computadora', 'Accesos (abrir el sistema, este manual, datos de acceso, copias de seguridad…)'], [
      ['Windows', 'Menú Inicio › Sistema UVA, y el ícono «Sistema UVA» del escritorio.'],
      ['Mac', 'Carpeta Aplicaciones › Sistema UVA (dentro de su carpeta de usuario) y el Escritorio.'],
      ['Linux', 'Menú de aplicaciones: busque «Sistema UVA».'],
    ]),
    h2('Copias de seguridad'),
    vineta(['Una vez por semana, abra ', b('Respaldar base de datos'), ' en los accesos del sistema. Se guarda una copia en la carpeta ', b('respaldos'), ' del sistema.']),
    vineta(['Copie esa carpeta a una memoria USB o a la nube (Google Drive, OneDrive…).']),
    h2('Si cambian el módem o la red de la oficina'),
    p(['Abra ', b('Renovar conexión de teléfonos'), ' en los accesos del sistema. Los teléfonos no tienen que reinstalar nada.']),
    h2('Desinstalar'),
    p(['Abra ', b('Desinstalar Sistema UVA'), ' en los accesos del sistema. Le pregunta si desea conservar los datos y le ofrece hacer antes una copia de seguridad.']),
  );

  // ===== 9. Problemas
  add(capitulo('9. Si algo no funciona'),
    h2('Al instalar'),
    tabla([3500, 6138], ['Lo que pasa', 'Qué hacer'], [
      ['Windows: «Windows protegió su PC».', 'Clic en «Más información» › «Ejecutar de todas formas» (capítulo 2, paso 2).'],
      ['El instalador dice que falta Docker.', 'Siga el paso 1 de su capítulo.'],
      ['Mac: macOS no deja abrir el instalador.', 'Clic derecho › Abrir, o Ajustes del Sistema › Privacidad y seguridad › Abrir igualmente (capítulo 3, paso 3).'],
      ['Mac: «La aplicación no se puede abrir» con el número -47.', 'Cierre la Terminal por completo (⌘ + Q), mueva la carpeta del instalador al Escritorio y ábralo otra vez. Si sigue, reinicie la Mac.'],
      ['Mac: la Terminal dice «zsh: killed» u «Operation not permitted».', 'Está usando un instalador anterior. Descárguelo de nuevo, borre la carpeta vieja y repita desde el paso 2.'],
      ['La instalación se detuvo con un error.', 'Vuelva a abrir el instalador: continúa donde se quedó, sin perder nada. Si se repite, envíe a soporte una foto de la ventana.'],
    ]),
    h2('En el uso diario'),
    tabla([3500, 6138], ['Lo que pasa', 'Qué hacer'], [
      ['Después de reiniciar, el sistema no abre.', 'Abra Docker Desktop, espere 2 minutos y abra el ícono «Sistema UVA».'],
      ['El teléfono no abre la dirección de la oficina.', [['Revise que esté en el ', b('mismo Wi-Fi'), ', que la dirección empiece con ', b('http://'), ' y que la computadora principal esté encendida. En Windows: abra el instalador, elija «Solo la app» y conteste Sí a «permitir que los teléfonos se conecten». Si la computadora tiene un antivirus con firewall (ESET, Norton, McAfee…), pida que permitan «Sistema UVA».']]],
      ['Dice «La conexión no es segura» al abrir la app.', 'Repita «Dar el permiso de seguridad» (capítulo 7).'],
      ['Cambiaron el módem y los teléfonos ya no se conectan.', '«Renovar conexión de teléfonos» en los accesos del sistema.'],
      ['«Correo o contraseña incorrectos».', 'Revise el correo letra por letra. Después de 5 intentos se bloquea 5 minutos.'],
      ['Un verificador no puede entrar aunque su contraseña es correcta.', 'Pida a soporte que le asigne su usuario en su ficha de verificador.'],
      ['Olvidó la contraseña de admin.', 'Abra «Datos de acceso» en los accesos del sistema.'],
    ]),
    espacio(),
    recuadro('¿Necesita ayuda?', [
      ['Si su problema no aparece en este capítulo o no se resuelve, contacte al equipo de soporte de AP Interfaces:'],
      ['Sitio web:  ', { text: WEB_TEXTO, link: WEB, size: 24 }],
      ['Tenga a la mano: una foto de la pantalla con el mensaje, qué computadora usa (Windows, Mac o Linux) y la versión del Sistema UVA (', b(VERSION), ').'],
    ], 'F1EDFF'),
  );

  // ===== Anexo técnico
  add(capitulo('Anexo · Información para soporte técnico'),
    p([{ text: 'Esta sección no es necesaria para instalar ni para el uso diario.', italics: true, color: '595959' }]),
    tabla([2600, 7038], ['Tema', 'Detalle'], [
      ['Carpeta del sistema', [['Windows: ', mono('%LOCALAPPDATA%\\Programs\\SistemaUVA')], ['Mac y Linux: ', mono('~/SistemaUVA')]]],
      ['Componentes', 'Docker Compose (proyecto «sistema-uva»): PostgreSQL 17, Odoo 19 (4 procesos), 6 microservicios Node, gateway nginx.'],
      ['Puertos habituales', 'Web 8080 (HTTP) · app de campo 8443 (HTTPS) · Odoo 8069. Si alguno está ocupado, el instalador elige el siguiente libre sin preguntar; las direcciones reales están en CREDENCIALES.txt.'],
      ['Administración (Windows)', [[mono('uva.ps1 estado | iniciar | detener | respaldar | actualizar | renovar-clave')], [mono('uva.ps1 abrir | abrir-app | abrir-odoo | agregar-app | regenerar-certificado | desinstalar')]]],
      ['Administración (Mac/Linux)', [[mono('./uva.sh estado | iniciar | detener | respaldar | actualizar | renovar-clave')], [mono('./uva.sh abrir | abrir-app | abrir-odoo | agregar-app | regenerar-certificado | desinstalar')]]],
      ['Instalación desatendida', [['Windows: ', mono('SistemaUVA-Instalador-Windows-' + VERSION + '.exe -Silencioso -Demo no')], ['Opciones: -ActualizarSistema · -Reinstalar · -SinAbrir · -Destino <carpeta>'], ['Mac/Linux: ', mono('--silencioso --demo no --actualizar-sistema --reinstalar --sin-abrir')]]],
      ['Bitácoras y respaldos', 'Subcarpetas logs y respaldos de la carpeta del sistema.'],
      ['Certificados', 'Autoridad local «Asercontrol CA local». Se conserva al desinstalar sin borrar datos y al «Reinstalar desde cero», para que los teléfonos no reinstalen el permiso.'],
      ['Usuarios', 'Se crean en el Administrador de Odoo. Para la app, el usuario se asigna en la ficha del verificador (Sistema UVA › Verificadores › Usuario).'],
      ['Correo saliente', '«¿Olvidó su contraseña?» requiere configurar Odoo › Ajustes › Técnico › Servidores de correo saliente.'],
    ]),
  );
  return hijos;
}

// ------------------------------------------------------------------ documento
const hijos = contenido();
const doc = new Document({
  creator: 'AP Interfaces', title: 'Manual de instalación del Sistema UVA',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 22, color: TEXTO } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: FONT, size: 48, bold: true, color: AZUL }, paragraph: { spacing: { before: 0, after: 100 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 36, bold: true, color: AZUL }, paragraph: { spacing: { before: 0, after: 240 }, keepNext: true, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: VIOLETA, space: 6 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 27, bold: true, color: VIOLETA }, paragraph: { spacing: { before: 300, after: 120 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, color: CIAN_OSCURO }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'vinetas', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 320 } } } }] },
      ...refs.map((ref) => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 380 } }, run: { bold: true, color: VIOLETA } } }] })),
    ],
  },
  sections: [{
    properties: { titlePage: true, page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1134, left: 1134, right: 1134, header: 500, footer: 500 } } },
    headers: {
      first: new Header({ children: [new Paragraph({ children: [] })] }),
      default: new Header({ children: [new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: ANCHO }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINEA, space: 4 } },
        children: [logo('logo-ap-color', 62), new TextRun({ text: '\tSistema UVA · Manual de instalación', font: FONT, size: 17, color: GRIS })],
      })] }),
    },
    footers: {
      first: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'AP Interfaces · Tu socio tecnológico · ', font: FONT, size: 17, color: GRIS }), new ExternalHyperlink({ link: WEB, children: [new TextRun({ text: WEB_TEXTO, font: FONT, size: 17, color: VIOLETA })] })] })] }),
      default: new Footer({ children: [new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: ANCHO }],
        children: [
          new TextRun({ text: 'AP Interfaces · Tu socio tecnológico · ', font: FONT, size: 16, color: GRIS }),
          new ExternalHyperlink({ link: WEB, children: [new TextRun({ text: WEB_TEXTO, font: FONT, size: 16, color: VIOLETA })] }),
          new TextRun({ text: `\tSistema UVA ${VERSION} · página `, font: FONT, size: 16, color: GRIS }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: VIOLETA, bold: true }),
        ],
      })] }),
    },
    children: hijos,
  }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(SALIDA, buf); console.log('ok', SALIDA, buf.length); });
