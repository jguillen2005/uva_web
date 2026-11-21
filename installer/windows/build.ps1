#Requires -Version 5.1
<#
.SYNOPSIS
  Genera el instalador SistemaUVA-Instalador-Windows-<versión>.exe. El ejecutable se compila con el csc.exe
  de .NET Framework (incluido en Windows): no hace falta instalar herramientas.

.PARAMETER Version      Versión que se muestra en el instalador y en "Aplicaciones instaladas".
.PARAMETER SinInternet  Incluye las imágenes de Docker (Odoo, PostgreSQL, nginx y microservicios)
                        para instalar sin descargar nada. El .exe pesa ~1 GB.
.PARAMETER OmitirFrontend  No vuelve a compilar el frontend (usa dist\ existente).
.PARAMETER App          Carpeta del proyecto de la app de campo (repositorio asercontrol). Por omisión
                        $env:ASERCONTROL_APP o la carpeta "asercontrol" junto a este repositorio.
.PARAMETER Salida       Carpeta donde se deja el .exe (por omisión installer\windows\salida).
.PARAMETER Nombre       Nombre base del .exe.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File installer\windows\build.ps1 -Version 1.1.1 -App C:\ruta\asercontrol
  powershell -ExecutionPolicy Bypass -File installer\windows\build.ps1 -Version 1.1.1 -App C:\ruta\asercontrol -SinInternet
#>
param(
    [string]$Version = '1.1.1',
    [switch]$SinInternet,
    [switch]$OmitirFrontend,
    [string]$App = '',
    [string]$Salida = '',
    [string]$Nombre = 'SistemaUVA-Instalador-Windows'
)

$ErrorActionPreference = 'Stop'
$Aqui = $PSScriptRoot
$Repo = (Resolve-Path (Join-Path $Aqui '..\..')).Path
$Trabajo = Join-Path $Aqui '.build'
$Etapa = Join-Path $Trabajo 'etapa'
$Payload = Join-Path $Trabajo 'payload'
if (-not $Salida) { $Salida = Join-Path $Aqui 'salida' }
if (-not $App) { $App = if ($env:ASERCONTROL_APP) { $env:ASERCONTROL_APP } else { Join-Path (Split-Path $Repo) 'asercontrol' } }
if (-not (Test-Path (Join-Path $App 'package.json'))) { throw "No se encontró el proyecto de la app de campo en '$App'. Indícalo con -App." }
$Utf8Bom = New-Object System.Text.UTF8Encoding $true
$sufijo = if ($SinInternet) { '-sin-internet' } else { '' }
$Exe = Join-Path $Salida "$Nombre-$Version$sufijo.exe"

function Write-Paso([string]$t) { Write-Host "`n> $t" -ForegroundColor Cyan }
function Invoke-Nativo([scriptblock]$b) {
    $a = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { & $b } finally { $ErrorActionPreference = $a }
}

Remove-Item $Trabajo -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $Etapa, $Payload, $Salida | Out-Null

# 1. Frontend en modo API ------------------------------------------------------------------
if (-not $OmitirFrontend) {
    Write-Paso 'Compilando el frontend (VITE_DATA_SOURCE=api)'
    Push-Location $Repo
    try {
        $env:VITE_DATA_SOURCE = 'api'
        Invoke-Nativo { npm run build }
        if ($LASTEXITCODE -ne 0) { throw 'Falló npm run build.' }
    } finally { Remove-Item env:VITE_DATA_SOURCE -ErrorAction SilentlyContinue; Pop-Location }
}
if (-not (Test-Path (Join-Path $Repo 'dist\index.html'))) { throw 'No existe dist\index.html.' }

# 1b. App de campo (PWA de las tablets): misma origen que su API, /api/app en el gateway --------
Write-Paso "Compilando la app de campo ($App)"
$appDist = Join-Path $Trabajo 'app'
Push-Location $App
try {
    $env:VITE_API_URL = '/api/app'
    Invoke-Nativo { npx vite build --outDir $appDist --emptyOutDir }
    if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación de la app de campo.' }
} finally { Remove-Item env:VITE_API_URL -ErrorAction SilentlyContinue; Pop-Location }
if (-not (Test-Path (Join-Path $appDist 'index.html'))) { throw 'La app de campo no generó index.html.' }

