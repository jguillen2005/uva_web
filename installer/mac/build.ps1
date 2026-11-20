#Requires -Version 5.1
<#
.SYNOPSIS
  Genera el instalador para Mac (Apple o Intel): un .zip con «Instalar Sistema UVA.command» y la carpeta
  contenido/ (web, app de campo, backend Odoo y uva.sh). Se ejecuta en Windows (o en cualquier equipo
  con PowerShell, Node/npm y Python).

.PARAMETER Version  Versión que muestra el instalador.
.PARAMETER App      Carpeta del proyecto de la app de campo (repositorio asercontrol).
.PARAMETER Salida   Carpeta donde se deja el .zip.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File installer\mac\build.ps1 -Version 1.1.1 -App C:\ruta\asercontrol
#>
param(
    [string]$Version = '1.1.1',
    [string]$App = '',
    [string]$Salida = '',
    [string]$Nombre = 'SistemaUVA-Instalador-Mac'
)

$ErrorActionPreference = 'Stop'
$Aqui = $PSScriptRoot
$Repo = (Resolve-Path (Join-Path $Aqui '..\..')).Path
$Trabajo = Join-Path $Aqui '.build'
$Raiz = Join-Path $Trabajo 'Instalador Sistema UVA'
# Doble clic en «Instalar Sistema UVA.app»: abre el instalador con bash en Terminal (macOS no lo detiene).
# El contenido va dentro de la app para que funcione aunque macOS la abra desde una copia aislada.
$AppMac = Join-Path $Raiz 'Instalar Sistema UVA.app'
$Recursos = Join-Path $AppMac 'Contents\Resources'
$Contenido = Join-Path $Recursos 'contenido'
if (-not $Salida) { $Salida = Join-Path $Aqui 'salida' }
if (-not $App) { $App = if ($env:ASERCONTROL_APP) { $env:ASERCONTROL_APP } else { Join-Path (Split-Path $Repo) 'asercontrol' } }
if (-not (Test-Path (Join-Path $App 'package.json'))) { throw "No se encontró el proyecto de la app de campo en '$App'. Indícalo con -App." }
$Zip = Join-Path $Salida "$Nombre-$Version.zip"

function Write-Paso([string]$t) { Write-Host "`n> $t" -ForegroundColor Cyan }
function Invoke-Nativo([scriptblock]$b) { $a = $ErrorActionPreference; $ErrorActionPreference = 'Continue'; try { & $b } finally { $ErrorActionPreference = $a } }

Remove-Item $Trabajo -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $Contenido, $Salida | Out-Null

