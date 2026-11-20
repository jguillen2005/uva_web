#!/bin/bash
# Ejecutable de «Instalar Sistema UVA.app» (Contents/MacOS/instalar).
# Abre el instalador en una ventana de Terminal leyéndolo con bash, en lugar de ejecutar el archivo
# descargado: así macOS no lo detiene («zsh: killed») por venir de internet sin firma de Apple.
RES="$(cd "$(dirname "$0")/../Resources" && pwd)"
APP="$(cd "$RES/../.." && pwd)"

# Quita la marca de «descargado de internet» de la app y de la carpeta donde está (si macOS abrió
# la app desde una copia aislada de solo lectura, no se puede y no hace falta: bash solo lee el archivo).
xattr -cr "$APP" 2>/dev/null || true
xattr -cr "$(dirname "$APP")" 2>/dev/null || true

# Un .command temporal creado aquí (sin marca de descarga) que abre el instalador con bash y se borra solo.
LANZA="$(mktemp -t sistema-uva)" || exit 1
mv -f "$LANZA" "$LANZA.command" && LANZA="$LANZA.command"
printf '#!/bin/bash\nrm -f "%s"\nexec bash "%s" "$@"\n' "$LANZA" "$RES/instalar.command" > "$LANZA"
chmod +x "$LANZA"
open -a Terminal "$LANZA"
