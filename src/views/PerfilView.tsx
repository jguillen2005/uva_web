import React, { useMemo, useState } from 'react';
import { PerfilData, PerfilPrefs, ScreenKey } from '../types';
import { catalogos } from '../api/endpoints';
import { useApi } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import {
  BadgeCheck,
  Bell,
  Clock,
  Globe,
  LogOut,
  Mail,
  Monitor,
  Phone,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react';

interface PerfilViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
  onLogout: () => void;
}

export const PerfilView: React.FC<PerfilViewProps> = (props) => {
  const { data, loading, error, reload } = useApi(() => catalogos.getPerfil());
  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} label="Cargando tu perfil…" />;
  return <PerfilContent {...props} data={data} />;
};

const PREF_ITEMS: { key: keyof PerfilPrefs; label: string; desc: string }[] = [
  { key: 'correo', label: 'Avisos por correo', desc: 'Asignaciones, devoluciones y autorizaciones llegan a tu buzón de Outlook.' },
  { key: 'teams', label: 'Avisos en Microsoft Teams', desc: 'Notificación inmediata en el chat de Teams.' },
  { key: 'vencimientos', label: 'Alertas de vencimiento', desc: 'Plazos de solicitudes, calibraciones y competencias por vencer.' },
  { key: 'resumenDiario', label: 'Resumen diario a las 08:00', desc: 'Un solo correo con los pendientes del día.' },
];

const PERMISO_LABEL: Record<string, { text: string; cls: string }> = {
  A: { text: 'Autorizar', cls: 'bg-warn-50 text-warn-700 ring-warn-200' },
  E: { text: 'Editar', cls: 'bg-success-50 text-success-700 ring-success-100' },
  V: { text: 'Ver', cls: 'bg-brand-50 text-brand-800 ring-brand-150' },
  '—': { text: 'Sin acceso', cls: 'bg-surface-100 text-ink-500 ring-line-200' },
};

