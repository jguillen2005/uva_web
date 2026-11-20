#!/bin/bash
# Ejecutable de «Instalar Sistema UVA.app» (Contents/MacOS/instalar).
#
# macOS ejecuta la app descargada desde una copia aislada temporal (App Translocation) que deja de poderse
# leer cuando la app termina. Por eso la app, MIENTRAS SIGUE ABIERTA, copia el instalador a una carpeta
# temporal propia (sin marcas de descarga) y abre ahí una ventana de Terminal que lo ejecuta con bash.
# No necesita permisos especiales (ni «Acceso total al disco»).
RES="$(cd "$(dirname "$0")/../Resources" && pwd)"
TMP_BASE="${TMPDIR:-/tmp}"; TMP_BASE="${TMP_BASE%/}"

aviso() {
  osascript -e "display dialog \"$1\" with title \"Instalador Sistema UVA\" buttons {\"OK\"} default button \"OK\" with icon stop" >/dev/null 2>&1 || true
}

# 1. Copia del instalador fuera de la app (solo contenido, sin atributos de macOS)
TRABAJO="$(mktemp -d "$TMP_BASE/sistema-uva-instalador.XXXXXX")" || { aviso 'No se pudo crear una carpeta temporal para el instalador.'; exit 1; }
mkdir -p "$TRABAJO/instalador"
if command -v ditto >/dev/null 2>&1; then
  ditto --noqtn --noextattr --noacl "$RES" "$TRABAJO/instalador" 2>/dev/null
else
  cp -R "$RES/." "$TRABAJO/instalador/" 2>/dev/null
fi
xattr -cr "$TRABAJO" 2>/dev/null || true
if [ ! -f "$TRABAJO/instalador/instalar.command" ] || [ ! -f "$TRABAJO/instalador/contenido/uva.sh" ]; then
  rm -rf "$TRABAJO"
  aviso 'No se pudo preparar el instalador. Mueva la carpeta «Instalador Sistema UVA» al Escritorio y vuelva a abrir «Instalar Sistema UVA».'
  exit 1
fi

# 2. Ventana de Terminal: un .command local (sin marca de descarga) que ejecuta el instalador con bash y,
#    al terminar, borra la copia temporal.
LANZA="$(mktemp "$TMP_BASE/sistema-uva.XXXXXX")" || exit 1
mv -f "$LANZA" "$LANZA.command" && LANZA="$LANZA.command"
printf '#!/bin/bash\nrm -f "%s"\nbash "%s" "$@"\nr=$?\nrm -rf "%s"\nexit $r\n' "$LANZA" "$TRABAJO/instalador/instalar.command" "$TRABAJO" > "$LANZA"
chmod +x "$LANZA"
open -a Terminal "$LANZA"
