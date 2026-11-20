import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Info, MonitorSmartphone, ShieldCheck, Smartphone, TabletSmartphone } from 'lucide-react';

/**
 * Instalar la app de campo (PWA) en teléfonos y tablets Android, iPhone y iPad.
 * Se instala desde el propio teléfono (sin códigos QR). El instalador del sistema publica en /descargas/ el certificado de la CA local (Android), el perfil de
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

const PasoPc: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <li className="flex gap-3 items-start">
    <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center shrink-0" aria-hidden="true">{n}</span>
    <div className="text-sm text-ink-800 leading-relaxed pt-0.5 min-w-0"><span className="sr-only">Paso {n}: </span>{children}</div>
  </li>
);

export const AppMovilView: React.FC = () => {
  const [info, setInfo] = useState<InfoAppMovil | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'sin-descargas'>('cargando');
  const [indice, setIndice] = useState(0);
  const movil = dispositivoMovil();
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetch('/descargas/app-movil.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: InfoAppMovil) => {
        setInfo(d);
        setEstado(d.app?.length ? 'listo' : 'sin-descargas');
      })
      .catch(() => setEstado('sin-descargas'));
  }, []);

  // Las descargas se piden por la web (HTTP): el teléfono aún no confía en el certificado de la app (HTTPS)
  const web = info?.web[indice] || window.location.origin;
  // En el propio teléfono: la app en la misma dirección (IP o nombre) con la que se abrió esta página
  const puertoApp = (() => { try { return new URL(info?.app[0] || '').port || '443'; } catch { return '8443'; } })();
  const appAqui = `https://${window.location.hostname}:${puertoApp}`;

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 sm:px-6 lg:px-8 pt-6 pb-5 border-b border-line-200 bg-white">
        <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Operación / App de campo</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900 mt-1">Instalar la app en teléfonos y tablets</h1>
        <p className="text-sm text-ink-600 max-w-3xl mt-1 leading-relaxed">
          Cada verificador instala la app en su teléfono o tablet (Android, iPhone o iPad). Al entrar con su correo y contraseña, la app
          guarda en el teléfono su agenda y todo lo necesario para trabajar en campo aunque no haya Internet.
        </p>
      </header>

      <div className="p-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-5 max-w-5xl w-full">
        {estado === 'cargando' && <p className="text-sm text-ink-500">Cargando…</p>}

        {estado === 'sin-descargas' && (
          <div role="alert" className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-ink-800 flex gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0" aria-hidden="true" />
            <p>
              Todavía no están listos los archivos para instalar la app. Pida a la persona que instaló el Sistema UVA que abra de nuevo el
              instalador y elija <strong>Actualizar todo</strong>; después vuelva a abrir esta página.
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
              <p className="text-sm text-ink-700 -mt-1">Sirve para que su {movil === 'ios' ? 'iPhone o iPad' : 'teléfono'} confíe en el Sistema UVA de su oficina.</p>
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

        {estado === 'listo' && info && !movil && (
          <>
            <section aria-labelledby="como-instalar" className="bg-white border border-line-200 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col gap-4">
              <div>
                <h2 id="como-instalar" className="text-lg font-bold text-ink-900">Cómo instalar la app en un teléfono o tablet</h2>
                <p className="text-sm text-ink-600 mt-1">La app se instala desde el propio teléfono o tablet (Android, iPhone o iPad). En cada uno:</p>
              </div>
              <ol className="flex flex-col gap-3">
                <PasoPc n={1}>Conéctelo al <strong>mismo Wi-Fi</strong> que esta computadora.</PasoPc>
                <PasoPc n={2}>
                  <span>Abra el navegador (<strong>Chrome</strong> en Android, <strong>Safari</strong> en iPhone o iPad) y escriba esta dirección <strong>completa, con http://</strong> al inicio (si el navegador dice «La conexión no es segura», toque <strong>Continuar al sitio</strong>):</span>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg sm:text-xl font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-1.5 break-all">{web}</span>
                    <button
                      type="button"
                      onClick={() => { void navigator.clipboard?.writeText(web).then(() => setCopiado(true), () => setCopiado(false)); }}
                      className="h-9 px-3 rounded-lg border border-line-300 bg-white hover:bg-surface-50 text-brand-700 text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      {copiado ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                      {copiado ? 'Copiada' : 'Copiar'}
                    </button>
                  </div>
                </PasoPc>
                <PasoPc n={3}>Inicie sesión con su correo y contraseña y abra el menú <strong>☰</strong> &gt; <strong>App de campo (móvil)</strong>.</PasoPc>
                <PasoPc n={4}>Ahí aparece <strong>«Instalar la app en este teléfono»</strong>: toque sus botones y siga los 3 pasos (permiso de seguridad, instalar la app y entrar).</PasoPc>
              </ol>

              {info.web.length > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 border-t border-line-100 pt-3">
                  <label htmlFor="direccion-servidor" className="text-xs font-semibold text-ink-700">Otra dirección de esta computadora</label>
                  <select
                    id="direccion-servidor"
                    value={indice}
                    onChange={(e) => { setIndice(Number(e.target.value)); setCopiado(false); }}
                    className="h-9 px-3 border border-line-300 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-600 sm:min-w-72"
                  >
                    {info.web.map((u, i) => <option key={u} value={i}>{u}</option>)}
                  </select>
                  <span className="text-[11px] text-ink-500">Si la de arriba no abre en el teléfono, pruebe con otra de esta lista.</span>
                </div>
              )}
            </section>

            <section aria-label="Requisitos" className="grid gap-3 sm:grid-cols-2">
              <div className="bg-white border border-line-200 rounded-xl p-4 flex gap-3">
                <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0" aria-hidden="true" />
                <p className="text-xs text-ink-700 leading-relaxed"><strong>¿Quién puede entrar?</strong> Cada verificador, con su propio correo y contraseña. Si a alguien no lo deja entrar, pida al administrador del sistema que le asigne un usuario en su ficha de verificador.</p>
              </div>
              <div className="bg-white border border-line-200 rounded-xl p-4 flex gap-3">
                <TabletSmartphone className="w-5 h-5 text-brand-600 shrink-0" aria-hidden="true" />
                <p className="text-xs text-ink-700 leading-relaxed"><strong>Funciona sin Internet.</strong> Lo que se capture en campo se envía solo a la oficina en cuanto el teléfono vuelve a tener conexión.</p>
              </div>
            </section>

            <p className="text-[11px] text-ink-500 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Permiso de seguridad para enviarlo por correo o WhatsApp (opcional):</span>
              <a className="text-brand-700 underline inline-flex items-center gap-1" href={`/descargas/${CERT_ANDROID}`} download><Download className="w-3 h-3" aria-hidden="true" />Android</a>
              <a className="text-brand-700 underline inline-flex items-center gap-1" href={`/descargas/${PERFIL_IOS}`}><Download className="w-3 h-3" aria-hidden="true" />iPhone y iPad</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
};
