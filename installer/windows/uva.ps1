#Requires -Version 5.1
<#
.SYNOPSIS
  Administra la instalación local del Sistema UVA (Docker Desktop + Odoo 19 + microservicios + gateway).

.DESCRIPTION
  Se instala junto a las carpetas backend\ y dist\. Lo usan el instalador, los accesos directos
  del menú Inicio y el arranque automático de Windows.

.EXAMPLE
  uva.ps1 instalar -Demo      Crea la base de datos con datos de demostración y levanta todo.
  uva.ps1 agregar-app         Agrega la app de campo a un sistema ya instalado (no toca la base de datos).
  uva.ps1 abrir-app           Abre la app de campo (tablets) en el navegador.
  uva.ps1 regenerar-certificado  Nuevo certificado HTTPS de la app (p. ej. si cambió la IP del equipo).
  uva.ps1 iniciar             Arranca los contenedores (y renueva la clave API si está por vencer).
  uva.ps1 detener             Detiene los contenedores (los datos se conservan).
  uva.ps1 estado              Muestra contenedores y direcciones.
  uva.ps1 abrir | abrir-odoo  Abre el sistema o el administrador de Odoo en el navegador.
  uva.ps1 respaldar           Respalda base de datos y archivos adjuntos en .\respaldos\
  uva.ps1 actualizar          Aplica una versión nueva de los módulos y servicios.
  uva.ps1 renovar-clave       Genera una nueva clave API para los microservicios.
  uva.ps1 desinstalar         Quita el sistema (pregunta si conservar los datos).
#>
param(
    [Parameter(Position = 0)]
    [ValidateSet('instalar', 'agregar-app', 'iniciar', 'detener', 'estado', 'abrir', 'abrir-odoo', 'abrir-app',
                 'respaldar', 'actualizar', 'renovar-clave', 'regenerar-certificado', 'desinstalar')]
    [string]$Accion = 'estado',
    [switch]$Demo,
    [switch]$EliminarDatos,
    [switch]$Silencioso
)

$ErrorActionPreference = 'Stop'
$Raiz = $PSScriptRoot
$Backend = Join-Path $Raiz 'backend'
$EnvFile = Join-Path $Backend '.env'
$EnvRespaldo = Join-Path $env:LOCALAPPDATA 'SistemaUVA-configuracion.env'
$Proyecto = 'sistema-uva'
$ComposeArchivos = 'docker-compose.yml;docker-compose.app.yml'   # el segundo publica la app de campo
$CertTablets = 'Certificado-tablets-Asercontrol.crt'
$Utf8SinBom = New-Object System.Text.UTF8Encoding $false
$Script:EsquemaClaveDias = 365

# ----------------------------------------------------------------------------- utilidades
function Write-Paso([string]$Texto) { Write-Host "`n> $Texto" -ForegroundColor Cyan }
function Write-Ok([string]$Texto) { Write-Host "  OK  $Texto" -ForegroundColor Green }
function Write-Aviso([string]$Texto) { Write-Host "  !   $Texto" -ForegroundColor Yellow }

function Stop-ConError([string]$Texto) {
    Write-Host "`n  ERROR  $Texto" -ForegroundColor Red
    throw $Texto
}

function Show-Mensaje([string]$Texto, [string]$Titulo = 'Sistema UVA', [string]$Botones = 'OK', [string]$Icono = 'Information') {
    if ($Silencioso) { return 'None' }
    Add-Type -AssemblyName System.Windows.Forms
    return [string][System.Windows.Forms.MessageBox]::Show($Texto, $Titulo, $Botones, $Icono)
}

function New-Secreto([int]$Largo = 24) {
    $abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    $bytes = New-Object byte[] $Largo
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    -join ($bytes | ForEach-Object { $abc[$_ % $abc.Length] })
}

function Test-PuertoLibre([int]$Puerto) {
    # 1. Puertos en escucha en Windows (incluye los que publica Docker Desktop: com.docker.backend, wslrelay),
    #    que un TcpListener de prueba no siempre detecta.
    try { if (Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction Stop) { return $false } } catch { }
    # 2. Puertos publicados por contenedores de Docker (también los de otros proyectos).
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        $publicados = Invoke-Nativo { docker ps --format '{{.Ports}}' 2>$null }
        if (($publicados -join ' ') -match "[:\]]$Puerto->") { return $false }
    }
    # 3. Prueba directa, en uso exclusivo.
    try {
        $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Puerto)
        $l.ExclusiveAddressUse = $true
        $l.Start(); $l.Stop(); return $true
    } catch { return $false }
}

function Get-PuertoLibre([int]$Desde) {
    for ($p = $Desde; $p -lt $Desde + 100; $p++) { if (Test-PuertoLibre $p) { return $p } }
    Stop-ConError "No hay puertos libres a partir de $Desde."
}

# .env  ------------------------------------------------------------------------------------
function Read-Env {
    $h = [ordered]@{}
    if (Test-Path $EnvFile) {
        foreach ($l in [System.IO.File]::ReadAllLines($EnvFile)) {
            if ($l -match '^\s*([A-Z0-9_]+)=(.*)$') { $h[$Matches[1]] = $Matches[2] }
        }
    }
    return $h
}

