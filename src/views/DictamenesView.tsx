import React, { useState } from 'react';
import { ScreenKey } from '../types';
import { dictaminacion } from '../api/endpoints';
import { useApi } from '../api/useApi';
import { AsyncState } from '../components/AsyncState';
import { Search, Award, CheckCircle2, XCircle, Clock, Eye, Download } from 'lucide-react';

interface DictamenesViewProps {
  onNavigate: (screen: ScreenKey) => void;
  onShowToast: (msg: string) => void;
}

export const DictamenesView: React.FC<DictamenesViewProps> = ({ onNavigate, onShowToast }) => {
  const { data: dictamenes, loading, error, reload } = useApi(() => dictaminacion.getDictamenes());
  const [tabFilter, setTabFilter] = useState<'Todos' | 'Conformes' | 'Inconformes' | 'Por vencer'>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!dictamenes) return <AsyncState loading={loading} error={error} onRetry={reload} />;

  const filtered = dictamenes.filter((d) => {
    const matchesTab =
      tabFilter === 'Todos' ||
      (tabFilter === 'Conformes' && d.res.includes('Conforme')) ||
      (tabFilter === 'Inconformes' && d.res.includes('Inconforme')) ||
      (tabFilter === 'Por vencer' && d.dueWarning);
    const matchesSearch =
      d.no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto flex flex-col min-h-full">
      {/* Header */}
      <div className="flex flex-col gap-1 pb-2 border-b border-line-200">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          Operación / Dictámenes y actas
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight mt-0.5">
          Dictámenes y actas
        </h1>
        <p className="text-sm text-ink-600 max-w-3xl leading-relaxed">
          Consulta de todos los dictámenes F-17 emitidos (conformes e inconformes), con su vigencia y el estado de su registro ante CONAGUA.
        </p>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-line-200 shadow-xs">
        <div className="flex max-w-full overflow-x-auto bg-surface-100 p-1 rounded-lg gap-1 text-xs font-semibold [&>button]:shrink-0">
          {(['Todos', 'Conformes', 'Inconformes', 'Por vencer'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTabFilter(t)}
              className={`px-3.5 py-1.5 rounded-md transition-colors ${
                tabFilter === t ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            type="search"
            placeholder="No. de dictamen, cliente, RFC o título..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-line-300 rounded-lg text-xs bg-white focus:outline-none focus:border-brand-600"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-line-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[850px]">
            <thead>
              <tr className="bg-surface-100 text-ink-700 font-semibold border-b border-line-200">
                <th className="py-3 px-4">Dictamen</th>
                <th className="py-3 px-4">Cliente / aprovechamiento</th>
                <th className="py-3 px-4">Emisión</th>
                <th className="py-3 px-4">Resultado</th>
                <th className="py-3 px-4">Vence</th>
                <th className="py-3 px-4">CONAGUA</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-100">
              {filtered.map((r, i) => (
                <tr key={i} className="hover:bg-surface-50 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-mono font-bold text-ink-900">{r.no}</div>
                    <div className="font-mono text-[11px] text-ink-500">{r.folio}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-ink-900 leading-tight">{r.client}</div>
                    <div className="text-[11px] text-ink-500">{r.title} · {r.well}</div>
                  </td>
                  <td className="py-3.5 px-4 text-ink-700 font-medium">{r.date}</td>
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
                  <td
                    className={`py-3.5 px-4 font-medium ${
                      r.dueWarning ? 'text-warn-700 font-bold' : 'text-ink-700'
                    }`}
                  >
                    {r.due}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full font-semibold ${
                        r.cnType === 'done'
                          ? 'bg-side-900 text-white'
                          : 'bg-warn-100 text-warn-700'
                      }`}
                    >
                      {r.cn}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onNavigate('Expediente')}
                      className="font-bold text-brand-600 hover:text-brand-700 bg-brand-100 hover:bg-brand-150 px-3 py-1.5 rounded-md transition-colors"
                    >
                      Ver expediente
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
