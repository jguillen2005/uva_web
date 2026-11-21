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
    # Con -EliminarDatos: conserva la autoridad de certificados (reinstalar desde cero; los teléfonos siguen confiando)
    [switch]$ConservarCertificado,
    [switch]$Silencioso
)

$ErrorActionPreference = 'Stop'
$Raiz = $PSScriptRoot
$Backend = Join-Path $Raiz 'backend'
$EnvFile = Join-Path $Backend '.env'
$EnvRespaldo = Join-Path $env:LOCALAPPDATA 'SistemaUVA-configuracion.env'
# Autoridad certificadora local (la que se instala en las tablets): se conserva al desinstalar sin borrar
# datos, para que una reinstalación la reutilice y las tablets no tengan que instalar otro certificado.
$CaRespaldo = Join-Path $env:LOCALAPPDATA 'SistemaUVA-ca'
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

# Puertos ocupados al arrancar ---------------------------------------------------------------
# Si otro programa tomó un puerto del sistema (web, app de campo u Odoo), se cambia solo al siguiente
# libre, sin preguntar. Los teléfonos encuentran solos el puerto nuevo de la app (buscan en el mismo equipo).
$Script:ProcesosDocker = 'com.docker.backend|com.docker.proxy|wslrelay|vpnkit|docker-proxy|Docker Desktop'
function Get-UsoPuerto([int]$Puerto) {
    # ¿Quién usa el puerto? 'propio' = el Sistema UVA (o Docker levantándolo); si no, una descripción.
    # Contenedores que publican el puerto. Sin comillas dentro del formato: PowerShell 5.1 las quita al
    # pasar argumentos a programas externos ({{.Labels}} trae «clave=valor,...»).
    $contenedores = @()
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        $contenedores = @(Invoke-Nativo { docker ps --filter "publish=$Puerto" --format '{{.Names}}|{{.Labels}}' 2>$null })
    }
    foreach ($c in $contenedores) {
        $partes = "$c".Split('|', 2)
        if (-not $partes[0]) { continue }
        if ($partes.Count -gt 1 -and $partes[1] -match "com\.docker\.compose\.project=$([regex]::Escape($Proyecto))(,|$)") { return 'propio' }
        return "el contenedor «$($partes[0])» de Docker"
    }
    try {
        $con = Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction Stop | Select-Object -First 1
        $proc = Get-Process -Id $con.OwningProcess -ErrorAction Stop
        # Docker Desktop publicando los puertos del sistema mientras arranca sus contenedores
        if ($proc.ProcessName -match $Script:ProcesosDocker) { return 'propio' }
        return "«$($proc.ProcessName)» (PID $($proc.Id))"
    } catch { }
    if (Test-PuertoLibre $Puerto) { return $null }
    return 'otro programa'
}

function Resolve-PuertosOcupados {
    # Devuelve las claves que cambiaron (GATEWAY_PORT, APP_PORT, ODOO_PORT)
    $cfg = Read-Env
    $usados = @($cfg['GATEWAY_PORT'], $cfg['APP_PORT'], $cfg['ODOO_PORT']) | Where-Object { $_ }
    $cambiados = New-Object System.Collections.Generic.List[string]
    foreach ($par in @(@('GATEWAY_PORT', 'web del Sistema UVA'), @('APP_PORT', 'app de campo'), @('ODOO_PORT', 'administrador de Odoo'))) {
        $clave = $par[0]
        if (-not $cfg[$clave]) { continue }
        $actual = [int]$cfg[$clave]
        $quien = Get-UsoPuerto $actual
        if (-not $quien -or $quien -eq 'propio') { continue }
        $nuevo = $actual + 1
        while ($true) { $nuevo = Get-PuertoLibre $nuevo; if ($usados -notcontains "$nuevo") { break }; $nuevo++ }
        Set-EnvValor $clave "$nuevo"
        $usados += "$nuevo"
        $cambiados.Add($clave)
        Write-Aviso "El puerto $actual ($($par[1])) lo está usando $($quien): el Sistema UVA usa ahora el $nuevo."
    }
    return ,$cambiados.ToArray()
}

