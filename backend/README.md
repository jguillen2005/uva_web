# Backend del Sistema UVA — Odoo 19 on-premise + microservicios

Arquitectura, endpoints y formas de datos: ver [CONTRACT.md](CONTRACT.md).

```
backend/
├── docker-compose.yml      PostgreSQL 17 · Odoo 19 · 6 microservicios · gateway nginx
├── .env.example            variables (la API key la escribe bootstrap)
├── odoo/
│   ├── config/odoo.conf
│   └── addons/             módulos uva_core, uva_formatos, uva_solicitudes, uva_instrumentos,
│                           uva_operacion, uva_dictaminacion, uva_api, uva_demo,
│                           uva_legal (Términos y Aviso de Privacidad en el sitio web de Odoo)
├── services/               microservicios Node 22 (una imagen, un contenedor por dominio)
│   ├── shared/             cliente JSON-2 de Odoo + fábrica de servidor Express
│   └── src/                reportes · catalogos · solicitudes · operacion · calidad · dictaminacion
├── gateway/nginx.conf      /api/<dominio>/* → svc-<dominio>
└── scripts/bootstrap.sh    crea la base "uva", instala módulos, genera API key, levanta el stack
```

## Puesta en marcha

> **Instalar en otro equipo Windows:** usa el instalador `SistemaUVA-Instalador-<versión>.exe`
> (genera contraseñas, elige puertos libres, crea accesos directos y desinstalador). Cómo generarlo
> y qué hace: [installer/README.md](../installer/README.md).

Requisitos: Docker Desktop (o Docker Engine + Compose v2). En Windows usa Git Bash.

```bash
cd backend
./scripts/bootstrap.sh          # primera vez: crea la BD "uva" con datos semilla
# ./scripts/bootstrap.sh --reset  # borra todo y vuelve a crear la BD
```

Después, en la raíz del proyecto:

```bash
printf 'VITE_DATA_SOURCE=api\nAPI_PROXY_TARGET=http://localhost:8080\n' > .env.local
npm run dev                      # Vite redirige /api → API_PROXY_TARGET
```

**Puertos:** se definen en `backend/.env` (`ODOO_PORT`, `GATEWAY_PORT`). Si 8069/8080 ya están ocupados por
otro proyecto, cámbialos (p.ej. 8169/8180) y ajusta `API_PROXY_TARGET` en `.env.local`.

**API key:** Odoo 19 obliga a que caduque (máx. 90 días por defecto). El script crea una de 89 días; para
rotarla vuelve a correr `./scripts/bootstrap.sh` (no reinstala si la base ya existe) y reinicia los servicios.

| Servicio | URL |
|---|---|
| Odoo backoffice | http://localhost:`ODOO_PORT` (usuario `admin`, contraseña de `ODOO_ADMIN_PASSWORD`) |
| API gateway | http://localhost:`GATEWAY_PORT`/api/health |
| Frontend (dev) | http://localhost:3000 |

## Operación

* Actualizar módulos tras cambiar código Odoo:
  `docker compose run --rm odoo odoo -d uva -u uva_api --stop-after-init && docker compose restart odoo`
* Logs: `docker compose logs -f odoo svc-solicitudes`
* Respaldo: `docker compose exec db pg_dump -U odoo uva > uva.sql` (+ volumen `uva-odoo-data` para adjuntos).
* Producción: `npm run build` en la raíz; el gateway sirve `dist/` en `/` y la API en `/api`.

## App de campo Asercontrol (módulo `uva_app_movil`)

La app de inspección en tablet (PWA offline del repositorio *asercontrol*) usa **esta misma base `uva`**,
sin base propia ni microservicios: el módulo `uva_app_movil` publica controladores HTTP de Odoo en `/api/app/*`
y escribe directamente en los modelos UVA (`uva.visita`, `uva.expediente` con sus puntos C/NC/N/A, fotos y el
PDF en `03_Campo`, `uva.verificador`, `uva.instrumento`). El acta recibida entra a **revisión técnica**
(`por_revisar`); si el revisor la devuelve, la tablet la reabre y el reenvío llega como versión 2.

* Login con usuario y contraseña de Odoo (el usuario debe tener un `uva.verificador` ligado); token HMAC de
  24 h firmado con el parámetro `uva_app_movil.secreto` (se crea al instalar). Bloqueo de 5 min tras 5 intentos.
* El gateway solo expone `/api/app/` hacia Odoo (`client_max_body_size 80m`); el backoffice sigue interno.
* Instalar: `docker compose run --rm odoo odoo -d uva -i uva_app_movil --stop-after-init && docker compose restart odoo`
* Datos de prueba de la app (verificador `jhovani.coss@asercontrol.com`, visitas `ORD-2026-CUL-*`):
  `TZ_OPERACION=America/Mazatlan node scripts/seed-app-movil.mjs`
* En la app: `VITE_API_URL=http://localhost:8180/api/app` (producción: `https://<gateway>/api/app`) y agregar
  el origen de la app al mapa CORS de `gateway/nginx.conf`.
* Recomendado en producción: `workers ≥ 4` en `odoo.conf` (las actas con fotos tardan varios segundos) y un
  servidor SMTP saliente para el correo de "recuperar contraseña".

## Seguridad — pendientes antes de producción

* Cambiar `admin_passwd` en `odoo/config/odoo.conf`, `POSTGRES_PASSWORD` y `ODOO_ADMIN_PASSWORD`.
* **Inicio de sesión de la web** (módulo `uva_sesion_web`): la web pide el usuario y la contraseña de Odoo y
  Odoo entrega una cookie firmada `HttpOnly` (10 h, `uva_sesion_web.horas`). El gateway valida esa cookie
  con `auth_request` (`/api/sesion/validar`) en cada llamada a `/api/<dominio>` y reenvía el login real a
  los microservicios en `X-UVA-User` (la cabecera que mande el navegador se descarta), así aplican los roles
  y la regla de imparcialidad del usuario que trabaja. Bloqueo de 5 min tras 5 intentos fallidos.
  «¿Olvidó su contraseña?» usa el correo de restablecimiento de Odoo: requiere un servidor de correo
  saliente y `web.base.url` apuntando al gateway (el instalador lo fija); el gateway publica
  `/web/reset_password`. Pendiente opcional: SSO con Microsoft 365 (Entra ID) sobre la misma sesión.
* Exponer solo el puerto del gateway (8080/443 con TLS); Odoo (8069) solo en la red interna.
* Integraciones Aspel SAE, SharePoint, Outlook y portal CONAGUA están como stubs (`# TODO integración`).
* Los datos semilla fijan `uva.fecha_referencia = 2026-10-21` (parámetro del sistema) para que plazos y
  "hoy" coincidan con el prototipo. **Bórralo en producción** (Ajustes › Técnico › Parámetros del sistema)
  para que se use la fecha real.

## Páginas legales (sitio web de Odoo)

`uva_legal` publica **/terminos-y-condiciones** y **/aviso-de-privacidad** con el módulo Website de Odoo.
El gateway expone solo esas dos rutas y sus recursos estáticos; el backoffice de Odoo sigue interno.

* **Editar textos:** Odoo › Sitio web › abrir la página › *Editar*. Los cambios no se pierden al actualizar
  el módulo (los registros son `noupdate`).
* Los datos entre [corchetes] (razón social, domicilio, correos, fecha) están resaltados: complétalos y
  haz que el área jurídica revise ambos textos antes de producción.
