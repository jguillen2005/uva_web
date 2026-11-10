import React from 'react';
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react';

interface AsyncStateProps {
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  /** Texto de carga; por defecto "Cargando…". */
  label?: string;
  /** `page` (predeterminado) ocupa el área de la vista con su padding; `inline` para tarjetas/paneles. */
  variant?: 'page' | 'inline';
}

/**
 * Estado de carga / error reutilizable. Se renderiza mientras no hay datos.
 * Paleta: tokens de src/index.css (brand-600, line-200), tarjetas blancas rounded-xl.
 */
export const AsyncState: React.FC<AsyncStateProps> = ({ loading, error, onRetry, label = 'Cargando…', variant = 'page' }) => {
  const wrapper = variant === 'page' ? 'p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full' : 'w-full';

  if (error && !loading) {
    return (
      <div className={wrapper}>
        <div role="alert" className="bg-white border border-danger-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertTriangle className="w-5 h-5 text-danger-700 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink-900">No se pudo cargar la información</p>
              <p className="text-xs text-ink-500 mt-0.5 break-words">{error.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-1.5 shrink-0 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 px-3.5 py-2 rounded-lg transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapper} aria-busy="true" aria-live="polite">
      <div className="bg-white border border-line-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          {label}
        </div>
        <div className="space-y-2.5 animate-pulse">
          <div className="h-3 rounded bg-line-100 w-2/3" />
          <div className="h-3 rounded bg-line-100 w-full" />
          <div className="h-3 rounded bg-line-100 w-5/6" />
          {variant === 'page' && <div className="h-3 rounded bg-line-100 w-1/2" />}
        </div>
      </div>
    </div>
  );
};