function Set-EnvValor([string]$Clave, [string]$Valor) {
    $lineas = New-Object System.Collections.Generic.List[string]
    $hecho = $false
    if (Test-Path $EnvFile) {
        foreach ($l in [System.IO.File]::ReadAllLines($EnvFile)) {
            if ($l -match "^$Clave=") { $lineas.Add("$Clave=$Valor"); $hecho = $true } else { $lineas.Add($l) }
        }
    }
    if (-not $hecho) { $lineas.Add("$Clave=$Valor") }
    [System.IO.File]::WriteAllLines($EnvFile, $lineas, $Utf8SinBom)
    Copy-Item $EnvFile $EnvRespaldo -Force   # para reinstalar sobre datos conservados
}

function Initialize-Env([bool]$ConDemo) {
    if (Test-Path $EnvFile) { return }
    if (Test-Path $EnvRespaldo) {
        Write-Aviso 'Se encontró la configuración de una instalación anterior: se reutiliza (contraseñas y datos).'
        Copy-Item $EnvRespaldo $EnvFile
        return
    }
    $odoo = Get-PuertoLibre 8069
    $gw = Get-PuertoLibre 8080
    if ($gw -eq $odoo) { $gw = Get-PuertoLibre ($odoo + 1) }
    $app = Get-PuertoLibre 8443
    $contenido = @(
        '# Sistema UVA - configuración generada por el instalador. NO compartir: contiene contraseñas.',
        "COMPOSE_PROJECT_NAME=$Proyecto",
        "COMPOSE_FILE=$ComposeArchivos",
        'COMPOSE_PATH_SEPARATOR=;',
        "APP_PORT=$app",
        'ODOO_DB=uva',
        "POSTGRES_PASSWORD=$(New-Secreto)",
        "ODOO_PORT=$odoo",
        "GATEWAY_PORT=$gw",
        "ODOO_ADMIN_PASSWORD=$(New-Secreto 16)",
        "ODOO_MASTER_PASSWORD=$(New-Secreto)",
        "UVA_DEMO=$([int]$ConDemo)",
        'UVA_SIN_INTERNET=0',
        'ODOO_API_KEY=',
        'ODOO_API_KEY_EXPIRA='
    )
    [System.IO.File]::WriteAllLines($EnvFile, $contenido, $Utf8SinBom)
    Copy-Item $EnvFile $EnvRespaldo -Force
    Write-Ok "Puertos asignados: sistema $gw, Odoo $odoo, app de campo $app."
}

# App de campo ------------------------------------------------------------------------------
function Initialize-ConfigApp {
    # Instalaciones anteriores a la app de campo: se agregan su puerto y el archivo de compose que la publica.
    $cfg = Read-Env
    if (-not $cfg['APP_PORT']) {
        $p = Get-PuertoLibre 8443
        Set-EnvValor 'APP_PORT' $p
        Write-Ok "Puerto de la app de campo: $p."
    }
    if ($cfg['COMPOSE_FILE'] -ne $ComposeArchivos) { Set-EnvValor 'COMPOSE_FILE' $ComposeArchivos }
    if (-not $cfg['COMPOSE_PATH_SEPARATOR']) { Set-EnvValor 'COMPOSE_PATH_SEPARATOR' ';' }
}

function Get-DireccionesEquipo {
    # Nombres e IP con los que las tablets pueden llegar a este equipo (van en el certificado).
    $nombres = New-Object System.Collections.Generic.List[string]
    $nombres.Add('localhost'); $nombres.Add($env:COMPUTERNAME.ToLower())
    try {
        $fqdn = [System.Net.Dns]::GetHostEntry($env:COMPUTERNAME).HostName.ToLower()
        if ($fqdn -and -not $nombres.Contains($fqdn)) { $nombres.Add($fqdn) }
    } catch { }
    $ips = New-Object System.Collections.Generic.List[string]
    $ips.Add('127.0.0.1')
    try {
        Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Docker|Loopback' } |
            ForEach-Object { if (-not $ips.Contains($_.IPAddress)) { $ips.Add($_.IPAddress) } }
    } catch { }
    [pscustomobject]@{ Nombres = $nombres; Ips = $ips }
}

