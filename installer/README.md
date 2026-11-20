# Instalador de Windows

Genera `SistemaUVA-Instalador-<versión>.exe`, un instalador autoextraíble con el ícono del sistema.
El ejecutable ([windows/stub/Instalador.cs](windows/stub/Instalador.cs)) se compila con el `csc.exe` de
.NET Framework incluido en Windows: no hace falta instalar herramientas. Lleva el contenido en un zip
pegado al final, sin límite práctico de tamaño, y no pide permisos de administrador.

El instalador lleva juntos la **web del Sistema UVA**, la **app de campo** de las tablets (repositorio
*asercontrol*, compilada con `VITE_API_URL=/api/app`) y el **backend Odoo 19** con sus microservicios.

## Generar el instalador

```powershell
# Con internet (~7 MB): descarga las imágenes de Docker durante la instalación
powershell -ExecutionPolicy Bypass -File installer\windows\build.ps1 -Version 1.1.0 `
  -App C:\ruta\asercontrol -Apk C:\ruta\Asercontrol-Campo.apk -Nombre ASERCONTROL-Instalador_web

# Sin internet (~1 GB): incluye las imágenes de Odoo, PostgreSQL, nginx y los microservicios
powershell -ExecutionPolicy Bypass -File installer\windows\build.ps1 -Version 1.1.0 `
  -App C:\ruta\asercontrol -Apk C:\ruta\Asercontrol-Campo.apk -Nombre ASERCONTROL-Instalador -SinInternet
```

`-App` es la carpeta del proyecto de la app de campo (por omisión `..\asercontrol` o `$env:ASERCONTROL_APP`).
`-Apk` (opcional) deja el APK en la carpeta instalada para repartirlo a las tablets. `-Salida` cambia la
carpeta del `.exe`; por omisión queda en `installer\windows\salida\`. Para revisar el contenido sin instalar:
`SistemaUVA-Instalador-1.0.0.exe /extraer C:\ruta\carpeta`. Instalación desatendida:
`SistemaUVA-Instalador-1.0.0.exe -Silencioso -Demo no`. Requisitos del equipo que compila: Node/npm y,
para `-SinInternet`, Docker y ~5 GB libres temporales.

El paquete **nunca** incluye `backend\.env` ni claves: cada instalación genera sus propias contraseñas.

## Qué hace el instalador en el equipo destino

1. Revisa RAM, disco y Docker Desktop. Si Docker falta, ofrece instalarlo (winget o sitio oficial).
   **Si el Sistema UVA (backend Odoo) ya está instalado**, no lo reinstala ni toca la base de datos: solo
   agrega o actualiza la app de campo y su módulo `uva_app_movil` (`uva.ps1 agregar-app`). Para actualizar
   también el backend: `<instalador>.exe -ActualizarSistema`. Si no está instalado, sigue con lo siguiente.
2. Pregunta si cargar **datos de demostración** (`uva_demo`) o iniciar con base vacía.
3. Copia todo a `%LOCALAPPDATA%\Programs\SistemaUVA` (no requiere administrador).
4. Genera `.env` con contraseñas aleatorias, elige **puertos libres** (desde 8080/8069) y una
   contraseña maestra para Odoo.
5. Carga las imágenes incluidas (versión sin internet) o las descarga/construye.
6. Crea la base `uva`, instala `uva_api|uva_demo`, `uva_legal`, `uva_app_movil`, el usuario técnico
   `api_uva` y su clave API (1 año; se renueva sola al iniciar sesión si faltan < 30 días).
7. Genera el certificado HTTPS de la app de campo (una autoridad local firma el certificado del equipo,
   con su nombre y sus IP) y publica la app en `https://<equipo>:<APP_PORT>` (desde 8443) con `/api/app`
   hacia Odoo (`backend/docker-compose.app.yml` + `gateway/app.conf`). Deja
   `Certificado-tablets-Asercontrol.crt` en la carpeta para instalarlo en las tablets.
8. Crea accesos en menú Inicio y escritorio (Sistema UVA y App de campo), el arranque automático al
   iniciar sesión y la entrada en «Aplicaciones instaladas» (con desinstalador).
9. Abre el sistema y `CREDENCIALES.txt` (usuario `admin`, contraseñas y direcciones de la app).

Con `-ActualizarSistema` sobre una instalación existente, **actualiza** todo: respalda la base, copia la
versión nueva, actualiza los módulos (`-u uva_core,uva_legal,uva_app_movil`) y reinicia los servicios,
conservando datos.

## Mantenimiento (`uva.ps1` en la carpeta instalada)

| Comando | Qué hace |
|---|---|
| `iniciar` / `detener` / `estado` | Arranca, detiene o muestra los contenedores |
| `abrir` / `abrir-odoo` | Abre el sistema o el backoffice |
| `respaldar` | `pg_dump` + filestore en `respaldos\<fecha>` |
| `actualizar` | Aplica la versión copiada (respalda antes) |
| `renovar-clave` | Nueva clave API para los microservicios |
| `abrir-app` | Abre la app de campo |
| `agregar-app` | Agrega la app de campo a un sistema ya instalado (sin tocar la base de datos) |
| `regenerar-certificado` | Nuevo certificado HTTPS (p. ej. cambió la IP); las tablets conservan la CA |
| `desinstalar` | Quita contenedores, accesos y carpeta; pregunta si conservar datos y ofrece respaldo |

