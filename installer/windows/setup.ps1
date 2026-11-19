#Requires -Version 5.1
<#
.SYNOPSIS
  Asistente de instalación del Sistema UVA. Lo ejecuta SistemaUVA-Instalador-<versión>.exe.

.PARAMETER Destino     Carpeta de instalación (por omisión %LOCALAPPDATA%\Programs\SistemaUVA).
.PARAMETER Demo        'si' o 'no': cargar datos de demostración (si se omite, se pregunta).
.PARAMETER Silencioso  Sin ventanas de diálogo (para pruebas o instalación desatendida).
.PARAMETER ActualizarSistema  Si ya hay un Sistema UVA instalado, actualiza también el backend (Odoo,
                       módulos y microservicios). Sin este parámetro solo se agrega o actualiza la app de campo.
#>
param(
    [string]$Destino = '',
    [ValidateSet('', 'si', 'no')][string]$Demo = '',
    [switch]$Silencioso,
    [switch]$SinAbrir,
    [switch]$ActualizarSistema
)
# Si el sistema ya está instalado, se usa su carpeta (registrada en "Aplicaciones instaladas").
$RegUva = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SistemaUVA'
if (-not $Destino) {
    $registrada = (Get-ItemProperty $RegUva -Name InstallLocation -ErrorAction SilentlyContinue).InstallLocation
    $Destino = if ($registrada -and (Test-Path (Join-Path $registrada 'backend\.env'))) { $registrada } else { Join-Path $env:LOCALAPPDATA 'Programs\SistemaUVA' }
}

$ErrorActionPreference = 'Stop'
$Origen = $PSScriptRoot
$Version = if (Test-Path (Join-Path $Origen 'version.txt')) { (Get-Content (Join-Path $Origen 'version.txt') -Raw).Trim() } else { '1.0.0' }
$Host.UI.RawUI.WindowTitle = "Instalador Sistema UVA $Version"

function Write-Paso([string]$Texto) { Write-Host "`n> $Texto" -ForegroundColor Cyan }
function Show-Mensaje([string]$Texto, [string]$Botones = 'OK', [string]$Icono = 'Information') {
    # También en consola: en modo silencioso es lo único que queda en la bitácora.
    $color = switch ($Icono) { 'Error' { 'Red' } 'Warning' { 'Yellow' } default { 'Gray' } }
    Write-Host ''; ($Texto -split "`n") | ForEach-Object { Write-Host "  $_" -ForegroundColor $color }
    if ($Silencioso) { return 'None' }
    Add-Type -AssemblyName System.Windows.Forms
    return [string][System.Windows.Forms.MessageBox]::Show($Texto, "Instalador Sistema UVA $Version", $Botones, $Icono)
}
function Exit-Instalador([int]$Codigo) {
    if (-not $Silencioso) { Write-Host "`nPresiona Enter para cerrar..."; [void](Read-Host) }
    exit $Codigo
}

Write-Host ''
Write-Host '  ==============================================' -ForegroundColor DarkCyan
Write-Host "    Sistema UVA $Version - Instalador" -ForegroundColor White
Write-Host '    NMX-AA-179-SCFI-2018 · APInterfaces' -ForegroundColor Gray
Write-Host '  ==============================================' -ForegroundColor DarkCyan

