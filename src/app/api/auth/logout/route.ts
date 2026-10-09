/**
 * Cierre de sesión (federado).
 *
 * Destruye la cookie local —el único sitio donde vivía el token— y
 * además cierra la sesión SSO en el proveedor. Sin esta segunda parte,
 * "Salir" borraba la sesión de la app pero Auth0 seguía autenticado, de
 * modo que el siguiente "Iniciar sesión" entraba en silencio y no se
 * podía cambiar de cuenta: justo lo contrario de lo que espera quien
 * pulsa "Salir". Tras el logout, Auth0 regresa a `returnTo`, que debe
 * figurar en las "Allowed Logout URLs" de la aplicación de Auth0.
 */

import { NextResponse } from "next/server";
import { entornoDeServidor } from "@/shared/config/entorno";
import { leerSesion } from "@/shared/lib/sesion";

export async function POST(): Promise<NextResponse> {
  const entorno = entornoDeServidor();
  const sesion = await leerSesion();
  sesion.destroy();

  // Endpoint de logout de Auth0, construido desde el origen del issuer
  // (sin la ruta de descubrimiento). Un 303 convierte el POST del
  // formulario en el GET que espera el navegador al seguir el redirect.
  const logout = new URL("/v2/logout", new URL(entorno.OIDC_ISSUER).origin);
  logout.searchParams.set("client_id", entorno.OIDC_CLIENT_ID);
  logout.searchParams.set("returnTo", entorno.APP_URL);

  return NextResponse.redirect(logout.href, { status: 303 });
}
