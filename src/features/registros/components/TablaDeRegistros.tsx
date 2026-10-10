"use client";

/**
 * Listado de registros extraídos: filtrar, seleccionar y exportar.
 *
 * Paginación por cursor, no por número de página: con `OFFSET` una
 * inserción concurrente desplaza los resultados y la página siguiente
 * repite o se salta filas.
 *
 * La selección es por casillas y la exportación usa, o bien los ids
 * marcados ("exportar solo estos"), o bien los filtros activos
 * ("exportar todo lo filtrado"). El reporte sale como tabla plana
 * ordenada por periodo.
 */

import { useState, type ReactNode } from "react";
import { useRegistrosListarRegistros } from "@/generated/api/registros/registros";
import type { RegistroSalida } from "@/generated/model";
import { useAbrirDocumento } from "../hooks/useAbrirDocumento";
import { useExportacion } from "@/features/reportes/hooks/useExportacion";
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

const TEXTO_POR_ESTADO_EXPORT: Record<string, string> = {
  queued: "En cola",
  running: "Generando",
  ready: "Listo",
  failed: "Falló",
};

/** Filtros ya aplicados; sus claves coinciden con el contrato del backend. */
type Filtros = {
  ruc?: string;
  ruc_inquilino?: string;
  periodo_desde?: string;
  periodo_hasta?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  solo_aprobados?: boolean;
};

