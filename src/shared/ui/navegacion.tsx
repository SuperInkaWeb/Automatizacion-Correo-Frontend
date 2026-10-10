"use client";

/**
 * Navegación principal del panel.
 *
 * Marca la sección activa con `aria-current`, no solo con color: a
 * quien navega con lector de pantalla el color no le dice nada, y a
 * quien no distingue bien los contrastes, tampoco.
 *
 * El contador de pendientes lo consulta este componente y no lo recibe
 * por prop: la navegación vive en un layout que es Server Component, así
 * que no puede usar hooks ni pasarle el resultado de una consulta de
 * cliente. Pedirlo aquí también evita que cada página tenga que
 * acordarse de propagarlo.
 */

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useRegistrosPendientesDeRevision } from "@/generated/api/registros/registros";

// Tipadas como `Route`: con `typedRoutes`, Next comprueba en
// compilacion que cada enlace apunta a una ruta que existe. Un typo
// deja de ser un 404 en produccion y pasa a ser un error de build.
// Ordenadas por el flujo de uso real: primero se vincula un buzon,
// luego se escanea, se revisa lo dudoso y al final se consultan y
// exportan los registros. La exportacion vive dentro de Registros
// (se exporta lo que se ve y se filtra), asi que no hay seccion aparte.
const SECCIONES: readonly { ruta: Route; etiqueta: string }[] = [
  { ruta: "/buzones", etiqueta: "Buzones" },
  { ruta: "/escaneos", etiqueta: "Escaneos" },
  { ruta: "/revision", etiqueta: "Revisión" },
  { ruta: "/registros", etiqueta: "Registros" },
];

export function Navegacion() {
  const rutaActual = usePathname();

  // Un fallo aquí no debe romper la navegación: sin contador se sigue
  // pudiendo llegar a la cola de revisión, que es lo que importa.
  const consulta = useRegistrosPendientesDeRevision({
    query: { refetchInterval: 60_000, retry: false },
  });
  const pendientes = consulta.data?.data.pendientes;

  return (
    <nav aria-label="Secciones" className="flex flex-wrap gap-1">
      {SECCIONES.map(({ ruta, etiqueta }) => {
        const activa = rutaActual === ruta;
        return (
          <Link
            key={ruta}
            href={ruta}
            aria-current={activa ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              activa
                ? "bg-[var(--color-acento)]/15 font-medium text-[var(--color-acento)]"
                : "text-[var(--color-texto-tenue)] hover:bg-[var(--color-superficie)]"
            }`}
          >
            {etiqueta}
            {ruta === "/revision" && pendientes !== undefined && pendientes > 0 && (
              <span
                className="ml-2 rounded-full bg-[var(--color-aviso)]/20 px-1.5 py-0.5 text-xs text-[var(--color-aviso)]"
                aria-label={`${pendientes} ${
                  pendientes === 1 ? "registro pendiente" : "registros pendientes"
                } de revisión`}
              >
                {pendientes}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
