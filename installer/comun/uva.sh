#!/bin/bash
# Sistema UVA en Mac y Linux (Ubuntu): administra la instalación local
# (Docker + Odoo 19 + microservicios + gateway + app de campo).
#
# Uso:  ./uva.sh <acción> [--demo] [--silencioso] [--eliminar-datos] [--conservar-certificado]
#   instalar             Crea la base de datos (con --demo: datos de demostración) y levanta todo.
#   agregar-app          Agrega o actualiza la app de campo en un sistema ya instalado (no toca los datos).
#   actualizar           Aplica la versión copiada: respalda, actualiza módulos y reinicia servicios.
#   iniciar | detener | estado
#   abrir | abrir-odoo | abrir-app
#   respaldar            Base de datos y archivos adjuntos en ./respaldos/<fecha>
#   renovar-clave        Nueva clave API para los microservicios
#   regenerar-certificado  Nuevo certificado HTTPS de la app (p. ej. si cambió la IP); la CA se conserva
#   desinstalar          Quita el sistema (pregunta si conservar los datos)
#   --pausa              Al terminar espera Enter (accesos directos de Linux que abren una terminal)
#
# Compatible con el bash 3.2 de macOS (sin arreglos asociativos ni ${var,,}).

set -u
RAIZ="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$RAIZ/backend"
ENV_FILE="$BACKEND/.env"
PROYECTO="${UVA_PROYECTO:-sistema-uva}"
COMPOSE_ARCHIVOS='docker-compose.yml:docker-compose.app.yml'   # el segundo publica la app de campo
CERT_TABLETS='Certificado-tablets-Asercontrol.crt'
ES_MAC=0; [ "$(uname -s)" = "Darwin" ] && ES_MAC=1
if [ "$ES_MAC" = 1 ]; then
  CONFIG_DIR="$HOME/Library/Application Support/SistemaUVA"
else
  CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/sistema-uva"
fi
ENV_RESPALDO="$CONFIG_DIR/configuracion.env"
# Autoridad certificadora local (la de las tablets): se conserva al desinstalar sin borrar datos y se
# reutiliza al reinstalar, para que las tablets no tengan que instalar otro certificado.
CA_RESPALDO="$CONFIG_DIR/ca"
ACCESOS_DIR="$HOME/Applications/Sistema UVA"
AGENTE="$HOME/Library/LaunchAgents/mx.asercontrol.sistemauva.plist"
DOCKER_NOMBRE='Docker Desktop'
if [ "$ES_MAC" != 1 ]; then
  DOCKER_NOMBRE='Docker'
  ACCESOS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"   # menú de aplicaciones (.desktop)
  AGENTE="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/sistema-uva.desktop"
fi
DIAS_CLAVE=365
# Verificador de campo que se crea al instalar (la app lo trae prellenado); se crea solo si no existe.
USUARIO_CAMPO='jhovani.coss@asercontrol.com'
CLAVE_CAMPO='asercontrol123456'

ACCION="${1:-estado}"; shift || true
DEMO=0; SILENCIOSO=0; ELIMINAR_DATOS=0; PAUSA=0; CONSERVAR_CA=0
for a in "$@"; do
  case "$a" in
    --demo) DEMO=1 ;;
    --pausa) PAUSA=1 ;;
    --silencioso) SILENCIOSO=1 ;;
    --eliminar-datos) ELIMINAR_DATOS=1 ;;
    --conservar-certificado) CONSERVAR_CA=1 ;;
  esac
done

