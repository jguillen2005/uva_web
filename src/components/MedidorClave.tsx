import React from 'react';
import { Check } from 'lucide-react';

/** Reglas obligatorias de la contraseña nueva (las mismas que valida el servidor). */
export const reglasClave = (nueva: string, actual: string) => [
  { ok: nueva.length >= 8, texto: 'Al menos 8 caracteres' },
  { ok: /\p{L}/u.test(nueva) && /\d/.test(nueva), texto: 'Letras y números' },
  { ok: !!nueva && nueva !== actual, texto: 'Distinta de la contraseña actual' },
];

const COMUNES = ['contraseña', 'contrasena', 'password', 'asercontrol', 'sistemauva', 'uva', 'qwerty', 'admin', '123456', 'abc123'];

export interface NivelClave {
  /** 0 = vacía, 1 = muy débil … 4 = muy segura */
  nivel: 0 | 1 | 2 | 3 | 4;
  etiqueta: string;
  consejo: string;
}

/**
 * Estima qué tan difícil es adivinar la contraseña: largo, variedad de caracteres y que no use palabras
 * obvias (su correo, el nombre del sistema, secuencias como 123456) ni caracteres repetidos.
 */
export function evaluarClave(clave: string, pistas: string[] = []): NivelClave {
  if (!clave) return { nivel: 0, etiqueta: '', consejo: '' };
  const baja = clave.toLowerCase();
  let puntos = 0;
  if (clave.length >= 8) puntos++;
  if (clave.length >= 12) puntos++;
  if (clave.length >= 16) puntos++;
  const tipos = [/[a-zñáéíóúü]/, /[A-ZÑÁÉÍÓÚÜ]/, /\d/, /[^\p{L}\d]/u].filter((r) => r.test(clave)).length;
  puntos += Math.max(0, tipos - 1);
  const obvias = [...COMUNES, ...pistas.map((p) => p.toLowerCase()).filter((p) => p.length >= 3)];
  const usaObvia = obvias.some((p) => baja.includes(p));
  const repetida = /(.)\1{2,}/.test(clave) || /(0123|1234|2345|3456|4567|5678|6789|abcd)/i.test(clave);
  if (usaObvia) puntos -= 2;
  if (repetida) puntos -= 1;
  if (clave.length < 8) puntos = Math.min(puntos, 1);

  if (puntos <= 1) {
    return {
      nivel: 1, etiqueta: 'Muy débil',
      consejo: usaObvia ? 'Evite su nombre, su correo, el nombre del sistema o secuencias como 123456.' : 'Use al menos 8 caracteres con letras y números.',
    };
  }
  if (puntos <= 2) return { nivel: 2, etiqueta: 'Débil', consejo: 'Hágala más larga o agregue mayúsculas y algún símbolo (por ejemplo ! o #).' };
  if (puntos <= 4) return { nivel: 3, etiqueta: 'Buena', consejo: 'Para hacerla más segura, use 12 caracteres o más.' };
  return { nivel: 4, etiqueta: 'Muy segura', consejo: 'Excelente. Guárdela en un lugar seguro y no la comparta.' };
}

const COLOR = ['bg-line-200', 'bg-danger-600', 'bg-warn-500', 'bg-success-500', 'bg-success-700'];
const TEXTO = ['text-ink-500', 'text-danger-700', 'text-warn-700', 'text-success-700', 'text-success-800'];

/** Medidor de seguridad: barra de 4 segmentos, nivel y consejo, y la lista de requisitos obligatorios. */
export const MedidorClave: React.FC<{ nueva: string; actual: string; pistas?: string[] }> = ({ nueva, actual, pistas }) => {
  const r = evaluarClave(nueva, pistas);
  const reglas = reglasClave(nueva, actual);
  return (
    <div className="space-y-2">
      <div aria-live="polite">
        <div className="flex gap-1" role="meter" aria-label="Seguridad de la contraseña" aria-valuemin={0} aria-valuemax={4}
          aria-valuenow={r.nivel} aria-valuetext={r.etiqueta || 'Sin escribir'}>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= r.nivel ? COLOR[r.nivel] : 'bg-line-200'}`} />
          ))}
        </div>
        <p className="text-xs mt-1.5 min-h-[1rem]">
          {r.nivel > 0 ? (
            <>
              <span className={`font-bold ${TEXTO[r.nivel]}`}>Seguridad: {r.etiqueta}.</span>{' '}
              <span className="text-ink-600">{r.consejo}</span>
            </>
          ) : (
            <span className="text-ink-500">Escriba su contraseña nueva para ver qué tan segura es.</span>
          )}
        </p>
      </div>
      <ul className="text-xs space-y-1" aria-label="Requisitos de la contraseña nueva">
        {reglas.map((x) => (
          <li key={x.texto} className={`flex items-center gap-1.5 ${x.ok ? 'text-success-700' : 'text-ink-500'}`}>
            <Check className={`w-3.5 h-3.5 ${x.ok ? '' : 'opacity-30'}`} aria-hidden="true" />
            {x.texto}
            <span className="sr-only">{x.ok ? ' (cumple)' : ' (pendiente)'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
