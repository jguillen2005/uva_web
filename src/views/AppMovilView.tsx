import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Apple, Download, ExternalLink, Info, MonitorSmartphone, ShieldCheck, Smartphone, TabletSmartphone, Wifi } from 'lucide-react';

/**
 * Instalar la app de campo (PWA) en teléfonos y tablets Android, iPhone y iPad.
 * El instalador del sistema publica en /descargas/ el certificado de la CA local (Android), el perfil de
 * configuración para iPhone/iPad y las direcciones de la app (app-movil.json).
 */

interface InfoAppMovil {
  app: string[];
  web: string[];
  generado?: string;
}

const CERT_ANDROID = 'Certificado-Android-Asercontrol.crt';
const PERFIL_IOS = 'Certificado-iPhone-iPad-Asercontrol.mobileconfig';

// ¿La página se abrió en un teléfono o tablet? (el iPad con iPadOS se presenta como Mac con pantalla táctil)
const dispositivoMovil = (): 'android' | 'ios' | null => {
  const ua = navigator.userAgent;
  if (/iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return null;
};

const BotonGrande: React.FC<{ href: string; descargar?: boolean; icono: React.ReactNode; children: React.ReactNode }> = ({ href, descargar, icono, children }) => (
  <a
    href={href}
    {...(descargar ? { download: '' } : {})}
    className="w-full min-h-14 px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white text-base font-bold inline-flex items-center justify-center gap-2.5 shadow-sm transition"
  >
    {icono}
    {children}
  </a>
);

const PasoMovil: React.FC<{ n: number; titulo: string; nota?: string; children: React.ReactNode }> = ({ n, titulo, nota, children }) => (
  <div className="bg-white rounded-xl border border-brand-100 p-4 flex flex-col gap-3">
    <h3 className="flex items-center gap-2.5 text-base font-bold text-ink-900">
      <span className="w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-extrabold flex items-center justify-center shrink-0" aria-hidden="true">{n}</span>
      <span><span className="sr-only">Paso {n}: </span>{titulo}</span>
      {nota && <span className="text-xs font-semibold text-ink-500">({nota})</span>}
    </h3>
    {children}
  </div>
);

const Qr: React.FC<{ texto: string; etiqueta: string }> = ({ texto, etiqueta }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let vigente = true;
    QRCode.toDataURL(texto, { margin: 1, width: 360, errorCorrectionLevel: 'M' })
      .then((url) => { if (vigente) setSrc(url); })
      .catch(() => setSrc(''));
    return () => { vigente = false; };
  }, [texto]);
  return (
    <figure className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-xl bg-white border border-line-200 p-1.5 shadow-xs">
        {src ? <img src={src} alt={`Código QR: ${etiqueta}`} className="w-full h-full" /> : <div className="w-full h-full bg-surface-50 animate-pulse rounded-lg" />}
      </div>
      <figcaption className="text-[11px] text-ink-500 text-center max-w-40 break-all">{texto.replace(/^https?:\/\//, '')}</figcaption>
    </figure>
  );
};

const Paso: React.FC<{ n: number; titulo: string; children: React.ReactNode; qr?: { texto: string; etiqueta: string }; accion?: React.ReactNode }> = ({ n, titulo, children, qr, accion }) => (
  <li className="bg-white border border-line-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row gap-4">
    <div className="flex gap-3 flex-1 min-w-0">
      <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center shrink-0" aria-hidden="true">{n}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-ink-900">
          <span className="sr-only">Paso {n}: </span>{titulo}
        </h3>
        <div className="text-xs sm:text-[13px] text-ink-700 mt-1.5 leading-relaxed space-y-1.5">{children}</div>
        {accion && <div className="mt-3 flex flex-wrap gap-2">{accion}</div>}
      </div>
    </div>
    {qr && <Qr {...qr} />}
  </li>
);

const BotonDescarga: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a
    href={href}
    download
    className="h-9 px-3 rounded-lg border border-line-300 bg-white hover:bg-surface-50 text-brand-700 text-xs font-semibold inline-flex items-center gap-1.5"
  >
    <Download className="w-3.5 h-3.5" aria-hidden="true" />
    {children}
  </a>
);