# ----------------------------------------------------------------------------- utilidades
paso()  { printf '\n\033[36m> %s\033[0m\n' "$*"; }
ok()    { printf '  \033[32mOK\033[0m  %s\n' "$*"; }
aviso() { printf '  \033[33m!\033[0m   %s\n' "$*"; }
falla() { printf '\n  \033[31mERROR\033[0m  %s\n' "$*" >&2; exit 1; }
minus() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# Diálogos. macOS: ventanas de osascript. Linux: preguntas en la terminal o, sin terminal, ventanas de
# zenity. Devuelven el botón elegido; en modo silencioso (o sin forma de preguntar), el predeterminado.
hay_terminal() { { : </dev/tty; } 2>/dev/null; }
hay_zenity() { [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && command -v zenity >/dev/null 2>&1; }
puede_preguntar() { [ "$SILENCIOSO" != 1 ] && { [ "$ES_MAC" = 1 ] || hay_terminal || hay_zenity; }; }
dialogo() {  # dialogo "texto" "Botón1,Botón2" "Predeterminado"
  local texto="$1" botones="$2" pred="$3"
  if ! puede_preguntar; then printf '%s' "$pred"; return; fi
  if [ "$ES_MAC" = 1 ]; then
    local lista; lista="$(printf '%s' "$botones" | sed 's/[^,][^,]*/"&"/g; s/,/, /g')"
    osascript -e "button returned of (display dialog \"$(printf '%s' "$texto" | sed 's/"/\\"/g')\" with title \"Sistema UVA\" buttons {$lista} default button \"$pred\")" 2>/dev/null || printf 'Cancelar'
  elif hay_terminal; then
    pregunta_terminal "$texto" "$botones" "$pred"
  else
    pregunta_zenity "$texto" "$botones" "$pred"
  fi
}
pregunta_terminal() {  # opciones numeradas; Enter = predeterminada. Escribe en la terminal, no en la salida.
  local texto="$1" botones="$2" pred="$3" i n r opcion
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
pregunta_zenity() {  # Aceptar = predeterminado; Cancelar = primer botón; el resto, botones extra
  local texto="$1" botones="$2" pred="$3" primero opcion r
  local -a extra=()
  IFS=','; set -- $botones; unset IFS
  if [ $# = 1 ]; then zenity --info --title 'Sistema UVA' --no-wrap --text "$texto" 2>/dev/null; printf '%s' "$pred"; return; fi
  primero="$1"
  for opcion in "$@"; do [ "$opcion" != "$pred" ] && [ "$opcion" != "$primero" ] && extra+=(--extra-button "$opcion"); done
  if r="$(zenity --question --title 'Sistema UVA' --no-wrap --text "$texto" --ok-label "$pred" --cancel-label "$primero" ${extra[@]+"${extra[@]}"} 2>/dev/null)"; then
    printf '%s' "$pred"; return
  fi
  if [ -n "$r" ]; then printf '%s' "$r"; else printf '%s' "$primero"; fi
}
mensaje() {
  puede_preguntar || return 0
  if [ "$ES_MAC" = 1 ]; then
    osascript -e "display dialog \"$(printf '%s' "$1" | sed 's/"/\\"/g')\" with title \"Sistema UVA\" buttons {\"OK\"} default button \"OK\"" >/dev/null 2>&1 || true
  elif hay_terminal; then printf '\n  %s\n' "$1" >/dev/tty
  else zenity --info --title 'Sistema UVA' --no-wrap --text "$1" 2>/dev/null || true; fi
}
carpeta_usuario() {  # carpeta_usuario DESKTOP|DOCUMENTS (en español: Escritorio, Documentos)
  local d=''; command -v xdg-user-dir >/dev/null 2>&1 && d="$(xdg-user-dir "$1" 2>/dev/null)"
  if [ -z "$d" ] || [ "$d" = "$HOME" ]; then
    case "$1" in
      DESKTOP) d="$HOME/Desktop"; [ -d "$HOME/Escritorio" ] && d="$HOME/Escritorio" ;;
      *) d="$HOME/Documents"; [ -d "$HOME/Documentos" ] && d="$HOME/Documentos" ;;
    esac
  fi
  printf '%s' "$d"
}
abrir_url() { if [ "$ES_MAC" = 1 ]; then open "$1"; elif command -v xdg-open >/dev/null; then xdg-open "$1" >/dev/null 2>&1 & else echo "$1"; fi; }

secreto() { LC_ALL=C tr -dc 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789' </dev/urandom | head -c "${1:-24}"; }

puerto_libre() {  # 0 si el puerto está libre
  local p="$1"
  # Puertos en escucha de cualquier usuario: ss (Linux) o netstat (Mac) los ven sin ser administrador;
  # lsof sin permisos no ve los de otros usuarios (root, Docker), por eso va al final.
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[]:.]$p\$" && return 1
  elif command -v netstat >/dev/null 2>&1; then
    netstat -an 2>/dev/null | grep -iE "^tcp" | grep -i listen | awk '{print $4}' | grep -qE "[]:.]$p\$" && return 1
  elif command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 && return 1
  fi
  # Puertos publicados por contenedores de Docker (también de otros proyectos). Ojo: [:\]] no sirve en grep
  # (la barra no escapa dentro de corchetes); el corchete de cierre va primero: []:]
  docker ps --format '{{.Ports}}' 2>/dev/null | grep -qE "[]:]$p->" && return 1
  return 0
}
puerto_desde() { local p="$1"; while [ "$p" -lt $(( $1 + 100 )) ]; do puerto_libre "$p" && { echo "$p"; return; }; p=$((p + 1)); done; falla "No hay puertos libres a partir de $1."; }

# Puertos ocupados al arrancar ---------------------------------------------------------------
# Si otro programa tomó un puerto del sistema (web, app de campo u Odoo), se cambia solo al siguiente
# libre, sin preguntar. Los teléfonos encuentran solos el puerto nuevo de la app (buscan en el mismo equipo).
uso_puerto() {  # uso_puerto <puerto>: vacío = libre; «propio» = el Sistema UVA; si no, quién lo usa
  local p="$1" linea proy nombre puertos quien=''
  while IFS='|' read -r proy nombre puertos; do
    printf '%s' "$puertos" | grep -qE "[]:]$p->" || continue
    if [ "$proy" = "$PROYECTO" ]; then echo propio; else echo "el contenedor «$nombre» de Docker"; fi
    return
  done <<EOF
$(docker ps --format '{{.Label "com.docker.compose.project"}}|{{.Names}}|{{.Ports}}' 2>/dev/null)
EOF
  puerto_libre "$p" && return
  if command -v lsof >/dev/null 2>&1; then
    quien="$(lsof -nP -iTCP:"$p" -sTCP:LISTEN -Fcp 2>/dev/null | awk '/^p/{pid=substr($0,2)} /^c/{print substr($0,2) " (PID " pid ")"; exit}')"
  fi
  if [ -z "$quien" ] && command -v ss >/dev/null 2>&1; then
    quien="$({ ss -ltnpH "sport = :$p" 2>/dev/null; sudo -n ss -ltnpH "sport = :$p" 2>/dev/null; } | sed -n 's/.*users:(("\([^"]*\)",pid=\([0-9]*\).*/\1 (PID \2)/p' | head -1)"
  fi
  # Docker publicando los puertos del sistema mientras arranca sus contenedores
  case "$quien" in com.docker*|docker-proxy*|vpnkit*|Docker*|rootlesskit*) echo propio; return ;; esac
  if [ -n "$quien" ]; then echo "«${quien% (PID*}» (PID ${quien##*PID })" | sed 's/))$/)/'; else echo 'otro programa'; fi
}

PUERTOS_CAMBIADOS=''
resolver_puertos() {
  local clave desc actual nuevo quien usados
  PUERTOS_CAMBIADOS=''
  usados=" $(leer_env GATEWAY_PORT) $(leer_env APP_PORT) $(leer_env ODOO_PORT) "
  for par in 'GATEWAY_PORT|web del Sistema UVA' 'APP_PORT|app de campo' 'ODOO_PORT|administrador de Odoo'; do
    clave="${par%%|*}"; desc="${par#*|}"
    actual="$(leer_env "$clave")"
    [ -n "$actual" ] || continue
    quien="$(uso_puerto "$actual")"
    { [ -z "$quien" ] || [ "$quien" = propio ]; } && continue
    nuevo=$((actual + 1))
    while :; do
      nuevo="$(puerto_desde "$nuevo")"
      case "$usados" in *" $nuevo "*) nuevo=$((nuevo + 1)) ;; *) break ;; esac
    done
    set_env "$clave" "$nuevo"
    usados="$usados$nuevo "
    PUERTOS_CAMBIADOS="$PUERTOS_CAMBIADOS $clave"
    aviso "El puerto $actual ($desc) lo está usando $quien: el Sistema UVA usa ahora el $nuevo."
  done
}

completar_cambio_puertos() {
  # Tras levantar los servicios con los puertos nuevos: dirección de los enlaces de correo (web), datos de
  # acceso y descargas de la app (QR de la página «App de campo (móvil)»).
  [ -n "$PUERTOS_CAMBIADOS" ] || return 0
  case "$PUERTOS_CAMBIADOS" in *GATEWAY_PORT*) actualizar_clave_api; compose up -d --wait ;; esac
  escribir_credenciales
  ok "Puertos actualizados: $(url_sistema) · app $(url_app). Los teléfonos encuentran solos el puerto nuevo."
}

# .env --------------------------------------------------------------------------------------
leer_env() { [ -f "$ENV_FILE" ] && sed -n "s/^$1=//p" "$ENV_FILE" | head -1; }
set_env() {
  local clave="$1" valor="$2" tmp
  tmp="$(mktemp)"
  if [ -f "$ENV_FILE" ] && grep -q "^$clave=" "$ENV_FILE"; then
    awk -v k="$clave" -v v="$valor" 'BEGIN{FS=OFS="="} $1==k {print k "=" v; next} {print}' "$ENV_FILE" > "$tmp"
  else
    { [ -f "$ENV_FILE" ] && cat "$ENV_FILE"; echo "$clave=$valor"; } > "$tmp"
  fi
  mv "$tmp" "$ENV_FILE"; chmod 600 "$ENV_FILE"
  mkdir -p "$CONFIG_DIR"; cp "$ENV_FILE" "$ENV_RESPALDO"; chmod 600 "$ENV_RESPALDO"
}

