# Manual de instalación (para desarrolladores)

`Manual de instalacion Sistema UVA.pdf` es el **único documento de instrucciones** que acompaña a los
instaladores de Windows, Mac y Linux (reemplaza a los antiguos `LEEME.txt`). Los `build.ps1` lo copian al
paquete y los instaladores lo dejan en la carpeta del sistema, con el acceso «Manual del Sistema UVA».
`CREDENCIALES.txt` (lo genera `uva.ps1`/`uva.sh` en cada instalación) remite a este manual.

Está escrito para personas que **no son del área de sistemas**: lenguaje claro, un paso por acción y una
imagen por paso. Lo técnico va solo en el anexo final.

## Regenerarlo (por ejemplo, al cambiar de versión o de pantallas)

```powershell
cd installer\manual
npm install
# 1. Capturas reales de la web y la app (con el Sistema UVA instalado en este equipo: web 8080, app 8443)
node capturas-manual.js capturas <contraseña de admin>
# 2. Ilustraciones (ventanas de Windows/Mac/Linux, ajustes de Android/iPhone) y marcos de teléfono
node figuras.js capturas fig node_modules
#    fig/w-opciones.png es una captura de la ventana de opciones de setup.ps1 (Show-Opciones)
# 3. Word
node generar-manual.js 1.1.1
```

4. Abrir `Manual de instalacion Sistema UVA.docx` en Word, actualizar el índice (clic derecho › Actualizar
   campos) y guardar como PDF con el mismo nombre. O con PowerShell:

```powershell
$w = New-Object -ComObject Word.Application; $d = $w.Documents.Open("$PWD\Manual de instalacion Sistema UVA.docx")
$d.TablesOfContents | ForEach-Object { $_.Update() }; $d.Save()
$d.SaveAs([ref]"$PWD\Manual de instalacion Sistema UVA.pdf", [ref]17); $d.Close(); $w.Quit()
```

5. Volver a generar los instaladores (`installer\<so>\build.ps1`): toman el PDF de esta carpeta.
