#!/bin/bash
# Asistente de instalación del Sistema UVA para Linux (Ubuntu 22.04 o superior, amd64 o arm64).
# En el explorador de archivos: clic derecho > «Ejecutar como un programa», o en una terminal:
#   bash "Instalar Sistema UVA.sh"
# Opciones: --silencioso  --demo si|no  --actualizar-sistema  --sin-abrir  --destino <carpeta>

set -u
ORIGEN="$(cd "$(dirname "$0")" && pwd)"
CONTENIDO="$ORIGEN/contenido"
VERSION="$(cat "$CONTENIDO/version.txt" 2>/dev/null || echo 1.0.0)"
DESTINO="$HOME/SistemaUVA"
DEMO=''; SILENCIOSO=0; ACTUALIZAR_SISTEMA=0; SIN_ABRIR=0; REINSTALAR=0
ARGS_ORIGINALES=("$@")
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

# Abierto desde el explorador de archivos (sin terminal): se vuelve a abrir dentro de una terminal para
# mostrar el avance y poder pedir la contraseña de administrador.
if [ "$SILENCIOSO" != 1 ] && [ ! -t 0 ] && [ -z "${UVA_EN_TERMINAL:-}" ]; then
  export UVA_EN_TERMINAL=1
  for t in gnome-terminal ptyxis kgx konsole xfce4-terminal mate-terminal x-terminal-emulator xterm; do
    command -v "$t" >/dev/null 2>&1 || continue
    case "$t" in
      gnome-terminal|ptyxis|kgx) exec "$t" -- bash "$0" "${ARGS_ORIGINALES[@]+"${ARGS_ORIGINALES[@]}"}" ;;
      *) exec "$t" -e bash "$0" "${ARGS_ORIGINALES[@]+"${ARGS_ORIGINALES[@]}"}" ;;
    esac
  done
fi

paso() { printf '\n\033[36m> %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32mOK\033[0m  %s\n' "$*"; }
aviso() { printf '  \033[33m!\033[0m   %s\n' "$*"; }
# Preguntas en la terminal: opciones numeradas, Enter = predeterminada. En modo silencioso, la predeterminada.
dialogo() {  # dialogo "texto" "B1,B2,B3" "Predeterminado"
  local texto="$1" botones="$2" pred="$3" i n r opcion
  if [ "$SILENCIOSO" = 1 ] || ! { : </dev/tty; } 2>/dev/null; then printf '%s' "$pred"; return; fi
  while :; do
    printf '\n%s\n\n' "$texto" >/dev/tty
    n=0; IFS=','; for opcion in $botones; do n=$((n + 1)); [ "$opcion" = "$pred" ] && r=' (Enter)' || r=''; printf '   %d) %s%s\n' "$n" "$opcion" "$r" >/dev/tty; done; unset IFS
    [ "$n" = 1 ] && { printf '\nPresione Enter para continuar...' >/dev/tty; read -r _ </dev/tty; printf '%s' "$pred"; return; }
    printf '\nElija una opción [1-%d]: ' "$n" >/dev/tty; read -r r </dev/tty || r=''
    [ -z "$r" ] && { printf '%s' "$pred"; return; }
    i=0; IFS=','; for opcion in $botones; do i=$((i + 1)); [ "$i" = "$r" ] && { unset IFS; printf '%s' "$opcion"; return; }; done; unset IFS
    printf '  Opción no válida.\n' >/dev/tty
  done
}
salir() {
  if [ "$SILENCIOSO" != 1 ] && { : </dev/tty; } 2>/dev/null; then printf '\nPresione Enter para cerrar...'; read -r _ </dev/tty; fi
  exit "$1"
}

printf '\n  ==============================================\n'
printf '    Sistema UVA %s - Instalador para Linux\n' "$VERSION"
printf '    Web + app de campo + backend Odoo 19\n'
printf '  ==============================================\n'