Bitácoras en `logs\`. Los datos viven en los volúmenes Docker `sistema-uva_uva-db` y
`sistema-uva_uva-odoo-data`; si se desinstala conservándolos, una reinstalación los reutiliza
(la configuración se guarda en `%LOCALAPPDATA%\SistemaUVA-configuracion.env`).

## Limitaciones conocidas

- **Docker Desktop no se incluye** en el instalador: su licencia no permite redistribuirlo y es de
  pago para empresas de más de 250 empleados o 10 MDD de ingresos. El instalador lo detecta y ofrece
  instalarlo.
- El `.exe` **no está firmado**: Windows SmartScreen mostrará «Editor desconocido». Para distribuirlo
  a clientes, firmarlo con un certificado de firma de código (`signtool sign`).
- El asistente es sencillo (consola con el avance + cuadros de diálogo). Si se requiere un asistente
  gráfico completo, el mismo contenido puede empaquetarse con Inno Setup.

## Instalador para Mac (Apple o Intel)

`installer/mac/` genera `SistemaUVA-Instalador-Mac-<versión>.zip` con **«Instalar Sistema UVA.command»**
(doble clic) y la carpeta `contenido/` (web, app de campo, backend Odoo, APK y `uva.sh`). Las imágenes de
Odoo 19, PostgreSQL 17, nginx y Node existen para arm64 y amd64: funciona nativo en ambos chips.

```powershell
# Se genera desde Windows (requiere Node/npm y Python)
powershell -ExecutionPolicy Bypass -File installer\mac\build.ps1 -Version 1.1.1 `
  -App C:\ruta\asercontrol -Apk C:\ruta\Asercontrol-Campo.apk
```

En el Mac hace lo mismo que el de Windows: revisa Docker Desktop, pregunta por datos de demostración,
detecta una instalación existente (actualizar todo o solo la app), genera contraseñas, puertos y el
certificado HTTPS, crea accesos en `~/Applications/Sistema UVA` y el escritorio y un LaunchAgent para el
arranque al iniciar sesión. Instala en `~/SistemaUVA`; la configuración se respalda en
`~/Library/Application Support/SistemaUVA/configuracion.env`. Administración: `~/SistemaUVA/uva.sh`
(mismas acciones que `uva.ps1`; también funciona en Linux).

- El `.command` no está firmado: macOS pide abrirlo con clic derecho > Abrir (o «Abrir de todos modos» en
  Privacidad y seguridad), o ejecutarlo con `bash` desde Terminal.
- Aún no hay versión sin internet para Mac (requiere imágenes arm64 y amd64 por separado).
- Probado en Linux (Docker en Docker): instalar, retomar tras un error, actualizar, inicio de sesión web,
  app por HTTPS con la CA local y desinstalar. Las partes exclusivas de macOS (diálogos, Llavero,
  accesos y LaunchAgent) no se pudieron probar en un Mac real.

`uva.sh` es común a Mac y Linux: vive en `installer/comun/` y cada `build.ps1` lo copia al paquete.

## Instalador para Linux (Ubuntu 22.04 o superior)

`installer/linux/` genera `SistemaUVA-Instalador-Linux-<versión>.tar.gz` con **«Instalar Sistema UVA.sh»**
(clic derecho > «Ejecutar como un programa», o `bash` en una terminal) y la carpeta `contenido/`.

```powershell
powershell -ExecutionPolicy Bypass -File installer\linux\build.ps1 -Version 1.1.1 `
  -App C:\ruta\asercontrol -Apk C:\ruta\Asercontrol-Campo.apk
```

Igual que en Mac, más lo propio de Linux: si falta Docker ofrece instalarlo (`docker.io` y
`docker-compose-v2` de Ubuntu, o el instalador oficial de Docker) y agrega al usuario al grupo `docker`
(en esa sesión usa `sg docker`). Instala la CA local en el sistema (`update-ca-certificates`) y en la base
NSS de Chrome/Chromium (`certutil`); crea lanzadores `.desktop` en el menú de aplicaciones y el escritorio
y el arranque automático (`~/.config/autostart`). Docker inicia con el equipo y los contenedores se
reinician solos. Instala en `~/SistemaUVA`; la configuración se respalda en `~/.config/sistema-uva/`.

- Las preguntas se hacen en la terminal (opciones numeradas); sin terminal, con ventanas de `zenity`.
- La imagen de los microservicios se construye una sola vez: sin `buildx` (paquete `docker.io`) construirla
  en paralelo para los seis servicios falla con «image already exists».
- Probado en Ubuntu 24.04 (contenedor con Docker propio): instalación nueva con un usuario sin permiso de
  Docker, accesos, certificado, actualizar, desinstalar y las pruebas funcionales, sin conexión y no
  funcionales sobre la instalación resultante.
