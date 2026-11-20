#Requires -Version 5.1
<#
.SYNOPSIS
  Genera el instalador para Linux (Ubuntu 22.04 o superior, amd64 o arm64): un .tar.gz con
  «Instalar Sistema UVA.sh» y la carpeta contenido/ (web, app de campo, backend Odoo, APK y uva.sh).
  Se ejecuta en Windows (o en cualquier equipo con PowerShell, Node/npm y Python).

.PARAMETER Version  Versión que muestra el instalador.
.PARAMETER App      Carpeta del proyecto de la app de campo (repositorio asercontrol).
.PARAMETER Apk      APK de la app de campo (opcional) para dejarlo en la carpeta instalada.
.PARAMETER Salida   Carpeta donde se deja el .tar.gz.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File installer\linux\build.ps1 -Version 1.1.1 -App C:\ruta\asercontrol -Apk C:\ruta\Asercontrol-Campo.apk
#>
param(
    [string]$Version = '1.1.1',
    [string]$App = '',
    [string]$Apk = '',
    [string]$Salida = '',
    [string]$Nombre = 'SistemaUVA-Instalador-Linux'
)

$ErrorActionPreference = 'Stop'
$Aqui = $PSScriptRoot
$Repo = (Resolve-Path (Join-Path $Aqui '..\..')).Path
$Trabajo = Join-Path $Aqui '.build'
$Raiz = Join-Path $Trabajo 'Instalador Sistema UVA'
$Contenido = Join-Path $Raiz 'contenido'
if (-not $Salida) { $Salida = Join-Path $Aqui 'salida' }
if (-not $App) { $App = if ($env:ASERCONTROL_APP) { $env:ASERCONTROL_APP } else { Join-Path (Split-Path $Repo) 'asercontrol' } }
if (-not (Test-Path (Join-Path $App 'package.json'))) { throw "No se encontró el proyecto de la app de campo en '$App'. Indícalo con -App." }
$Paquete = Join-Path $Salida "$Nombre-$Version.tar.gz"

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
Copy-Item (Join-Path $Aqui 'instalar.sh') (Join-Path $Raiz 'Instalar Sistema UVA.sh')
[System.IO.File]::WriteAllText((Join-Path $Contenido 'version.txt'), $Version)
if ($Apk) { Copy-Item $Apk (Join-Path $Contenido 'Asercontrol-Campo.apk') }

Write-Paso 'Comprimiendo (.tar.gz con permisos de ejecución)'
$py = @'
import io, os, sys, tarfile, time
raiz, destino = sys.argv[1], sys.argv[2]
base = os.path.dirname(raiz)
ejecutables = ('.sh',)
texto_unix = ('.sh', '.conf', '.yml', '.txt', '.env.example')
ahora = time.time()
with tarfile.open(destino, 'w:gz') as t:
    for carpeta, dirs, archivos in os.walk(raiz):
        dirs.sort()
        rel = os.path.relpath(carpeta, base).replace(os.sep, '/')
        d = tarfile.TarInfo(rel); d.type = tarfile.DIRTYPE; d.mode = 0o755; d.mtime = ahora
        t.addfile(d)
        for nombre in sorted(archivos):
            ruta = os.path.join(carpeta, nombre)
            datos = open(ruta, 'rb').read()
            if nombre.endswith(texto_unix):
                datos = datos.replace(b'\r\n', b'\n')  # finales de línea de Unix
            info = tarfile.TarInfo(rel + '/' + nombre)
            info.size = len(datos); info.mtime = ahora
            info.mode = 0o755 if nombre.endswith(ejecutables) else 0o644
            t.addfile(info, io.BytesIO(datos))
print('ok')
'@
$pyFile = Join-Path $Trabajo 'tar_linux.py'
[System.IO.File]::WriteAllText($pyFile, $py)
Remove-Item $Paquete -Force -ErrorAction SilentlyContinue
Invoke-Nativo { python -I $pyFile $Raiz $Paquete }
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Paquete)) { throw 'No se pudo crear el .tar.gz.' }

Remove-Item $Trabajo -Recurse -Force
Write-Host ("`n  Instalador para Linux listo: {0}  ({1:N1} MB)" -f $Paquete, ((Get-Item $Paquete).Length / 1MB)) -ForegroundColor Green