inicializar_env() {
  [ -f "$ENV_FILE" ] && return
  if [ -f "$ENV_RESPALDO" ]; then
    aviso 'Se encontró la configuración de una instalación anterior: se reutiliza (contraseñas y datos).'
    cp "$ENV_RESPALDO" "$ENV_FILE"; chmod 600 "$ENV_FILE"; return
  fi
  local odoo gw app
  odoo="$(puerto_desde 8069)"; gw="$(puerto_desde 8080)"
  [ "$gw" = "$odoo" ] && gw="$(puerto_desde $((odoo + 1)))"
  app="$(puerto_desde 8443)"
  ( umask 077; cat > "$ENV_FILE" ) <<EOF
# Sistema UVA - configuración generada por el instalador. NO compartir: contiene contraseñas.
COMPOSE_PROJECT_NAME=$PROYECTO
COMPOSE_FILE=$COMPOSE_ARCHIVOS
COMPOSE_PATH_SEPARATOR=:
APP_PORT=$app
ODOO_DB=uva
POSTGRES_PASSWORD=$(secreto)
ODOO_PORT=$odoo
GATEWAY_PORT=$gw
ODOO_ADMIN_PASSWORD=$(secreto 16)
ODOO_MASTER_PASSWORD=$(secreto)
UVA_DEMO=$DEMO
UVA_SIN_INTERNET=0
ODOO_API_KEY=
ODOO_API_KEY_EXPIRA=
EOF
  mkdir -p "$CONFIG_DIR"; cp "$ENV_FILE" "$ENV_RESPALDO"
  ok "Puertos asignados: sistema $gw, Odoo $odoo, app de campo $app."
}

inicializar_config_app() {
  # La carpeta de descargas se crea antes de levantar el gateway: si Docker la creara al montarla,
  # en Linux quedaría a nombre de root y el instalador ya no podría escribir en ella.
  mkdir -p "$RAIZ/descargas"
  # Instalaciones anteriores a la app de campo: puerto y archivo de compose que la publica.
  if [ -z "$(leer_env APP_PORT)" ]; then set_env APP_PORT "$(puerto_desde 8443)"; fi
  [ "$(leer_env COMPOSE_FILE)" = "$COMPOSE_ARCHIVOS" ] || set_env COMPOSE_FILE "$COMPOSE_ARCHIVOS"
  [ "$(leer_env COMPOSE_PATH_SEPARATOR)" = ":" ] || set_env COMPOSE_PATH_SEPARATOR ":"
}

fijar_clave_maestra() {
  local maestra conf tmp; maestra="$(leer_env ODOO_MASTER_PASSWORD)"; conf="$BACKEND/odoo/config/odoo.conf"
  [ -n "$maestra" ] || return 0
  tmp="$(mktemp)"; sed "s/^admin_passwd[[:space:]]*=.*/admin_passwd = $maestra/" "$conf" > "$tmp" && cat "$tmp" > "$conf"; rm -f "$tmp"
}

# Docker ------------------------------------------------------------------------------------
docker_listo() { docker info >/dev/null 2>&1; }
asegurar_docker() {
  if [ "$ES_MAC" = 1 ]; then
    command -v docker >/dev/null 2>&1 || falla 'Docker Desktop no está instalado. Descárguelo de https://www.docker.com/products/docker-desktop/ e intente de nuevo.'
  else
    command -v docker >/dev/null 2>&1 || falla 'Docker no está instalado. Ejecute de nuevo el instalador del Sistema UVA (ofrece instalarlo) o: sudo apt install docker.io docker-compose-v2'
  fi
  if docker_listo; then
    docker compose version >/dev/null 2>&1 || falla 'Falta Docker Compose. En Ubuntu: sudo apt install docker-compose-v2'
    return
  fi
  if [ "$ES_MAC" = 1 ]; then
    paso 'Iniciando Docker Desktop (puede tardar un par de minutos)...'; open -a Docker >/dev/null 2>&1 || true
  else
    if docker info 2>&1 | grep -qi 'permission denied'; then
      falla "Su usuario no tiene permiso para usar Docker. Ejecute:  sudo usermod -aG docker $USER  y cierre e inicie sesión de nuevo."
    fi
    paso 'Iniciando el servicio de Docker'
    if [ "$SILENCIOSO" = 1 ]; then sudo -n systemctl start docker >/dev/null 2>&1 || true
    else sudo systemctl start docker || true; fi
  fi
  local i=0
  while [ $i -lt 60 ]; do sleep 5; docker_listo && { ok "$DOCKER_NOMBRE está listo."; return; }; printf '.'; i=$((i + 1)); done
  if [ "$ES_MAC" = 1 ]; then falla 'Docker Desktop no respondió. Ábralo, espere a que diga "Engine running" y vuelva a intentar.'
  else falla 'Docker no respondió. Revise el servicio con:  sudo systemctl status docker'; fi
}
compose() { (cd "$BACKEND" && docker compose "$@") || falla "docker compose $* terminó con error."; }

odoo_shell() {  # odoo_shell "<código python>"
  local db archivo salida
  db="$(leer_env ODOO_DB)"
  archivo="$BACKEND/.uva-shell-$$.py"
  printf '%s\n' "$1" > "$archivo"
  chmod 644 "$archivo"   # el usuario odoo del contenedor debe poder leerlo
  # shellcheck disable=SC2016  # $0, $HOST... los expande el sh del contenedor
  salida="$(cd "$BACKEND" && docker compose run --rm -T -v "$archivo:/tmp/uva-shell.py:ro" --entrypoint sh odoo \
    -c 'odoo shell -d "$0" --db_host "$HOST" --db_user "$USER" --db_password "$PASSWORD" --no-http --log-level=warn < /tmp/uva-shell.py' "$db" 2>&1)"
  local r=$?
  rm -f "$archivo"
  [ $r -eq 0 ] || { echo "$salida"; falla 'Falló la consola de Odoo.'; }
  printf '%s' "$salida"
}

base_existe() {
  local db; db="$(leer_env ODOO_DB)"
  [ "$(cd "$BACKEND" && docker compose exec -T db psql -U odoo -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" 2>/dev/null | tr -d '[:space:]')" = "1" ]
}