function Initialize-Certificados([bool]$Forzar = $false) {
    # Una autoridad local (CA) firma el certificado HTTPS del equipo. La CA se instala una vez en cada
    # tablet; si el certificado del equipo se regenera (cambio de IP), la CA sigue siendo la misma.
    $dir = Join-Path $Backend 'certs'
    if (-not $Forzar -and (Test-Path (Join-Path $dir 'servidor-cadena.crt'))) { return }
    New-Item -ItemType Directory -Force $dir | Out-Null
    $eq = Get-DireccionesEquipo
    $alt = @($eq.Nombres | ForEach-Object { "DNS:$_" }) + @($eq.Ips | ForEach-Object { "IP:$_" })
    $ext = "basicConstraints=CA:FALSE`nkeyUsage=digitalSignature,keyEncipherment`nextendedKeyUsage=serverAuth`nsubjectAltName=$($alt -join ',')`n"
    [System.IO.File]::WriteAllText((Join-Path $dir 'servidor.ext'), $ext, $Utf8SinBom)
    $sh = @(
        'set -e', 'cd /c',
        'if [ ! -f ca.crt ]; then',
        '  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/O=Asercontrol/CN=Asercontrol CA local" -keyout ca.key -out ca.crt -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null',
        'fi',
        "openssl req -newkey rsa:2048 -nodes -subj `"/O=Asercontrol/CN=$($env:COMPUTERNAME.ToLower())`" -keyout servidor.key -out servidor.csr 2>/dev/null",
        'openssl x509 -req -in servidor.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 825 -sha256 -extfile servidor.ext -out servidor.crt 2>/dev/null',
        'cat servidor.crt ca.crt > servidor-cadena.crt',
        'rm -f servidor.csr ca.srl',
        'chmod 644 servidor.key'
    ) -join "`n"
    [System.IO.File]::WriteAllText((Join-Path $dir 'generar.sh'), "$sh`n", $Utf8SinBom)
    Write-Paso 'Generando el certificado HTTPS de la app de campo'
    # openssl viene en la imagen de Odoo (ya cargada o descargada para el sistema).
    $imagen = 'odoo:19.0'
    Invoke-Nativo { docker run --rm --user root -v "${dir}:/c" --entrypoint sh $imagen /c/generar.sh }
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $dir 'servidor-cadena.crt'))) { Stop-ConError 'No se pudo generar el certificado HTTPS.' }
    Remove-Item (Join-Path $dir 'generar.sh'), (Join-Path $dir 'servidor.ext') -Force -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $dir 'ca.crt') (Join-Path $Raiz $CertTablets) -Force
    Write-Ok "Certificado para: $(($eq.Nombres + $eq.Ips) -join ', ')"
    # En este equipo, confiar en la CA para abrir la app sin advertencias (Windows pide confirmar).
    if (-not $Silencioso) {
        try { Import-Certificate -FilePath (Join-Path $dir 'ca.crt') -CertStoreLocation Cert:\CurrentUser\Root | Out-Null; Write-Ok 'Certificado de confianza instalado en este equipo.' }
        catch { Write-Aviso 'No se instaló el certificado en este equipo; el navegador mostrará una advertencia.' }
    }
}

function Install-ModuloApp {
    # Instala los módulos de la app de campo y del inicio de sesión web en la base existente, o los
    # actualiza si ya estaban. No toca otros módulos ni datos.
    $db = (Read-Env)['ODOO_DB']
    foreach ($modulo in @('uva_app_movil', 'uva_sesion_web')) {
        # En "solo app" no se copia el módulo de sesión web: se instala solo si está presente.
        if (-not (Test-Path (Join-Path $Backend (Join-Path 'odoo' (Join-Path 'addons' $modulo))))) { continue }
        $estado = Invoke-OdooShell "m = env['ir.module.module'].search([('name', '=', '$modulo')])`nprint('UVA_MOD_ESTADO=' + (m.state or 'ninguno'))`n"
        $instalado = ([regex]::Match($estado, 'UVA_MOD_ESTADO=(\w+)')).Groups[1].Value -eq 'installed'
        if ($instalado) {
            Write-Paso "Actualizando el módulo $modulo en Odoo"
            Invoke-Compose run --rm odoo odoo -d $db -u $modulo --stop-after-init --no-http
        } else {
            Write-Paso "Instalando el módulo $modulo en Odoo"
            Invoke-Compose run --rm odoo odoo -d $db -i $modulo --stop-after-init --no-http
        }
    }
}

function Set-ClaveMaestraOdoo {
    $conf = Join-Path $Backend 'odoo\config\odoo.conf'
    $maestra = (Read-Env)['ODOO_MASTER_PASSWORD']
    if (-not $maestra) { return }
    $texto = [System.IO.File]::ReadAllText($conf)
    $nuevo = [regex]::Replace($texto, '(?m)^admin_passwd\s*=.*$', "admin_passwd = $maestra")
    if ($nuevo -ne $texto) { [System.IO.File]::WriteAllText($conf, $nuevo, $Utf8SinBom) }
}

# Docker -----------------------------------------------------------------------------------
function Invoke-Nativo([scriptblock]$Bloque) {
    # En PowerShell 5.1 la salida de error de programas externos no debe convertirse en excepción.
    $anterior = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Bloque } finally { $ErrorActionPreference = $anterior }
}

function Test-Docker {
    Invoke-Nativo { docker info --format '{{.ServerVersion}}' *> $null }
    return ($LASTEXITCODE -eq 0)
}

function Assert-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Stop-ConError 'Docker Desktop no está instalado. Descárgalo de https://www.docker.com/products/docker-desktop/ e intenta de nuevo.'
    }
    if (Test-Docker) { return }
    $exe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (Test-Path $exe) {
        Write-Paso 'Iniciando Docker Desktop (puede tardar un par de minutos)...'
        Start-Process $exe | Out-Null
    }
    $limite = (Get-Date).AddMinutes(5)
    while ((Get-Date) -lt $limite) {
        Start-Sleep -Seconds 5
        if (Test-Docker) { Write-Ok 'Docker Desktop está listo.'; return }
        Write-Host '.' -NoNewline
    }
    Stop-ConError 'Docker Desktop no respondió. Ábrelo manualmente, espera a que diga "Engine running" y vuelve a intentar.'
}