const TEL_RE = /^[0-9+()\-\s.]{7,25}$/;

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} en ${os}` : browser;
}

const PerfilContent: React.FC<PerfilViewProps & { data: PerfilData }> = ({ data, onShowToast, onLogout }) => {
  const [saved, setSaved] = useState<PerfilData>(data);
  const [phone, setPhone] = useState(data.phone);
  const [prefs, setPrefs] = useState<PerfilPrefs>(data.prefs);
  const [saving, setSaving] = useState(false);

  const phoneError = phone.trim() && !TEL_RE.test(phone.trim())
    ? 'Usa solo números, espacios, +, guiones y paréntesis (mínimo 7 caracteres).'
    : '';
  const dirty = phone.trim() !== saved.phone || PREF_ITEMS.some((p) => prefs[p.key] !== saved.prefs[p.key]);

  const permisosOrdenados = useMemo(() => {
    const rank: Record<string, number> = { A: 0, E: 1, V: 2, '—': 3 };
    return [...saved.permisos].sort((a, b) => (rank[a.val] ?? 9) - (rank[b.val] ?? 9));
  }, [saved.permisos]);
  const conAcceso = saved.permisos.filter((p) => p.val !== '—').length;

  const handleSave = async () => {
    if (phoneError || !dirty) return;
    setSaving(true);
    try {
      const res = await catalogos.updatePerfil({ phone: phone.trim(), prefs });
      setSaved(res.perfil);
      setPhone(res.perfil.phone);
      setPrefs(res.perfil.prefs);
      onShowToast('Tus datos de contacto y preferencias se guardaron.');
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'No se pudo guardar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setPhone(saved.phone);
    setPrefs(saved.prefs);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto pb-28">
      {/* Header */}
      <div className="pb-2 border-b border-line-200">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">Cuenta / Mi perfil</span>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">Mi perfil</h1>
        <p className="text-sm text-ink-600 max-w-2xl leading-relaxed">
          Tu identidad viene de tu cuenta institucional de Microsoft 365. Aquí puedes actualizar tu teléfono, elegir cómo recibir avisos y consultar qué puedes hacer en cada módulo.
        </p>
      </div>

      {/* Identity card */}
      <section aria-label="Identidad" className="bg-white border border-line-200 rounded-xl shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-sm" aria-hidden="true">
          {saved.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-bold text-ink-900 leading-tight">{saved.name}</h2>
          <p className="text-sm text-ink-600">{saved.title}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {saved.roles.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-150">
                <ShieldCheck className="w-3 h-3" />
                {r}
              </span>
            ))}
            {saved.verificadorCode && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-100 text-ink-700 ring-1 ring-inset ring-line-200">
                Verificador {saved.verificadorCode}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-success-700 bg-success-50 ring-1 ring-inset ring-success-100 rounded-lg px-3 py-2 self-start sm:self-center">
          <BadgeCheck className="w-4 h-4 shrink-0" />
          <span className="font-semibold">Cuenta verificada · {saved.identityProvider}</span>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {/* Contact */}
          <section aria-labelledby="perfil-contacto" className="bg-white border border-line-200 rounded-xl shadow-xs">
            <header className="px-4 sm:px-5 py-3.5 border-b border-line-200 flex items-center gap-2">
              <User className="w-4 h-4 text-brand-600" />
              <h2 id="perfil-contacto" className="text-sm font-bold text-ink-900">Datos de contacto</h2>
            </header>
            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <ReadOnly icon={<Mail className="w-4 h-4" />} label="Correo institucional (inicio de sesión)" value={saved.email} />
              </div>
              <div>
                <label htmlFor="perfil-tel" className="block text-xs font-semibold text-ink-700 mb-1">
                  Teléfono de contacto
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="perfil-tel"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="33 1234 5678"
                    aria-invalid={!!phoneError}
                    aria-describedby="perfil-tel-help"
                    className={`w-full h-10 pl-9 pr-3 rounded-lg border bg-white text-sm text-ink-900 placeholder:text-ink-400 ${
                      phoneError ? 'border-danger-700' : 'border-line-300 focus:border-brand-600'
                    }`}
                  />
                </div>
                <p id="perfil-tel-help" className={`text-[11px] mt-1 ${phoneError ? 'text-danger-700' : 'text-ink-500'}`}>
                  {phoneError || 'Lo usan coordinación y los inspectores para localizarte.'}
                </p>
              </div>
              <ReadOnly icon={<Globe className="w-4 h-4" />} label="Zona horaria" value={saved.tz.replace(/_/g, ' ')} />
              <p className="sm:col-span-2 text-[11px] text-ink-500 leading-snug bg-surface-50 border border-line-200 rounded-lg px-3 py-2">
                El nombre, el correo y los roles los administra el área de sistemas en Microsoft Entra ID. Si hay un error, pídele el cambio al administrador del Sistema UVA.
              </p>
            </div>
          </section>

          {/* Notifications */}
          <section aria-labelledby="perfil-notif" className="bg-white border border-line-200 rounded-xl shadow-xs">
            <header className="px-4 sm:px-5 py-3.5 border-b border-line-200 flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-600" />
              <h2 id="perfil-notif" className="text-sm font-bold text-ink-900">Notificaciones</h2>
            </header>
            <ul className="divide-y divide-line-200">
              {PREF_ITEMS.map((item) => (
                <li key={item.key} className="px-4 sm:px-5 py-3.5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p id={`pref-${item.key}`} className="text-sm font-semibold text-ink-900">{item.label}</p>
                    <p className="text-xs text-ink-500 leading-snug mt-0.5">{item.desc}</p>
                  </div>
                  <Toggle
                    checked={prefs[item.key]}
                    labelledBy={`pref-${item.key}`}
                    onChange={(v) => setPrefs((p) => ({ ...p, [item.key]: v }))}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6 min-w-0 lg:sticky lg:top-6">
          {/* Session */}
          <section aria-labelledby="perfil-sesion" className="bg-white border border-line-200 rounded-xl shadow-xs">
            <header className="px-4 sm:px-5 py-3.5 border-b border-line-200 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-brand-600" />
              <h2 id="perfil-sesion" className="text-sm font-bold text-ink-900">Sesión</h2>
            </header>
            <dl className="p-4 sm:p-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500 flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" />Este dispositivo</dt>
                <dd className="font-semibold text-ink-900 text-right">{deviceLabel()}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Último acceso</dt>
                <dd className="font-semibold text-ink-900 text-right">{saved.lastAccess}</dd>
              </div>
            </dl>
            <div className="px-4 sm:px-5 pb-4 sm:pb-5">
              <button
                type="button"
                onClick={onLogout}
                className="w-full h-10 rounded-lg border border-danger-200 text-danger-700 hover:bg-danger-50 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </div>
          </section>

          {/* Permissions */}
          <section aria-labelledby="perfil-permisos" className="bg-white border border-line-200 rounded-xl shadow-xs">
            <header className="px-4 sm:px-5 py-3.5 border-b border-line-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-600" />
                <h2 id="perfil-permisos" className="text-sm font-bold text-ink-900">Mis permisos</h2>
              </div>
              <span className="text-[11px] text-ink-500">{conAcceso} de {saved.permisos.length} módulos</span>
            </header>
            <ul className="divide-y divide-line-100 max-h-[26rem] overflow-y-auto">
              {permisosOrdenados.map((p) => {
                const lbl = PERMISO_LABEL[p.val] ?? PERMISO_LABEL['—'];
                return (
                  <li key={p.mod} className="px-4 sm:px-5 py-2 flex items-center justify-between gap-3">
                    <span className={`text-xs ${p.val === '—' ? 'text-ink-400' : 'text-ink-800'}`}>{p.mod}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset whitespace-nowrap ${lbl.cls}`}>
                      {lbl.text}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="px-4 sm:px-5 py-3 border-t border-line-200 text-[11px] text-ink-500 leading-snug">
              Si tienes varios roles se muestra el permiso más alto. Autorizar incluye editar y ver.
            </p>
          </section>
        </div>
      </div>

      {/* Sticky save bar, only when there are changes */}
      {dirty && (
        <div className="fixed bottom-0 inset-x-0 lg:left-66 z-30 bg-white/95 backdrop-blur border-t border-line-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-700 font-medium">Tienes cambios sin guardar.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={saving}
                className="h-10 px-4 rounded-lg border border-line-300 text-ink-700 hover:bg-surface-100 text-xs font-semibold"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !!phoneError}
                className="h-10 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReadOnly: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="min-w-0">
    <span className="block text-xs font-semibold text-ink-700 mb-1">{label}</span>
    <div className="h-10 px-3 rounded-lg bg-surface-50 border border-line-200 flex items-center gap-2 text-sm text-ink-800">
      <span className="text-ink-400 shrink-0">{icon}</span>
      <span className="truncate" title={value}>{value || '—'}</span>
    </div>
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; labelledBy: string }> = ({ checked, onChange, labelledBy }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={labelledBy}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors mt-0.5 ${checked ? 'bg-brand-600' : 'bg-line-300'}`}
  >
    <span
      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`}
    />
  </button>
);