importar_imagenes() {
  # Paquete sin internet: imágenes de Docker en ./imagenes/ (docker save comprimido).
  local dir="$RAIZ/imagenes" a
  ls "$dir"/*.tar* >/dev/null 2>&1 || return 0
  paso 'Cargando las imágenes de Docker incluidas (no se descarga nada)...'
  for a in "$dir"/*.tar*; do docker load -i "$a" || falla "No se pudo cargar $(basename "$a")."; done
  [ -f "$dir/servicios.txt" ] && set_env UVA_SVC_IMAGE "$(tr -d '[:space:]' < "$dir/servicios.txt")"
  set_env UVA_SIN_INTERNET 1
  rm -rf "$dir"
  ok 'Imágenes cargadas.'
}
opciones_arranque() { if [ "$(leer_env UVA_SIN_INTERNET)" = "1" ]; then echo '--no-build --pull never'; else echo '--no-build'; fi; }
# Los 6 microservicios comparten una imagen: se construye una sola vez. Sin buildx (docker.io de Ubuntu),
# construirla en paralelo para cada servicio choca («image ... already exists»).
construir_servicios() { [ "$(leer_env UVA_SIN_INTERNET)" = "1" ] || compose build svc-catalogos; }

# Red y certificado -------------------------------------------------------------------------
nombre_equipo() {
  if [ "$ES_MAC" = 1 ]; then minus "$(scutil --get LocalHostName 2>/dev/null || hostname -s).local"; else minus "$(hostname -s)"; fi
}
ips_equipo() {
  if [ "$ES_MAC" = 1 ]; then
    ifconfig 2>/dev/null | awk '/inet / && $2 !~ /^127\./ && $2 !~ /^169\.254\./ {print $2}'
  else
    hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.' | grep -vE '^(127|169\.254|172\.(1[7-9]|2[0-9]|3[01]))\.'
  fi
}

inicializar_certificados() {  # [forzar]
  local dir="$BACKEND/certs" alt ip nombre
  # Respaldo de la CA también en instalaciones que ya la tenían (antes no se respaldaba)
  if [ -f "$dir/ca.key" ] && [ ! -f "$CA_RESPALDO/ca.key" ]; then
    ( umask 077; mkdir -p "$CA_RESPALDO" ) && cp "$dir/ca.crt" "$dir/ca.key" "$CA_RESPALDO/" 2>/dev/null && chmod 600 "$CA_RESPALDO/ca.key"
  fi
  if [ "${1:-}" != "forzar" ] && [ -f "$dir/servidor-cadena.crt" ]; then return; fi
  mkdir -p "$dir"
  if [ ! -f "$dir/ca.crt" ] && [ -f "$CA_RESPALDO/ca.key" ]; then
    cp "$CA_RESPALDO/ca.crt" "$CA_RESPALDO/ca.key" "$dir/"
    ok 'Se reutiliza la autoridad certificadora anterior: las tablets no necesitan reinstalar el certificado.'
  fi
  nombre="$(nombre_equipo)"
  alt="DNS:localhost,DNS:$nombre,DNS:${nombre%.local},IP:127.0.0.1"
  [ "$ES_MAC" = 1 ] || alt="$alt,DNS:$nombre.local"
  for ip in $(ips_equipo); do alt="$alt,IP:$ip"; done
  printf 'basicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=%s\n' "$alt" > "$dir/servidor.ext"
  cat > "$dir/generar.sh" <<EOF
set -e
cd /c
if [ ! -f ca.crt ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/O=Asercontrol/CN=Asercontrol CA local" -keyout ca.key -out ca.crt -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
fi
openssl req -newkey rsa:2048 -nodes -subj "/O=Asercontrol/CN=$nombre" -keyout servidor.key -out servidor.csr 2>/dev/null
openssl x509 -req -in servidor.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 825 -sha256 -extfile servidor.ext -out servidor.crt 2>/dev/null
cat servidor.crt ca.crt > servidor-cadena.crt
rm -f servidor.csr ca.srl
chmod 644 servidor.key
# Los archivos quedan a nombre del usuario (en Linux, root dentro del contenedor los crearía como root)
chown $(id -u):$(id -g) ca.crt ca.key servidor.key servidor.crt servidor-cadena.crt
EOF
  paso 'Generando el certificado HTTPS de la app de campo'
  # openssl viene en la imagen de Odoo (ya cargada o descargada para el sistema).
  docker run --rm --user root -v "$dir:/c" --entrypoint sh odoo:19.0 /c/generar.sh || falla 'No se pudo generar el certificado HTTPS.'
  [ -f "$dir/servidor-cadena.crt" ] || falla 'No se pudo generar el certificado HTTPS.'
  rm -f "$dir/generar.sh" "$dir/servidor.ext"
  cp "$dir/ca.crt" "$RAIZ/$CERT_TABLETS"
  ( umask 077; mkdir -p "$CA_RESPALDO" ) && cp "$dir/ca.crt" "$dir/ca.key" "$CA_RESPALDO/" && chmod 600 "$CA_RESPALDO/ca.key"
  ok "Certificado para: $(printf '%s' "$alt" | sed 's/DNS://g; s/IP://g; s/,/, /g')"
  # En este Mac, confiar en la CA para abrir la app sin advertencias (macOS pide la contraseña).
  if [ "$ES_MAC" = 1 ] && [ "$SILENCIOSO" != 1 ]; then
    if security add-trusted-cert -r trustRoot -k "$HOME/Library/Keychains/login.keychain-db" "$dir/ca.crt" 2>/dev/null; then
      ok 'Certificado de confianza instalado en este Mac.'
    else
      aviso 'No se instaló el certificado en este Mac; el navegador mostrará una advertencia.'
    fi
  fi
  if [ "$ES_MAC" != 1 ] && [ "$SILENCIOSO" != 1 ]; then confiar_ca_linux "$dir/ca.crt"; fi
}

# Linux: la CA local en el sistema (curl, apps) y en la base NSS de Chrome/Chromium del usuario.
CA_SISTEMA='/usr/local/share/ca-certificates/asercontrol-ca-local.crt'
bases_nss() {
  printf '%s\n' "$HOME/.pki/nssdb"
  [ -d "$HOME/snap/chromium" ] && printf '%s\n' "$HOME/snap/chromium/current/.pki/nssdb"
  return 0
}
confiar_ca_linux() {
  local ca="$1" d
  paso 'Instalando el certificado «Asercontrol CA local» en este equipo (puede pedir su contraseña)'
  if command -v update-ca-certificates >/dev/null 2>&1 && sudo install -m 644 "$ca" "$CA_SISTEMA" && sudo update-ca-certificates >/dev/null 2>&1; then
    ok 'Certificado de confianza instalado en el sistema.'
  else
    aviso 'No se instaló el certificado en el sistema.'
  fi
  if ! command -v certutil >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    sudo apt-get install -y -qq libnss3-tools >/dev/null 2>&1 || true
  fi
  if command -v certutil >/dev/null 2>&1; then
    for d in $(bases_nss); do
      mkdir -p "$d"
      [ -f "$d/cert9.db" ] || certutil -d "sql:$d" -N --empty-password >/dev/null 2>&1
      certutil -d "sql:$d" -D -n 'Asercontrol CA local' >/dev/null 2>&1 || true
      certutil -d "sql:$d" -A -t 'C,,' -n 'Asercontrol CA local' -i "$ca" >/dev/null 2>&1
    done
    ok 'Chrome/Chromium confiarán en la app de campo (reinicie el navegador si estaba abierto).'
  else
    aviso 'Sin certutil (paquete libnss3-tools): Chrome mostrará una advertencia la primera vez.'
  fi
}
quitar_ca_linux() {
  local d
  if [ -f "$CA_SISTEMA" ]; then sudo rm -f "$CA_SISTEMA" && sudo update-ca-certificates --fresh >/dev/null 2>&1 || true; fi
  if command -v certutil >/dev/null 2>&1; then
    for d in $(bases_nss); do certutil -d "sql:$d" -D -n 'Asercontrol CA local' >/dev/null 2>&1 || true; done
  fi
}

# Odoo --------------------------------------------------------------------------------------
instalar_modulos_app() {
  # Módulos de la app de campo y del inicio de sesión web: instala o actualiza; no toca otros módulos ni datos.
  local db modulo estado; db="$(leer_env ODOO_DB)"
  for modulo in uva_app_movil uva_sesion_web; do
    [ -d "$BACKEND/odoo/addons/$modulo" ] || continue
    estado="$(odoo_shell "m = env['ir.module.module'].search([('name', '=', '$modulo')])
print('UVA_MOD_ESTADO=' + (m.state or 'ninguno'))" | sed -n 's/.*UVA_MOD_ESTADO=\([a-z_]*\).*/\1/p' | tail -1)"
    if [ "$estado" = "installed" ]; then
      paso "Actualizando el módulo $modulo en Odoo"; compose run --rm odoo odoo -d "$db" -u "$modulo" --stop-after-init --no-http
    else
      paso "Instalando el módulo $modulo en Odoo"; compose run --rm odoo odoo -d "$db" -i "$modulo" --stop-after-init --no-http
    fi
  done
}

