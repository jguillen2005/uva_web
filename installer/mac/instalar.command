#!/bin/bash
# Asistente de instalación del Sistema UVA para Mac (Apple o Intel).
# Doble clic en Finder. Si macOS lo bloquea: clic derecho > Abrir > Abrir.
# Opciones (Terminal): --silencioso  --demo si|no  --actualizar-sistema  --sin-abrir  --destino <carpeta>

set -u
ORIGEN="$(cd "$(dirname "$0")" && pwd)"
CONTENIDO="$ORIGEN/contenido"
VERSION="$(cat "$CONTENIDO/version.txt" 2>/dev/null || echo 1.1)"
DESTINO="$HOME/SistemaUVA"
DEMO=''; SILENCIOSO=0; ACTUALIZAR_SISTEMA=0; SIN_ABRIR=0
while [ $# -gt 0 ]; do
  case "$1" in
    --silencioso) SILENCIOSO=1 ;;
    --demo) DEMO="${2:-}"; shift ;;
    --actualizar-sistema) ACTUALIZAR_SISTEMA=1 ;;
    --sin-abrir) SIN_ABRIR=1 ;;
    --destino) DESTINO="${2:-$DESTINO}"; shift ;;
  esac
  shift
done

paso() { printf '\n\033[36m> %s\033[0m\n' "$*"; }
dialogo() {  # dialogo "texto" "B1,B2,B3" "Predeterminado"
  if [ "$SILENCIOSO" = 1 ]; then printf '%s' "$3"; return; fi
  local lista; lista="$(printf '%s' "$2" | sed 's/[^,][^,]*/"&"/g; s/,/, /g')"
  osascript -e "button returned of (display dialog \"$(printf '%s' "$1" | sed 's/"/\\"/g')\" with title \"Instalador Sistema UVA $VERSION\" buttons {$lista} default button \"$3\")" 2>/dev/null || printf 'Cancelar'
}
salir() {
  if [ "$SILENCIOSO" != 1 ]; then printf '\nPresione Enter para cerrar...'; read -r _; fi
  exit "$1"
}

printf '\n  ==============================================\n'
printf '    Sistema UVA %s - Instalador para Mac\n' "$VERSION"
printf '    Web + app de campo + backend Odoo 19\n'
printf '  ==============================================\n'

# ------------------------------------------------------------------ requisitos
paso 'Revisando requisitos del equipo'
[ -d "$CONTENIDO/backend" ] || { echo "  Falta la carpeta 'contenido' junto a este instalador. Descomprima el .zip completo."; salir 1; }
ram_gb=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 ))
libre_gb=$(df -g "$HOME" 2>/dev/null | awk 'NR==2 {print $4}')
chip="$(uname -m)"; [ "$chip" = "arm64" ] && chip='Apple (arm64)' || chip='Intel (x86_64)'
echo "  macOS $(sw_vers -productVersion 2>/dev/null) · chip $chip · RAM ${ram_gb} GB · disco libre ${libre_gb:-?} GB"
[ "$ram_gb" -lt 8 ] && echo '  ! Se recomiendan 8 GB de RAM o más.'
if [ -n "${libre_gb:-}" ] && [ "$libre_gb" -lt 8 ]; then
  dialogo "Se necesitan al menos 8 GB libres en el disco (hay $libre_gb GB)." 'OK' 'OK' >/dev/null; salir 1
fi

if ! command -v docker >/dev/null 2>&1 && [ ! -d /Applications/Docker.app ]; then
  r="$(dialogo "El Sistema UVA necesita Docker Desktop y no está instalado en este Mac.

¿Abrir la página de descarga? Elija la versión para su chip: $chip.

Después de instalarlo, abra Docker Desktop una vez, acepte sus términos y vuelva a ejecutar este instalador.

Docker Desktop es gratuito para empresas de menos de 250 empleados y menos de 10 MDD de ingresos anuales." 'Cancelar,Abrir descarga' 'Abrir descarga')"
  [ "$r" = 'Abrir descarga' ] && open 'https://www.docker.com/products/docker-desktop/'
  echo '  Instale Docker Desktop y vuelva a ejecutar el instalador.'
  salir 2
fi
# Docker Desktop instalado pero sin el comando en el PATH de esta sesión
command -v docker >/dev/null 2>&1 || export PATH="$PATH:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin"

# ------------------------------------------------------------------ instalación nueva o existente
UVA="$DESTINO/uva.sh"
# Instalado = configuración completa; una instalación interrumpida se retoma como nueva (conserva lo hecho)
EXISTENTE=0; grep -q '^UVA_ADMIN_CONFIGURADO=1' "$DESTINO/backend/.env" 2>/dev/null && EXISTENTE=1
SOLO_APP=0; ACTUALIZACION=0
if [ $EXISTENTE = 1 ] && [ $ACTUALIZAR_SISTEMA = 1 ]; then
  ACTUALIZACION=1
