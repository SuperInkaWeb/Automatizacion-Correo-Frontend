"use client";

import {
  useRegistrosConsultarExportacion,
  useRegistrosSolicitarExportacion,
} from "@/generated/api/registros/registros";
import type { SolicitarExportacionEntrada } from "@/generated/model";

const ESTADOS_TERMINALES = new Set(["ready", "failed"]);

/**
 * Solicita una exportación y la sigue hasta que está lista.
 *
 * La exportación es asíncrona (202 + worker); aquí se consulta cada dos
 * segundos y se deja de consultar en cuanto termina. Vive como hook para
 * poder usarlo tanto en la pantalla de Reportes como en la de Registros
 * (exportar la selección) sin duplicar el sondeo.
 */
export function useExportacion() {
  const solicitar = useRegistrosSolicitarExportacion();
  const exportacionId = solicitar.data?.data.id;

  const consulta = useRegistrosConsultarExportacion(exportacionId ?? "", {
    query: {
      enabled: Boolean(exportacionId),
      refetchInterval: (c) => {
        const estado = c.state.data?.data.estado;
        return estado && ESTADOS_TERMINALES.has(estado) ? false : 2000;
      },
    },
  });

  const exportar = (data: SolicitarExportacionEntrada) =>
    solicitar.mutate({ data });

  return {
    exportar,
    pidiendo: solicitar.isPending,
    error: solicitar.error,
    exportacion: consulta.data?.data,
  };
}