asegurar_usuario_campo() {
  # Verificador de la app de campo (prellenado en la app): se crea con su usuario de Odoo solo si no existe;
  # a uno existente nunca le cambia la contraseña.
  local salida
  salida="$(odoo_shell "Users = env['res.users'].sudo().with_context(no_reset_password=True)
jc = Users.with_context(active_test=False).search([('login', '=', '$USUARIO_CAMPO')], limit=1)
if not jc:
    grupos = [env.ref('base.group_user').id, env.ref('uva_core.group_uva_inspector').id]
    jc = Users.create({'name': 'Eduardo Jhovani Jaime Coss', 'login': '$USUARIO_CAMPO',
                       'email': '$USUARIO_CAMPO', 'password': '$CLAVE_CAMPO',
                       'lang': 'es_MX', 'tz': 'America/Mexico_City', 'group_ids': [(6, 0, grupos)]})
Ver = env['uva.verificador'].sudo().with_context(active_test=False)
if not Ver.search([('user_id', '=', jc.id)], limit=1):
    ver = Ver.search([('email', '=ilike', '$USUARIO_CAMPO'), ('user_id', '=', False)], limit=1)
    if ver:
        ver.user_id = jc.id
    else:
        code, n = 'JC', 1
        while Ver.search_count([('code', '=', code)]):
            n += 1; code = 'JC%d' % n
        Ver.create({'name': 'Eduardo Jhovani Jaime Coss', 'code': code, 'user_id': jc.id,
                    'email': '$USUARIO_CAMPO', 'estado': 'activo'})
env.cr.commit()
print('UVA_CAMPO_OK')")"
  if printf '%s' "$salida" | grep -q UVA_CAMPO_OK; then ok "Usuario de la app de campo listo: $USUARIO_CAMPO"
  else echo "$salida"; aviso "No se pudo crear el usuario $USUARIO_CAMPO."; fi
}

actualizar_clave_api() {  # [fijar_admin]
  local admin_pw='' base_url salida clave vence
  [ "${1:-}" = "fijar_admin" ] && admin_pw="$(leer_env ODOO_ADMIN_PASSWORD)"
  base_url="http://$(nombre_equipo):$(leer_env GATEWAY_PORT)"
  salida="$(odoo_shell "from datetime import timedelta
from odoo import fields
admin = env.ref('base.user_admin')
vals = {'lang': 'es_MX', 'tz': 'America/Mexico_City'}
if '$admin_pw':
    vals['password'] = '$admin_pw'
admin.write(vals)
ICP = env['ir.config_parameter'].sudo()
ICP.set_param('web.base.url', '$base_url')
ICP.set_param('web.base.url.freeze', 'True')
actual = ICP.get_param('uva.usuario_actual', 'gtorres')
if not env['res.users'].sudo().search([('login', '=', actual)], limit=1):
    ICP.set_param('uva.usuario_actual', 'admin')
Users = env['res.users'].sudo().with_context(no_reset_password=True)
user = Users.search([('login', '=', 'api_uva')], limit=1)
if not user:
    grupos = [env.ref('base.group_user').id, env.ref('uva_core.group_uva_admin').id]
    user = Users.create({'name': 'API Sistema UVA', 'login': 'api_uva', 'email': 'api_uva@localhost',
                         'tz': 'America/Mexico_City', 'group_ids': [(6, 0, grupos)],
                         'uva_usuario_tecnico': True})
Keys = env['res.users.apikeys']
Keys.sudo().search([('user_id', '=', user.id), ('name', '=', 'microservicios')]).unlink()
vence = fields.Datetime.now() + timedelta(days=$DIAS_CLAVE)
key = Keys.with_user(user).sudo()._generate(None, 'microservicios', vence)
env.cr.commit()
print('UVA_API_KEY=' + key)
print('UVA_API_KEY_EXPIRA=' + vence.strftime('%Y-%m-%d'))")"
  clave="$(printf '%s' "$salida" | sed -n 's/.*UVA_API_KEY=\([0-9a-f]*\).*/\1/p' | tail -1)"
  vence="$(printf '%s' "$salida" | sed -n 's/.*UVA_API_KEY_EXPIRA=\([0-9-]*\).*/\1/p' | tail -1)"
  [ -n "$clave" ] || { echo "$salida"; falla 'No se pudo generar la clave API de los microservicios.'; }
  set_env ODOO_API_KEY "$clave"; set_env ODOO_API_KEY_EXPIRA "$vence"
  ok "Clave API de los microservicios generada (vence el $vence)."
}

url_sistema() { echo "http://localhost:$(leer_env GATEWAY_PORT)"; }
url_odoo()    { echo "http://localhost:$(leer_env ODOO_PORT)"; }
url_app()     { echo "https://localhost:$(leer_env APP_PORT)"; }
urls_app_red() {
  local p ip lista; p="$(leer_env APP_PORT)"; lista=''
  for ip in $(ips_equipo); do lista="$lista  https://$ip:$p"; done
  echo "$lista  https://$(nombre_equipo):$p"
}

texto_firewall() {
  if [ "$ES_MAC" = 1 ]; then
    printf '  Firewall del Mac: si está activado, permite las conexiones entrantes de Docker\n    (Ajustes del Sistema > Red > Firewall > Opciones).'
  else
    printf '  Firewall: Docker publica los puertos directamente (ufw no los bloquea). Si las tablets no\n    conectan, revisa que estén en la misma red y la dirección (https:// y puerto).'
  fi
}

