#!/usr/bin/env bash
# Crea la base de datos "uva" en Odoo 19, instala los módulos del Sistema UVA con sus datos semilla,
# genera la API key del usuario técnico api_uva para los microservicios y levanta todo el stack.
# Uso (desde backend/):  ./scripts/bootstrap.sh            (Git Bash en Windows)
#        Reinstalar desde cero:  ./scripts/bootstrap.sh --reset
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || cp .env.example .env
set -a; . ./.env; set +a
DB="${ODOO_DB:-uva}"

if [ "${1:-}" = "--reset" ]; then
  echo "⚠  Eliminando contenedores y volúmenes (base de datos y filestore)…"
  docker compose down -v
fi

echo "▶ Levantando PostgreSQL…"
docker compose up -d --wait db

if docker compose exec -T db psql -U odoo -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1; then
  echo "▶ La base '$DB' ya existe: se omite la instalación (usa --reset para recrearla)."
else
  echo "▶ Creando base '$DB' e instalando módulos (puede tardar varios minutos la primera vez)…"
  docker compose run --rm odoo odoo -d "$DB" -i uva_demo,uva_legal --load-language=es_MX --stop-after-init --no-http
fi

echo "▶ Configurando idioma, contraseña de admin y API key del usuario api_uva…"
OUT=$(docker compose run --rm -T odoo odoo shell -d "$DB" --no-http --log-level=warn <<PY
admin = env.ref('base.user_admin')
admin.write({'lang': 'es_MX', 'tz': 'America/Mexico_City', 'password': '${ODOO_ADMIN_PASSWORD:-admin}'})
user = env['res.users'].search([('login', '=', 'api_uva')], limit=1)
assert user, 'No existe el usuario api_uva (¿se instaló uva_demo?)'
env['res.users.apikeys'].sudo().search([('user_id', '=', user.id), ('name', '=', 'microservicios')]).unlink()
# Odoo 19 exige vencimiento en las API keys: 90 días, el máximo por defecto (vuelve a correr este script para rotarla)
from datetime import timedelta
from odoo import fields
key = env['res.users.apikeys'].with_user(user)._generate(None, 'microservicios', fields.Datetime.now() + timedelta(days=89))
env.cr.commit()
print('UVA_API_KEY=' + key)
PY
)
KEY=$(printf '%s\n' "$OUT" | sed -n 's/^UVA_API_KEY=//p' | tail -1 | tr -d '\r')
if [ -z "$KEY" ]; then
  echo "✖ No se pudo generar la API key. Salida de odoo shell:"; printf '%s\n' "$OUT"; exit 1
fi
if grep -q '^ODOO_API_KEY=' .env; then
  sed -i.bak "s|^ODOO_API_KEY=.*|ODOO_API_KEY=$KEY|" .env && rm -f .env.bak
else
  echo "ODOO_API_KEY=$KEY" >> .env
fi
# El shell cargó la key anterior desde .env y tiene prioridad sobre el archivo en docker compose
export ODOO_API_KEY="$KEY"
echo "✔ API key guardada en backend/.env"

echo "▶ Levantando Odoo, microservicios y gateway…"
docker compose up -d --build --wait

echo
echo "✔ Listo."
echo "   Odoo (backoffice):  http://localhost:${ODOO_PORT:-8069}   usuario: admin"
echo "   API gateway:        http://localhost:${GATEWAY_PORT:-8080}/api/health"
echo "   Frontend:           en la raíz del proyecto:  VITE_DATA_SOURCE=api npm run dev"