elif [ $EXISTENTE = 1 ]; then
  echo "  Se detectó el Sistema UVA (backend Odoo) instalado en $DESTINO."
  r="$(dialogo "Se detectó el Sistema UVA ya instalado en:
$DESTINO

Actualizar todo: web, backend Odoo y app de campo a la versión $VERSION. Odoo no se reinstala: se respalda la base de datos y se conservan los datos y usuarios.

Solo la app: actualiza solo la app de campo de las tablets; la web y el backend quedan como están." 'Cancelar,Solo la app,Actualizar todo' 'Actualizar todo')"
  case "$r" in
    'Actualizar todo') ACTUALIZACION=1 ;;
    'Solo la app') SOLO_APP=1 ;;
    *) salir 0 ;;
  esac
else
  echo '  No se encontró el Sistema UVA en este Mac: se instalará completo (Odoo, base de datos, web y app de campo).'
  if [ -z "$DEMO" ]; then
    r="$(dialogo '¿Cargar datos de demostración?

Sí: clientes, expedientes y usuarios de ejemplo para conocer el sistema.
No: base de datos vacía, lista para operar.' 'Cancelar,No,Sí' 'Sí')"
    case "$r" in Sí) DEMO=si ;; No) DEMO=no ;; *) salir 0 ;; esac
  fi
fi

# ------------------------------------------------------------------ copiar archivos
paso "Copiando archivos a $DESTINO"
mkdir -p "$DESTINO"
if [ $SOLO_APP = 1 ]; then
  # Solo la app de campo, su módulo de Odoo, la configuración del gateway y los scripts de administración.
  rm -rf "$DESTINO/app" "$DESTINO/backend/odoo/addons/uva_app_movil"
  cp -R "$CONTENIDO/app" "$DESTINO/app"
  cp -R "$CONTENIDO/backend/odoo/addons/uva_app_movil" "$DESTINO/backend/odoo/addons/uva_app_movil"
  for f in backend/gateway/app.conf backend/docker-compose.app.yml uva.sh LEEME.txt Asercontrol-Campo.apk; do
    [ -e "$CONTENIDO/$f" ] && cp "$CONTENIDO/$f" "$DESTINO/$f"
  done
else
  # Se reemplazan código, web, app y scripts; se conservan .env, certificados, CREDENCIALES, respaldos y bitácoras.
  rm -rf "$DESTINO/dist" "$DESTINO/app" "$DESTINO/backend/odoo/addons" "$DESTINO/backend/services" "$DESTINO/backend/gateway"
  conf="$DESTINO/backend/odoo/config/odoo.conf"; conf_guardada=''
  [ -f "$conf" ] && conf_guardada="$(cat "$conf")"
  (cd "$CONTENIDO" && tar cf - --exclude version.txt .) | (cd "$DESTINO" && tar xf -)
  [ -n "$conf_guardada" ] && printf '%s\n' "$conf_guardada" > "$conf"
fi
chmod +x "$UVA"
xattr -dr com.apple.quarantine "$DESTINO" 2>/dev/null || true
echo '  Archivos copiados.'

# ------------------------------------------------------------------ instalar / actualizar
args=()
if [ $SOLO_APP = 1 ]; then args=(agregar-app)
elif [ $ACTUALIZACION = 1 ]; then args=(actualizar)
else args=(instalar); [ "$DEMO" = si ] && args+=(--demo); fi
[ "$SILENCIOSO" = 1 ] && args+=(--silencioso)
if ! /bin/bash "$UVA" "${args[@]}"; then
  dialogo "La instalación no terminó. Revise la bitácora en:
$DESTINO/logs

Puede reintentar ejecutando de nuevo este instalador." 'OK' 'OK' >/dev/null
  salir 1
fi

if [ $SIN_ABRIR != 1 ] && [ "$SILENCIOSO" != 1 ]; then
  /bin/bash "$UVA" abrir
  open -e "$DESTINO/CREDENCIALES.txt" 2>/dev/null || true
fi
if [ $SOLO_APP = 1 ]; then final='La app de campo quedó agregada al Sistema UVA (el backend y sus datos no se modificaron).'
else final="Sistema UVA $VERSION quedó instalado (web, app de campo y backend Odoo)."; fi
dialogo "$final

Ábralo con los accesos «Sistema UVA» y «App de campo» del escritorio o de la carpeta Aplicaciones > Sistema UVA de su usuario.
Direcciones, datos de acceso y cómo preparar las tablets están en CREDENCIALES.txt." 'OK' 'OK' >/dev/null
salir 0