export function TablaDeRegistros() {
  // Borradores del formulario, separados de lo aplicado: escribir en un
  // campo no debe relanzar la consulta en cada tecla.
  const [ruc, setRuc] = useState("");
  const [rucInquilino, setRucInquilino] = useState("");
  const [periodoDesde, setPeriodoDesde] = useState("");
  const [periodoHasta, setPeriodoHasta] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [soloAprobados, setSoloAprobados] = useState(false);
  const [formato, setFormato] = useState("xlsx");

  const [aplicados, setAplicados] = useState<Filtros>({});
  const [cursores, setCursores] = useState<string[]>([]);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const cursorActual = cursores.at(-1);
  const registros = useRegistrosListarRegistros({
    limite: 25,
    ...aplicados,
    ...(cursorActual ? { cursor: cursorActual } : {}),
  });
  const exportacion = useExportacion();

  const aplicarFiltros = () => {
    // Al cambiar los filtros se vuelve a la primera página y se limpia la
    // selección: marcar filas de un listado y luego filtrarlo dejaría
    // seleccionados registros que ya no se ven.
    setCursores([]);
    setSeleccion(new Set());
    setAplicados({
      ...(ruc ? { ruc } : {}),
      ...(rucInquilino ? { ruc_inquilino: rucInquilino } : {}),
      ...(periodoDesde ? { periodo_desde: periodoDesde } : {}),
      ...(periodoHasta ? { periodo_hasta: periodoHasta } : {}),
      ...(fechaDesde ? { fecha_desde: fechaDesde } : {}),
      ...(fechaHasta ? { fecha_hasta: fechaHasta } : {}),
      ...(soloAprobados ? { solo_aprobados: true } : {}),
    });
  };

  const filas = registros.data?.data ?? [];
  const meta = registros.data?.meta;
  const hayMas = meta?.hay_mas === true;
  const siguiente = meta?.cursor ?? undefined;

  const alternar = (id: string) =>
    setSeleccion((previa) => {
      const copia = new Set(previa);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });

  const todasVisiblesMarcadas =
    filas.length > 0 && filas.every((f) => seleccion.has(f.id));
  const alternarTodas = () =>
    setSeleccion((previa) => {
      const copia = new Set(previa);
      if (todasVisiblesMarcadas) filas.forEach((f) => copia.delete(f.id));
      else filas.forEach((f) => copia.add(f.id));
      return copia;
    });

  const exportar = (soloSeleccionados: boolean) =>
    exportacion.exportar({
      formato,
      ...aplicados,
      ...(soloSeleccionados ? { ids: [...seleccion] } : {}),
    });

  return (
    <div className="flex flex-col gap-6">
      <Tarjeta titulo="Filtrar registros">
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            aplicarFiltros();
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="RUC arrendador">
              <Entrada value={ruc} onChange={setRuc} placeholder="11 dígitos" maxLength={11} />
            </Campo>
            <Campo etiqueta="RUC inquilino">
              <Entrada
                value={rucInquilino}
                onChange={setRucInquilino}
                placeholder="11 dígitos"
                maxLength={11}
              />
            </Campo>
            <Campo etiqueta="Solo aprobados">
              <label className="flex h-full items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={soloAprobados}
                  onChange={(e) => setSoloAprobados(e.target.checked)}
                  className="size-4"
                />
                <span className="text-[var(--color-texto-tenue)]">
                  Excluir pendientes y rechazados
                </span>
              </label>
            </Campo>
            <Campo etiqueta="Periodo desde (AAAAMM)">
              <Entrada value={periodoDesde} onChange={setPeriodoDesde} placeholder="202501" maxLength={6} />
            </Campo>
            <Campo etiqueta="Periodo hasta (AAAAMM)">
              <Entrada value={periodoHasta} onChange={setPeriodoHasta} placeholder="202512" maxLength={6} />
            </Campo>
            <div className="hidden lg:block" />
            <Campo etiqueta="Fecha de pago desde">
              <Entrada type="date" value={fechaDesde} onChange={setFechaDesde} />
            </Campo>
            <Campo etiqueta="Fecha de pago hasta">
              <Entrada type="date" value={fechaHasta} onChange={setFechaHasta} />
            </Campo>
          </div>
          <div>
            <Boton type="submit" variante="secundario">
              Aplicar filtros
            </Boton>
          </div>
        </form>
      </Tarjeta>

      <Tarjeta
        titulo="Registros extraídos"
        descripcion="Marca filas para exportar solo esas, o exporta todo lo filtrado. El reporte sale como tabla plana por periodo."
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={formato}
              onChange={(e) => setFormato(e.target.value)}
              aria-label="Formato del reporte"
              className="rounded-md border border-[var(--color-borde)] bg-[var(--color-fondo)] px-2 py-1.5 text-sm"
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV</option>
            </select>
            <Boton
              variante="secundario"
              cargando={exportacion.pidiendo}
              disabled={seleccion.size === 0}
              onClick={() => exportar(true)}
            >
              Exportar seleccionados ({seleccion.size})
            </Boton>
            <Boton cargando={exportacion.pidiendo} onClick={() => exportar(false)}>
              Exportar todo lo filtrado
            </Boton>
          </div>
        }
      >
        {exportacion.error && (
          <div className="mb-4">
            <Fallo mensaje={mensajeDeError(exportacion.error)} />
          </div>
        )}
        {exportacion.exportacion && (
          <ResultadoDeExportacion datos={exportacion.exportacion} />
        )}

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
            <Tabla
              cabeceras={[
                <input
                  key="todas"
                  type="checkbox"
                  aria-label="Seleccionar todos los de esta página"
                  checked={todasVisiblesMarcadas}
                  onChange={alternarTodas}
                  className="size-4"
                />,
                "RUC",
                "Nombre",
                "Periodo",
                "Fecha",
                "Importe pagado",
                "Estado",
                "Revisión",
                "Origen",
              ]}
              descripcion="Registros tributarios extraídos"
            >
              {filas.map((registro) => (
                <FilaDeRegistro
                  key={registro.id}
                  registro={registro}
                  seleccionado={seleccion.has(registro.id)}
                  onAlternar={() => alternar(registro.id)}
                />
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
                {seleccion.size > 0 ? ` · ${seleccion.size} marcado${seleccion.size === 1 ? "" : "s"}` : ""}
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
    </div>
  );
}

function ResultadoDeExportacion({
  datos,
}: {
  datos: NonNullable<ReturnType<typeof useExportacion>["exportacion"]>;
}) {
  return (
    <div
      aria-live="polite"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-[var(--color-borde)] p-3 text-sm"
    >
      <Etiqueta
        tono={
          datos.estado === "ready"
            ? "exito"
            : datos.estado === "failed"
              ? "error"
              : "info"
        }
      >
        {TEXTO_POR_ESTADO_EXPORT[datos.estado] ?? datos.estado}
      </Etiqueta>
      {datos.estado === "ready" && (
        <>
          <span className="text-[var(--color-texto-tenue)]">
            {datos.total_filas} fila{datos.total_filas === 1 ? "" : "s"}
          </span>
          {datos.url_de_descarga && (
            <a
              href={datos.url_de_descarga}
              rel="noopener noreferrer"
              className="rounded-md bg-[var(--color-acento)] px-3 py-1.5 text-white"
            >
              Descargar
            </a>
          )}
        </>
      )}
      {datos.estado === "failed" && (
        <span>{datos.mensaje_de_error ?? "No se pudo generar."}</span>
      )}
    </div>
  );
}

function FilaDeRegistro({
  registro,
  seleccionado,
  onAlternar,
}: {
  registro: RegistroSalida;
  seleccionado: boolean;
  onAlternar: () => void;
}) {
  const tono =
    TONO_POR_COMPLETITUD[
      registro.completitud as keyof typeof TONO_POR_COMPLETITUD
    ];
  const documento = useAbrirDocumento();

  return (
    <tr className="border-b border-[var(--color-borde)] last:border-0">
      <Celda>
        <input
          type="checkbox"
          aria-label="Seleccionar este registro"
          checked={seleccionado}
          onChange={onAlternar}
          className="size-4"
        />
      </Celda>
      <Celda className="font-mono text-xs">
        {registro.ruc_contribuyente ?? "—"}
      </Celda>
      <Celda>{registro.nombre_contribuyente || "—"}</Celda>
      <Celda className="tabular-nums">{registro.periodo ?? "—"}</Celda>
      <Celda className="whitespace-nowrap">
        {registro.fecha_de_pago ?? "—"}
      </Celda>
      <Celda className="tabular-nums">
        {registro.importe_pagado
          ? `${registro.moneda === "USD" ? "US$" : "S/"} ${registro.importe_pagado}`
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
            <button
              type="button"
              onClick={() => void documento.abrir(registro.id)}
              disabled={documento.cargando}
              title={registro.correo_asunto ?? "Ver documento"}
              className="truncate text-left text-[var(--color-acento)] underline-offset-2 hover:underline disabled:opacity-60"
            >
              {documento.error
                ? "Reintentar"
                : (registro.adjunto_nombre ?? "Ver documento")}
            </button>
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

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[var(--color-texto-tenue)]">{etiqueta}</span>
      {children}
    </label>
  );
}

function Entrada({
  value,
  onChange,
  placeholder,
  maxLength,
  type = "text",
}: {
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      inputMode={maxLength ? "numeric" : undefined}
      className="rounded-md border border-[var(--color-borde)] bg-[var(--color-fondo)] px-2 py-1.5 text-sm"
    />
  );
}

function mensajeDeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "No fue posible solicitar el reporte.";
}
