/**
 * Sesión de la web con los usuarios de Odoo (módulo uva_sesion_web, rutas /api/sesion/*).
 * La sesión vive en una cookie HttpOnly que pone el servidor: la web nunca ve ni guarda el token.
 * En modo mock (VITE_DATA_SOURCE=mock) no hay servidor y se entra directo, como en la maqueta.
 */
import { client } from './client';
import { isMock } from './source';

export interface PerfilSesion {
  name: string;
  initials?: string;
  title?: string;
  email?: string;
  login?: string;
}

/** La web exige inicio de sesión solo cuando trabaja contra el servidor. */
export const requiereSesion = !isMock;

/** Evento que emite el cliente HTTP cuando el servidor responde 401 (sesión vencida o inválida). */
export const EVENTO_SESION_VENCIDA = 'uva:sesion-vencida';

export const sesion = {
  /** Sesión vigente o null si no hay (o venció). */
  async actual(): Promise<PerfilSesion | null> {
    try {
      const r = await client.get<{ perfil: PerfilSesion }>('/sesion/yo');
      return r.perfil;
    } catch (e) {
      if ((e as { status?: number }).status === 401) return null;
      throw e;
    }
  },
  iniciar: (email: string, password: string) =>
    client.post<{ ok: boolean; perfil: PerfilSesion }>('/sesion/login', { email, password }),
  recuperar: (email: string) => client.post<{ ok: boolean; message: string }>('/sesion/recuperar', { email }),
  cerrar: () => client.post<{ ok: boolean }>('/sesion/salir'),
};