# Descargas para instalar la app de campo en teléfonos y tablets (las publica la web en /descargas/):
# certificado de la CA para Android, perfil de configuración para iPhone/iPad y las direcciones.
sha256_hex() { if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1; else shasum -a 256 | cut -d' ' -f1; fi; }
publicar_descargas() {
  local dir="$RAIZ/descargas" ca="$BACKEND/certs/ca.crt" b64 hex u1 u2 ip app='' web=''
  mkdir -p "$dir"
  if [ ! -w "$dir" ]; then
    # Instalaciones donde Docker creó la carpeta como root (Linux): se recupera con sudo
    sudo -n chown -R "$(id -u):$(id -g)" "$dir" 2>/dev/null || sudo chown -R "$(id -u):$(id -g)" "$dir" || return 1
  fi
  if [ -f "$ca" ]; then
    cp "$ca" "$dir/Certificado-Android-Asercontrol.crt"
    b64="$(sed '/-----/d' "$ca" | tr -d '\r\n')"
    hex="$(printf '%s' "$b64" | base64 -d 2>/dev/null | sha256_hex)"
    [ -n "$hex" ] || hex="$(printf '%s' "$b64" | sha256_hex)"
    hex="$(printf '%s' "$hex" | tr '[:lower:]' '[:upper:]')"
    u1="$(printf '%s' "$hex" | sed -E 's/^(.{8})(.{4})(.{4})(.{4})(.{12}).*/\1-\2-\3-\4-\5/')"
    u2="$(printf '%s' "$hex" | cut -c33-64 | sed -E 's/^(.{8})(.{4})(.{4})(.{4})(.{12}).*/\1-\2-\3-\4-\5/')"
    cat > "$dir/Certificado-iPhone-iPad-Asercontrol.mobileconfig" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadCertificateFileName</key><string>Asercontrol-CA-local.cer</string>
      <key>PayloadContent</key><data>$b64</data>
      <key>PayloadDescription</key><string>Autoridad certificadora local del Sistema UVA</string>
      <key>PayloadDisplayName</key><string>Asercontrol CA local</string>
      <key>PayloadIdentifier</key><string>mx.asercontrol.sistemauva.ca.certificado</string>
      <key>PayloadType</key><string>com.apple.security.root</string>
      <key>PayloadUUID</key><string>$u1</string>
      <key>PayloadVersion</key><integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key><string>Permite abrir e instalar la app de campo Asercontrol desde el servidor de la oficina.</string>
  <key>PayloadDisplayName</key><string>Asercontrol - App de campo</string>
  <key>PayloadIdentifier</key><string>mx.asercontrol.sistemauva.ca</string>
  <key>PayloadOrganization</key><string>Asercontrol</string>
  <key>PayloadRemovalDisallowed</key><false/>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadUUID</key><string>$u2</string>
  <key>PayloadVersion</key><integer>1</integer>
</dict>
</plist>
EOF
  fi
  # La app se instala desde el navegador (PWA); el APK ya no se distribuye (se quita el de versiones anteriores)
  rm -f "$dir/Asercontrol-Campo.apk" "$RAIZ/Asercontrol-Campo.apk"
  for ip in $(ips_equipo); do
    app="$app\"https://$ip:$(leer_env APP_PORT)\", "; web="$web\"http://$ip:$(leer_env GATEWAY_PORT)\", "
  done
  app="$app\"https://$(nombre_equipo):$(leer_env APP_PORT)\""; web="$web\"http://$(nombre_equipo):$(leer_env GATEWAY_PORT)\""
  printf '{\n  "app": [%s],\n  "web": [%s],\n  "generado": "%s"\n}\n' "$app" "$web" "$(date '+%Y-%m-%dT%H:%M:%S')" > "$dir/app-movil.json"
  chmod -R a+rX "$dir"
}

escribir_credenciales() {
  cat > "$RAIZ/CREDENCIALES.txt" <<EOF
SISTEMA UVA - DATOS DE ACCESO
Generado: $(date '+%Y-%m-%d %H:%M')

Sistema (usuarios):            $(url_sistema)
  Inicio de sesión con los usuarios de Odoo (correo o usuario y contraseña).
  Al principio: usuario admin con la contraseña de abajo; después crea un usuario por persona.
  «¿Olvidó su contraseña?» envía el enlace por correo: requiere configurar el servidor de
  correo saliente en Odoo (Ajustes > Técnico > Servidores de correo saliente).
Administrador de Odoo:         $(url_odoo)
  Usuario:                     admin
  Contraseña:                  $(leer_env ODOO_ADMIN_PASSWORD)
Contraseña maestra de Odoo:    $(leer_env ODOO_MASTER_PASSWORD)
  (gestión de bases de datos; guárdala en un lugar seguro)

App de campo (tablets de los verificadores):
  En este equipo:              $(url_app)
  Desde las tablets (misma red):$(urls_app_red)
  Usuarios: los de Odoo ligados a un verificador (Sistema UVA > Verificadores > Usuario).
  Verificador predeterminado:  $USUARIO_CAMPO / $CLAVE_CAMPO
    (también entra a la web; cambia su contraseña desde Odoo cuando quieras)
  Certificado para las tablets: $CERT_TABLETS (en esta carpeta)
    Instálalo una vez en cada tablet: Ajustes > Seguridad > Cifrado y credenciales >
    Instalar un certificado > Certificado de CA. Luego abre la dirección en Chrome y elige
    "Agregar a la pantalla de inicio". Más fácil: web del Sistema UVA > «App de campo (móvil)».
$(texto_firewall)

Cambia la contraseña de admin al primer ingreso. Este archivo contiene contraseñas: no lo compartas.
EOF
  chmod 600 "$RAIZ/CREDENCIALES.txt"
  publicar_descargas || aviso 'No se pudieron preparar las descargas de la app.'
}

http_codigo() { curl -sk -o /dev/null -m 10 -w '%{http_code}' "$1" 2>/dev/null; }
esperar_sistema() {
  local u i=0; u="$(url_sistema)"
  while [ $i -lt 60 ]; do
    # Sin sesión la API responde 401: gateway -> microservicio -> Odoo e inicio de sesión web funcionando
    if [ "$(http_codigo "$u/api/health")" = 200 ] && [ "$(http_codigo "$u/api/sesion/yo")" = 401 ]; then return 0; fi
    sleep 3; i=$((i + 1))
  done
  return 1
}
esperar_app() {
  local i=0
  while [ $i -lt 40 ]; do
    [ "$(http_codigo "$(url_sistema)/api/app/health")" = 200 ] && [ "$(http_codigo "$(url_app)/")" = 200 ] && return 0
    sleep 3; i=$((i + 1))
  done
  return 1
}

# Accesos directos y arranque automático ----------------------------------------------------
crear_accesos() {
  [ "$ES_MAC" = 1 ] || { crear_accesos_linux; return; }
  mkdir -p "$ACCESOS_DIR"
  local accion nombre
  while IFS='|' read -r nombre accion; do
    printf '#!/bin/bash\n"%s/uva.sh" %s\n' "$RAIZ" "$accion" > "$ACCESOS_DIR/$nombre.command"
    chmod +x "$ACCESOS_DIR/$nombre.command"
  done <<EOF
Sistema UVA|abrir
App de campo (tablets)|abrir-app
Administrador de Odoo|abrir-odoo
Iniciar Sistema UVA|iniciar
Detener Sistema UVA|detener
Estado del Sistema UVA|estado
Respaldar base de datos|respaldar
Desinstalar Sistema UVA|desinstalar
EOF
  ln -sf "$RAIZ/CREDENCIALES.txt" "$ACCESOS_DIR/Datos de acceso.txt"
  ln -sf "$RAIZ" "$ACCESOS_DIR/Carpeta del sistema (certificado)"
  cp "$ACCESOS_DIR/Sistema UVA.command" "$HOME/Desktop/Sistema UVA.command" 2>/dev/null || true
  cp "$ACCESOS_DIR/App de campo (tablets).command" "$HOME/Desktop/App de campo Asercontrol.command" 2>/dev/null || true
  # Arranque automático al iniciar sesión (Docker Desktop debe estar configurado para abrir al iniciar).
  mkdir -p "$(dirname "$AGENTE")"
  cat > "$AGENTE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>mx.asercontrol.sistemauva</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$RAIZ/uva.sh</string><string>iniciar</string><string>--silencioso</string></array>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$RAIZ/logs/arranque.log</string>
  <key>StandardErrorPath</key><string>$RAIZ/logs/arranque.log</string>
</dict></plist>
EOF
  launchctl unload "$AGENTE" >/dev/null 2>&1 || true
  launchctl load "$AGENTE" >/dev/null 2>&1 || true
  ok 'Accesos en ~/Applications/Sistema UVA y en el escritorio; arranque automático al iniciar sesión.'
}