export const AppMovilView: React.FC = () => {
  const [info, setInfo] = useState<InfoAppMovil | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'sin-descargas'>('cargando');
  const [indice, setIndice] = useState(0);
  const movil = dispositivoMovil();
  const [plataforma, setPlataforma] = useState<'android' | 'ios'>(movil || 'android');

  useEffect(() => {
    fetch('/descargas/app-movil.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: InfoAppMovil) => {
        setInfo(d);
        setEstado(d.app?.length ? 'listo' : 'sin-descargas');
      })
      .catch(() => setEstado('sin-descargas'));
  }, []);

  const app = info?.app[indice] || '';
  // Las descargas se piden por la web (HTTP): el teléfono aún no confía en el certificado de la app (HTTPS)
  const web = info?.web[indice] || window.location.origin;
  const descarga = (archivo: string) => `${web}/descargas/${archivo}`;
  // En el propio teléfono: la app en la misma dirección (IP o nombre) con la que se abrió esta página
  const puertoApp = (() => { try { return new URL(info?.app[0] || '').port || '443'; } catch { return '8443'; } })();
  const appAqui = `https://${window.location.hostname}:${puertoApp}`;

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 sm:px-6 lg:px-8 pt-6 pb-5 border-b border-line-200 bg-white">
        <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Operación / App de campo</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900 mt-1">Instalar la app en teléfonos y tablets</h1>
        <p className="text-sm text-ink-600 max-w-3xl mt-1 leading-relaxed">
          Los verificadores instalan la app de campo en su teléfono o tablet (Android, iPhone o iPad). Al iniciar sesión con su correo y
          contraseña, la app descarga su agenda, instrumentos y datos a la base de datos del dispositivo para trabajar sin conexión.
        </p>
      </header>

      <div className="p-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-5 max-w-5xl w-full">
        {estado === 'cargando' && <p className="text-sm text-ink-500">Cargando…</p>}

        {estado === 'sin-descargas' && (
          <div role="alert" className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-ink-800 flex gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0" aria-hidden="true" />
            <p>
              Las descargas para instalar la app se generan al instalar o actualizar el Sistema UVA en el servidor. Ejecute el instalador
              (o <code className="font-mono text-xs">uva.ps1 actualizar</code>) y vuelva a abrir esta página.
            </p>
          </div>
        )}

        {estado === 'listo' && info && movil && (
          <section aria-labelledby="instalar-aqui" className="bg-brand-50 border border-brand-200 rounded-2xl p-4 sm:p-5 flex flex-col gap-5">
            <div className="flex items-start gap-2.5">
              <MonitorSmartphone className="w-6 h-6 text-brand-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 id="instalar-aqui" className="text-lg font-extrabold text-ink-900">Instalar la app en este {movil === 'ios' ? 'iPhone o iPad' : 'teléfono'}</h2>
                <p className="text-sm text-ink-700 mt-0.5">Son 3 pasos y toman unos 3 minutos. Hágalo con el {movil === 'ios' ? 'iPhone o iPad' : 'teléfono'} conectado al <strong>mismo Wi-Fi</strong> que la computadora de la oficina.</p>
              </div>
            </div>

            <PasoMovil n={1} titulo="Dar el permiso de seguridad" nota="Solo la primera vez.">
              <BotonGrande href={`/descargas/${movil === 'ios' ? PERFIL_IOS : CERT_ANDROID}`} descargar={movil === 'android'} icono={<Download className="w-5 h-5" aria-hidden="true" />}>
                Descargar permiso de seguridad
              </BotonGrande>
              {movil === 'ios' ? (
                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-ink-800">
                  <li>Toque el botón de arriba y luego <strong>Permitir</strong>.</li>
                  <li>Abra la app <strong>Ajustes</strong>. Arriba aparece <strong>Perfil descargado</strong>: tóquelo y después <strong>Instalar</strong>. Le pedirá el código de su {movil === 'ios' ? 'iPhone' : 'teléfono'}.</li>
                  <li>En <strong>Ajustes</strong> entre a <strong>General</strong> &gt; <strong>Información</strong>. Hasta abajo toque <strong>Ajustes de confianza de certificados</strong> y encienda <strong>Asercontrol CA local</strong>.</li>
                </ol>
              ) : (
                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-ink-800">
                  <li>Toque el botón de arriba. El teléfono descarga un archivo.</li>
                  <li>Abra la app <strong>Ajustes</strong> del teléfono y, en la lupa de búsqueda, escriba <strong>certificado</strong>.</li>
                  <li>Toque <strong>Certificado de CA</strong> (o <strong>Instalar un certificado</strong> &gt; <strong>Certificado de CA</strong>). Si aparece un aviso, toque <strong>Instalar de todos modos</strong>.</li>
                  <li>Elija el archivo <strong>Certificado-Android-Asercontrol</strong> (está en Descargas).</li>
                </ol>
              )}
            </PasoMovil>

            <PasoMovil n={2} titulo="Instalar la app">
              <BotonGrande href={appAqui} icono={<Smartphone className="w-5 h-5" aria-hidden="true" />}>
                Abrir la app
              </BotonGrande>
              {movil === 'ios' ? (
                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-ink-800">
                  <li>Toque el botón de arriba. La app se abre en <strong>Safari</strong> (debe ser Safari).</li>
                  <li>Toque el botón <strong>Compartir</strong>: el cuadro con una flecha hacia arriba (en iPhone está abajo; en iPad, arriba a la derecha).</li>
                  <li>Deslice hacia abajo, toque <strong>Agregar a pantalla de inicio</strong> y luego <strong>Agregar</strong>.</li>
                </ol>
              ) : (
                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-ink-800">
                  <li>Toque el botón de arriba. La app se abre en el navegador.</li>
                  <li>Toque el botón azul <strong>Instalar app</strong>. Si no aparece, toque los tres puntos <strong>⋮</strong> de arriba a la derecha y elija <strong>Instalar aplicación</strong>.</li>
                  <li>Confirme con <strong>Instalar</strong>. En su pantalla aparece el ícono <strong>Asercontrol</strong>.</li>
                </ol>
              )}
            </PasoMovil>

            <PasoMovil n={3} titulo="Entrar">
              <ol className="list-decimal pl-5 space-y-1.5 text-sm text-ink-800">
                <li>Abra la app desde el ícono <strong>Asercontrol</strong> de su pantalla{movil === 'ios' ? ' (no desde Safari)' : ''}.</li>
                <li>Escriba su correo y su contraseña y toque <strong>Iniciar sesión</strong>.</li>
                <li>Espere el mensaje <strong>Listo para trabajar sin conexión</strong>. ¡Ya puede usarla en campo, aunque no haya señal!</li>
              </ol>
            </PasoMovil>
          </section>
        )}

        {estado === 'listo' && info && movil && (
          <h2 className="text-sm font-bold text-ink-700 -mb-2">Instalar en otro dispositivo</h2>
        )}

        {estado === 'listo' && info && (
          <>
            <section aria-label="Requisitos" className="grid gap-3 sm:grid-cols-3">
              <div className="bg-white border border-line-200 rounded-xl p-4 flex gap-3">
                <Wifi className="w-5 h-5 text-brand-600 shrink-0" aria-hidden="true" />
                <p className="text-xs text-ink-700 leading-relaxed">El teléfono o tablet debe estar en la <strong>misma red Wi-Fi</strong> que el servidor para instalar y sincronizar.</p>
              </div>
              <div className="bg-white border border-line-200 rounded-xl p-4 flex gap-3">
                <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0" aria-hidden="true" />
                <p className="text-xs text-ink-700 leading-relaxed">Usuario: el de Odoo del verificador (Sistema UVA &gt; Verificadores &gt; Usuario). Se inicia sesión <strong>en el dispositivo</strong>.</p>
              </div>
              <div className="bg-white border border-line-200 rounded-xl p-4 flex gap-3">
                <TabletSmartphone className="w-5 h-5 text-brand-600 shrink-0" aria-hidden="true" />
                <p className="text-xs text-ink-700 leading-relaxed">Funciona en teléfonos y tablets, en vertical y horizontal.</p>
              </div>
            </section>

            {info.app.length > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label htmlFor="direccion-servidor" className="text-xs font-semibold text-ink-700">Dirección del servidor en su red</label>
                <select
                  id="direccion-servidor"
                  value={indice}
                  onChange={(e) => setIndice(Number(e.target.value))}
                  className="h-9 px-3 border border-line-300 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-600 sm:min-w-72"
                >
                  {info.app.map((u, i) => <option key={u} value={i}>{u}</option>)}
                </select>
                <span className="text-[11px] text-ink-500">Use la que corresponde a la red Wi-Fi de los dispositivos.</span>
              </div>
            )}

            <div role="tablist" aria-label="Tipo de dispositivo" className="inline-flex self-start rounded-xl border border-line-200 bg-white p-1 gap-1">
              {([
                ['android', 'Android (teléfono y tablet)', <Smartphone key="a" className="w-4 h-4" aria-hidden="true" />],
                ['ios', 'iPhone y iPad', <Apple key="i" className="w-4 h-4" aria-hidden="true" />],
              ] as const).map(([clave, texto, icono]) => (
                <button
                  key={clave}
                  role="tab"
                  type="button"
                  id={`tab-${clave}`}
                  aria-selected={plataforma === clave}
                  aria-controls={`panel-${clave}`}
                  onClick={() => setPlataforma(clave)}
                  className={`h-10 px-4 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
                    plataforma === clave ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-surface-50'
                  }`}
                >
                  {icono}
                  {texto}
                </button>
              ))}
            </div>

            {plataforma === 'android' && (
              <div id="panel-android" role="tabpanel" aria-labelledby="tab-android">
              <ol className="flex flex-col gap-3">
                <Paso n={1} titulo="Instalar el certificado del servidor (una sola vez)" qr={{ texto: descarga(CERT_ANDROID), etiqueta: 'certificado para Android' }}
                  accion={<BotonDescarga href={`/descargas/${CERT_ANDROID}`}>Descargar certificado</BotonDescarga>}>
                  <p>Escanee el código con la cámara y descargue el certificado.</p>
                  <p>Después: <strong>Ajustes &gt; Seguridad &gt; Más ajustes de seguridad &gt; Cifrado y credenciales &gt; Instalar un certificado &gt; Certificado de CA</strong> y elija el archivo descargado. (En Samsung: Ajustes &gt; Seguridad y privacidad &gt; Otros ajustes de seguridad &gt; Instalar desde almacenamiento &gt; Certificado de CA).</p>
                </Paso>
                <Paso n={2} titulo="Abrir la app en Chrome e instalarla" qr={{ texto: app, etiqueta: 'app de campo' }}>
                  <p>Escanee el código; la app se abre en Chrome.</p>
                  <p>Toque <strong>Instalar app</strong> en la pantalla de la app, o el menú <strong>⋮ &gt; Instalar aplicación</strong> (o <strong>Agregar a la pantalla principal</strong>).</p>
                </Paso>
                <Paso n={3} titulo="Abrir desde el ícono e iniciar sesión">
                  <p>Abra la app desde su ícono e inicie sesión con su correo y contraseña. Verá <strong>«Preparando el dispositivo»</strong> mientras se descargan la agenda, los instrumentos y sus datos; al terminar dirá <strong>«Listo para trabajar sin conexión»</strong>.</p>
                </Paso>
              </ol>
              </div>
            )}

            {plataforma === 'ios' && (
              <div id="panel-ios" role="tabpanel" aria-labelledby="tab-ios">
              <ol className="flex flex-col gap-3">
                <Paso n={1} titulo="Descargar el perfil del servidor (una sola vez)" qr={{ texto: descarga(PERFIL_IOS), etiqueta: 'perfil para iPhone y iPad' }}
                  accion={<BotonDescarga href={`/descargas/${PERFIL_IOS}`}>Descargar perfil</BotonDescarga>}>
                  <p>Escanee el código con la cámara; se abre en <strong>Safari</strong>. Toque <strong>Permitir</strong> para descargar el perfil.</p>
                  <p>Luego: <strong>Ajustes &gt; Perfil descargado &gt; Instalar</strong> (pide el código del dispositivo).</p>
                </Paso>
                <Paso n={2} titulo="Confiar en el certificado">
                  <p><strong>Ajustes &gt; General &gt; Información &gt; Ajustes de confianza de certificados</strong> y active <strong>«Asercontrol CA local»</strong>.</p>
                  <p>Sin este paso, iPhone y iPad no permiten abrir ni instalar la app.</p>
                </Paso>
                <Paso n={3} titulo="Abrir la app en Safari y agregarla a la pantalla de inicio" qr={{ texto: app, etiqueta: 'app de campo' }}>
                  <p>Escanee el código; la app se abre en <strong>Safari</strong> (en iPhone y iPad solo Safari puede instalarla).</p>
                  <p>Toque <strong>Compartir</strong> (en iPhone, abajo; en iPad, arriba a la derecha) &gt; <strong>Agregar a pantalla de inicio</strong> &gt; <strong>Agregar</strong>.</p>
                </Paso>
                <Paso n={4} titulo="Abrir desde el ícono e iniciar sesión ahí">
                  <p>Abra la app <strong>desde el ícono de la pantalla de inicio</strong> e inicie sesión con su correo y contraseña. En iPhone y iPad la app instalada guarda sus datos aparte de Safari: por eso se inicia sesión en la app instalada.</p>
                  <p>Verá <strong>«Preparando el dispositivo»</strong> y al terminar <strong>«Listo para trabajar sin conexión»</strong>.</p>
                </Paso>
              </ol>
              </div>
            )}

            <p className="text-[11px] text-ink-500 flex items-center gap-1.5">
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
              Dirección de la app: <a className="text-brand-700 underline" href={app} target="_blank" rel="noreferrer">{app}</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
};
