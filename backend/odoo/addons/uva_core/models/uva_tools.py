# -*- coding: utf-8 -*-
"""Utilidades de formato compartidas por los módulos del Sistema UVA.

Las fechas se guardan como ``Date``/``Datetime`` en los modelos y solo se convierten
a texto (``dd/mm/aaaa``, ``Mié 21 oct``...) al construir el JSON de ``uva.api``.
"""
import re
from datetime import date, datetime, timedelta

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

from odoo import fields

PARAM_FECHA_REFERENCIA = 'uva.fecha_referencia'
TZ_DEFAULT = 'America/Mexico_City'

MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
MESES_CAP = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
               'septiembre', 'octubre', 'noviembre', 'diciembre']
DIAS_ABR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

TITULOS = ('Ing. ', 'Lic. ', 'Arq. ', 'Téc. ', 'Dr. ', 'Dra. ', 'Mtro. ', 'Mtra. ', 'C. ')

GUION = '—'


def hoy(env):
    """Fecha "de hoy" del sistema.

    Si el parámetro ``uva.fecha_referencia`` (aaaa-mm-dd) está definido se usa como fecha
    actual (útil para demostraciones y pruebas); si no, la fecha del contexto del usuario.
    """
    valor = env['ir.config_parameter'].sudo().get_param(PARAM_FECHA_REFERENCIA)
    if valor:
        try:
            return date.fromisoformat(valor.strip())
        except ValueError:
            pass
    return fields.Date.context_today(env['res.users'])


def tz_usuario(env):
    nombre = env.context.get('tz') or env.user.tz or TZ_DEFAULT
    if ZoneInfo is None:
        return None
    try:
        return ZoneInfo(nombre)
    except Exception:  # noqa: BLE001
        return ZoneInfo(TZ_DEFAULT)


def a_local(env, dt):
    """Convierte un Datetime naive (UTC, como lo guarda Odoo) a la zona del usuario."""
    if not dt:
        return None
    tz = tz_usuario(env)
    if tz is None:
        return dt
    from datetime import timezone
    return dt.replace(tzinfo=timezone.utc).astimezone(tz).replace(tzinfo=None)


def fdate(d):
    """``dd/mm/aaaa`` o ``—``."""
    if not d:
        return GUION
    if isinstance(d, str):
        d = fields.Date.to_date(d)
    return d.strftime('%d/%m/%Y')


def fdm(d):
    """``dd/mm``."""
    return d.strftime('%d/%m') if d else GUION


def fdia_mes(d):
    """``21 oct``."""
    if not d:
        return GUION
    return '%d %s' % (d.day, MESES_ABR[d.month - 1])


def fdia_semana(d):
    """``Mié 21 oct``."""
    if not d:
        return GUION
    return '%s %d %s' % (DIAS_ABR[d.weekday()], d.day, MESES_ABR[d.month - 1])


def frango(d1, d2):
    """``19 oct – 30 oct``."""
    if not d1 and not d2:
        return ''
    return '%s – %s' % (fdia_mes(d1 or d2), fdia_mes(d2 or d1))


def lunes_de(d):
    return d - timedelta(days=d.weekday())


def sumar_habiles(d, n):
    """Suma ``n`` días hábiles (lunes a viernes) a la fecha ``d``."""
    actual = d
    while n > 0:
        actual += timedelta(days=1)
        if actual.weekday() < 5:
            n -= 1
    return actual


def dias_habiles_entre(d1, d2):
    """Días hábiles transcurridos de ``d1`` (excluido) a ``d2`` (incluido). Negativo si d2 < d1."""
    if d1 == d2:
        return 0
    signo = 1
    if d2 < d1:
        d1, d2 = d2, d1
        signo = -1
    n = 0
    actual = d1
    while actual < d2:
        actual += timedelta(days=1)
        if actual.weekday() < 5:
            n += 1
    return n * signo


def sumar_meses(d, meses):
    mes = d.month - 1 + meses
    anio = d.year + mes // 12
    mes = mes % 12 + 1
    import calendar
    dia = min(d.day, calendar.monthrange(anio, mes)[1])
    return date(anio, mes, dia)


def plural(n, singular, plural_):
    return singular if n == 1 else plural_


def corchetes(texto):
    """``UVA-0016`` → ``[UVA-0016]``."""
    if not texto:
        return ''
    texto = sin_corchetes(texto)
    return '[%s]' % texto


def sin_corchetes(texto):
    return (texto or '').strip().strip('[]').strip()


_RE_PREFIJO = re.compile(r'^\s*(\[[^\]]+\])\s*(.*)$')


def prefijo(nombre):
    """``[Inspector 4] Ing. Laura Valdés`` → ``[Inspector 4]``."""
    m = _RE_PREFIJO.match(nombre or '')
    return m.group(1) if m else (nombre or '')


def sin_prefijo(nombre):
    """``[Gerente Técnico] Ing. Gerardo Torres`` → ``Ing. Gerardo Torres``."""
    m = _RE_PREFIJO.match(nombre or '')
    return m.group(2) if m else (nombre or '')


def corchete_al_final(nombre):
    """``[Inspector 3] Ing. Carlos Mendoza`` → ``Ing. Carlos Mendoza [Inspector 3]``."""
    m = _RE_PREFIJO.match(nombre or '')
    if not m:
        return nombre or ''
    return '%s %s' % (m.group(2), m.group(1))


def nombre_corto(nombre):
    """Quita títulos profesionales: ``[Inspector 3] Ing. Carlos Mendoza`` → ``[Inspector 3] Carlos Mendoza``."""
    resultado = nombre or ''
    for titulo in TITULOS:
        resultado = resultado.replace(titulo, '')
    return resultado.strip()


def fmt_volumen(valor):
    if not valor:
        return GUION
    return '{:,.0f} m³'.format(valor)


def parse_volumen(texto):
    if texto in (None, '', False):
        return 0.0
    if isinstance(texto, (int, float)):
        return float(texto)
    limpio = re.sub(r'[^0-9.]', '', str(texto).replace(',', ''))
    try:
        return float(limpio) if limpio else 0.0
    except ValueError:
        return 0.0


def parse_fecha(texto, referencia=None):
    """Acepta ``aaaa-mm-dd``, ``dd/mm/aaaa``, ``Mié 21 oct`` o ``21 oct``. Devuelve ``date`` o ``None``."""
    if not texto or texto == GUION:
        return None
    if isinstance(texto, datetime):
        return texto.date()
    if isinstance(texto, date):
        return texto
    texto = str(texto).strip()
    try:
        return date.fromisoformat(texto[:10])
    except ValueError:
        pass
    m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', texto)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            return None
    m = re.search(r'(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóú]{3})', texto)
    if m:
        abr = m.group(2).lower()
        if abr in MESES_ABR:
            ref = referencia or date.today()
            try:
                return date(ref.year, MESES_ABR.index(abr) + 1, int(m.group(1)))
            except ValueError:
                return None
    return None


def es_numero(valor):
    try:
        int(str(valor))
        return True
    except (TypeError, ValueError):
        return False