# Linux: lanzadores .desktop en el menú de aplicaciones, dos en el escritorio y arranque al iniciar sesión.
# Docker arranca con el equipo y los contenedores se reinician solos (restart: unless-stopped).
crear_accesos_linux() {
  local nombre accion terminal archivo icono escritorio
  mkdir -p "$ACCESOS_DIR" "$(dirname "$AGENTE")"
  icono="$RAIZ/dist/brand/logo-uva.png"; [ -f "$icono" ] || icono='applications-office'
  while IFS='|' read -r archivo nombre accion terminal; do
    cat > "$ACCESOS_DIR/sistema-uva-$archivo.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=$nombre
Comment=Sistema UVA - Asercontrol
Exec=$accion
Icon=$icono
Terminal=$terminal
Categories=Office;
EOF
    chmod +x "$ACCESOS_DIR/sistema-uva-$archivo.desktop"
  done <<EOF
abrir|Sistema UVA|"$RAIZ/uva.sh" abrir|false
app|App de campo Asercontrol|"$RAIZ/uva.sh" abrir-app|false
odoo|Administrador de Odoo (Sistema UVA)|"$RAIZ/uva.sh" abrir-odoo|false
iniciar|Iniciar Sistema UVA|"$RAIZ/uva.sh" iniciar --pausa|true
detener|Detener Sistema UVA|"$RAIZ/uva.sh" detener --pausa|true
estado|Estado del Sistema UVA|"$RAIZ/uva.sh" estado --pausa|true
respaldar|Respaldar base de datos (Sistema UVA)|"$RAIZ/uva.sh" respaldar --pausa|true
credenciales|Datos de acceso (Sistema UVA)|xdg-open "$RAIZ/CREDENCIALES.txt"|false
carpeta|Carpeta del Sistema UVA (certificado)|xdg-open "$RAIZ"|false
desinstalar|Desinstalar Sistema UVA|"$RAIZ/uva.sh" desinstalar --pausa|true
EOF
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$ACCESOS_DIR" >/dev/null 2>&1
  escritorio="$(carpeta_usuario DESKTOP)"
  if [ -d "$escritorio" ]; then
    for archivo in abrir app; do
      cp "$ACCESOS_DIR/sistema-uva-$archivo.desktop" "$escritorio/sistema-uva-$archivo.desktop"
      chmod +x "$escritorio/sistema-uva-$archivo.desktop"
      # GNOME (Ubuntu) solo ejecuta lanzadores del escritorio marcados como de confianza
      command -v gio >/dev/null 2>&1 && gio set "$escritorio/sistema-uva-$archivo.desktop" metadata::trusted true >/dev/null 2>&1
    done
  fi
  cat > "$AGENTE" <<EOF
[Desktop Entry]
Type=Application
Name=Sistema UVA (arranque)
Exec="$RAIZ/uva.sh" iniciar --silencioso
Terminal=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
EOF
  sudo -n systemctl enable docker >/dev/null 2>&1 || true
  ok 'Accesos en el menú de aplicaciones y en el escritorio; arranque automático con el equipo.'
}

quitar_accesos() {
  if [ "$ES_MAC" != 1 ]; then
    rm -f "$ACCESOS_DIR"/sistema-uva-*.desktop "$AGENTE" "$(carpeta_usuario DESKTOP)"/sistema-uva-*.desktop
    return 0
  fi
  launchctl unload "$AGENTE" >/dev/null 2>&1 || true
  rm -f "$AGENTE" "$HOME/Desktop/Sistema UVA.command" "$HOME/Desktop/App de campo Asercontrol.command"
  rm -rf "$ACCESOS_DIR"
}

# ----------------------------------------------------------------------------- acciones
accion_instalar() {
  asegurar_docker
  paso 'Preparando configuración'
  inicializar_env; inicializar_config_app; importar_imagenes; fijar_clave_maestra
  # Instalación que se retoma con configuración previa: sus puertos pudieron quedar ocupados
  resolver_puertos
  paso 'Levantando la base de datos (la primera vez descarga imágenes de Docker; puede tardar)'
  compose up -d --wait db
  local nueva=0 modulos
  if ! base_existe; then
    nueva=1
    if [ "$(leer_env UVA_DEMO)" = 1 ]; then modulos='uva_demo,uva_legal,uva_app_movil,uva_sesion_web'; else modulos='uva_api,uva_legal,uva_app_movil,uva_sesion_web'; fi
    paso "Creando la base '$(leer_env ODOO_DB)' e instalando módulos ($modulos). Tarda varios minutos..."
    compose run --rm odoo odoo -d "$(leer_env ODOO_DB)" -i "$modulos" --load-language=es_MX --stop-after-init --no-http
  else
    aviso "La base '$(leer_env ODOO_DB)' ya existe: se conservan sus datos."
  fi
  inicializar_certificados
  paso 'Configurando usuario administrador y clave API de los microservicios'
  if [ $nueva = 1 ] || [ "$(leer_env UVA_ADMIN_CONFIGURADO)" != 1 ]; then actualizar_clave_api fijar_admin; else actualizar_clave_api; fi
  set_env UVA_ADMIN_CONFIGURADO 1
  asegurar_usuario_campo
  [ -n "$(cd "$BACKEND" && docker compose ps -q odoo 2>/dev/null)" ] && compose restart odoo
  paso 'Levantando Odoo, microservicios y gateway'
  # shellcheck disable=SC2046
  construir_servicios
  compose up -d $(opciones_arranque) --wait
  escribir_credenciales
  crear_accesos
  if esperar_sistema; then ok 'El sistema responde.'; else aviso 'El sistema aún no responde; revise "./uva.sh estado".'; fi
  if esperar_app; then ok 'La app de campo responde.'; else aviso 'La app de campo aún no responde; revise "./uva.sh estado".'; fi
  printf '\n  \033[32mSistema UVA instalado.\033[0m\n  Sistema:       %s\n  Odoo:          %s\n  App de campo:  %s  (tablets:%s)\n' \
    "$(url_sistema)" "$(url_odoo)" "$(url_app)" "$(urls_app_red)"
}

accion_agregar_app() {
  asegurar_docker
  [ -f "$ENV_FILE" ] || falla 'No se encontró una instalación del Sistema UVA en esta carpeta.'
  [ -f "$RAIZ/app/index.html" ] || falla 'Falta la carpeta app/ con la app de campo.'
  paso 'Agregando la app de campo al Sistema UVA existente'
  inicializar_config_app
  resolver_puertos
  compose up -d --wait db odoo
  instalar_modulos_app
  asegurar_usuario_campo
  inicializar_certificados
  paso 'Publicando la app de campo en el gateway'
  # shellcheck disable=SC2046
  construir_servicios
  compose up -d $(opciones_arranque) --wait
  compose restart odoo gateway
  escribir_credenciales
  completar_cambio_puertos
  crear_accesos
  if esperar_app; then ok 'La app de campo responde.'; else aviso 'La app aún no responde; revise "./uva.sh estado".'; fi
}

