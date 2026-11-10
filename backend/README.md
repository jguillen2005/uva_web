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

## Seguridad — pendientes antes de producción

* Cambiar `admin_passwd` en `odoo/config/odoo.conf`, `POSTGRES_PASSWORD` y `ODOO_ADMIN_PASSWORD`.
* El gateway hoy **no autentica al usuario final**: los microservicios actúan con el usuario técnico `api_uva`.
  Siguiente paso recomendado: SSO con Microsoft 365 (Entra ID) en el gateway y propagar el usuario a Odoo
  para que apliquen los roles de `uva_core`.
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