# ------------------------------------------------------------------ requisitos
Write-Paso 'Revisando requisitos del equipo'
$os = Get-CimInstance Win32_OperatingSystem
$ramGb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$disco = Get-PSDrive -Name ($Destino.Substring(0, 1))
$libreGb = [math]::Round($disco.Free / 1GB, 1)
Write-Host "  Windows $($os.Version) · RAM $ramGb GB · disco libre $libreGb GB"
if ($ramGb -lt 8) { Write-Host '  ! Se recomiendan 8 GB de RAM o más.' -ForegroundColor Yellow }
# Imágenes en Docker (~3 GB) + base de datos; la versión sin internet suma ~1 GB temporal del paquete.
$minimo = if (Test-Path (Join-Path $Origen 'imagenes.tar.gz')) { 8 } else { 6 }
if ($libreGb -lt 15) { Write-Host '  ! Se recomiendan 15 GB libres para operar con holgura (respaldos y crecimiento).' -ForegroundColor Yellow }
if ($libreGb -lt $minimo) {
    Show-Mensaje "Se necesitan al menos $minimo GB libres en el disco $($disco.Name): (hay $libreGb GB)." 'OK' 'Error' | Out-Null
    Exit-Instalador 1
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    $texto = "El Sistema UVA necesita Docker Desktop y no está instalado en este equipo.`n`n" +
             "¿Instalarlo ahora? Se descarga del sitio oficial de Docker (requiere internet y permisos " +
             "de administrador; al terminar puede pedir reiniciar Windows).`n`n" +
             "Después de instalarlo, abre Docker Desktop una vez, acepta sus términos y vuelve a ejecutar este instalador.`n`n" +
             "Nota: Docker Desktop es gratuito para empresas de menos de 250 empleados y menos de 10 MDD de ingresos anuales; " +
             "para empresas mayores requiere suscripción."
    if ((Show-Mensaje $texto 'YesNo' 'Warning') -eq 'Yes') {
        if (Get-Command winget -ErrorAction SilentlyContinue) {
            Write-Paso 'Instalando Docker Desktop con winget'
            winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements
        } else {
            Start-Process 'https://www.docker.com/products/docker-desktop/'
        }
    }
    Write-Host '  Instala Docker Desktop y vuelve a ejecutar el instalador.' -ForegroundColor Yellow
    Exit-Instalador 2
}

# ------------------------------------------------------------------ instalación nueva o actualización
$uva = Join-Path $Destino 'uva.ps1'
$existente = Test-Path (Join-Path $Destino 'backend\.env')
$actualizacion = $existente -and $ActualizarSistema
$soloApp = $existente -and -not $ActualizarSistema
if ($soloApp) {
    # El backend ya existe: no se reinstala Odoo ni se tocan la base de datos ni los microservicios.
    Write-Host "  Se detectó el Sistema UVA (backend Odoo) instalado en $Destino." -ForegroundColor Green
    $r = Show-Mensaje ("Se detectó el Sistema UVA ya instalado en:`n$Destino`n`n" +
        "Sí: actualizar TODO a la versión $Version (web, backend Odoo y app de campo). Odoo no se " +
        "reinstala: se respalda la base de datos y se conservan los datos y usuarios.`n`n" +
        "No: actualizar SOLO la app de campo de las tablets; la web y el backend quedan como están.") 'YesNoCancel' 'Question'
    if ($r -eq 'Cancel') { Exit-Instalador 0 }
    if ($r -eq 'Yes') { $soloApp = $false; $actualizacion = $true }
} elseif ($actualizacion) {
    if ((Show-Mensaje "El Sistema UVA ya está instalado en:`n$Destino`n`n¿Actualizarlo a la versión $Version? Se respalda la base de datos antes y se conservan los datos." 'YesNo' 'Question') -eq 'No') { Exit-Instalador 0 }
} else {
    Write-Host '  No se encontró el Sistema UVA en este equipo: se instalará completo (Odoo, base de datos, web y app de campo).'
    if ($Demo -eq '') {
        $r = Show-Mensaje ("¿Cargar datos de demostración?`n`n" +
            "Sí: clientes, expedientes y usuarios de ejemplo para conocer el sistema.`n" +
            "No: base de datos vacía, lista para operar.") 'YesNoCancel' 'Question'
        if ($r -eq 'Cancel') { Exit-Instalador 0 }
        $Demo = if ($r -eq 'No') { 'no' } else { 'si' }
    }
}