function Complete-CambioPuertos([string[]]$Cambiados) {
    # Tras levantar los servicios con los puertos nuevos: direcciones de los enlaces de correo (web), datos
    # de acceso y descargas de la app (QR de la página «App de campo (móvil)»).
    if (-not $Cambiados -or $Cambiados.Count -eq 0) { return }
    if ($Cambiados -contains 'GATEWAY_PORT') {
        Update-ClaveApi $false
        Invoke-Compose up -d --wait   # los microservicios toman la clave nueva
    }
    Write-Credenciales
    Write-Ok "Puertos actualizados: $((Get-Urls).Sistema) · app $((Get-Urls).App). Los teléfonos encuentran solos el puerto nuevo."
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
    # La carpeta de descargas se crea antes de levantar el gateway (que la publica en /descargas/)
    New-Item -ItemType Directory -Force (Join-Path $Raiz 'descargas') | Out-Null
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
    # Respaldo de la CA también en instalaciones que ya la tenían (antes no se respaldaba)
    if ((Test-Path (Join-Path $dir 'ca.key')) -and -not (Test-Path (Join-Path $CaRespaldo 'ca.key'))) {
        New-Item -ItemType Directory -Force $CaRespaldo | Out-Null
        Copy-Item (Join-Path $dir 'ca.crt'), (Join-Path $dir 'ca.key') $CaRespaldo -Force
    }
    if (-not $Forzar -and (Test-Path (Join-Path $dir 'servidor-cadena.crt'))) { return }
    New-Item -ItemType Directory -Force $dir | Out-Null
    if (-not (Test-Path (Join-Path $dir 'ca.crt')) -and (Test-Path (Join-Path $CaRespaldo 'ca.key'))) {
        Copy-Item (Join-Path $CaRespaldo 'ca.crt'), (Join-Path $CaRespaldo 'ca.key') $dir -Force
        Write-Ok 'Se reutiliza la autoridad certificadora anterior: las tablets no necesitan reinstalar el certificado.'
    }
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
    New-Item -ItemType Directory -Force $CaRespaldo | Out-Null
    Copy-Item (Join-Path $dir 'ca.crt'), (Join-Path $dir 'ca.key') $CaRespaldo -Force
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
    # Recién instalado, el comando docker puede no estar aún en el PATH de esta sesión
    $binDocker = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'
    if (-not (Get-Command docker -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $binDocker 'docker.exe'))) { $env:Path += ";$binDocker" }
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

# Descargas para instalar la app de campo en teléfonos y tablets (las publica la web en /descargas/):
# certificado de la CA para Android, perfil de configuración para iPhone/iPad y las direcciones.
function Publish-Descargas {
    $c = Read-Env
    $dir = Join-Path $Raiz 'descargas'
    New-Item -ItemType Directory -Force $dir | Out-Null
    $ca = Join-Path $Backend 'certs\ca.crt'
    if (Test-Path $ca) {
        Copy-Item $ca (Join-Path $dir 'Certificado-Android-Asercontrol.crt') -Force
        $pem = [System.IO.File]::ReadAllText($ca)
        $b64 = (($pem -split "`n") | Where-Object { $_ -notmatch '-----' } | ForEach-Object { $_.Trim() }) -join ''
        $sha = [System.Security.Cryptography.SHA256]::Create().ComputeHash([Convert]::FromBase64String($b64))
        $hex = -join ($sha | ForEach-Object { $_.ToString('X2') })
        $uuid = { param($i) $h = $hex.Substring($i, 32); '{0}-{1}-{2}-{3}-{4}' -f $h.Substring(0, 8), $h.Substring(8, 4), $h.Substring(12, 4), $h.Substring(16, 4), $h.Substring(20, 12) }
        $perfil = @"
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
      <key>PayloadUUID</key><string>$(& $uuid 0)</string>
      <key>PayloadVersion</key><integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key><string>Permite abrir e instalar la app de campo Asercontrol desde el servidor de la oficina.</string>
  <key>PayloadDisplayName</key><string>Asercontrol - App de campo</string>
  <key>PayloadIdentifier</key><string>mx.asercontrol.sistemauva.ca</string>
  <key>PayloadOrganization</key><string>Asercontrol</string>
  <key>PayloadRemovalDisallowed</key><false/>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadUUID</key><string>$(& $uuid 32)</string>
  <key>PayloadVersion</key><integer>1</integer>
</dict>
</plist>
"@
        [System.IO.File]::WriteAllText((Join-Path $dir 'Certificado-iPhone-iPad-Asercontrol.mobileconfig'), $perfil.Replace("`r`n", "`n"), $Utf8SinBom)
    }
    # La app se instala desde el navegador (PWA); el APK ya no se distribuye (se quita el de versiones anteriores)
    Remove-Item (Join-Path $dir 'Asercontrol-Campo.apk'), (Join-Path $Raiz 'Asercontrol-Campo.apk') -Force -ErrorAction SilentlyContinue
    $eq = Get-DireccionesEquipo
    $ips = @($eq.Ips | Where-Object { $_ -ne '127.0.0.1' })
    $nombre = $env:COMPUTERNAME.ToLower()
    $info = [ordered]@{
        app     = @($ips | ForEach-Object { "https://${_}:$($c['APP_PORT'])" }) + @("https://${nombre}:$($c['APP_PORT'])")
        web     = @($ips | ForEach-Object { "http://${_}:$($c['GATEWAY_PORT'])" }) + @("http://${nombre}:$($c['GATEWAY_PORT'])")
        generado = (Get-Date).ToString('s')
    }
    [System.IO.File]::WriteAllText((Join-Path $dir 'app-movil.json'), ($info | ConvertTo-Json -Depth 3), $Utf8SinBom)
}

