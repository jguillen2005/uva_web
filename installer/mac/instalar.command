#!/bin/bash
# Asistente de instalación del Sistema UVA para Mac (Apple o Intel).
# Normalmente lo abre «Instalar Sistema UVA.app» (doble clic): la app lo ejecuta con bash en Terminal.
# Va dentro de la app (Contents/Resources/instalar.command). A mano: bash ".../Instalar Sistema UVA.app/Contents/Resources/instalar.command"
# Opciones (Terminal): --silencioso  --demo si|no  --actualizar-sistema  --reinstalar  --sin-abrir  --destino <carpeta>

set -u
ORIGEN="$(cd "$(dirname "$0")" && pwd)"
CONTENIDO="$ORIGEN/contenido"
# El contenido va dentro de la app (Contents/Resources/contenido): este .command, junto a la app, lo usa de ahí.
[ -d "$CONTENIDO" ] || CONTENIDO="$ORIGEN/Instalar Sistema UVA.app/Contents/Resources/contenido"
VERSION="$(cat "$CONTENIDO/version.txt" 2>/dev/null || echo 1.1)"
DESTINO="$HOME/SistemaUVA"
DEMO=''; SILENCIOSO=0; ACTUALIZAR_SISTEMA=0; SIN_ABRIR=0; REINSTALAR=0
while [ $# -gt 0 ]; do
  case "$1" in
    --silencioso) SILENCIOSO=1 ;;
    --demo) DEMO="${2:-}"; shift ;;
    --actualizar-sistema) ACTUALIZAR_SISTEMA=1 ;;
    --reinstalar) REINSTALAR=1 ;;
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
elegir() {  # elegir "texto" "Opción 1|Opción 2|..." "Predeterminada": lista (macOS admite solo 3 botones)
  if [ "$SILENCIOSO" = 1 ]; then printf '%s' "$3"; return; fi
  local lista; lista="$(printf '%s' "$2" | sed 's/"/\\"/g; s/[^|][^|]*/"&"/g; s/|/, /g')"
  osascript -e "set r to choose from list {$lista} with title \"Instalador Sistema UVA $VERSION\" with prompt \"$(printf '%s' "$1" | sed 's/"/\\"/g')\" default items {\"$3\"} OK button name \"Continuar\" cancel button name \"Cancelar\"" \
    -e 'if r is false then return "Cancelar"' -e 'return item 1 of r' 2>/dev/null || printf 'Cancelar'
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
# Reinstalar desde cero: respaldo en Documentos, desinstala la versión anterior con sus datos (conserva la
# autoridad de certificados: los teléfonos siguen confiando en el servidor) y sigue como instalación nueva.
reinstalar_desde_cero() {
  local r respaldo='' copia
  if [ "$SILENCIOSO" != 1 ]; then
    r="$(dialogo "Reinstalar desde cero borra la instalación anterior y TODOS sus datos (clientes, visitas, actas y usuarios).

Antes se guarda un respaldo de la base de datos en su carpeta Documentos.

¿Continuar?" 'Cancelar,Reinstalar' 'Cancelar')"
    [ "$r" = 'Reinstalar' ] || salir 0
  fi
  paso 'Reinstalar desde cero: respaldo de la versión anterior'
  # Se usa el uva.sh de esta versión (el anterior no conoce --conservar-certificado)
  chflags nouchg "$UVA" 2>/dev/null; chmod u+w "$UVA" 2>/dev/null
  cat "$CONTENIDO/uva.sh" > "$UVA.nuevo" && chmod 755 "$UVA.nuevo" && { mv -f "$UVA.nuevo" "$UVA" 2>/dev/null || { rm -f "$UVA"; mv -f "$UVA.nuevo" "$UVA"; }; }
  if bash "$UVA" respaldar --silencioso; then
    respaldo="$(ls -1d "$DESTINO"/respaldos/*/ 2>/dev/null | sort | tail -1)"; respaldo="${respaldo%/}"
  fi
  if [ -n "$respaldo" ]; then
    copia="$HOME/Documents/Respaldo Sistema UVA $(basename "$respaldo")"
    mkdir -p "$HOME/Documents"; cp -R "$respaldo" "$copia" && printf '  \033[32mOK\033[0m  Respaldo guardado en %s\n' "$copia"
  else
    r="$(dialogo 'No se pudo respaldar la base de datos (¿Docker Desktop está abierto?).

Si continúa, los datos actuales se borran SIN respaldo.' 'Cancelar,Continuar sin respaldo' 'Cancelar')"
    [ "$r" = 'Continuar sin respaldo' ] || salir 1
  fi
  paso 'Desinstalando la versión anterior'
  bash "$UVA" desinstalar --silencioso --eliminar-datos --conservar-certificado || { printf '  La desinstalación anterior no terminó: revise ~/SistemaUVA/logs.\n'; salir 1; }
  rm -rf "$DESTINO" 2>/dev/null
  printf '  \033[32mOK\033[0m  Versión anterior desinstalada. Se instala la versión %s desde cero.\n' "$VERSION"
  EXISTENTE=0; REINSTALADO=1
}
if [ $EXISTENTE = 1 ] && [ $ACTUALIZAR_SISTEMA = 1 ]; then
  ACTUALIZACION=1
elif [ $EXISTENTE = 1 ] && [ $REINSTALAR = 1 ]; then
  reinstalar_desde_cero
elif [ $EXISTENTE = 1 ]; then
  echo "  Se detectó el Sistema UVA (backend Odoo) instalado en $DESTINO."
  OP_ACTUALIZAR="Actualizar todo: instala la versión $VERSION en la web, Odoo y la app. Respalda la base y conserva clientes, visitas y usuarios."
  OP_REINSTALAR='Reinstalar desde cero: guarda un respaldo en Documentos, borra la instalación anterior con todos sus datos e instala la versión nueva limpia.'
  OP_SOLO_APP='Solo la app: actualiza solo la app de campo; la web, Odoo y los datos no cambian.'
  OP_CANCELAR='Cancelar: salir sin hacer cambios.'
  r="$(elegir "Se detectó el Sistema UVA ya instalado en $DESTINO. ¿Qué desea hacer?" \
    "$OP_ACTUALIZAR|$OP_REINSTALAR|$OP_SOLO_APP|$OP_CANCELAR" "$OP_ACTUALIZAR")"
  case "$r" in
    'Actualizar todo'*) ACTUALIZACION=1 ;;
    'Reinstalar desde cero'*) reinstalar_desde_cero ;;
    'Solo la app'*) SOLO_APP=1 ;;
    *) salir 0 ;;
  esac