function Invoke-Compose {
    # Las variables del .env deben ganar a las del entorno de Windows.
    foreach ($k in (Read-Env).Keys) { Remove-Item "env:$k" -ErrorAction SilentlyContinue }
    $argumentos = $args
    Push-Location $Backend
    try {
        Invoke-Nativo { docker compose @argumentos }
        if ($LASTEXITCODE -ne 0) { Stop-ConError "docker compose $($argumentos -join ' ') terminó con error ($LASTEXITCODE)." }
    } finally { Pop-Location }
}

function Invoke-OdooShell([string]$Python) {
    foreach ($k in (Read-Env).Keys) { Remove-Item "env:$k" -ErrorAction SilentlyContinue }
    $db = (Read-Env)['ODOO_DB']
    # El script va en un archivo UTF-8 sin BOM montado en el contenedor: enviarlo por la entrada
    # estándar desde PowerShell 5.1 le antepone un BOM que Python rechaza. Contiene la contraseña
    # de admin, así que se borra al terminar.
    $archivo = Join-Path $Backend ('.uva-shell-' + [guid]::NewGuid().ToString('N') + '.py')
    [System.IO.File]::WriteAllText($archivo, $Python, $Utf8SinBom)
    # Sin comillas dobles: PowerShell 5.1 no las escapa al pasarlas a programas externos.
    $comando = 'odoo shell -d $0 --db_host $HOST --db_user $USER --db_password $PASSWORD --no-http --log-level=warn < /tmp/uva-shell.py'
    Push-Location $Backend
    try {
        $salida = Invoke-Nativo { docker compose run --rm -T -v "${archivo}:/tmp/uva-shell.py:ro" --entrypoint sh odoo -c $comando $db }
        if ($LASTEXITCODE -ne 0) { Write-Host ($salida -join "`n"); Stop-ConError 'Falló la consola de Odoo.' }
        return ($salida -join "`n")
    } finally {
        Remove-Item $archivo -Force -ErrorAction SilentlyContinue
        Pop-Location
    }
}