function Write-Credenciales {
    $c = Read-Env; $u = Get-Urls
    # Direcciones de la web desde la red (las que se escriben en los teléfonos)
    $webRed = @($u.AppRed | ForEach-Object { ($_ -replace '^https://', 'http://') -replace ":$($c['APP_PORT'])$", ":$($c['GATEWAY_PORT'])" })
    # Usuario del sistema (web y app); '-' = su contraseña se cambió en el sistema (caso PA-4)
    $claveSistema = if ($c['UVA_CLAVE_CAMPO'] -eq '-') { '(se cambió en el sistema: use la contraseña actual)' } else { $Script:ClaveCampo }
    $otras = if ($webRed.Count -gt 1) { "`r`n   Si esa no abre, pruebe:  " + (($webRed | Select-Object -Skip 1) -join '   o   ') } else { '' }
    $txt = @"
SISTEMA UVA · SUS DATOS DE ACCESO
Guarde este archivo en un lugar seguro: contiene contraseñas. No lo comparta.
Creado el: $(Get-Date -Format 'dd/MM/yyyy HH:mm')

1. PARA ENTRAR AL SISTEMA EN ESTA COMPUTADORA
   Haga doble clic en el ícono «Sistema UVA» del escritorio
   (o escriba en el navegador:  $($u.Sistema) ).

   Usuario:     $($Script:UsuarioCampo)
   Contraseña:  $claveSistema

   Es el mismo usuario y la misma contraseña para la web y para la app de campo.
   Tiene los roles Administrador e Inspector: con él registre a cada persona en
   «Usuarios y roles» (manual, capítulo 6).

2. DIRECCIÓN PARA LOS TELÉFONOS Y LAS DEMÁS COMPUTADORAS DE LA OFICINA
   Conectados al mismo Wi-Fi que esta computadora, escriban en el navegador:

   $($webRed[0])$otras

   Con esa dirección cada verificador instala la app en su teléfono
   (manual, capítulo «Instalar la app en el teléfono o tablet»).

3. INSTRUCCIONES COMPLETAS
   «Manual de instalacion Sistema UVA» (PDF): menú Inicio › Sistema UVA › Manual del Sistema UVA.

------------------------------------------------------------------------------
DATOS TÉCNICOS (solo para soporte técnico; no los necesita para el uso diario)
   Administrador de Odoo:        $($u.Odoo)   (usuario admin, contraseña: $($c['ODOO_ADMIN_PASSWORD']))
   Contraseña maestra de Odoo:   $($c['ODOO_MASTER_PASSWORD'])
   App de campo:                 $($u.App)   ·   desde la red: $($u.AppRed -join '  ')
   Páginas legales:              $($u.Sistema)/terminos-y-condiciones   ·   $($u.Sistema)/aviso-de-privacidad
   Correo para «¿Olvidó su contraseña?»: Odoo › Ajustes › Técnico › Servidores de correo saliente.
"@
    [System.IO.File]::WriteAllText((Join-Path $Raiz 'CREDENCIALES.txt'), $txt, (New-Object System.Text.UTF8Encoding $true))
    try { Publish-Descargas } catch { Write-Aviso "No se pudieron preparar las descargas de la app: $($_.Exception.Message)" }
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
    $cambiados = Resolve-PuertosOcupados
    Invoke-Compose up -d --wait db odoo
    Install-ModuloApp
    Confirm-UsuarioCampo
    Initialize-Certificados
    Write-Paso 'Publicando la app de campo en el gateway'
    $opc = @(Get-OpcionesArranque)
    Invoke-Compose up -d @opc --wait
    Invoke-Compose restart odoo gateway
    Write-Credenciales
    Complete-CambioPuertos $cambiados
    if (Wait-App) { Write-Ok 'La app de campo responde.' } else { Write-Aviso 'La app aún no responde; revisa "uva.ps1 estado".' }
    $u = Get-Urls
    Write-Host "`n  App de campo lista." -ForegroundColor Green
    Write-Host "  En este equipo:  $($u.App)"
    Write-Host "  Desde tablets:   $($u.AppRed -join '  ó  ')"
}