fi
if [ $EXISTENTE = 0 ]; then
  [ "${REINSTALADO:-0}" = 1 ] || echo '  No se encontró el Sistema UVA en este Mac: se instalará completo (Odoo, base de datos, web y app de campo).'
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
# Se copia solo el CONTENIDO de los archivos, sin atributos extendidos: macOS no permite pasar a la copia
# las marcas de procedencia/cuarentena del paquete descargado («Operation not permitted»), y no hacen falta.
# No se necesita ningún permiso especial (ni «Acceso total al disco»): todo va a la carpeta del usuario.
copiar_archivo() {  # copiar_archivo <origen> <destino>: reemplaza el archivo con el contenido del origen
  [ -e "$1" ] || return 0
  local nuevo="$2.nuevo.$$"
  mkdir -p "$(dirname "$2")"
  cat "$1" > "$nuevo" || { rm -f "$nuevo"; return 1; }
  [ -x "$1" ] && chmod 755 "$nuevo"
  if [ -e "$2" ]; then chflags nouchg "$2" 2>/dev/null; chmod u+w "$2" 2>/dev/null; fi
  mv -f "$nuevo" "$2" 2>/dev/null || { rm -f "$2" 2>/dev/null; mv -f "$nuevo" "$2"; } || { rm -f "$nuevo"; return 1; }
}
copiar_por_archivo() {  # copia carpeta por carpeta y archivo por archivo (solo contenido)
  local rel err=0
  while IFS= read -r rel; do mkdir -p "$2/$rel"; done <<EOF
$(cd "$1" && find . -type d)
EOF
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    copiar_archivo "$1/$rel" "$2/$rel" || { echo "  No se pudo copiar: ${rel#./}"; err=1; }
  done <<EOF
$(cd "$1" && find . -type f)
EOF
  return $err
}
copiar_dir() {  # copiar_dir <origen> <destino>: copia el contenido (fusiona y reemplaza)
  mkdir -p "$2"
  if command -v ditto >/dev/null 2>&1; then
    ditto --noqtn --noextattr --noacl "$1" "$2" 2>/dev/null && return 0
  else
    cp -R "$1/." "$2/" 2>/dev/null && return 0
  fi
  copiar_por_archivo "$1" "$2"
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
  for f in backend/gateway/app.conf backend/docker-compose.app.yml uva.sh; do
    copiar_archivo "$CONTENIDO/$f" "$DESTINO/$f" || error_copia=1
  done
  copiar_archivo "$CONTENIDO/Manual de instalacion Sistema UVA.pdf" "$DESTINO/Manual de instalacion Sistema UVA.pdf" || error_copia=1
else
  # Se reemplazan código, web, app y scripts; se conservan .env, certificados, CREDENCIALES, respaldos y bitácoras.
  rm -rf "$DESTINO/dist" "$DESTINO/app" "$DESTINO/backend/odoo/addons" "$DESTINO/backend/services" "$DESTINO/backend/gateway"
  conf="$DESTINO/backend/odoo/config/odoo.conf"; conf_guardada=''
  [ -f "$conf" ] && conf_guardada="$(cat "$conf")"
  copiar_archivo "$CONTENIDO/uva.sh" "$DESTINO/uva.sh" || error_copia=1
  copiar_dir "$CONTENIDO" "$DESTINO" || error_copia=1
  rm -f "$DESTINO/version.txt"
  [ -n "$conf_guardada" ] && printf '%s\n' "$conf_guardada" > "$conf"
  # Se conserva la configuración (contraseña maestra); solo se sube el valor anterior de procesos (2 -> 4).
  [ -f "$conf" ] && sed -i.bak 's/^workers = 2$/workers = 4/' "$conf" && rm -f "$conf.bak"
fi
chmod +x "$UVA" 2>/dev/null
rm -f "$DESTINO/LEEME.txt"   # reemplazado por el manual en PDF
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

La base de datos y los usuarios no se modificaron. Cierre esta ventana y vuelva a abrir «Instalar Sistema UVA». Si se repite, envíe a soporte una captura de la ventana de Terminal." 'OK' 'OK' >/dev/null
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
