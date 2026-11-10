/**
 * Cliente HTTP mínimo para el backend de Sistema UVA (gateway `/api/*`).
 * JSON de entrada/salida; los errores del backend llegan como `{ error }` con status 4xx/5xx
 * y se lanzan como `ApiError` con ese mensaje.
 */

export const API_BASE_URL: string = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
  }
}

export type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query): string {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function errorFromResponse(res: Response, path: string): Promise<ApiError> {
  let message = `Error ${res.status} al consultar el servidor`;
  try {
    const text = await res.text();
    if (text) {
      try {
        const body = JSON.parse(text) as { error?: unknown; message?: unknown };
        if (typeof body.error === 'string' && body.error) message = body.error;
        else if (typeof body.message === 'string' && body.message) message = body.message;
      } catch {
        message = text.slice(0, 300);
      }
    }
  } catch {
    /* cuerpo ilegible: se conserva el mensaje genérico */
  }
  return new ApiError(message, res.status, path);
}

async function doFetch(method: string, path: string, body?: unknown, query?: Query): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Verifique su conexión.', 0, path);
  }
  if (!res.ok) throw await errorFromResponse(res, path);
  return res;
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const res = await doFetch(method, path, body, query);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('Respuesta inválida del servidor (no es JSON).', res.status, path);
  }
}

/** Descarga un archivo (p. ej. CSV) y devuelve su contenido y el nombre sugerido por `Content-Disposition`. */
async function download(path: string, query?: Query): Promise<{ blob: Blob; filename: string | null }> {
  const res = await doFetch('GET', path, undefined, query);
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : null;
  return { blob: await res.blob(), filename };
}

export const client = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  download,
};

/** Dispara la descarga de un Blob en el navegador. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Codifica un segmento de ruta (ids, folios con corchetes, etc.). */
export const seg = (value: string | number): string => encodeURIComponent(String(value));
