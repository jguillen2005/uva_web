# Instalador de Windows

Genera `SistemaUVA-Instalador-<versión>.exe`, un instalador autoextraíble con el ícono del sistema.
El ejecutable ([windows/stub/Instalador.cs](windows/stub/Instalador.cs)) se compila con el `csc.exe` de
.NET Framework incluido en Windows: no hace falta instalar herramientas. Lleva el contenido en un zip
pegado al final, sin límite práctico de tamaño, y no pide permisos de administrador.

## Generar el instalador

```powershell
# Normal (~3 MB): descarga las imágenes de Docker durante la instalación
powershell -ExecutionPolicy Bypass -File installer\windows\build.ps1 -Version 1.0.0

# Sin internet (~1 GB): incluye las imágenes de Odoo, PostgreSQL, nginx y los microservicios
powershell -ExecutionPolicy Bypass -File installer\windows\build.ps1 -Version 1.0.0 -SinInternet
```

El resultado queda en `installer\windows\salida\`. Para revisar el contenido sin instalar:
`SistemaUVA-Instalador-1.0.0.exe /extraer C:\ruta\carpeta`. Instalación desatendida:
`SistemaUVA-Instalador-1.0.0.exe -Silencioso -Demo no`. Requisitos del equipo que compila: Node/npm y,
para `-SinInternet`, Docker y ~5 GB libres temporales.

El paquete **nunca** incluye `backend\.env` ni claves: cada instalación genera sus propias contraseñas.

## Qué hace el instalador en el equipo destino

1. Revisa RAM, disco y Docker Desktop. Si Docker falta, ofrece instalarlo (winget o sitio oficial).
2. Pregunta si cargar **datos de demostración** (`uva_demo`) o iniciar con base vacía.
3. Copia todo a `%LOCALAPPDATA%\Programs\SistemaUVA` (no requiere administrador).
4. Genera `.env` con contraseñas aleatorias, elige **puertos libres** (desde 8080/8069) y una
   contraseña maestra para Odoo.
5. Carga las imágenes incluidas (versión sin internet) o las descarga/construye.
6. Crea la base `uva`, instala `uva_api|uva_demo`, `uva_legal`, `uva_app_movil`, el usuario técnico
   `api_uva` y su clave API (1 año; se renueva sola al iniciar sesión si faltan < 30 días).
7. Crea accesos en menú Inicio y escritorio, el arranque automático al iniciar sesión y la entrada
   en «Aplicaciones instaladas» (con desinstalador).
8. Abre el sistema y `CREDENCIALES.txt` (usuario `admin` y contraseñas generadas).

Si se ejecuta sobre una instalación existente, **actualiza**: respalda la base, copia la versión
nueva, actualiza los módulos (`-u uva_core,uva_legal`) y reinicia los servicios, conservando datos.

## Mantenimiento (`uva.ps1` en la carpeta instalada)

| Comando | Qué hace |
|---|---|
| `iniciar` / `detener` / `estado` | Arranca, detiene o muestra los contenedores |
| `abrir` / `abrir-odoo` | Abre el sistema o el backoffice |
| `respaldar` | `pg_dump` + filestore en `respaldos\<fecha>` |
| `actualizar` | Aplica la versión copiada (respalda antes) |
| `renovar-clave` | Nueva clave API para los microservicios |
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
