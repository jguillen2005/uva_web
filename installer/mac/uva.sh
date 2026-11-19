#!/bin/bash
# Sistema UVA en Mac (también funciona en Linux): administra la instalación local
# (Docker Desktop + Odoo 19 + microservicios + gateway + app de campo).
#
# Uso:  ./uva.sh <acción> [--demo] [--silencioso] [--eliminar-datos]
#   instalar             Crea la base de datos (con --demo: datos de demostración) y levanta todo.
#   agregar-app          Agrega o actualiza la app de campo en un sistema ya instalado (no toca los datos).
#   actualizar           Aplica la versión copiada: respalda, actualiza módulos y reinicia servicios.
#   iniciar | detener | estado
#   abrir | abrir-odoo | abrir-app
#   respaldar            Base de datos y archivos adjuntos en ./respaldos/<fecha>
#   renovar-clave        Nueva clave API para los microservicios
#   regenerar-certificado  Nuevo certificado HTTPS de la app (p. ej. si cambió la IP); la CA se conserva
#   desinstalar          Quita el sistema (pregunta si conservar los datos)
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
ACCESOS_DIR="$HOME/Applications/Sistema UVA"
AGENTE="$HOME/Library/LaunchAgents/mx.asercontrol.sistemauva.plist"
DIAS_CLAVE=365
# Verificador de campo que se crea al instalar (la app lo trae prellenado); se crea solo si no existe.
USUARIO_CAMPO='jhovani.coss@asercontrol.com'
CLAVE_CAMPO='asercontrol123456'

ACCION="${1:-estado}"; shift || true
DEMO=0; SILENCIOSO=0; ELIMINAR_DATOS=0
for a in "$@"; do
  case "$a" in
    --demo) DEMO=1 ;;
    --silencioso) SILENCIOSO=1 ;;
    --eliminar-datos) ELIMINAR_DATOS=1 ;;
  esac
done

# ----------------------------------------------------------------------------- utilidades
paso()  { printf '\n\033[36m> %s\033[0m\n' "$*"; }
ok()    { printf '  \033[32mOK\033[0m  %s\n' "$*"; }
aviso() { printf '  \033[33m!\033[0m   %s\n' "$*"; }
falla() { printf '\n  \033[31mERROR\033[0m  %s\n' "$*" >&2; exit 1; }
minus() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# Diálogo con botones (macOS). Devuelve el botón elegido; en modo silencioso, el predeterminado.
dialogo() {  # dialogo "texto" "Botón1,Botón2" "Predeterminado"
  local texto="$1" botones="$2" pred="$3"
  if [ "$SILENCIOSO" = 1 ] || [ "$ES_MAC" != 1 ]; then printf '%s' "$pred"; return; fi
  local lista; lista="$(printf '%s' "$botones" | sed 's/[^,][^,]*/"&"/g; s/,/, /g')"
  osascript -e "button returned of (display dialog \"$(printf '%s' "$texto" | sed 's/"/\\"/g')\" with title \"Sistema UVA\" buttons {$lista} default button \"$pred\")" 2>/dev/null || printf 'Cancelar'
}
mensaje() { [ "$SILENCIOSO" = 1 ] || [ "$ES_MAC" != 1 ] && return 0; osascript -e "display dialog \"$(printf '%s' "$1" | sed 's/"/\\"/g')\" with title \"Sistema UVA\" buttons {\"OK\"} default button \"OK\"" >/dev/null 2>&1 || true; }
abrir_url() { if [ "$ES_MAC" = 1 ]; then open "$1"; elif command -v xdg-open >/dev/null; then xdg-open "$1" >/dev/null 2>&1 & else echo "$1"; fi; }

