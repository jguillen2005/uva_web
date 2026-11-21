#Requires -Version 5.1
<#
.SYNOPSIS
  Asistente de instalación del Sistema UVA. Lo ejecuta SistemaUVA-Instalador-Windows-<versión>.exe.

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
    [switch]$ActualizarSistema,
    # Si ya hay un Sistema UVA: respaldo en Documentos, desinstalar con sus datos e instalar desde cero.
    [switch]$Reinstalar
)
# Si el sistema ya está instalado, se usa su carpeta (registrada en "Aplicaciones instaladas").
$RegUva = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SistemaUVA'
if (-not $Destino) {
    $registrada = (Get-ItemProperty $RegUva -Name InstallLocation -ErrorAction SilentlyContinue).InstallLocation
    $Destino = if ($registrada -and (Test-Path (Join-Path $registrada 'backend\.env'))) { $registrada } else { Join-Path $env:LOCALAPPDATA 'Programs\SistemaUVA' }
}

$ErrorActionPreference = 'Stop'
$Origen = $PSScriptRoot
$Version = if (Test-Path (Join-Path $Origen 'version.txt')) { (Get-Content (Join-Path $Origen 'version.txt') -Raw).Trim() } else { '1.1.1' }
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
function Show-Opciones([string]$Texto, [array]$Opciones) {
    # Ventana con un botón por opción y su descripción al lado. $Opciones: @(@('Botón', 'Descripción'), ...)
    # Devuelve el texto del botón elegido ('' si se cierra la ventana).
    Write-Host ''; Write-Host "  $Texto" -ForegroundColor Gray
    foreach ($o in $Opciones) { Write-Host "    $($o[0]): $($o[1])" -ForegroundColor Gray }
    if ($Silencioso) { return '' }
    Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing
    $f = New-Object System.Windows.Forms.Form
    $f.Text = "Instalador Sistema UVA $Version"; $f.StartPosition = 'CenterScreen'; $f.TopMost = $true
    $f.FormBorderStyle = 'FixedDialog'; $f.MaximizeBox = $false; $f.MinimizeBox = $false
    $f.Font = New-Object System.Drawing.Font('Segoe UI', 9.75)
    $ancho = 620
    $l = New-Object System.Windows.Forms.Label
    $l.Text = $Texto; $l.Location = New-Object System.Drawing.Point(20, 18); $l.Font = $f.Font
    $l.Size = $l.GetPreferredSize((New-Object System.Drawing.Size(($ancho - 40), 0)))
    $f.Controls.Add($l)
    $y = 18 + $l.Height + 16
    foreach ($o in $Opciones) {
        $b = New-Object System.Windows.Forms.Button
        $b.Text = $o[0]; $b.Tag = $o[0]; $b.Size = New-Object System.Drawing.Size(180, 34); $b.Location = New-Object System.Drawing.Point(20, $y)
        $b.Add_Click({ $f.Tag = $this.Tag; $f.Close() })
        $d = New-Object System.Windows.Forms.Label
        $d.Text = $o[1]; $d.Location = New-Object System.Drawing.Point(212, ($y + 1)); $d.ForeColor = [System.Drawing.Color]::FromArgb(70, 70, 70); $d.Font = $f.Font
        $d.Size = $d.GetPreferredSize((New-Object System.Drawing.Size(($ancho - 232), 0)))
        $f.Controls.Add($b); $f.Controls.Add($d)
        $y += [Math]::Max(34, $d.Height) + 12
        if ($o[0] -eq $Opciones[0][0]) { $f.AcceptButton = $b }
    }
    $f.ClientSize = New-Object System.Drawing.Size($ancho, ($y + 8))
    [void]$f.ShowDialog()
    return [string]$f.Tag
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
# Instalado = configuración completa; una instalación interrumpida se retoma como nueva (conserva lo hecho)
$envDestino = Join-Path $Destino 'backend\.env'
$existente = (Test-Path $envDestino) -and ((Get-Content $envDestino -ErrorAction SilentlyContinue) -contains 'UVA_ADMIN_CONFIGURADO=1')
$actualizacion = $existente -and $ActualizarSistema
$reinstalar = $existente -and $Reinstalar -and -not $ActualizarSistema
$soloApp = $existente -and -not $ActualizarSistema -and -not $Reinstalar
if ($soloApp -and -not $Silencioso) {
    Write-Host "  Se detectó el Sistema UVA (backend Odoo) instalado en $Destino." -ForegroundColor Green
    $r = Show-Opciones "Se detectó el Sistema UVA ya instalado en $Destino. ¿Qué desea hacer?" @(
        @('Actualizar todo', "Instala la versión $Version en la web, Odoo y la app. Respalda la base y conserva clientes, visitas y usuarios."),
        @('Reinstalar desde cero', 'Guarda un respaldo en Documentos, borra la instalación anterior con todos sus datos e instala la versión nueva limpia.'),
        @('Solo la app', 'Actualiza solo la app de campo; la web, Odoo y los datos no cambian.'),
        @('Cancelar', 'Salir sin hacer cambios.'))
    switch ($r) {
        'Actualizar todo' { $soloApp = $false; $actualizacion = $true }
        'Reinstalar desde cero' {
            $c = Show-Mensaje ("Reinstalar desde cero borra la instalación anterior y TODOS sus datos (clientes, visitas, actas y usuarios).`n`n" +
                "Antes se guarda un respaldo de la base de datos en su carpeta Documentos.`n`n¿Continuar?") 'YesNo' 'Warning'
            if ($c -ne 'Yes') { Exit-Instalador 0 }
            $soloApp = $false; $reinstalar = $true
        }
        'Solo la app' { }
        default { Exit-Instalador 0 }
    }
} elseif ($soloApp) {
    # Modo silencioso sin -ActualizarSistema ni -Reinstalar: solo la app (no toca el backend ni los datos).
    Write-Host "  Se detectó el Sistema UVA (backend Odoo) instalado en ${Destino}: se actualiza solo la app de campo." -ForegroundColor Green
} elseif ($actualizacion) {
    if ((Show-Mensaje "El Sistema UVA ya está instalado en:`n$Destino`n`n¿Actualizarlo a la versión $Version? Se respalda la base de datos antes y se conservan los datos." 'YesNo' 'Question') -eq 'No') { Exit-Instalador 0 }
}
if (-not $existente -or $reinstalar) {
    if (-not $reinstalar) { Write-Host '  No se encontró el Sistema UVA en este equipo: se instalará completo (Odoo, base de datos, web y app de campo).' }
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
if ($reinstalar) {
    # Reinstalar desde cero: respaldo en Documentos, desinstalar la versión anterior con sus datos (conservando la
    # autoridad de certificados: los teléfonos siguen confiando en el servidor) y seguir como instalación nueva.
    # Se usa el uva.ps1 de esta versión (el anterior no conoce -ConservarCertificado).
    $psExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    Copy-Item (Join-Path $tmp 'uva.ps1') $uva -Force
    Write-Paso 'Reinstalar desde cero: respaldo de la versión anterior'
    $copia = $null
    & $psExe -NoProfile -ExecutionPolicy Bypass -File $uva respaldar -Silencioso
    $ultimo = Get-ChildItem (Join-Path $Destino 'respaldos') -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($LASTEXITCODE -eq 0 -and $ultimo) {
        $copia = Join-Path ([Environment]::GetFolderPath('MyDocuments')) ('Respaldo Sistema UVA ' + $ultimo.Name)
        Copy-Item $ultimo.FullName $copia -Recurse -Force
        Write-Host "  OK  Respaldo guardado en $copia" -ForegroundColor Green
    } else {
        $c = Show-Mensaje ("No se pudo respaldar la base de datos (¿Docker Desktop está abierto?).`n`n" +
            "Si continúa, los datos actuales se borran SIN respaldo. ¿Continuar?") 'YesNo' 'Warning'
        if ($c -ne 'Yes') { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue; Exit-Instalador 1 }
    }
    Write-Paso 'Desinstalando la versión anterior'
    & $psExe -NoProfile -ExecutionPolicy Bypass -File $uva desinstalar -Silencioso -EliminarDatos -ConservarCertificado
    # uva.ps1 borra su carpeta unos segundos después de terminar (no puede borrarse mientras corre)
    for ($i = 0; $i -lt 30 -and (Test-Path $Destino); $i++) { Start-Sleep -Seconds 1 }
    if (Test-Path $Destino) { Remove-Item $Destino -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path $envDestino) {
        Show-Mensaje "No se pudo desinstalar la versión anterior. Revise la bitácora en:`n$(Join-Path $Destino 'logs')" 'OK' 'Error' | Out-Null
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue; Exit-Instalador 1
    }
    Write-Host "  OK  Versión anterior desinstalada. Se instala la versión $Version desde cero." -ForegroundColor Green
    New-Item -ItemType Directory -Force $Destino | Out-Null
}
if ($soloApp) {
    # Solo la app de campo, su módulo de Odoo, la configuración del gateway y los scripts de administración.
    foreach ($d in @('app', 'backend\odoo\addons\uva_app_movil')) {
        $p = Join-Path $Destino $d
        if (Test-Path $p) { Remove-Item $p -Recurse -Force }
        Copy-Item (Join-Path $tmp $d) $p -Recurse -Force
    }
    foreach ($f in @('backend\gateway\app.conf', 'backend\docker-compose.app.yml', 'uva.ps1', 'Manual de instalacion Sistema UVA.pdf')) {
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
    if ($confGuardada) {
        # Se conserva la configuración (contraseña maestra); solo se sube el valor anterior de procesos (2 -> 4).
        $confGuardada = [regex]::Replace($confGuardada, '(?m)^workers = 2(\r?)$', 'workers = 4$1')
        [System.IO.File]::WriteAllText($confActual, $confGuardada)
    }
}
Remove-Item $tmp -Recurse -Force
Remove-Item (Join-Path $Destino 'LEEME.txt') -Force -ErrorAction SilentlyContinue   # reemplazado por el manual en PDF
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
New-Acceso (Join-Path $menu 'Renovar conexión de teléfonos.lnk') 'regenerar-certificado' 'Si cambió el módem o la red de la oficina: los teléfonos vuelven a conectarse' 'Normal'
New-Acceso (Join-Path $menu 'Desinstalar Sistema UVA.lnk') 'desinstalar' 'Quitar el Sistema UVA' 'Normal'
$manual = $shell.CreateShortcut((Join-Path $menu 'Manual del Sistema UVA.lnk'))
$manual.TargetPath = Join-Path $Destino 'Manual de instalacion Sistema UVA.pdf'; $manual.Description = 'Instrucciones de instalación y uso'; $manual.Save()
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

# ------------------------------------------------------------------ acceso desde teléfonos y tablets
# Windows bloquea las conexiones que llegan de otros equipos. En lugar de pedir al usuario que pegue comandos,
# el instalador lo hace con su permiso (ventana de Control de cuentas de usuario). Solo redes privadas.
function Get-ValorEnv([string]$Clave, [string]$Pred) {
    $l = Get-Content $envDestino -ErrorAction SilentlyContinue | Where-Object { $_ -like "$Clave=*" } | Select-Object -First 1
    if ($l) { $l.Substring($Clave.Length + 1).Trim() } else { $Pred }
}
$puertoWeb = Get-ValorEnv 'GATEWAY_PORT' '8080'; $puertoApp = Get-ValorEnv 'APP_PORT' '8443'
$regla = 'Sistema UVA - App de campo y web'
function Test-ReglaFirewall {
    try {
        $r = @(Get-NetFirewallRule -DisplayName $regla -ErrorAction Stop | Where-Object { $_.Enabled -eq 'True' })
        if (-not $r) { return $false }
        $p = @($r | Get-NetFirewallPortFilter | ForEach-Object { $_.LocalPort })
        return ($p -contains $puertoWeb) -and ($p -contains $puertoApp)
    } catch { return $false }
}
if (-not $Silencioso -and -not (Test-ReglaFirewall)) {
    $r = Show-Mensaje ("Último paso: permitir que los teléfonos y tablets se conecten a esta computadora.`n`n" +
        "Al elegir Sí, Windows mostrará una ventana que pregunta «¿Quiere permitir que esta aplicación haga cambios en el dispositivo?». Elija Sí.`n`n" +
        "(La red Wi-Fi de la oficina quedará marcada como red privada. Si elige No, el sistema funcionará en esta computadora, pero los teléfonos no podrán conectarse.)") 'YesNo' 'Question'
    if ($r -eq 'Yes') {
        $cmd = "Get-NetConnectionProfile | Where-Object { `$_.NetworkCategory -eq 'Public' } | Set-NetConnectionProfile -NetworkCategory Private; " +
               "Remove-NetFirewallRule -DisplayName '$regla' -ErrorAction SilentlyContinue; " +
               "New-NetFirewallRule -DisplayName '$regla' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $puertoWeb,$puertoApp -Profile Private,Domain | Out-Null"
        $codificado = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
        try {
            Start-Process $ps -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $codificado
        } catch { }
        if (Test-ReglaFirewall) {
            Write-Host '  OK  Los teléfonos y tablets ya pueden conectarse a esta computadora.' -ForegroundColor Green
        } else {
            Show-Mensaje ("No se pudo dar el permiso (quizá se eligió No en la ventana de Windows).`n`n" +
                "Puede hacerlo después volviendo a abrir este instalador y eligiendo «Solo la app». Consulte la guía de instalación, paso «Permitir que los teléfonos se conecten».") 'OK' 'Warning' | Out-Null
        }
    }
}

if (-not $SinAbrir) { & $ps -NoProfile -ExecutionPolicy Bypass -File $uva abrir }
$credenciales = Join-Path $Destino 'CREDENCIALES.txt'
if (-not $Silencioso -and (Test-Path $credenciales)) { Start-Process notepad.exe $credenciales }
$final = if ($soloApp) {
    "La app de campo quedó actualizada. Los datos del sistema no se modificaron.`n`n"
} else { "¡Listo! El Sistema UVA $Version quedó instalado en esta computadora.`n`n" }
Show-Mensaje ($final +
    "Para abrirlo use el ícono «Sistema UVA» del escritorio.`n`n" +
    "Se abrió el archivo CREDENCIALES.txt con su usuario y contraseña: guárdelo en un lugar seguro.") | Out-Null
Exit-Instalador 0