# Usuario del sistema para la web y la app de campo (Administrador + Inspector), en toda instalación.
# Su contraseña es fija y no se pide cambiarla; está en el manual y en CREDENCIALES.txt. A un usuario que ya
# existe nunca se le cambia la contraseña (el cliente pudo cambiarla a propósito).
$Script:UsuarioCampo = 'jhovani.coss@asercontrol.com'
$Script:ClaveCampo = 'asercontrol123456'
# Comprueba que admin pueda entrar a la web con la contraseña de CREDENCIALES.txt y, si no, corrige su acceso
# (activo, administrador de Odoo). Con -FijarClave (instalación nueva) también le pone esa contraseña; al
# actualizar nunca la cambia (el cliente pudo haberla cambiado a propósito).
function Test-LoginAdmin {
    $cuerpo = @{ email = 'admin'; password = (Read-Env)['ODOO_ADMIN_PASSWORD'] } | ConvertTo-Json -Compress
    try {
        $r = Invoke-RestMethod -Uri "$((Get-Urls).Sistema)/api/sesion/login" -Method Post -ContentType 'application/json' -Body $cuerpo -TimeoutSec 30
        return [bool]$r.ok
    } catch { return $false }
}
function Confirm-AccesoAdmin([switch]$FijarClave) {
    Write-Paso 'Comprobando que admin pueda entrar con los datos de CREDENCIALES.txt'
    if (Test-LoginAdmin) { Write-Ok 'admin entra a la web con la contraseña de CREDENCIALES.txt.'; return }
    Write-Aviso 'admin no pudo entrar a la web: se corrige su acceso.'
    $clave = if ($FijarClave) { (Read-Env)['ODOO_ADMIN_PASSWORD'] } else { '' }
    $py = @"
admin = env.ref('base.user_admin').sudo().with_context(active_test=False)
vals = {'active': True}
if '$clave':
    vals['password'] = '$clave'
admin.write(vals)
grupo = env.ref('base.group_system')
if grupo not in admin.group_ids:
    admin.write({'group_ids': [(4, grupo.id)]})
env.cr.commit()
print('UVA_ADMIN_OK')
"@
    $salida = Invoke-OdooShell $py
    if ($salida -notmatch 'UVA_ADMIN_OK') { Write-Host $salida }
    if (Test-LoginAdmin) { Write-Ok 'Acceso de admin corregido: ya entra con la contraseña de CREDENCIALES.txt.' }
    elseif ($FijarClave) { Write-Aviso 'admin aún no puede entrar a la web; envía a soporte la bitácora.' }
    else { Write-Aviso 'La contraseña de admin no coincide con CREDENCIALES.txt (probablemente se cambió en el sistema): usa la contraseña actual.' }
}