# ------------------------------------------------------------------ requisitos
paso 'Revisando requisitos del equipo'
[ -d "$CONTENIDO/backend" ] || { echo "  Falta la carpeta 'contenido' junto a este instalador. Descomprima el archivo completo."; salir 1; }
distro="$( . /etc/os-release 2>/dev/null && printf '%s' "${PRETTY_NAME:-Linux}")"
ram_gb=$(( ( $(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0) + 524288 ) / 1048576 ))
mkdir -p "$DESTINO" 2>/dev/null
libre_gb=$(df -BG "$DESTINO" 2>/dev/null | awk 'NR==2 {gsub("G","",$4); print $4}')
echo "  ${distro:-Linux} · $(uname -m) · RAM ${ram_gb} GB · disco libre ${libre_gb:-?} GB"
[ "$ram_gb" -lt 8 ] && aviso 'Se recomiendan 8 GB de RAM o más.'
if [ -n "${libre_gb:-}" ] && [ "$libre_gb" -lt 8 ]; then
  dialogo "Se necesitan al menos 8 GB libres en el disco (hay $libre_gb GB)." 'OK' 'OK' >/dev/null; salir 1
fi
[ "$(id -u)" = 0 ] && aviso 'Está ejecutando el instalador como root: se recomienda ejecutarlo con su usuario normal.'

# ------------------------------------------------------------------ Docker
COMO_GRUPO=0   # 1 = el usuario se acaba de agregar al grupo docker: usar «sg docker» en esta sesión
docker_ok() { docker info >/dev/null 2>&1; }
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  # Se instala solo (paquetes oficiales de Ubuntu: docker.io y docker-compose-v2); pide la contraseña una vez.
  echo '  El Sistema UVA necesita Docker (programa gratuito) y no está instalado: se instala ahora.'
  echo '  Si se lo pide, escriba su contraseña (al escribirla no aparecen letras: es normal).'
  paso 'Instalando Docker (puede tardar unos minutos)'
  sudo apt-get update -qq || true
  if ! sudo apt-get install -y docker.io docker-compose-v2; then
    aviso 'No se pudieron instalar los paquetes de Ubuntu; se intenta con el instalador oficial de Docker.'
    curl -fsSL https://get.docker.com | sudo sh || { echo '  No se pudo instalar Docker.'; salir 2; }
  fi
fi
if ! docker_ok; then
  sudo systemctl enable --now docker >/dev/null 2>&1 || sudo systemctl start docker >/dev/null 2>&1 || true
fi
if ! docker_ok && docker info 2>&1 | grep -qi 'permission denied'; then
  paso 'Dando permiso a su usuario para usar Docker (grupo docker)'
  sudo usermod -aG docker "$USER" || { echo "  No se pudo agregar $USER al grupo docker."; salir 2; }
  COMO_GRUPO=1
  sg docker -c 'docker info' >/dev/null 2>&1 || { echo '  Docker no responde. Revise:  sudo systemctl status docker'; salir 2; }
elif ! docker_ok; then
  echo '  Docker no responde. Revise el servicio con:  sudo systemctl status docker'; salir 2
fi
ok 'Docker está listo.'

