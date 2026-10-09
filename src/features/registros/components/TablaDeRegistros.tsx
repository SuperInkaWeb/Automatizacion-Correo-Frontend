"use client";

/**
 * Listado de registros extraídos, con filtros.
 *
 * Paginación por cursor, no por número de página: el backend la
 * expone así porque con `OFFSET` una inserción concurrente desplaza
 * los resultados y la página siguiente repite o se salta filas.
 */

import { useState } from "react";
import { useRegistrosListarRegistros } from "@/generated/api/registros/registros";
import type { RegistroSalida } from "@/generated/model";
import {
  Boton,
  Cargando,
  Celda,
  Etiqueta,
  Fallo,
  SinDatos,
  Tabla,
  Tarjeta,
} from "@/shared/ui";

const CABECERAS = [
  "RUC",
  "Nombre",
  "Periodo",
  "Fecha",
  "Importe",
  "Estado",
  "Revisión",
  "Origen",
] as const;

const TONO_POR_COMPLETITUD = {
  complete: "exito",
  partial: "aviso",
  empty: "error",
} as const;

const TEXTO_POR_COMPLETITUD: Record<string, string> = {
  complete: "Completo",
  partial: "Parcial",
  empty: "Vacío",
};

const TEXTO_POR_REVISION: Record<string, string> = {
  not_required: "—",
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export function TablaDeRegistros() {
  const [ruc, setRuc] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [filtros, setFiltros] = useState<{ ruc?: string; periodo?: string }>({});
  const [cursores, setCursores] = useState<string[]>([]);

  const cursorActual = cursores.at(-1);
  const registros = useRegistrosListarRegistros({
    limite: 25,
    ...filtros,
    ...(cursorActual ? { cursor: cursorActual } : {}),
  });

  const aplicarFiltros = () => {
    // Al cambiar los filtros se vuelve a la primera página: conservar
    // el cursor daría una página intermedia de un listado distinto.
    setCursores([]);
    setFiltros({
      ...(ruc ? { ruc } : {}),
      ...(periodo ? { periodo } : {}),
    });
  };

  const filas = registros.data?.data ?? [];
  const meta = registros.data?.meta;
  const hayMas = meta?.hay_mas === true;
  const siguiente = meta?.cursor ?? undefined;

  return (
    <Tarjeta
      titulo="Registros extraídos"
      acciones={
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            aplicarFiltros();
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[var(--color-texto-tenue)]">RUC</span>
            <input
              value={ruc}
              onChange={(evento) => setRuc(evento.target.value)}
              inputMode="numeric"
              maxLength={11}
              placeholder="11 dígitos"
              className="w-36 rounded-md border border-[var(--color-borde)] bg-[var(--color-fondo)] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[var(--color-texto-tenue)]">Periodo</span>
            <input
              value={periodo}
              onChange={(evento) => setPeriodo(evento.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="AAAAMM"
              className="w-28 rounded-md border border-[var(--color-borde)] bg-[var(--color-fondo)] px-2 py-1.5 text-sm"
            />
          </label>
          <Boton type="submit" variante="secundario">
            Filtrar
          </Boton>
        </form>
      }
    >
      {registros.isLoading ? (
        <Cargando filas={6} />
      ) : registros.isError ? (
        <Fallo
          mensaje="No fue posible cargar los registros."
          onReintentar={() => void registros.refetch()}
        />
      ) : filas.length === 0 ? (
        <SinDatos
          titulo="Ningún registro con esos criterios"
          descripcion="Lanza un escaneo o prueba a quitar los filtros."
        />
      ) : (
        <>
          <Tabla cabeceras={CABECERAS} descripcion="Registros tributarios extraídos">
            {filas.map((registro) => (
              <FilaDeRegistro key={registro.id} registro={registro} />
            ))}
          </Tabla>

          <div className="mt-4 flex items-center justify-between gap-3">
            <Boton
              variante="secundario"
              disabled={cursores.length === 0}
              onClick={() => setCursores((previos) => previos.slice(0, -1))}
            >
              Anterior
            </Boton>
            <span className="text-sm text-[var(--color-texto-tenue)]">
              {filas.length} registro{filas.length === 1 ? "" : "s"}
            </span>
            <Boton
              variante="secundario"
              disabled={!hayMas || !siguiente}
              onClick={() =>
                siguiente && setCursores((previos) => [...previos, siguiente])
              }
            >
              Siguiente
            </Boton>
          </div>
        </>
      )}
    </Tarjeta>
  );
}

function FilaDeRegistro({ registro }: { registro: RegistroSalida }) {
  const tono =
    TONO_POR_COMPLETITUD[
      registro.completitud as keyof typeof TONO_POR_COMPLETITUD
    ];

  return (
    <tr className="border-b border-[var(--color-borde)] last:border-0">
      <Celda className="font-mono text-xs">
        {registro.ruc_contribuyente ?? "—"}
      </Celda>
      <Celda>{registro.nombre_contribuyente || "—"}</Celda>
      <Celda className="tabular-nums">{registro.periodo ?? "—"}</Celda>
      <Celda className="whitespace-nowrap">
        {registro.fecha_de_pago ?? "—"}
      </Celda>
      <Celda className="tabular-nums">
        {registro.importe
          ? `${registro.moneda === "USD" ? "US$" : "S/"} ${registro.importe}`
          : "—"}
      </Celda>
      <Celda>
        <Etiqueta tono={tono ?? "neutro"}>
          {TEXTO_POR_COMPLETITUD[registro.completitud] ?? registro.completitud}
        </Etiqueta>
      </Celda>
      <Celda className="text-[var(--color-texto-tenue)]">
        {TEXTO_POR_REVISION[registro.estado_de_revision] ??
          registro.estado_de_revision}
      </Celda>
      <Celda>
        {registro.adjunto_nombre || registro.correo_remitente ? (
          <div className="flex max-w-[16rem] flex-col">
            <span className="truncate" title={registro.correo_asunto ?? undefined}>
              {registro.adjunto_nombre ?? "—"}
            </span>
            {registro.correo_remitente && (
              <span className="truncate text-xs text-[var(--color-texto-tenue)]">
                {registro.correo_remitente}
              </span>
            )}
          </div>
        ) : (
          "—"
        )}
      </Celda>
    </tr>
  );
}
