import { redirect } from "next/navigation";
import { entornoDeCliente } from "@/shared/config/entorno";
import { leerSesion } from "@/shared/lib/sesion";

/**
 * Pantalla de entrada.
 *
 * Si ya hay sesión redirige al panel; si no, ofrece iniciarla. La
 * comprobación es de servidor: el navegador nunca ve el token, así
 * que no podría decidirlo por su cuenta.
 */
export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sesion = await leerSesion();
  if (sesion.accessToken) {
    redirect("/escaneos");
  }

  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {entornoDeCliente.NEXT_PUBLIC_APP_NAME}
        </h1>
        <p className="text-[var(--color-texto-tenue)]">
          Extracción automática de datos tributarios desde los adjuntos de tu
          correo.
        </p>
      </div>

      {error && (
        // El mensaje es genérico a propósito: distinguir "firma
        // inválida" de "código ya usado" solo le sirve a quien sondea.
        <p
          role="alert"
          className="rounded-md border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 p-3 text-sm"
        >
          No fue posible iniciar sesión. Vuelve a intentarlo.
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        <a
          href="/api/auth/login"
          className="inline-flex w-full items-center justify-center rounded-md bg-[var(--color-acento)] px-4 py-2.5 font-medium text-white hover:opacity-90"
        >
          Iniciar sesión
        </a>
        {/* Fuerza el formulario de Auth0 aunque haya sesión SSO activa. */}
        <a
          href="/api/auth/login?cambiar=1"
          className="text-xs text-[var(--color-texto-tenue)] underline hover:opacity-90"
        >
          Entrar con otra cuenta
        </a>
      </div>

      <p className="text-xs text-[var(--color-texto-tenue)]">
        Se solicita permiso de solo lectura sobre tu buzón. La aplicación
        nunca envía ni modifica correo.
      </p>
    </div>
  );
}