secreto() { LC_ALL=C tr -dc 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789' </dev/urandom | head -c "${1:-24}"; }

puerto_libre() {  # 0 si el puerto está libre
  local p="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 && return 1
  elif command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$p\$" && return 1
  fi
  # Puertos publicados por contenedores de Docker (también de otros proyectos)
  docker ps --format '{{.Ports}}' 2>/dev/null | grep -qE "[:\]]$p->" && return 1
  return 0
}
puerto_desde() { local p="$1"; while [ "$p" -lt $(( $1 + 100 )) ]; do puerto_libre "$p" && { echo "$p"; return; }; p=$((p + 1)); done; falla "No hay puertos libres a partir de $1."; }

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
  command -v docker >/dev/null 2>&1 || falla 'Docker Desktop no está instalado. Descárguelo de https://www.docker.com/products/docker-desktop/ e intente de nuevo.'
  docker_listo && return
  if [ "$ES_MAC" = 1 ]; then paso 'Iniciando Docker Desktop (puede tardar un par de minutos)...'; open -a Docker >/dev/null 2>&1 || true; fi
  local i=0
  while [ $i -lt 60 ]; do sleep 5; docker_listo && { ok 'Docker Desktop está listo.'; return; }; printf '.'; i=$((i + 1)); done
  falla 'Docker Desktop no respondió. Ábralo, espere a que diga "Engine running" y vuelva a intentar.'
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
opciones_arranque() { if [ "$(leer_env UVA_SIN_INTERNET)" = "1" ]; then echo '--no-build --pull never'; else echo '--build'; fi; }

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
  if [ "${1:-}" != "forzar" ] && [ -f "$dir/servidor-cadena.crt" ]; then return; fi
  mkdir -p "$dir"
  nombre="$(nombre_equipo)"
  alt="DNS:localhost,DNS:$nombre,DNS:${nombre%.local},IP:127.0.0.1"
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
EOF
  paso 'Generando el certificado HTTPS de la app de campo'
  # openssl viene en la imagen de Odoo (ya cargada o descargada para el sistema).
  docker run --rm --user root -v "$dir:/c" --entrypoint sh odoo:19.0 /c/generar.sh || falla 'No se pudo generar el certificado HTTPS.'
  [ -f "$dir/servidor-cadena.crt" ] || falla 'No se pudo generar el certificado HTTPS.'
  rm -f "$dir/generar.sh" "$dir/servidor.ext"
  cp "$dir/ca.crt" "$RAIZ/$CERT_TABLETS"
  ok "Certificado para: $(printf '%s' "$alt" | sed 's/DNS://g; s/IP://g; s/,/, /g')"
  # En este Mac, confiar en la CA para abrir la app sin advertencias (macOS pide la contraseña).
  if [ "$ES_MAC" = 1 ] && [ "$SILENCIOSO" != 1 ]; then
    if security add-trusted-cert -r trustRoot -k "$HOME/Library/Keychains/login.keychain-db" "$dir/ca.crt" 2>/dev/null; then
      ok 'Certificado de confianza instalado en este Mac.'
    else
      aviso 'No se instaló el certificado en este Mac; el navegador mostrará una advertencia.'
    fi
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
    "Agregar a la pantalla de inicio", o instala Asercontrol-Campo.apk y escribe la dirección en "Servidor".
  Firewall del Mac: si está activado, permite las conexiones entrantes de Docker
    (Ajustes del Sistema > Red > Firewall > Opciones).

Cambia la contraseña de admin al primer ingreso. Este archivo contiene contraseñas: no lo compartas.
EOF
  chmod 600 "$RAIZ/CREDENCIALES.txt"
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
  [ "$ES_MAC" = 1 ] || return 0
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
  ln -sf "$RAIZ" "$ACCESOS_DIR/Carpeta del sistema (certificado y APK)"
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

quitar_accesos() {
  [ "$ES_MAC" = 1 ] || return 0
  launchctl unload "$AGENTE" >/dev/null 2>&1 || true
  rm -f "$AGENTE" "$HOME/Desktop/Sistema UVA.command" "$HOME/Desktop/App de campo Asercontrol.command"
  rm -rf "$ACCESOS_DIR"
}

# ----------------------------------------------------------------------------- acciones
accion_instalar() {
  asegurar_docker
  paso 'Preparando configuración'
  inicializar_env; inicializar_config_app; importar_imagenes; fijar_clave_maestra
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
  compose up -d --wait db odoo
  instalar_modulos_app
  asegurar_usuario_campo
  inicializar_certificados
  paso 'Publicando la app de campo en el gateway'
  # shellcheck disable=SC2046
  compose up -d $(opciones_arranque) --wait
  compose restart odoo gateway
  escribir_credenciales
  crear_accesos
  if esperar_app; then ok 'La app de campo responde.'; else aviso 'La app aún no responde; revise "./uva.sh estado".'; fi
}

accion_actualizar() {
  asegurar_docker
  importar_imagenes; fijar_clave_maestra; inicializar_config_app; inicializar_certificados
  paso 'Respaldando antes de actualizar'; accion_respaldar
  paso 'Actualizando módulos de Odoo'
  compose run --rm odoo odoo -d "$(leer_env ODOO_DB)" -u 'uva_core,uva_legal' --stop-after-init --no-http
  instalar_modulos_app
  # La contraseña de admin se fija si una instalación anterior no llegó a hacerlo
  if [ "$(leer_env UVA_ADMIN_CONFIGURADO)" = 1 ]; then actualizar_clave_api; else actualizar_clave_api fijar_admin; set_env UVA_ADMIN_CONFIGURADO 1; fi
  asegurar_usuario_campo
  paso 'Reconstruyendo servicios'
  # shellcheck disable=SC2046
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
  compose up -d --wait
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
  if [ "$SILENCIOSO" != 1 ] && [ "$ES_MAC" = 1 ]; then
    r="$(dialogo "¿Eliminar también la base de datos y los archivos del Sistema UVA?

Eliminar: se borra todo de forma permanente.
Conservar: los datos quedan para una reinstalación futura." "Cancelar,Conservar datos,Eliminar" "Conservar datos")"
    [ "$r" = "Cancelar" ] && { aviso 'Desinstalación cancelada.'; return; }
    [ "$r" = "Eliminar" ] && borrar=1
    if [ "$borrar" = 1 ] && docker_listo && [ "$(dialogo '¿Hacer un respaldo antes de borrar?' 'No,Sí' 'Sí')" = "Sí" ]; then
      accion_respaldar
      cp -R "$RESPALDO_HECHO" "$HOME/Documents/Respaldo Sistema UVA $(basename "$RESPALDO_HECHO")" && ok 'Respaldo copiado a Documentos.'
    fi
  fi
  if docker_listo; then
    paso 'Quitando contenedores'
    if [ "$borrar" = 1 ]; then (cd "$BACKEND" && docker compose down -v --rmi local); else (cd "$BACKEND" && docker compose down --rmi local); fi
    if [ "$borrar" = 1 ]; then
      for im in $(docker image ls --format '{{.Repository}}:{{.Tag}}' sistema-uva-servicios); do docker image rm "$im" >/dev/null 2>&1; done
    fi
  else
    aviso 'Docker Desktop no está activo: los contenedores no se quitaron (proyecto "sistema-uva" en Docker Desktop).'
  fi
  [ "$borrar" = 1 ] && rm -f "$ENV_RESPALDO"
  if [ "$ES_MAC" = 1 ] && [ "$borrar" = 1 ]; then
    security delete-certificate -c 'Asercontrol CA local' "$HOME/Library/Keychains/login.keychain-db" >/dev/null 2>&1 || true
  fi
  paso 'Quitando accesos directos'
  quitar_accesos
  cd / && rm -rf "$RAIZ"
  ok 'Sistema UVA desinstalado.'
  [ "$borrar" = 1 ] || echo '  Los datos se conservaron. Para borrarlos después: Docker Desktop > Volumes > sistema-uva_*'
  mensaje 'Sistema UVA se desinstaló correctamente.'
}

# ----------------------------------------------------------------------------- principal
mkdir -p "$RAIZ/logs"
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