# 2. Contenido a instalar (sin .env, dependencias ni compilados) ---------------------------
Write-Paso 'Armando el contenido'
Invoke-Nativo { robocopy (Join-Path $Repo 'backend') (Join-Path $Payload 'backend') /E /NFL /NDL /NJH /NJS /NP `
    /XD node_modules __pycache__ .git certs /XF .env .env.* *.pyc *.log } | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy backend falló ($LASTEXITCODE)." }
Invoke-Nativo { robocopy (Join-Path $Repo 'dist') (Join-Path $Payload 'dist') /E /NFL /NDL /NJH /NJS /NP } | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy dist falló ($LASTEXITCODE)." }
Invoke-Nativo { robocopy $appDist (Join-Path $Payload 'app') /E /NFL /NDL /NJH /NJS /NP } | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy app falló ($LASTEXITCODE)." }
Copy-Item (Join-Path $Repo 'backend\.env.example') (Join-Path $Payload 'backend\.env.example')
Get-ChildItem $Payload -Recurse -Force -Filter '.env' | Remove-Item -Force   # nunca empaquetar secretos
foreach ($f in 'uva.ps1') {
    $texto = [System.IO.File]::ReadAllText((Join-Path $Aqui $f))
    [System.IO.File]::WriteAllText((Join-Path $Payload $f), $texto, $Utf8Bom)   # PS 5.1 necesita BOM
}
# Manual de instalación (único documento de instrucciones; reemplaza al antiguo LEEME.txt)
Copy-Item (Join-Path $Aqui '..\manual\Manual de instalacion Sistema UVA.pdf') (Join-Path $Payload 'Manual de instalacion Sistema UVA.pdf')

# Ícono (PNG dentro de un .ico, válido desde Windows Vista)
Add-Type -AssemblyName System.Drawing
$logo = [System.Drawing.Image]::FromFile((Join-Path $Repo 'public\brand\logo-uva.png'))
$tamanos = 256, 48, 32, 16
$pngs = foreach ($t in $tamanos) {
    $bmp = New-Object System.Drawing.Bitmap $t, $t
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'; $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($logo, 0, 0, $t, $t); $g.Dispose()
    $ms = New-Object System.IO.MemoryStream; $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
    , $ms.ToArray()
}
$logo.Dispose()
$ico = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $ico
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$tamanos.Count)
$offset = 6 + 16 * $tamanos.Count
for ($i = 0; $i -lt $tamanos.Count; $i++) {
    $t = $tamanos[$i]; $b = if ($t -ge 256) { 0 } else { $t }
    $w.Write([byte]$b); $w.Write([byte]$b); $w.Write([byte]0); $w.Write([byte]0)
    $w.Write([uint16]1); $w.Write([uint16]32); $w.Write([uint32]$pngs[$i].Length); $w.Write([uint32]$offset)
    $offset += $pngs[$i].Length
}
foreach ($p in $pngs) { $w.Write($p) }
$w.Flush(); [System.IO.File]::WriteAllBytes((Join-Path $Payload 'uva.ico'), $ico.ToArray()); $w.Dispose()

Compress-Archive -Path (Join-Path $Payload '*') -DestinationPath (Join-Path $Etapa 'payload.zip') -CompressionLevel Optimal

$setup = [System.IO.File]::ReadAllText((Join-Path $Aqui 'setup.ps1'))
[System.IO.File]::WriteAllText((Join-Path $Etapa 'setup.ps1'), $setup, $Utf8Bom)
[System.IO.File]::WriteAllText((Join-Path $Etapa 'version.txt'), $Version)

# 3. Imágenes de Docker (opcional) ---------------------------------------------------------
if ($SinInternet) {
    $svc = "sistema-uva-servicios:$Version"
    Write-Paso "Construyendo la imagen de microservicios ($svc)"
    Invoke-Nativo { docker build -t $svc (Join-Path $Repo 'backend\services') }
    if ($LASTEXITCODE -ne 0) { throw 'Falló docker build.' }
    $imagenes = @('postgres:17', 'odoo:19.0', 'nginx:1.27-alpine', $svc)
    foreach ($im in $imagenes[0..2]) {
        Invoke-Nativo { docker image inspect $im *> $null }
        if ($LASTEXITCODE -ne 0) { Invoke-Nativo { docker pull $im }; if ($LASTEXITCODE -ne 0) { throw "No se pudo descargar $im." } }
    }
    Write-Paso "Exportando imágenes ($($imagenes -join ', '))"
    $tar = Join-Path $Trabajo 'imagenes.tar'
    Invoke-Nativo { docker save -o $tar @imagenes }
    if ($LASTEXITCODE -ne 0) { throw 'Falló docker save.' }
    Write-Paso 'Comprimiendo imágenes (varios minutos)'
    $gz = Join-Path $Etapa 'imagenes.tar.gz'
    $in = [System.IO.File]::OpenRead($tar); $out = [System.IO.File]::Create($gz)
    $z = New-Object System.IO.Compression.GZipStream($out, [System.IO.Compression.CompressionLevel]::Optimal)
    $in.CopyTo($z, 4MB); $z.Dispose(); $out.Dispose(); $in.Dispose()
    Remove-Item $tar -Force
    [System.IO.File]::WriteAllText((Join-Path $Etapa 'servicios.txt'), $svc)
    Write-Host ("  imagenes.tar.gz: {0:N0} MB" -f ((Get-Item $gz).Length / 1MB))
}

# 4. Ejecutable autoextraíble -------------------------------------------------------------
# Un .exe propio (C#) con el zip pegado al final: sin el límite de tamaño de IExpress y con ícono.
Write-Paso 'Compilando el ejecutable del instalador'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw 'No se encontró csc.exe de .NET Framework 4.x.' }
$stub = Join-Path $Trabajo 'stub.exe'
$net = Split-Path $csc
Invoke-Nativo { & $csc /nologo /target:exe /optimize+ /platform:anycpu "/out:$stub" `
    "/win32icon:$(Join-Path $Payload 'uva.ico')" "/win32manifest:$(Join-Path $Aqui 'stub\Instalador.manifest')" `
    "/r:$net\System.IO.Compression.dll" "/r:$net\System.IO.Compression.FileSystem.dll" `
    (Join-Path $Aqui 'stub\Instalador.cs') }
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $stub)) { throw 'No compiló el ejecutable del instalador.' }

Write-Paso 'Empaquetando'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = Join-Path $Trabajo 'contenido.zip'
# Sin recompresión: payload.zip e imagenes.tar.gz ya están comprimidos.
[System.IO.Compression.ZipFile]::CreateFromDirectory($Etapa, $zip, [System.IO.Compression.CompressionLevel]::NoCompression, $false)
Remove-Item $Exe -Force -ErrorAction SilentlyContinue
$salidaExe = [System.IO.File]::Create($Exe)
try {
    foreach ($parte in $stub, $zip) {
        $in = [System.IO.File]::OpenRead($parte); $in.CopyTo($salidaExe, 4MB); $in.Dispose()
    }
    $largo = (Get-Item $zip).Length
    $cola = [System.BitConverter]::GetBytes([int64]$largo) + [System.Text.Encoding]::ASCII.GetBytes('UVASFX01')
    $salidaExe.Write($cola, 0, $cola.Length)
} finally { $salidaExe.Dispose() }

Remove-Item $Trabajo -Recurse -Force
$mb = (Get-Item $Exe).Length / 1MB
Write-Host ("`n  Instalador listo: {0}  ({1:N1} MB)" -f $Exe, $mb) -ForegroundColor Green