# ------------------------------------------------------------------ instalación nueva o existente
UVA="$DESTINO/uva.sh"
# Instalado = configuración completa; una instalación interrumpida se retoma como nueva (conserva lo hecho)
EXISTENTE=0; grep -q '^UVA_ADMIN_CONFIGURADO=1' "$DESTINO/backend/.env" 2>/dev/null && EXISTENTE=1
SOLO_APP=0; ACTUALIZACION=0
# Reinstalar desde cero: respaldo en Documentos, desinstala la versión anterior con sus datos (conserva la
# autoridad de certificados: los teléfonos siguen confiando en el servidor) y sigue como instalación nueva.
reinstalar_desde_cero() {
  local r respaldo='' docs copia
  if [ "$SILENCIOSO" != 1 ]; then
    r="$(dialogo "Reinstalar desde cero borra la instalación anterior y TODOS sus datos (clientes, visitas, actas y usuarios).
Antes se guarda un respaldo de la base de datos en su carpeta Documentos. ¿Continuar?" 'Cancelar,Reinstalar' 'Cancelar')"
    [ "$r" = 'Reinstalar' ] || salir 0
  fi
  paso 'Reinstalar desde cero: respaldo de la versión anterior'
  # Se usa el uva.sh de esta versión (el anterior no conoce --conservar-certificado)
  rm -f "$UVA"; cp "$CONTENIDO/uva.sh" "$UVA" && chmod +x "$UVA"
  if bash "$UVA" respaldar --silencioso; then
    respaldo="$(ls -1d "$DESTINO"/respaldos/*/ 2>/dev/null | sort | tail -1)"; respaldo="${respaldo%/}"
  fi
  if [ -n "$respaldo" ]; then
    docs="$(xdg-user-dir DOCUMENTS 2>/dev/null)"; [ -n "$docs" ] && [ "$docs" != "$HOME" ] || docs="$HOME/Documentos"
    copia="$docs/Respaldo Sistema UVA $(basename "$respaldo")"
    mkdir -p "$docs"; cp -R "$respaldo" "$copia" && ok "Respaldo guardado en $copia"
  else
    r="$(dialogo 'No se pudo respaldar la base de datos (¿Docker está activo?). Si continúa, los datos actuales se borran SIN respaldo.' 'Cancelar,Continuar sin respaldo' 'Cancelar')"
    [ "$r" = 'Continuar sin respaldo' ] || salir 1
  fi
  paso 'Desinstalando la versión anterior'
  bash "$UVA" desinstalar --silencioso --eliminar-datos --conservar-certificado || { aviso "La desinstalación anterior no terminó: revise $DESTINO/logs."; salir 1; }
  rm -rf "$DESTINO" 2>/dev/null
  ok "Versión anterior desinstalada. Se instala la versión $VERSION desde cero."
  EXISTENTE=0; REINSTALADO=1
}
if [ $EXISTENTE = 1 ] && [ $ACTUALIZAR_SISTEMA = 1 ]; then
  ACTUALIZACION=1
elif [ $EXISTENTE = 1 ] && [ $REINSTALAR = 1 ]; then
  reinstalar_desde_cero
elif [ $EXISTENTE = 1 ]; then
  echo "  Se detectó el Sistema UVA (backend Odoo) instalado en $DESTINO."
  r="$(dialogo "Se detectó el Sistema UVA ya instalado en $DESTINO. ¿Qué desea hacer?

  Actualizar todo:       instala la versión $VERSION en la web, Odoo y la app. Respalda la base
                         y conserva clientes, visitas y usuarios.
  Reinstalar desde cero: guarda un respaldo en Documentos, borra la instalación anterior con
                         todos sus datos e instala la versión nueva limpia.
  Solo la app:           actualiza solo la app de campo; la web, Odoo y los datos no cambian.
  Cancelar:              salir sin hacer cambios." 'Actualizar todo,Reinstalar desde cero,Solo la app,Cancelar' 'Actualizar todo')"
  case "$r" in
    'Actualizar todo') ACTUALIZACION=1 ;;
    'Reinstalar desde cero') reinstalar_desde_cero ;;
    'Solo la app') SOLO_APP=1 ;;
    *) salir 0 ;;
  esac
