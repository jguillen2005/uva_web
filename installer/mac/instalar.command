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
# Las marcas de cuarentena del .zip descargado pueden impedir leer o reemplazar archivos (sobre todo los
# ejecutables como uva.sh): se quitan antes de copiar.
xattr -cr "$CONTENIDO" 2>/dev/null || xattr -dr com.apple.quarantine "$CONTENIDO" 2>/dev/null || true
copiar_dir() {  # copiar_dir <origen> <destino>: copia el contenido (fusiona y reemplaza)
  mkdir -p "$2"
  if command -v ditto >/dev/null 2>&1; then ditto --noqtn "$1" "$2"; else cp -R "$1/." "$2/"; fi
}
copiar_archivo() {  # reemplaza el archivo: lo borra antes (también si quedó bloqueado)
  [ -e "$1" ] || return 0
  if [ -e "$2" ]; then chflags nouchg "$2" 2>/dev/null; chmod u+w "$2" 2>/dev/null; rm -f "$2"; fi
  cp "$1" "$2"
}
error_copia=0
if [ $SOLO_APP = 1 ]; then
  # Solo la app de campo, sus módulos de Odoo, la configuración del gateway y los scripts de administración.
  # Si falta algo indispensable (p. ej. tras una actualización interrumpida), se repone desde el paquete
  for d in backend/services backend/gateway backend/odoo/addons dist; do
    if [ -d "$CONTENIDO/$d" ] && [ ! -d "$DESTINO/$d" ]; then
      echo "  Reponiendo $d (faltaba en la instalación)."; mkdir -p "$(dirname "$DESTINO/$d")"
      copiar_dir "$CONTENIDO/$d" "$DESTINO/$d" || error_copia=1
    fi
  done
  for f in backend/docker-compose.yml backend/gateway/nginx.conf; do
    [ -e "$DESTINO/$f" ] || copiar_archivo "$CONTENIDO/$f" "$DESTINO/$f" || error_copia=1
  done
  rm -rf "$DESTINO/app" "$DESTINO/backend/odoo/addons/uva_app_movil" "$DESTINO/backend/odoo/addons/uva_sesion_web"
  copiar_dir "$CONTENIDO/app" "$DESTINO/app" || error_copia=1
  for m in uva_app_movil uva_sesion_web; do
    [ -d "$CONTENIDO/backend/odoo/addons/$m" ] && { copiar_dir "$CONTENIDO/backend/odoo/addons/$m" "$DESTINO/backend/odoo/addons/$m" || error_copia=1; }
  done
  for f in backend/gateway/app.conf backend/docker-compose.app.yml uva.sh LEEME.txt Asercontrol-Campo.apk; do
    copiar_archivo "$CONTENIDO/$f" "$DESTINO/$f" || error_copia=1
  done
else
  # Se reemplazan código, web, app y scripts; se conservan .env, certificados, CREDENCIALES, respaldos y bitácoras.
  rm -rf "$DESTINO/dist" "$DESTINO/app" "$DESTINO/backend/odoo/addons" "$DESTINO/backend/services" "$DESTINO/backend/gateway"
  conf="$DESTINO/backend/odoo/config/odoo.conf"; conf_guardada=''
  [ -f "$conf" ] && conf_guardada="$(cat "$conf")"
  copiar_archivo "$CONTENIDO/uva.sh" "$DESTINO/uva.sh" || error_copia=1
  copiar_dir "$CONTENIDO" "$DESTINO" || error_copia=1
  rm -f "$DESTINO/version.txt"
  [ -n "$conf_guardada" ] && printf '%s\n' "$conf_guardada" > "$conf"
fi
chmod +x "$UVA" 2>/dev/null
xattr -dr com.apple.quarantine "$DESTINO" 2>/dev/null || true
# Comprobar que llegó lo indispensable antes de tocar Odoo o los servicios
faltan=''
# Copiados en esta ejecución: deben ser idénticos al paquete. El resto (solo la app): deben existir.
iguales='uva.sh backend/docker-compose.app.yml backend/gateway/app.conf backend/odoo/addons/uva_app_movil/__manifest__.py app/index.html'
existen='backend/docker-compose.yml backend/services/Dockerfile backend/gateway/nginx.conf'
[ $SOLO_APP = 1 ] || { iguales="$iguales $existen"; existen=''; }
for f in $iguales; do
  [ -e "$CONTENIDO/$f" ] && ! cmp -s "$CONTENIDO/$f" "$DESTINO/$f" && faltan="$faltan
  $f"
done
for f in $existen; do
  [ -e "$DESTINO/$f" ] || faltan="$faltan
  $f"
done
if [ $error_copia = 1 ] || [ -n "$faltan" ]; then
  echo "  No se pudieron copiar todos los archivos.$faltan"
  dialogo "No se pudieron copiar los archivos a:
$DESTINO

Suele deberse a permisos de macOS. Abra Ajustes del Sistema > Privacidad y seguridad > Acceso total al disco, active Terminal y vuelva a ejecutar este instalador. La base de datos y los usuarios no se modificaron." 'OK' 'OK' >/dev/null
  salir 1
fi
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