Write-Paso 'Compilando la web del Sistema UVA (VITE_DATA_SOURCE=api)'
Push-Location $Repo
try { $env:VITE_DATA_SOURCE = 'api'; Invoke-Nativo { npx vite build --outDir (Join-Path $Contenido 'dist') --emptyOutDir }; if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación de la web.' } }
finally { Remove-Item env:VITE_DATA_SOURCE -ErrorAction SilentlyContinue; Pop-Location }

Write-Paso "Compilando la app de campo ($App)"
Push-Location $App
try { $env:VITE_API_URL = '/api/app'; Invoke-Nativo { npx vite build --outDir (Join-Path $Contenido 'app') --emptyOutDir }; if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación de la app de campo.' } }
finally { Remove-Item env:VITE_API_URL -ErrorAction SilentlyContinue; Pop-Location }

Write-Paso 'Armando el contenido'
Invoke-Nativo { robocopy (Join-Path $Repo 'backend') (Join-Path $Contenido 'backend') /E /NFL /NDL /NJH /NJS /NP `
    /XD node_modules __pycache__ .git certs /XF .env .env.* *.pyc *.log } | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy backend falló ($LASTEXITCODE)." }
Get-ChildItem $Contenido -Recurse -Force -Filter '.env' | Remove-Item -Force   # nunca empaquetar secretos
Copy-Item (Join-Path $Aqui '..\comun\uva.sh') (Join-Path $Contenido 'uva.sh')
Copy-Item (Join-Path $Aqui 'LEEME.txt') (Join-Path $Contenido 'LEEME.txt')
Copy-Item (Join-Path $Aqui 'LEEME.txt') (Join-Path $Raiz 'LEEME.txt')
Copy-Item (Join-Path $Aqui 'instalar.command') (Join-Path $Raiz 'Instalar Sistema UVA.command')
Copy-Item (Join-Path $Aqui 'instalar.command') (Join-Path $Recursos 'instalar.command')
[System.IO.File]::WriteAllText((Join-Path $Contenido 'version.txt'), $Version)

Write-Paso 'Armando «Instalar Sistema UVA.app»'
$macos = Join-Path $AppMac 'Contents\MacOS'
New-Item -ItemType Directory -Force $macos | Out-Null
Copy-Item (Join-Path $Aqui 'lanzador.sh') (Join-Path $macos 'instalar')
$plist = @"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>instalar</string>
  <key>CFBundleIdentifier</key><string>mx.asercontrol.sistemauva.instalador</string>
  <key>CFBundleName</key><string>Instalar Sistema UVA</string>
  <key>CFBundleDisplayName</key><string>Instalar Sistema UVA</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$Version</string>
  <key>CFBundleVersion</key><string>$Version</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
"@
[System.IO.File]::WriteAllText((Join-Path $AppMac 'Contents\Info.plist'), $plist.Replace("`r`n", "`n"))
# Ícono de la app (Pillow, si está disponible; si no, macOS muestra el ícono genérico)
$icono = Join-Path $Contenido 'app\app-icons\icon-512.png'
Invoke-Nativo { python -I -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGBA').save(sys.argv[2], sizes=[(16,16),(32,32),(64,64),(128,128),(256,256),(512,512)])" $icono (Join-Path $Recursos 'AppIcon.icns') 2>$null }
if (-not (Test-Path (Join-Path $Recursos 'AppIcon.icns'))) { Write-Host '  (sin ícono: falta Pillow en Python)' -ForegroundColor Yellow }

Write-Paso 'Comprimiendo (con permisos de ejecución para Mac)'
# Python escribe los permisos Unix en el zip: sin ellos el .command no se puede ejecutar en macOS.
$py = @'
import os, sys, zipfile
raiz, destino = sys.argv[1], sys.argv[2]
base = os.path.dirname(raiz)
ejecutables = ('.command', '.sh')
texto_unix = ('.command', '.sh', '.conf', '.yml', '.txt', '.env.example')
with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED) as z:
    for carpeta, _, archivos in os.walk(raiz):
        for nombre in sorted(archivos):
            ruta = os.path.join(carpeta, nombre)
            arc = os.path.relpath(ruta, base).replace(os.sep, '/')
            info = zipfile.ZipInfo.from_file(ruta, arc)
            info.compress_type = zipfile.ZIP_DEFLATED
            lanzador = '.app/Contents/MacOS/' in arc  # ejecutable de la app
            modo = 0o755 if nombre.endswith(ejecutables) or lanzador else 0o644
            info.external_attr = (0o100000 | modo) << 16
            info.create_system = 3  # Unix: macOS respeta los permisos
            datos = open(ruta, 'rb').read()
            if nombre.endswith(texto_unix) or lanzador or nombre == 'Info.plist':
                datos = datos.replace(b'\r\n', b'\n')  # finales de línea de Unix
            z.writestr(info, datos)
print('ok')
'@
$pyFile = Join-Path $Trabajo 'zip_mac.py'
[System.IO.File]::WriteAllText($pyFile, $py)
Remove-Item $Zip -Force -ErrorAction SilentlyContinue
Invoke-Nativo { python -I $pyFile $Raiz $Zip }
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Zip)) { throw 'No se pudo crear el .zip.' }

Remove-Item $Trabajo -Recurse -Force
Write-Host ("`n  Instalador para Mac listo: {0}  ({1:N1} MB)" -f $Zip, ((Get-Item $Zip).Length / 1MB)) -ForegroundColor Green
