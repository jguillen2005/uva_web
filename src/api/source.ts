/**
 * Selector explícito de origen de datos.
 *   VITE_DATA_SOURCE=api  → todas las funciones de `endpoints.ts` llaman al backend.
 *   VITE_DATA_SOURCE=mock → (predeterminado) resuelven los datos locales de `src/data/*`.
 * No hay respaldo silencioso: en modo `api` un error del backend se propaga tal cual.
 */
export type DataSource = 'api' | 'mock';

const raw = String(import.meta.env.VITE_DATA_SOURCE ?? 'mock').trim().toLowerCase();

export const DATA_SOURCE: DataSource = raw === 'api' ? 'api' : 'mock';
export const isMock = DATA_SOURCE === 'mock';

/** Respuesta estándar de las acciones (POST/PUT/PATCH) del contrato. */
export type ActionResult<T extends object = object> = { ok: boolean; message: string } & T;

const MOCK_LATENCY_MS = 250;

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/** Resuelve una copia de los datos mock con una pequeña latencia simulada. */
export function mockResolve<T>(data: T, latency = MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(clone(data)), latency));
}

/** Resuelve una acción mock: `{ ok: true, message, ...extra }`. */
export function mockAction<T extends object = object>(message: string, extra?: T): Promise<ActionResult<T>> {
  return mockResolve({ ok: true, message, ...(extra ?? {}) } as ActionResult<T>, 150);
}

/** Elige la implementación según `VITE_DATA_SOURCE`. */
export function pick<T>(api: () => Promise<T>, mock: () => Promise<T>): Promise<T> {
  return isMock ? mock() : api();
}