function Test-BaseExiste {
    $db = (Read-Env)['ODOO_DB']
    Push-Location $Backend
    try {
        $r = Invoke-Nativo { docker compose exec -T db psql -U odoo -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" }
        return (($r -join '').Trim() -eq '1')
    } finally { Pop-Location }
}

function Import-Imagenes {
    # El instalador "sin internet" trae las imágenes de Docker en .\imagenes\ (docker save comprimido).
    $dir = Join-Path $Raiz 'imagenes'
    $archivos = @(Get-ChildItem $dir -Filter '*.tar*' -ErrorAction SilentlyContinue)
    if ($archivos.Count -eq 0) { return }
    Write-Paso 'Cargando las imágenes de Docker incluidas en el instalador (no se descarga nada)...'
    foreach ($a in $archivos) {
        $ruta = $a.FullName
        Invoke-Nativo { docker load -i $ruta }
        if ($LASTEXITCODE -ne 0) { Stop-ConError "No se pudo cargar $($a.Name)." }
    }
    $etiqueta = Join-Path $dir 'servicios.txt'
    if (Test-Path $etiqueta) { Set-EnvValor 'UVA_SVC_IMAGE' ([System.IO.File]::ReadAllText($etiqueta).Trim()) }
    Set-EnvValor 'UVA_SIN_INTERNET' '1'
    Remove-Item $dir -Recurse -Force   # libera el espacio: las imágenes ya están en Docker
    Write-Ok 'Imágenes cargadas.'
}

function Get-OpcionesArranque {
    # Sin internet: usar solo las imágenes cargadas, sin construir ni descargar.
    if ((Read-Env)['UVA_SIN_INTERNET'] -eq '1') { return @('--no-build', '--pull', 'never') }
    return @('--build')
}

# Odoo -------------------------------------------------------------------------------------
function Update-ClaveApi([bool]$FijarAdmin) {
    $cfg = Read-Env
    $adminPw = if ($FijarAdmin) { $cfg['ODOO_ADMIN_PASSWORD'] } else { '' }
    # Los enlaces de los correos de Odoo (p. ej. restablecer contraseña) deben abrir la web del sistema.
    $baseUrl = "http://$($env:COMPUTERNAME.ToLower()):$($cfg['GATEWAY_PORT'])"
    # Solo ASCII: PowerShell 5.1 envía la entrada a programas externos en ASCII.
    $py = @"
from datetime import timedelta
from odoo import fields
admin = env.ref('base.user_admin')
vals = {'lang': 'es_MX', 'tz': 'America/Mexico_City'}
if '$adminPw':
    vals['password'] = '$adminPw'
admin.write(vals)
ICP = env['ir.config_parameter'].sudo()
ICP.set_param('web.base.url', '$baseUrl')
ICP.set_param('web.base.url.freeze', 'True')
# Respaldo sin sesion (la web ya inicia sesion con usuarios de Odoo): usuario del parametro
# uva.usuario_actual (por omision gtorres, que solo existe con datos de demostracion).
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
vence = fields.Datetime.now() + timedelta(days=$($Script:EsquemaClaveDias))
key = Keys.with_user(user).sudo()._generate(None, 'microservicios', vence)
env.cr.commit()
print('UVA_API_KEY=' + key)
print('UVA_API_KEY_EXPIRA=' + vence.strftime('%Y-%m-%d'))
"@
    $out = Invoke-OdooShell $py
    $clave = ([regex]::Match($out, 'UVA_API_KEY=([0-9a-f]+)')).Groups[1].Value
    $vence = ([regex]::Match($out, 'UVA_API_KEY_EXPIRA=([0-9-]+)')).Groups[1].Value
    if (-not $clave) { Write-Host $out; Stop-ConError 'No se pudo generar la clave API de los microservicios.' }
    Set-EnvValor 'ODOO_API_KEY' $clave
    Set-EnvValor 'ODOO_API_KEY_EXPIRA' $vence
    Write-Ok "Clave API de los microservicios generada (vence el $vence)."
}

function Get-Urls {
    $c = Read-Env
    $red = @((Get-DireccionesEquipo).Ips | Where-Object { $_ -ne '127.0.0.1' })
    [pscustomobject]@{
        Sistema = "http://localhost:$($c['GATEWAY_PORT'])"
        Odoo    = "http://localhost:$($c['ODOO_PORT'])"
        App     = "https://localhost:$($c['APP_PORT'])"
        AppRed  = @($red | ForEach-Object { "https://${_}:$($c['APP_PORT'])" }) + @("https://$($env:COMPUTERNAME.ToLower()):$($c['APP_PORT'])")
    }
}

function Write-Credenciales {
    $c = Read-Env; $u = Get-Urls
    $txt = @"
SISTEMA UVA - DATOS DE ACCESO
Generado: $(Get-Date -Format 'yyyy-MM-dd HH:mm')

Sistema (usuarios):            $($u.Sistema)
  Inicio de sesión con los usuarios de Odoo (correo o usuario y contraseña).
  Al principio: usuario admin con la contraseña de abajo; después crea un usuario por persona.
  «¿Olvidó su contraseña?» envía el enlace por correo: requiere configurar el servidor de
  correo saliente en Odoo (Ajustes > Técnico > Servidores de correo saliente).
Administrador de Odoo:         $($u.Odoo)
  Usuario:                     admin
  Contraseña:                  $($c['ODOO_ADMIN_PASSWORD'])
Contraseña maestra de Odoo:    $($c['ODOO_MASTER_PASSWORD'])
  (gestión de bases de datos; guárdala en un lugar seguro)

App de campo (tablets de los verificadores):
  En este equipo:              $($u.App)
  Desde las tablets (misma red): $($u.AppRed -join '  ó  ')
  Usuarios: los de Odoo ligados a un verificador (Sistema UVA > Verificadores > Usuario).
  Verificador predeterminado:  $($Script:UsuarioCampo) / $($Script:ClaveCampo)
    (también entra a la web; cambia su contraseña desde Odoo cuando quieras)
  Certificado para las tablets: $CertTablets (en esta carpeta)
    Instálalo una vez en cada tablet: Ajustes > Seguridad > Cifrado y credenciales >
    Instalar un certificado > Certificado de CA. Luego abre la dirección en Chrome y elige
    "Agregar a la pantalla de inicio" para usarla como aplicación (también sin internet).
    O instala Asercontrol-Campo.apk (en esta carpeta) y escribe la dirección de arriba en "Servidor".

Páginas legales (editables en Odoo > Sitio web):
  $($u.Sistema)/terminos-y-condiciones
  $($u.Sistema)/aviso-de-privacidad

Cambia la contraseña de admin al primer ingreso. Este archivo contiene contraseñas: no lo compartas.
"@
    [System.IO.File]::WriteAllText((Join-Path $Raiz 'CREDENCIALES.txt'), $txt, (New-Object System.Text.UTF8Encoding $true))
}

function Wait-Sistema {
    $u = (Get-Urls).Sistema
    for ($i = 0; $i -lt 60; $i++) {
        try {
            # Gateway -> microservicio -> Odoo (con la clave API) y el inicio de sesion web en Odoo:
            # sin sesion ambos deben responder 401 (la API exige iniciar sesion).
            $ok = 0
            foreach ($ruta in '/api/sesion/yo', '/api/dictaminacion/bandeja') {
                try { Invoke-WebRequest "$u$ruta" -UseBasicParsing -TimeoutSec 10 | Out-Null; $ok++ }
                catch { if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { $ok++ } }
            }
            if ($ok -eq 2 -and (Invoke-WebRequest "$u/api/health" -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200) { return $true }
            Start-Sleep -Seconds 3
        } catch { Start-Sleep -Seconds 3 }
    }
    return $false
}

function Wait-App {
    # API de la app (gateway -> Odoo, módulo uva_app_movil) y archivos de la app en el puerto HTTPS.
    $u = Get-Urls
    for ($i = 0; $i -lt 40; $i++) {
        try {
            $r = Invoke-WebRequest "$($u.Sistema)/api/app/health" -UseBasicParsing -TimeoutSec 10
            if ($r.StatusCode -eq 200) { break }
        } catch { Start-Sleep -Seconds 3 }
    }
    if ($i -ge 40) { return $false }
    # El puerto HTTPS usa un certificado propio: se comprueba que responda sin validar la cadena.
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient('127.0.0.1', [int](Read-Env)['APP_PORT'])
        $tcp.Close(); return $true
    } catch { return $false }
}

function Invoke-AgregarApp {
    # Sistema ya instalado: no se reinstala Odoo ni se tocan la base de datos ni los demás módulos.
    Assert-Docker
    if (-not (Test-Path $EnvFile)) { Stop-ConError 'No se encontró una instalación del Sistema UVA en esta carpeta.' }
    if (-not (Test-Path (Join-Path $Raiz 'app\index.html'))) { Stop-ConError 'Falta la carpeta app\ con la app de campo.' }
    Write-Paso 'Agregando la app de campo al Sistema UVA existente'
    Initialize-ConfigApp
    Invoke-Compose up -d --wait db odoo
    Install-ModuloApp
    Confirm-UsuarioCampo
    Initialize-Certificados
    Write-Paso 'Publicando la app de campo en el gateway'
    $opc = @(Get-OpcionesArranque)
    Invoke-Compose up -d @opc --wait
    Invoke-Compose restart odoo gateway
    Write-Credenciales
    if (Wait-App) { Write-Ok 'La app de campo responde.' } else { Write-Aviso 'La app aún no responde; revisa "uva.ps1 estado".' }
    $u = Get-Urls
    Write-Host "`n  App de campo lista." -ForegroundColor Green
    Write-Host "  En este equipo:  $($u.App)"
    Write-Host "  Desde tablets:   $($u.AppRed -join '  ó  ')"
}

# Verificador de la app de campo (prellenado en la app y en la web): se crea con su usuario de Odoo solo si
# no existe; a uno existente nunca le cambia la contraseña.
$Script:UsuarioCampo = 'jhovani.coss@asercontrol.com'
$Script:ClaveCampo = 'asercontrol123456'
function Confirm-UsuarioCampo {
    $u = $Script:UsuarioCampo
    $py = @"
Users = env['res.users'].sudo().with_context(no_reset_password=True)
jc = Users.with_context(active_test=False).search([('login', '=', '$u')], limit=1)
if not jc:
    grupos = [env.ref('base.group_user').id, env.ref('uva_core.group_uva_inspector').id]
    jc = Users.create({'name': 'Eduardo Jhovani Jaime Coss', 'login': '$u',
                       'email': '$u', 'password': '$($Script:ClaveCampo)',
                       'lang': 'es_MX', 'tz': 'America/Mexico_City', 'group_ids': [(6, 0, grupos)]})
Ver = env['uva.verificador'].sudo().with_context(active_test=False)
if not Ver.search([('user_id', '=', jc.id)], limit=1):
    ver = Ver.search([('email', '=ilike', '$u'), ('user_id', '=', False)], limit=1)
    if ver:
        ver.user_id = jc.id
    else:
        code, n = 'JC', 1
        while Ver.search_count([('code', '=', code)]):
            n += 1; code = 'JC%d' % n
        Ver.create({'name': 'Eduardo Jhovani Jaime Coss', 'code': code, 'user_id': jc.id,
                    'email': '$u', 'estado': 'activo'})
env.cr.commit()
print('UVA_CAMPO_OK')
"@
    $out = Invoke-OdooShell $py
    if ($out -match 'UVA_CAMPO_OK') { Write-Ok "Usuario de la app de campo listo: $u" }
    else { Write-Host $out; Write-Aviso "No se pudo crear el usuario $u." }
}

# ----------------------------------------------------------------------------- acciones
function Invoke-Instalar {
    Assert-Docker
    Write-Paso 'Preparando configuración'
    Initialize-Env $Demo.IsPresent
    Initialize-ConfigApp
    Import-Imagenes
    Set-ClaveMaestraOdoo
    Initialize-Certificados
    $cfg = Read-Env

    Write-Paso 'Levantando la base de datos (la primera vez descarga imágenes de Docker; puede tardar)'
    Invoke-Compose up -d --wait db

    $nueva = -not (Test-BaseExiste)
    if ($nueva) {
        $modulos = if ($cfg['UVA_DEMO'] -eq '1') { 'uva_demo,uva_legal,uva_app_movil,uva_sesion_web' } else { 'uva_api,uva_legal,uva_app_movil,uva_sesion_web' }
        Write-Paso "Creando la base '$($cfg['ODOO_DB'])' e instalando módulos ($modulos). Tarda varios minutos..."
        Invoke-Compose run --rm odoo odoo -d $cfg['ODOO_DB'] -i $modulos --load-language=es_MX --stop-after-init --no-http
    } else {
        Write-Aviso "La base '$($cfg['ODOO_DB'])' ya existe: se conservan sus datos."
    }

    Write-Paso 'Configurando usuario administrador y clave API de los microservicios'
    # La contraseña de admin se fija una sola vez (también si un intento anterior falló a medias).
    Update-ClaveApi ($nueva -or (Read-Env)['UVA_ADMIN_CONFIGURADO'] -ne '1')
    Set-EnvValor 'UVA_ADMIN_CONFIGURADO' '1'
    Confirm-UsuarioCampo
    # Si Odoo ya estaba corriendo (reinstalación o reintento), reiniciarlo para que lea los parámetros nuevos.
    Push-Location $Backend
    try { $odooActivo = Invoke-Nativo { docker compose ps -q odoo } } finally { Pop-Location }
    if ($odooActivo) { Invoke-Compose restart odoo }

    Write-Paso 'Levantando Odoo, microservicios y gateway'
    $opc = @(Get-OpcionesArranque)   # @(): un solo elemento no debe volverse texto
    Invoke-Compose up -d @opc --wait

    Write-Credenciales
    if (Wait-Sistema) { Write-Ok 'El sistema responde.' } else { Write-Aviso 'El sistema aún no responde; revisa "uva.ps1 estado".' }
    if (Wait-App) { Write-Ok 'La app de campo responde.' } else { Write-Aviso 'La app de campo aún no responde; revisa "uva.ps1 estado".' }
    $u = Get-Urls
    Write-Host "`n  Sistema UVA instalado." -ForegroundColor Green
    Write-Host "  Sistema:       $($u.Sistema)"
    Write-Host "  Odoo:          $($u.Odoo)   (usuario admin; contraseña en CREDENCIALES.txt)"
    Write-Host "  App de campo:  $($u.App)   (tablets: $($u.AppRed -join '  ó  '))"
}

function Invoke-Iniciar {
    Assert-Docker
    Write-Paso 'Iniciando Sistema UVA'
    Invoke-Compose up -d --wait
    $vence = (Read-Env)['ODOO_API_KEY_EXPIRA']
    if ($vence -and ([datetime]$vence - (Get-Date)).TotalDays -lt 30) {
        Write-Aviso "La clave API vence el ${vence}; se renueva."
        Invoke-RenovarClave
    }
    Write-Ok "Listo: $((Get-Urls).Sistema)"
}

function Invoke-RenovarClave {
    Assert-Docker
    Write-Paso 'Renovando la clave API de los microservicios'
    Update-ClaveApi $false
    Invoke-Compose up -d --wait   # recrea los microservicios con la clave nueva
}

function Invoke-Actualizar {
    Assert-Docker
    Import-Imagenes
    Set-ClaveMaestraOdoo
    Initialize-ConfigApp
    Initialize-Certificados
    $db = (Read-Env)['ODOO_DB']
    Write-Paso 'Respaldando antes de actualizar'
    Invoke-Respaldar | Out-Null
    Write-Paso 'Actualizando módulos de Odoo'
    Invoke-Compose run --rm odoo odoo -d $db -u 'uva_core,uva_legal' --stop-after-init --no-http
    Install-ModuloApp
    # Clave API nueva y dirección de los enlaces de correo (restablecer contraseña) hacia la web;
    # la contraseña de admin se fija si una instalación anterior no llegó a hacerlo
    Update-ClaveApi ((Read-Env)['UVA_ADMIN_CONFIGURADO'] -ne '1')
    Set-EnvValor 'UVA_ADMIN_CONFIGURADO' '1'
    Confirm-UsuarioCampo
    Write-Paso 'Reconstruyendo servicios'
    $opc = @(Get-OpcionesArranque)   # @(): un solo elemento no debe volverse texto
    Invoke-Compose up -d @opc --wait
    # Odoo carga el código nuevo de los módulos y el gateway su configuración nueva (inicio de sesión)
    Invoke-Compose restart odoo gateway
    Write-Credenciales
    if (Wait-Sistema) { Write-Ok 'El sistema responde.' } else { Write-Aviso 'El sistema aún no responde; revisa "uva.ps1 estado".' }
    Write-Ok 'Actualización terminada.'
}

function Invoke-Respaldar {
    Assert-Docker
    $db = (Read-Env)['ODOO_DB']
    $dest = Join-Path $Raiz ("respaldos\" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Force $dest | Out-Null
    Write-Paso "Respaldando en $dest"
    Invoke-Compose up -d --wait db odoo
    Invoke-Compose exec -T db sh -c "pg_dump -U odoo -Fc $db > /tmp/uva.dump"
    Invoke-Compose cp db:/tmp/uva.dump (Join-Path $dest "$db.dump")
    Invoke-Compose exec -T db rm -f /tmp/uva.dump
    Invoke-Compose cp "odoo:/var/lib/odoo/filestore/$db" (Join-Path $dest 'filestore')
    Write-Ok "Respaldo listo: $dest"
    Write-Host '  Restaurar: pg_restore sobre una base vacía + copiar filestore a /var/lib/odoo/filestore/<base>.'
    return $dest
}

function Invoke-Desinstalar {
    $borrar = $EliminarDatos.IsPresent
    if (-not $Silencioso) {
        $r = Show-Mensaje ("¿Eliminar también la base de datos y los archivos del Sistema UVA?`n`n" +
            "Sí: se borra todo de forma permanente.`nNo: se conservan los datos para una reinstalación futura.") `
            'Desinstalar Sistema UVA' 'YesNoCancel' 'Warning'
        if ($r -eq 'Cancel') { Write-Aviso 'Desinstalación cancelada.'; return }
        $borrar = ($r -eq 'Yes')
        if ($borrar -and (Test-Docker)) {
            if ((Show-Mensaje '¿Hacer un respaldo antes de borrar?' 'Desinstalar Sistema UVA' 'YesNo' 'Question') -eq 'Yes') {
                $dest = Invoke-Respaldar
                $copia = Join-Path ([Environment]::GetFolderPath('MyDocuments')) ('Respaldo Sistema UVA ' + (Split-Path $dest -Leaf))
                Copy-Item $dest $copia -Recurse
                Write-Ok "Respaldo copiado a $copia"
            }
        }
    }
    if (Test-Docker) {
        Write-Paso 'Quitando contenedores'
        if ($borrar) { Invoke-Compose down -v --rmi local } else { Invoke-Compose down --rmi local }
        if ($borrar) {
            # La imagen de microservicios es exclusiva del sistema; postgres/odoo/nginx pueden usarlas otros proyectos.
            $propias = @(Invoke-Nativo { docker image ls --format '{{.Repository}}:{{.Tag}}' sistema-uva-servicios })
            foreach ($im in $propias) { if ($im) { Invoke-Nativo { docker image rm $im } | Out-Null } }
        }
    } else {
        Write-Aviso 'Docker Desktop no está activo: los contenedores no se quitaron (puedes hacerlo desde Docker Desktop, proyecto "sistema-uva").'
    }
    if ($borrar) { Remove-Item $EnvRespaldo -Force -ErrorAction SilentlyContinue }

    Write-Paso 'Quitando accesos directos y registro'
    $menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Sistema UVA'
    Remove-Item $menu -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Sistema UVA.lnk') -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'App de campo Asercontrol.lnk') -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path ([Environment]::GetFolderPath('Startup')) 'Sistema UVA (inicio).lnk') -Force -ErrorAction SilentlyContinue
    Remove-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SistemaUVA' -Recurse -Force -ErrorAction SilentlyContinue

    # La carpeta se borra al terminar este script (no puede borrarse a sí mismo mientras corre).
    Set-Location $env:TEMP
    Start-Process cmd.exe -ArgumentList "/c timeout /t 3 /nobreak >nul & rmdir /s /q `"$Raiz`"" -WindowStyle Hidden
    Write-Ok 'Sistema UVA desinstalado.'
    if (-not $borrar) { Write-Host "  Los datos se conservaron. Para borrarlos después: Docker Desktop > Volumes > sistema-uva_*" }
    Show-Mensaje 'Sistema UVA se desinstaló correctamente.' | Out-Null
}

# ----------------------------------------------------------------------------- principal
$logs = Join-Path $Raiz 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null
$transcripcion = $false
if ($Accion -notin @('abrir', 'abrir-odoo', 'estado')) {
    try { Start-Transcript -Path (Join-Path $logs "$Accion-$(Get-Date -Format 'yyyyMMdd-HHmmss').log") | Out-Null; $transcripcion = $true } catch { }
}
try {
    switch ($Accion) {
        'instalar'      { Invoke-Instalar }
        'agregar-app'   { Invoke-AgregarApp }
        'abrir-app'     { Start-Process (Get-Urls).App }
        'regenerar-certificado' {
            Assert-Docker; Initialize-Certificados $true; Invoke-Compose restart gateway; Write-Credenciales
            Write-Ok 'Certificado renovado con la misma autoridad: las tablets no necesitan reinstalarla.'
        }
        'iniciar'       { Invoke-Iniciar }
        'detener'       { Assert-Docker; Write-Paso 'Deteniendo Sistema UVA'; Invoke-Compose stop; Write-Ok 'Detenido (los datos se conservan).' }
        'estado'        { Assert-Docker; Invoke-Compose ps; $u = Get-Urls; Write-Host "`n  Sistema: $($u.Sistema)`n  Odoo:    $($u.Odoo)`n  App:     $($u.App)  (tablets: $($u.AppRed -join '  ó  '))" }
        'abrir'         { Start-Process (Get-Urls).Sistema }
        'abrir-odoo'    { Start-Process (Get-Urls).Odoo }
        'respaldar'     { Invoke-Respaldar | Out-Null }
        'actualizar'    { Invoke-Actualizar }
        'renovar-clave' { Invoke-RenovarClave }
        'desinstalar'   { Invoke-Desinstalar }
    }
} catch {
    if (-not $Silencioso) { Show-Mensaje "Ocurrió un error:`n`n$($_.Exception.Message)`n`nRevisa la bitácora en:`n$logs" 'Sistema UVA' 'OK' 'Error' | Out-Null }
    exit 1
} finally {
    if ($transcripcion) { try { Stop-Transcript | Out-Null } catch { } }
}
