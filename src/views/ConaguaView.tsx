import React, { useState } from 'react';
import { ConaguaItem, ScreenKey } from '../types';
import { dictaminacion } from '../api/endpoints';
import { useApi, errorMessage } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { UploadCloud, CheckCircle2, Clock, Send, Bot, FileText, ArrowRight } from 'lucide-react';

interface ConaguaViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

export const ConaguaView: React.FC<ConaguaViewProps> = ({ onNavigate, onShowToast }) => {
  const { data, loading, error, reload } = useApi(() => dictaminacion.getConagua());

  if (!data) return <AsyncState loading={loading} error={error} onRetry={reload} />;
  return <ConaguaContent initialItems={data} onNavigate={onNavigate} onShowToast={onShowToast} />;
};

interface ConaguaContentProps extends ConaguaViewProps {
  initialItems: ConaguaItem[];
}

const ConaguaContent: React.FC<ConaguaContentProps> = ({ initialItems, onNavigate, onShowToast }) => {
  const [items, setItems] = useState<ConaguaItem[]>(initialItems);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleAction = async (item: ConaguaItem) => {
    if (item.action === 'Cargar') {
      onNavigate('Expediente');
    } else if (item.action === 'Enviar acuse') {
      if (sendingId) return;
      setSendingId(item.id);
      try {
        const res = await dictaminacion.enviarAcuse(item.id);
        onShowToast(res.message);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? res.item ?? { ...i, st: 'Acuse enviado', stType: 'done', action: 'Ver' }
              : i
          )
        );
      } catch (e) {
        onShowToast(errorMessage(e));
      } finally {
        setSendingId(null);
      }
    } else {
      onNavigate('Expediente');
    }
  };

  const pendingCount = items.filter((i) => i.st === 'Pendiente de carga').length;
  const needEmailCount = items.filter((i) => i.st === 'Acuse por enviar al cliente').length;
  const completedCount = 9;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto flex flex-col min-h-full">
      {/* Header */}
      <div className="flex flex-col gap-1 pb-2 border-b border-line-200">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          Operación / Carga a CONAGUA
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
          Carga a CONAGUA
        </h1>
        <p className="text-sm text-ink-600 max-w-3xl leading-relaxed">
          Bandeja del Encargado de registro ante CONAGUA. Solo aparecen dictámenes autorizados por el Gerente Técnico.
          Fase 1: carga manual y registro del acuse. Fase 2: carga asistida con bot (pausa para e.firma y captcha).
        </p>
      </div>

      {/* 3 Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-brand-600 rounded-xl p-4 flex flex-col gap-1 shadow-xs">
          <span className="text-xs text-ink-600 font-semibold">Pendientes de carga</span>
          <span className="text-3xl font-extrabold text-brand-600 tabular-nums">{pendingCount}</span>
          <span className="text-[11px] text-ink-500">Requieren trámite en portal CONAGUA</span>
        </div>

        <div className="bg-white border border-line-200 rounded-xl p-4 flex flex-col gap-1 shadow-xs">
          <span className="text-xs text-ink-600 font-medium">Cargados sin acuse enviado</span>
          <span className="text-3xl font-bold text-ink-900 tabular-nums">{needEmailCount}</span>
          <span className="text-[11px] text-ink-500">Acuse disponible para notificación</span>
        </div>

        <div className="bg-white border border-line-200 rounded-xl p-4 flex flex-col gap-1 shadow-xs">
          <span className="text-xs text-ink-600 font-medium">Con acuse este mes</span>
          <span className="text-3xl font-bold text-success-700 tabular-nums">{completedCount}</span>
          <span className="text-[11px] text-success-700 font-semibold">100% notificados a clientes</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-line-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[880px]">
            <thead>
              <tr className="bg-surface-100 text-ink-700 font-semibold border-b border-line-200">
                <th className="py-3 px-4">Dictamen</th>
                <th className="py-3 px-4">Cliente / aprovechamiento</th>
                <th className="py-3 px-4">Resultado</th>
                <th className="py-3 px-4">Autorizado</th>
                <th className="py-3 px-4">Días en espera</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-100">
              {items.map((r, i) => (
                <tr key={r.id || i} className="hover:bg-surface-50 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-ink-900">{r.no}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-ink-900 leading-tight">{r.client}</div>
                    <div className="text-[11px] text-ink-500">{r.title} · {r.well}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full font-bold ${
                        r.resType === 'ok'
                          ? 'bg-success-100 text-success-700'
                          : 'bg-danger-100 text-danger-700'
                      }`}
                    >
                      {r.res}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-ink-700">{r.authDate}</td>
                  <td className="py-3.5 px-4 text-ink-700 font-medium">{r.days}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full font-semibold ${
                        r.stType === 'pend'
                          ? 'bg-warn-100 text-warn-700'
                          : r.stType === 'blue'
                          ? 'bg-brand-100 text-brand-800'
                          : 'bg-side-900 text-white'
                      }`}
                    >
                      {r.st}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleAction(r)}
                      disabled={sendingId === r.id}
                      className={`inline-flex items-center gap-1 font-bold px-3 py-1.5 rounded-md transition-colors ${
                        r.action === 'Cargar'
                          ? 'bg-brand-600 hover:bg-brand-700 text-white'
                          : r.action === 'Enviar acuse'
                          ? 'bg-brand-100 hover:bg-brand-150 text-brand-800'
                          : 'bg-surface-100 hover:bg-surface-200 text-ink-900'
                      }`}
                    >
                      {r.action === 'Cargar' && <UploadCloud className="w-3.5 h-3.5" />}
                      {r.action === 'Enviar acuse' && <Send className="w-3.5 h-3.5" />}
                      {r.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
