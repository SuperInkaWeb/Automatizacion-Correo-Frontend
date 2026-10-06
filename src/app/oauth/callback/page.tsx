"use client";

/**
 * Retorno de la vinculación de un buzón.
 *
 * Propósito
 *   Es la página a la que Google o Microsoft devuelven al usuario tras
 *   autorizar el acceso de solo lectura a su correo. Recoge el `code` y el
 *   `state` de la URL y los entrega al backend, que canjea el código por
 *   los tokens y guarda la conexión.
 *
 * Por qué existe como página propia y en la raíz
 *   La URL de retorno (`/oauth/callback`) se registra en la consola de cada
 *   proveedor y debe existir tal cual. Va fuera de `(panel)` porque el
 *   proveedor redirige con una navegación completa del navegador, no con el
 *   router interno; la sesión viaja igual en la cookie, así que la llamada
 *   al BFF sigue autenticada.
 *
 * Seguridad
 *   El `state` lo valida el backend: es de un solo uso y se consume de
 *   forma atómica. Esta página solo lo reenvía; no decide nada. Si el
 *   proveedor devuelve un `error` (por ejemplo, el usuario canceló), se
 *   muestra sin exponer detalle del flujo.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { Proveedores } from "@/app/proveedores";
import { useBuzonesCallback } from "@/generated/api/buzones/buzones";
import { Boton, Cargando, Fallo } from "@/shared/ui";

function Contenido() {
  const router = useRouter();
  const parametros = useSearchParams();
  const completar = useBuzonesCallback();

  const codigo = parametros.get("code");
  const state = parametros.get("state");
  const errorRecibido = parametros.get("error");

  // El problema se deriva en el render, no se guarda en estado: `error` y
  // la ausencia de `code`/`state` ya están en la URL, y meterlos en un
  // efecto solo añadiría un `setState` innecesario que el linter —con
  // razón— desaconseja.
  const problema = errorRecibido
    ? "No se completó la autorización en el proveedor."
    : !codigo || !state
      ? "Faltan datos en la respuesta del proveedor."
      : null;

  // El canje se dispara una sola vez: el `state` es de un solo uso, y en
  // desarrollo React monta los efectos dos veces. Sin esta guarda, el
  // segundo intento chocaría contra un `state` ya consumido.
  const yaEnviado = useRef(false);

  useEffect(() => {
    if (yaEnviado.current || problema || !codigo || !state) return;
    yaEnviado.current = true;
    completar.mutate(
      { data: { codigo, state } },
      // `replace`, no `push`: el botón "atrás" no debe regresar a este
      // callback, que ya no serviría de nada.
      { onSuccess: () => router.replace("/buzones") },
    );
  }, [codigo, state, problema, completar, router]);

  if (problema || completar.isError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
        <h1 className="text-xl font-semibold">No se pudo conectar el buzón</h1>
        <Fallo mensaje={problema ?? mensajeDeError(completar.error)} />
        <Boton variante="secundario" onClick={() => router.replace("/buzones")}>
          Volver a buzones
        </Boton>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <p className="text-sm text-[var(--color-texto-tenue)]">Conectando el buzón…</p>
      <Cargando filas={2} />
    </div>
  );
}

export default function RetornoDeVinculacion() {
  // `Proveedores` aporta el QueryClient que usa el hook del canje: esta
  // página vive fuera de `(panel)`, así que no hereda el del layout del
  // panel y hay que montarlo aquí. El `Suspense` lo exige `useSearchParams`
  // para el build de producción: sin él, Next aborta el prerender.
  return (
    <Proveedores>
      <Suspense fallback={<Cargando filas={2} />}>
        <Contenido />
      </Suspense>
    </Proveedores>
  );
}

function mensajeDeError(error: unknown): string {
  // El backend ya devuelve un mensaje redactado para mostrarse.
  if (error instanceof Error && error.message) return error.message;
  return "No fue posible completar la conexión del buzón.";
}