fi
if [ $EXISTENTE = 0 ]; then
  [ "${REINSTALADO:-0}" = 1 ] || echo '  No se encontró el Sistema UVA en este equipo: se instalará completo (Odoo, base de datos, web y app de campo).'
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
copiar_archivo() {  # reemplaza el archivo (lo borra antes, también si quedó de solo lectura)
  [ -e "$1" ] || return 0
  mkdir -p "$(dirname "$2")"; rm -f "$2"; cp "$1" "$2"
}
error_copia=0
if [ $SOLO_APP = 1 ]; then
  # Solo la app de campo, sus módulos de Odoo, la configuración del gateway y los scripts de administración.
  # Si falta algo indispensable (p. ej. tras una actualización interrumpida), se repone desde el paquete
  for d in backend/services backend/gateway backend/odoo/addons dist; do
    if [ -d "$CONTENIDO/$d" ] && [ ! -d "$DESTINO/$d" ]; then
      echo "  Reponiendo $d (faltaba en la instalación)."; mkdir -p "$(dirname "$DESTINO/$d")"
      cp -R "$CONTENIDO/$d" "$DESTINO/$d" || error_copia=1
    fi
  done
  for f in backend/docker-compose.yml backend/gateway/nginx.conf; do
    [ -e "$DESTINO/$f" ] || copiar_archivo "$CONTENIDO/$f" "$DESTINO/$f" || error_copia=1
  done
  rm -rf "$DESTINO/app" "$DESTINO/backend/odoo/addons/uva_app_movil" "$DESTINO/backend/odoo/addons/uva_sesion_web"
  cp -R "$CONTENIDO/app" "$DESTINO/app" || error_copia=1
  for m in uva_app_movil uva_sesion_web; do
    [ -d "$CONTENIDO/backend/odoo/addons/$m" ] && { cp -R "$CONTENIDO/backend/odoo/addons/$m" "$DESTINO/backend/odoo/addons/$m" || error_copia=1; }
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
  rm -f "$DESTINO/uva.sh"
  cp -R "$CONTENIDO/." "$DESTINO/" || error_copia=1
  rm -f "$DESTINO/version.txt"
  [ -n "$conf_guardada" ] && printf '%s\n' "$conf_guardada" > "$conf"
  # Se conserva la configuración (contraseña maestra); solo se sube el valor anterior de procesos (2 -> 4).
  [ -f "$conf" ] && sed -i.bak 's/^workers = 2$/workers = 4/' "$conf" && rm -f "$conf.bak"
fi
chmod +x "$UVA" 2>/dev/null
rm -f "$DESTINO/LEEME.txt"   # reemplazado por el manual en PDF
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
  echo "  No se pudieron copiar todos los archivos a $DESTINO.$faltan"
  echo '  Revise los permisos de esa carpeta y vuelva a ejecutar el instalador. La base de datos no se modificó.'
  salir 1
fi
ok 'Archivos copiados.'

# ------------------------------------------------------------------ instalar / actualizar
args=()
if [ $SOLO_APP = 1 ]; then args=(agregar-app)
elif [ $ACTUALIZACION = 1 ]; then args=(actualizar)
else args=(instalar); [ "$DEMO" = si ] && args+=(--demo); fi
[ "$SILENCIOSO" = 1 ] && args+=(--silencioso)
if [ $COMO_GRUPO = 1 ]; then
  # El permiso del grupo docker aplica a esta sesión solo a través de «sg»; tras cerrar sesión ya no hace falta.
  sg docker -c "$(printf '%q ' bash "$UVA" "${args[@]}")"; r=$?
else
  bash "$UVA" "${args[@]}"; r=$?
fi
if [ $r != 0 ]; then
  echo "  La instalación no terminó. Revise la bitácora en $DESTINO/logs"
  echo '  Puede reintentar ejecutando de nuevo este instalador: retoma sin perder lo avanzado.'
  salir 1
fi

if [ $SIN_ABRIR != 1 ] && [ "$SILENCIOSO" != 1 ]; then
  bash "$UVA" abrir
  command -v xdg-open >/dev/null 2>&1 && xdg-open "$DESTINO/CREDENCIALES.txt" >/dev/null 2>&1 &
fi
if [ $SOLO_APP = 1 ]; then final='La app de campo quedó agregada al Sistema UVA (el backend y sus datos no se modificaron).'
else final="Sistema UVA $VERSION quedó instalado (web, app de campo y backend Odoo)."; fi
printf '\n  \033[32m%s\033[0m\n' "$final"
echo '  Ábralo con los accesos «Sistema UVA» y «App de campo Asercontrol» del escritorio o del menú de aplicaciones.'
echo "  Direcciones, datos de acceso y cómo preparar las tablets: $DESTINO/CREDENCIALES.txt"
if [ $COMO_GRUPO = 1 ]; then
  aviso 'Cierre sesión y vuelva a entrar para que los accesos directos puedan usar Docker.'
fi
salir 0
