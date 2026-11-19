import { useEffect, useRef } from 'react';

/**
 * En pantallas donde el panel de detalle queda debajo de la tabla (< 1280 px),
 * al elegir otra fila desplaza la vista al detalle para que el cambio se vea.
 * No hace nada en la primera carga ni si el panel ya está a la vista.
 */
export function useRevealDetail<T extends HTMLElement>(selection: unknown) {
  const ref = useRef<T>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el || window.matchMedia('(min-width: 1280px)').matches) return;
    const { top, bottom } = el.getBoundingClientRect();
    if (top > window.innerHeight * 0.6 || bottom < 0) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }, [selection]);

  return ref;
}