# ------------------------------------------------------------------ copiar archivos
Write-Paso "Copiando archivos a $Destino"
New-Item -ItemType Directory -Force $Destino | Out-Null
$tmp = Join-Path $env:TEMP ('uva-payload-' + [guid]::NewGuid().ToString('N'))
Expand-Archive -Path (Join-Path $Origen 'payload.zip') -DestinationPath $tmp -Force
if ($soloApp) {
    # Solo la app de campo, su módulo de Odoo, la configuración del gateway y los scripts de administración.
    foreach ($d in @('app', 'backend\odoo\addons\uva_app_movil')) {
        $p = Join-Path $Destino $d
        if (Test-Path $p) { Remove-Item $p -Recurse -Force }
        Copy-Item (Join-Path $tmp $d) $p -Recurse -Force
    }
    foreach ($f in @('backend\gateway\app.conf', 'backend\docker-compose.app.yml', 'uva.ps1', 'LEEME.txt', 'Asercontrol-Campo.apk')) {
        if (Test-Path (Join-Path $tmp $f)) { Copy-Item (Join-Path $tmp $f) (Join-Path $Destino $f) -Force }
    }
} else {
    # Se reemplazan código, frontend y scripts; se conservan .env, certificados, CREDENCIALES, respaldos y bitácoras.
    foreach ($d in @('dist', 'app', 'backend\odoo\addons', 'backend\services', 'backend\gateway')) {
        $p = Join-Path $Destino $d
        if (Test-Path $p) { Remove-Item $p -Recurse -Force }
    }
    $confActual = Join-Path $Destino 'backend\odoo\config\odoo.conf'
    $confGuardada = $null
    if (Test-Path $confActual) { $confGuardada = [System.IO.File]::ReadAllText($confActual) }
    Copy-Item (Join-Path $tmp '*') $Destino -Recurse -Force
    if ($confGuardada) { [System.IO.File]::WriteAllText($confActual, $confGuardada) }
}
Remove-Item $tmp -Recurse -Force
if (-not $soloApp -and (Test-Path (Join-Path $Origen 'imagenes.tar.gz'))) {
    $img = Join-Path $Destino 'imagenes'
    New-Item -ItemType Directory -Force $img | Out-Null
    Move-Item (Join-Path $Origen 'imagenes.tar.gz') $img -Force
    Copy-Item (Join-Path $Origen 'servicios.txt') $img -Force
}
Write-Host '  Archivos copiados.'