# Caso PA-4: comprueba que el usuario del sistema entre de verdad a la web y a la app con la contraseña de
# CREDENCIALES.txt. Si no puede (su contraseña se cambió en el sistema), no se le cambia: CREDENCIALES.txt lo
# indica (UVA_CLAVE_CAMPO=-) en lugar de mostrar una contraseña que no sirve.
function Confirm-UsuarioSistema {
    $anterior = (Read-Env)['UVA_CLAVE_CAMPO']
    Write-Paso "Comprobando que $($Script:UsuarioCampo) pueda entrar a la web y a la app"
    $cuerpo = @{ email = $Script:UsuarioCampo; password = $Script:ClaveCampo } | ConvertTo-Json -Compress
    $codigo = 0
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Uri "$((Get-Urls).Sistema)/api/app/auth/login" -Method Post -ContentType 'application/json' -Body $cuerpo -TimeoutSec 30
        $codigo = [int]$r.StatusCode
    } catch { if ($_.Exception.Response) { $codigo = [int]$_.Exception.Response.StatusCode } }
    if ($codigo -eq 200) {
        Write-Ok "$($Script:UsuarioCampo) entra a la web y a la app con la contraseña de CREDENCIALES.txt."
        Set-EnvValor 'UVA_CLAVE_CAMPO' 'ok'
    } else {
        Write-Aviso "$($Script:UsuarioCampo) no pudo entrar (respuesta $codigo): su contraseña se cambió en el sistema; no se modifica."
        Set-EnvValor 'UVA_CLAVE_CAMPO' '-'
    }
    if ((Read-Env)['UVA_CLAVE_CAMPO'] -ne $anterior) { Write-Credenciales }
}

function Confirm-UsuarioCampo {
    # Usuario del sistema (web y app): se crea solo si no existe, con la contraseña fija; a uno existente
    # nunca le cambia la contraseña, solo le asegura los roles Administrador e Inspector y su ficha de verificador.
    $u = $Script:UsuarioCampo
    $py = @"
Users = env['res.users'].sudo().with_context(no_reset_password=True)
jc = Users.with_context(active_test=False).search([('login', '=', '$u')], limit=1)
grupos = [env.ref('base.group_user').id, env.ref('uva_core.group_uva_inspector').id, env.ref('uva_core.group_uva_admin').id]
if not jc:
    jc = Users.create({'name': 'Eduardo Jhovani Jaime Coss', 'login': '$u',
                       'email': '$u', 'password': '$($Script:ClaveCampo)',
                       'lang': 'es_MX', 'tz': 'America/Mexico_City', 'group_ids': [(6, 0, grupos)]})
else:
    jc.write({'group_ids': [(4, g) for g in grupos]})
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
# Datos para prellenar el inicio de sesion (web y app): viven en la base de Odoo, no en el codigo
ICP = env['ir.config_parameter'].sudo()
ICP.set_param('uva.usuario_sistema', '$u')
ICP.set_param('uva.clave_sistema', '$($Script:ClaveCampo)')
env.cr.commit()
print('UVA_CAMPO_OK')
"@
    $out = Invoke-OdooShell $py
    if ($out -match 'UVA_CAMPO_OK') { Write-Ok "Usuario del sistema listo: $u (Administrador e Inspector)" }
    else { Write-Host $out; Write-Aviso "No se pudo crear el usuario del sistema $u." }
}

# ----------------------------------------------------------------------------- acciones
function Invoke-Instalar {
    Assert-Docker
    Write-Paso 'Preparando configuración'
    Initialize-Env $Demo.IsPresent
    # Instalación que se retoma con configuración previa: sus puertos pudieron quedar ocupados
    Resolve-PuertosOcupados | Out-Null
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
    if ($nueva) { Confirm-AccesoAdmin -FijarClave } else { Confirm-AccesoAdmin }
    Confirm-UsuarioSistema
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
    $cambiados = Resolve-PuertosOcupados
    Invoke-Compose up -d --wait
    Complete-CambioPuertos $cambiados
    # Comprobación final: si el gateway no pudo tomar sus puertos, no se dice «Listo»
    if (-not (Wait-Sistema)) { Write-Aviso "El sistema no responde en $((Get-Urls).Sistema). Revisa 'uva.ps1 estado' y la bitácora en logs\." }
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
    Resolve-PuertosOcupados | Out-Null   # Update-ClaveApi y Write-Credenciales de abajo toman los puertos nuevos
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
    Confirm-AccesoAdmin
    Confirm-UsuarioSistema
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
    if ($borrar) {
        Remove-Item $EnvRespaldo -Force -ErrorAction SilentlyContinue
        if (-not $ConservarCertificado) { Remove-Item $CaRespaldo -Recurse -Force -ErrorAction SilentlyContinue }
    }

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
            Assert-Docker; Initialize-Certificados $true; Publish-Descargas; Invoke-Compose restart gateway; Write-Credenciales
            Write-Ok 'Conexión de teléfonos renovada (misma autoridad: los teléfonos no tienen que volver a instalar el permiso de seguridad).'
            Show-Mensaje 'Listo: los teléfonos y tablets pueden volver a conectarse con la dirección nueva de esta computadora.' | Out-Null
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