accion_actualizar() {
  asegurar_docker
  importar_imagenes; fijar_clave_maestra; inicializar_config_app; inicializar_certificados
  resolver_puertos   # la clave API y los datos de acceso de abajo toman los puertos nuevos
  paso 'Respaldando antes de actualizar'; accion_respaldar
  paso 'Actualizando módulos de Odoo'
  compose run --rm odoo odoo -d "$(leer_env ODOO_DB)" -u 'uva_core,uva_legal' --stop-after-init --no-http
  instalar_modulos_app
  # La contraseña de admin se fija si una instalación anterior no llegó a hacerlo
  if [ "$(leer_env UVA_ADMIN_CONFIGURADO)" = 1 ]; then actualizar_clave_api; else actualizar_clave_api fijar_admin; set_env UVA_ADMIN_CONFIGURADO 1; fi
  asegurar_usuario_campo
  paso 'Reconstruyendo servicios'
  # shellcheck disable=SC2046
  construir_servicios
  compose up -d $(opciones_arranque) --wait
  compose restart odoo gateway
  escribir_credenciales
  crear_accesos
  if esperar_sistema; then ok 'El sistema responde.'; else aviso 'El sistema aún no responde; revise "./uva.sh estado".'; fi
  ok 'Actualización terminada.'
}

accion_iniciar() {
  asegurar_docker
  paso 'Iniciando Sistema UVA'
  resolver_puertos
  compose up -d --wait
  completar_cambio_puertos
  # Comprobación final: si el gateway no pudo tomar sus puertos, no se dice «Listo»
  esperar_sistema || aviso "El sistema no responde en $(url_sistema). Revise «./uva.sh estado» y la bitácora en logs/."
  local vence; vence="$(leer_env ODOO_API_KEY_EXPIRA)"
  if [ -n "$vence" ]; then
    local hoy_s vence_s
    hoy_s="$(date +%s)"
    vence_s="$(date -j -f '%Y-%m-%d' "$vence" +%s 2>/dev/null || date -d "$vence" +%s 2>/dev/null || echo 0)"
    if [ "$vence_s" -gt 0 ] && [ $(( (vence_s - hoy_s) / 86400 )) -lt 30 ]; then
      aviso "La clave API vence el $vence; se renueva."; actualizar_clave_api; compose up -d --wait
    fi
  fi
  ok "Listo: $(url_sistema)"
}

accion_respaldar() {
  asegurar_docker
  local db dest; db="$(leer_env ODOO_DB)"; dest="$RAIZ/respaldos/$(date '+%Y%m%d-%H%M%S')"
  mkdir -p "$dest"
  paso "Respaldando en $dest"
  compose up -d --wait db odoo
  compose exec -T db sh -c "pg_dump -U odoo -Fc $db > /tmp/uva.dump"
  compose cp db:/tmp/uva.dump "$dest/$db.dump"
  compose exec -T db rm -f /tmp/uva.dump
  compose cp "odoo:/var/lib/odoo/filestore/$db" "$dest/filestore"
  ok "Respaldo listo: $dest"
  RESPALDO_HECHO="$dest"
}

accion_desinstalar() {
  local borrar=$ELIMINAR_DATOS r
  if puede_preguntar; then
    r="$(dialogo "¿Eliminar también la base de datos y los archivos del Sistema UVA?

Eliminar: se borra todo de forma permanente.
Conservar: los datos quedan para una reinstalación futura." "Cancelar,Conservar datos,Eliminar" "Conservar datos")"
    [ "$r" = "Cancelar" ] && { aviso 'Desinstalación cancelada.'; return; }
    [ "$r" = "Eliminar" ] && borrar=1
    if [ "$borrar" = 1 ] && docker_listo && [ "$(dialogo '¿Hacer un respaldo antes de borrar?' 'No,Sí' 'Sí')" = "Sí" ]; then
      accion_respaldar
      cp -R "$RESPALDO_HECHO" "$(carpeta_usuario DOCUMENTS)/Respaldo Sistema UVA $(basename "$RESPALDO_HECHO")" && ok 'Respaldo copiado a Documentos.'
    fi
  fi
  if docker_listo; then
    paso 'Quitando contenedores'
    if [ "$borrar" = 1 ]; then (cd "$BACKEND" && docker compose down -v --rmi local); else (cd "$BACKEND" && docker compose down --rmi local); fi
    if [ "$borrar" = 1 ]; then
      for im in $(docker image ls --format '{{.Repository}}:{{.Tag}}' sistema-uva-servicios); do docker image rm "$im" >/dev/null 2>&1; done
    fi
  else
    aviso "$DOCKER_NOMBRE no está activo: los contenedores no se quitaron (proyecto \"sistema-uva\")."
  fi
  [ "$borrar" = 1 ] && rm -rf "$ENV_RESPALDO"
  # --conservar-certificado (reinstalar desde cero): la autoridad local se conserva para que los teléfonos y
  # tablets sigan confiando en el servidor sin instalar otro permiso de seguridad.
  if [ "$borrar" = 1 ] && [ "$CONSERVAR_CA" != 1 ]; then
    rm -rf "$CA_RESPALDO"
    if [ "$ES_MAC" = 1 ]; then
      security delete-certificate -c 'Asercontrol CA local' "$HOME/Library/Keychains/login.keychain-db" >/dev/null 2>&1 || true
    else
      quitar_ca_linux
    fi
  fi
  paso 'Quitando accesos directos'
  quitar_accesos
  cd / && rm -rf "$RAIZ"
  ok 'Sistema UVA desinstalado.'
  if [ "$borrar" != 1 ]; then
    if [ "$ES_MAC" = 1 ]; then echo '  Los datos se conservaron. Para borrarlos después: Docker Desktop > Volumes > sistema-uva_*'
    else echo '  Los datos se conservaron. Para borrarlos después: docker volume rm sistema-uva_uva-db sistema-uva_uva-odoo-data'; fi
  fi
  mensaje 'Sistema UVA se desinstaló correctamente.'
}

# ----------------------------------------------------------------------------- principal
mkdir -p "$RAIZ/logs"
if [ "$PAUSA" = 1 ]; then trap 'printf "\nPresione Enter para cerrar..." >/dev/tty 2>/dev/null; read -r _ </dev/tty 2>/dev/null' EXIT; fi
case "$ACCION" in
  abrir|abrir-odoo|abrir-app|estado) ;;
  *) exec > >(tee -a "$RAIZ/logs/$ACCION-$(date '+%Y%m%d-%H%M%S').log") 2>&1 ;;
esac
case "$ACCION" in
  instalar)      accion_instalar ;;
  agregar-app)   accion_agregar_app ;;
  actualizar)    accion_actualizar ;;
  iniciar)       accion_iniciar ;;
  detener)       asegurar_docker; paso 'Deteniendo Sistema UVA'; compose stop; ok 'Detenido (los datos se conservan).' ;;
  estado)        asegurar_docker; (cd "$BACKEND" && docker compose ps); printf '\n  Sistema: %s\n  Odoo:    %s\n  App:     %s  (tablets:%s)\n' "$(url_sistema)" "$(url_odoo)" "$(url_app)" "$(urls_app_red)" ;;
  abrir)         abrir_url "$(url_sistema)" ;;
  abrir-odoo)    abrir_url "$(url_odoo)" ;;
  abrir-app)     abrir_url "$(url_app)" ;;
  respaldar)     accion_respaldar ;;
  renovar-clave) asegurar_docker; paso 'Renovando la clave API de los microservicios'; actualizar_clave_api; compose up -d --wait ;;
  regenerar-certificado) asegurar_docker; inicializar_certificados forzar; compose restart gateway; escribir_credenciales; ok 'Certificado renovado con la misma autoridad: las tablets no necesitan reinstalarla.' ;;
  desinstalar)   accion_desinstalar ;;
  *) echo "Acción desconocida: $ACCION"; sed -n '5,16p' "$0"; exit 2 ;;
esac