# ------------------------------------------------------------------ accesos directos y registro
Write-Paso 'Creando accesos directos'
$shell = New-Object -ComObject WScript.Shell
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$icono = Join-Path $Destino 'uva.ico'
function New-Acceso([string]$Ruta, [string]$Accion, [string]$Descripcion, [string]$Ventana = 'Hidden') {
    $lnk = $shell.CreateShortcut($Ruta)
    $lnk.TargetPath = $ps
    $extra = if ($Ventana -eq 'Hidden') { '-WindowStyle Hidden ' } else { '-NoExit ' }
    $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass $extra-File `"$uva`" $Accion"
    $lnk.WorkingDirectory = $Destino
    $lnk.Description = $Descripcion
    if (Test-Path $icono) { $lnk.IconLocation = "$icono,0" }
    $lnk.Save()
}
$menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Sistema UVA'
New-Item -ItemType Directory -Force $menu | Out-Null
New-Acceso (Join-Path $menu 'Sistema UVA.lnk') 'abrir' 'Abrir el Sistema UVA en el navegador'
New-Acceso (Join-Path $menu 'Administrador de Odoo.lnk') 'abrir-odoo' 'Abrir el administrador de Odoo'
New-Acceso (Join-Path $menu 'App de campo (tablets).lnk') 'abrir-app' 'Abrir la app de campo de los verificadores'
$certLnk = $shell.CreateShortcut((Join-Path $menu 'Certificado para tablets.lnk'))
$certLnk.TargetPath = $Destino; $certLnk.Description = 'Carpeta con Certificado-tablets-Asercontrol.crt'; $certLnk.Save()
New-Acceso (Join-Path $menu 'Iniciar Sistema UVA.lnk') 'iniciar' 'Arrancar los servicios' 'Normal'
New-Acceso (Join-Path $menu 'Detener Sistema UVA.lnk') 'detener' 'Detener los servicios' 'Normal'
New-Acceso (Join-Path $menu 'Estado del Sistema UVA.lnk') 'estado' 'Ver el estado de los servicios' 'Normal'
New-Acceso (Join-Path $menu 'Respaldar base de datos.lnk') 'respaldar' 'Respaldar base de datos y archivos' 'Normal'
New-Acceso (Join-Path $menu 'Desinstalar Sistema UVA.lnk') 'desinstalar' 'Quitar el Sistema UVA' 'Normal'
$cred = $shell.CreateShortcut((Join-Path $menu 'Datos de acceso.lnk'))
$cred.TargetPath = Join-Path $Destino 'CREDENCIALES.txt'; $cred.Save()
New-Acceso (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Sistema UVA.lnk') 'abrir' 'Abrir el Sistema UVA'
New-Acceso (Join-Path ([Environment]::GetFolderPath('Desktop')) 'App de campo Asercontrol.lnk') 'abrir-app' 'Abrir la app de campo de los verificadores'
# Al iniciar sesión: arranca los servicios y renueva la clave API si está por vencer.
New-Acceso (Join-Path ([Environment]::GetFolderPath('Startup')) 'Sistema UVA (inicio).lnk') 'iniciar -Silencioso' 'Arranque automático del Sistema UVA'

$reg = $RegUva
New-Item -Path $reg -Force | Out-Null
$versionRegistrada = (Get-ItemProperty $reg -Name DisplayVersion -ErrorAction SilentlyContinue).DisplayVersion
$valores = @{
    # Con "solo app" el backend conserva su versión instalada.
    DisplayName = 'Sistema UVA'; DisplayVersion = $(if ($soloApp -and $versionRegistrada) { $versionRegistrada } else { $Version }); Publisher = 'APInterfaces'
    InstallLocation = $Destino; DisplayIcon = $icono; NoModify = 1; NoRepair = 1
    UninstallString = "`"$ps`" -NoProfile -ExecutionPolicy Bypass -File `"$uva`" desinstalar"
    QuietUninstallString = "`"$ps`" -NoProfile -ExecutionPolicy Bypass -File `"$uva`" desinstalar -Silencioso"
    EstimatedSize = 3500000
}
foreach ($k in $valores.Keys) {
    $tipo = if ($valores[$k] -is [int]) { 'DWord' } else { 'String' }
    New-ItemProperty -Path $reg -Name $k -Value $valores[$k] -PropertyType $tipo -Force | Out-Null
}
Write-Host '  Menú Inicio, escritorio y "Aplicaciones instaladas" de Windows.'

# ------------------------------------------------------------------ instalar / actualizar
$argumentos = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $uva)
if ($soloApp) { $argumentos += 'agregar-app' }
elseif ($actualizacion) { $argumentos += 'actualizar' }
else { $argumentos += 'instalar'; if ($Demo -eq 'si') { $argumentos += '-Demo' } }
if ($Silencioso) { $argumentos += '-Silencioso' }
& $ps @argumentos
if ($LASTEXITCODE -ne 0) {
    Show-Mensaje "La instalación no terminó. Revisa la bitácora en:`n$(Join-Path $Destino 'logs')`n`nPuedes reintentar con el acceso «Iniciar Sistema UVA» o ejecutando de nuevo el instalador." 'OK' 'Error' | Out-Null
    Exit-Instalador 1
}

if (-not $SinAbrir) { & $ps -NoProfile -ExecutionPolicy Bypass -File $uva abrir }
$credenciales = Join-Path $Destino 'CREDENCIALES.txt'
if (-not $Silencioso -and (Test-Path $credenciales)) { Start-Process notepad.exe $credenciales }
$final = if ($soloApp) {
    "La app de campo quedó agregada al Sistema UVA (el backend y sus datos no se modificaron).`n`n"
} else { "Sistema UVA $Version quedó instalado (web, app de campo y backend Odoo).`n`n" }
Show-Mensaje ($final +
    "Ábrelo con los accesos «Sistema UVA» y «App de campo (tablets)» del menú Inicio.`n" +
    "Direcciones, datos de acceso y cómo preparar las tablets están en CREDENCIALES.txt.") | Out-Null
Exit-Instalador 0
