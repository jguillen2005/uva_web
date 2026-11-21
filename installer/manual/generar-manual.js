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
// Versión VISIBLE del producto y de la documentación: siempre 1.0.0 (nombres de los instaladores, portada, pie).
// La versión interna por mejoras (1.1.1, 1.1.2…) no se muestra: queda en version-interna.txt de cada instalación.
const VERSION = '1.0.0';
const VERSION_MANUAL = VERSION;
// Formato y paleta de AP Interfaces (sitio web: azul marino, cian y violeta; tipografía Inter / Segoe UI)
const FONT = 'Segoe UI';
const AZUL = '071326';        // azul marino
const VIOLETA = '7657FF';
const CIAN = '19D3D1';
const AZUL_WEB = '0058CE';      // azul del degradado de la web
const VIOLETA_WEB = '6F1CE6';   // violeta del degradado de la web
// Encabezados de tabla: un color por columna, de violeta a azul (imita el degradado; Word no admite degradados en celdas)
const tonoColumna = (i, n) => { if (n <= 1) return AZUL_WEB; const t = i / (n - 1); const a = [0x6f, 0x1c, 0xe6], z = [0x00, 0x58, 0xce]; return a.map((v, k) => Math.round(v + (z[k] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase(); };
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
  shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: fill || AZUL_WEB } : fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
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
    new TableRow({ tableHeader: true, children: encabezado.map((t, i) => celda(t, anchos[i], { header: true, fill: tonoColumna(i, encabezado.length) })) }),
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
// Portada: imagen con el degradado de la web de AP Interfaces, el logo blanco y el título (marca/portada.png,
// generada con portada.js; Word no admite fondos con degradado)
const portadaMarca = () => {
  const data = fs.readFileSync(path.join(MARCA, 'portada.png'));
  const m = medidas(data);
  return [
    new Paragraph({ spacing: { after: 240 }, children: [new ImageRun({ type: 'png', data, transformation: { width: ANCHO_PX, height: Math.round(m.h * ANCHO_PX / m.w) }, altText: { title: 'Portada', description: 'Manual de instalación · Sistema UVA y App de campo Asercontrol', name: 'portada' } })] }),
  ];
};
const mono = (text) => ({ text, font: 'Consolas', size: 21 });

// ------------------------------------------------------------------ contenido
function contenido() {
  const hijos = [];
  const add = (...x) => hijos.push(...x.flat());

  // ===== Portada
  add(
    portadaMarca(),
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
      [[[b('Linux')]], 'SistemaUVA-Instalador-Linux-' + VERSION + '.tar.gz', 'Capítulo 4'],
    ]),
    espacio(),
    h2('Requisitos de la computadora principal'),
    tabla([2000, 2546, 2546, 2546], ['', 'Windows', 'Mac', 'Linux'], [
      [[[b('Sistema')]], 'Windows 10 (versión 22H2) u 11, de 64 bits', 'macOS 14 (Sonoma) o más reciente', 'Ubuntu 22.04 o 24.04, Debian 12, Linux Mint 21 o más reciente, Fedora 40 o más reciente, Red Hat, Rocky o AlmaLinux 9'],
      [[[b('Procesador')]], 'Intel o AMD de 64 bits, 4 núcleos (mínimo 2), con virtualización activada', 'Chip Apple (M1 o más reciente) o Intel', 'Intel o AMD de 64 bits, o ARM de 64 bits; 4 núcleos (mínimo 2)'],
      [[[b('Memoria (RAM)')]], '16 GB recomendados (mínimo 8 GB)', '16 GB recomendados (mínimo 8 GB)', '16 GB recomendados (mínimo 8 GB)'],
      [[[b('Disco libre')]], '15 GB recomendados (mínimo 8 GB); mejor en disco SSD', '15 GB recomendados (mínimo 8 GB)', '15 GB recomendados (mínimo 8 GB); mejor en disco SSD'],
      [[[b('Otros')]], 'Cuenta que pueda aceptar el permiso de administrador de Windows', 'La contraseña de la Mac', 'Usuario con permiso de administrador (sudo)'],
    ]),
    p([{ text: 'Para saber la memoria y el sistema: Windows › Configuración › Sistema › Información · Mac › menú de la manzana › Acerca de esta Mac · Linux › Configuración › Acerca de.', size: 19, color: GRIS }]),
    h2('Lo que necesita'),
    vineta([b('La computadora principal'), ' que cumpla los requisitos de la tabla de arriba.']),
    vineta([b('Internet'), ' durante la instalación: el instalador descarga lo que necesita.']),
    vineta([b('Nada más que instalar antes'), ': el Sistema UVA necesita Docker, un programa gratuito, pero ', b('el instalador lo instala por usted'), ' si no lo tiene.']),
    vineta([b('Entre 30 y 45 minutos'), '. La mayor parte es esperar.']),
    vineta(['En Mac y Linux, ', b('la contraseña'), ' con la que entra a la computadora.']),
    espacio(),
    consejo([['Use una computadora que esté ', b('encendida todo el horario de trabajo'), ' y conectada siempre al Wi-Fi de la oficina. Si se apaga, los verificadores no podrán enviar su información hasta que vuelva a encenderse (no se pierde: se envía después).']]),
  );

  // ===== 2. Windows
  const W = [lista(), lista(), lista(), lista(), lista()];
  add(capitulo('2. Instalar en Windows'),
    h2('Paso 1 · Abra el instalador'),
    W[0](['Abra la carpeta ', b('Descargas'), ' y haga ', b('doble clic'), ' en ', b('SistemaUVA-Instalador-Windows-' + VERSION + '.exe'), '.']),
    fig('w-1-descargas', 470),
    W[0](['Si aparece una pantalla azul que dice ', b('«Windows protegió su PC»'), ', es normal con programas nuevos. Haga clic en ', b('Más información'), ' y luego en ', b('Ejecutar de todas formas'), '.']),
    lado([['w-2-protegio', '1. Clic en «Más información»'], ['w-3-ejecutar', '2. Clic en «Ejecutar de todas formas»']], 170),
    h2('Paso 2 · Docker Desktop se instala solo (si no lo tiene)'),
    p(['El Sistema UVA necesita ', b('Docker Desktop'), ', un programa gratuito. ', b('No tiene que buscarlo ni descargarlo'), ': si falta, el instalador lo instala por usted. Si ya lo tiene, este paso no aparece.']),
    W[1](['El instalador avisa que va a instalar Docker Desktop. Haga clic en ', b('Aceptar'), '.']),
    W[1](['Windows pregunta ', b('«¿Quiere permitir que esta aplicación haga cambios en el dispositivo?»'), '. Elija ', b('Sí'), '. Espere unos 10 minutos mientras se descarga e instala.']),
    W[1](['Normalmente la instalación sigue sola sin reiniciar. ', b('Solo si Windows lo necesita'), ', pregunta si desea ', b('reiniciar'), ' la computadora: guarde su trabajo y elija ', b('Sí'), '.']),
    W[1](['Si reinició: al volver a entrar a Windows, ', b('la instalación del Sistema UVA continúa sola'), ' (Docker tarda 1 o 2 minutos en abrir). Siga con el paso 3.']),
    lado([['w-docker-1', '1. Clic en «Aceptar»'], ['w-docker-2', 'Solo si aparece: reiniciar, «Sí»']], 190),
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
    h2('Paso 1 · Descomprima el instalador'),
    M[0](['En ', b('Descargas'), ', haga doble clic en ', b('SistemaUVA-Instalador-Mac-' + VERSION + '.zip'), '. Aparece la carpeta ', b('Instalador Sistema UVA'), '.']),
    fig('m-1-zip', 470),
    M[0](['Recomendado: ', b('arrastre esa carpeta al Escritorio'), '. Así macOS la abre sin problemas. Si ya tenía una carpeta anterior con el mismo nombre, bórrela primero.']),
    h2('Paso 2 · Abra el instalador'),
    M[1](['Abra la carpeta y haga doble clic en ', b('Instalar Sistema UVA'), ' (ícono azul).']),
    fig('m-2-app', 470),
    M[1](['La primera vez macOS puede mostrar un aviso porque el instalador es nuevo. Es normal: haga clic en ', b('Aceptar'), ' y después:']),
    fig('m-3-bloqueo', 250),
    vineta([b('Clic derecho'), ' (o Control + clic) en ', b('Instalar Sistema UVA'), ' › ', b('Abrir'), ', y otra vez ', b('Abrir'), '.']),
    lado([['m-4-clic-derecho', 'Clic derecho › Abrir'], ['m-5-abrir', 'Clic en «Abrir»']], 190),
    vineta(['En macOS más reciente: ', b('Ajustes del Sistema › Privacidad y seguridad'), ', baje hasta ', b('Seguridad'), ', haga clic en ', b('Abrir igualmente'), ' y vuelva a abrir el instalador.']),
    fig('m-6-privacidad', 430),
    h2('Paso 3 · Docker Desktop se instala solo (si no lo tiene)'),
    p(['El Sistema UVA necesita ', b('Docker Desktop'), ', un programa gratuito. ', b('No tiene que buscarlo ni descargarlo'), ': si falta, el instalador descarga la versión para su Mac y la instala. Si ya lo tiene, este paso no aparece.']),
    M[2](['Cuando el instalador avise que va a instalar Docker Desktop, haga clic en ', b('Continuar'), '.']),
    M[2](['macOS le pide ', b('la contraseña de la Mac'), ': escríbala y haga clic en ', b('OK'), '. Espere unos 10 minutos.']),
    fig('m-docker', 520),
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
  add(capitulo('4. Instalar en Linux'),
    p(['Funciona en ', b('Ubuntu, Debian, Linux Mint y similares'), ', y en ', b('Fedora, Red Hat, Rocky y AlmaLinux'), ' (versiones en la tabla de requisitos del capítulo 1). En Linux hay que escribir ', b('una sola línea'), ' en la Terminal; aquí se muestra exactamente cuál.']),
    p([{ text: 'Las imágenes son de Ubuntu; en otras versiones los menús pueden llamarse un poco distinto (por ejemplo, «Abrir en terminal»).', size: 19, color: GRIS }]),
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
    vineta(['Las preguntas tienen opciones numeradas: ', b('escriba el número y presione Enter'), '. A «¿Cargar datos de demostración?» responda ', b('No'), ' para trabajar con datos reales. Si falta Docker, el instalador lo instala solo (le pedirá su contraseña).']),
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
    h2('¿Dónde se guarda la información?'),
    p(['La información del sistema (clientes, solicitudes, visitas, expedientes, actas y sus documentos) se guarda ', b('dentro del Sistema UVA'), ', en la computadora principal, y se consulta desde la web. Fuera del sistema solo quedan estos archivos y carpetas:']),
    tabla([2900, 3700, 3038], ['Qué', 'Dónde', 'Cómo se obtiene'], [
      [[[b('Reportes exportados')], ['Ej.: Estadisticas_UVA_2026-11-21.csv (se abre con Excel)']],
        [['Carpeta ', b('Descargas'), ' de la computadora desde la que se exportó:'], [mono('Windows: C:\\Users\\<usuario>\\Downloads')], [mono('Mac: ~/Downloads')], [mono('Linux: ~/Descargas')]],
        'En la web, Estadísticas › «Exportar a Excel (CSV)». El navegador guarda el archivo en Descargas.'],
      [[[b('Documentos de cada expediente')], ['Solicitud, documentos del cliente, actas de campo con fotos y firmas, dictamen y acuse de CONAGUA']],
        [['Dentro del sistema, ordenados por expediente en carpetas:'], [mono('01_Solicitud · 02_DocsCliente · 03_Campo')], [mono('04_Dictamen · 05_Acuse')]],
        'Se consultan en la web, en el expediente. Al descargar uno, el navegador lo guarda en Descargas.'],
      [[[b('Actas de campo aún sin enviar')]], 'En el teléfono o tablet del verificador, dentro de la app.', 'Se envían solas a la oficina al tener conexión; después quedan en 03_Campo.'],
      [[[b('Copias de seguridad')]],
        [[b('Carpeta del sistema'), ' › ', mono('respaldos'), ', una subcarpeta por fecha (por ejemplo ', mono('20261121-103000'), ') con la base de datos y los archivos.']],
        '«Respaldar base de datos» en los accesos del sistema.'],
      [[[b('Copia al reinstalar o desinstalar')]], [['Carpeta ', b('Documentos'), ' › «Respaldo Sistema UVA <fecha>»']], 'La hace el instalador antes de borrar.'],
      [[[b('Datos de acceso, manual y bitácoras')]], [[b('Carpeta del sistema'), ': ', mono('CREDENCIALES.txt'), ', el manual (PDF) y la subcarpeta ', mono('logs'), '.']], '«Carpeta del Sistema UVA» o «Datos de acceso» en los accesos del sistema.'],
      [[[b('Permiso de seguridad para teléfonos')]], [[b('Carpeta del sistema'), ' › ', mono('descargas')]], 'Los teléfonos lo descargan desde la web (capítulo 7).'],
    ]),
    p([b('La carpeta del sistema'), ' está en:']),
    tabla([2200, 7438], ['Computadora', 'Carpeta del sistema (ábrala con el acceso «Carpeta del Sistema UVA»)'], [
      ['Windows', [[mono('C:\\Users\\<usuario>\\AppData\\Local\\Programs\\SistemaUVA')], [{ text: 'AppData es una carpeta oculta: use el acceso Inicio › Sistema UVA › Carpeta del Sistema UVA.', size: 19, color: GRIS }]]],
      ['Mac', [[mono('/Users/<usuario>/SistemaUVA')], [{ text: 'En Finder: su carpeta de usuario › SistemaUVA.', size: 19, color: GRIS }]]],
      ['Linux', [[mono('/home/<usuario>/SistemaUVA')], [{ text: 'En Archivos: Carpeta personal › SistemaUVA.', size: 19, color: GRIS }]]],
    ]),
    importante([['No mueva ni borre archivos dentro de la carpeta del sistema: el Sistema UVA los necesita para funcionar. Para guardar una copia de su información, use «Respaldar base de datos» y copie la carpeta ', b('respaldos'), ' a una memoria USB o a la nube.']]),
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
      ['No se pudo instalar Docker solo (por ejemplo, se eligió No en el permiso de Windows).', 'Se abre la página de Docker: descargue e instale Docker Desktop, reinicie la computadora y vuelva a abrir el instalador del Sistema UVA.'],
      ['Windows: después de reiniciar, la instalación no continuó.', 'Abra Docker Desktop desde el menú Inicio, espere 2 minutos y vuelva a abrir el instalador del Sistema UVA.'],
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
      ['Bitácoras y respaldos', 'Subcarpetas logs y respaldos de la carpeta del sistema. Cada respaldo: uva.dump (pg_dump) y filestore/ (archivos adjuntos).'],
      ['Datos (ubicación física)', 'Volúmenes de Docker sistema-uva_uva-db (PostgreSQL) y sistema-uva_uva-odoo-data (archivos adjuntos de Odoo: documentos, actas, fotos, firmas y PDF). En Windows y Mac viven dentro de la máquina virtual de Docker Desktop; no se editan a mano: use «Respaldar base de datos».'],
      ['Linux', [['Docker: apt (docker.io, docker-compose-v2) en Ubuntu/Debian; repositorio oficial de Docker con dnf (docker-ce, docker-compose-plugin) en Fedora/Red Hat/Rocky/AlmaLinux. Certificado: update-ca-certificates o update-ca-trust.'], ['SELinux: el instalador etiqueta la carpeta del sistema con ', mono('container_file_t'), '. Si los servicios no arrancan: ', mono('sudo chcon -R -t container_file_t ~/SistemaUVA')]]],
      ['Versión', [['Visible para el usuario: ' + VERSION + '. Versión interna (por mejoras): archivo ', mono('version-interna.txt'), ' en la carpeta del sistema.']]],
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
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 36, bold: true, color: AZUL_WEB }, paragraph: { spacing: { before: 0, after: 240 }, keepNext: true, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: VIOLETA, space: 6 } } } },
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
          new TextRun({ text: `\tManual versión ${VERSION_MANUAL} · página `, font: FONT, size: 16, color: GRIS }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: VIOLETA, bold: true }),
        ],
      })] }),
    },
    children: hijos,
  }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(SALIDA, buf); console.log('ok', SALIDA, buf.length); });
