"use client";

/**
 * Formulario de corrección de un registro.
 *
 * Es el mismo formulario para dos sitios: la cola de revisión (donde el
 * pipeline marcó algo dudoso) y el listado general (editar un registro
 * ya completo por si se coló un error). Vive aquí, compartido, para que
 * el conjunto de campos corregibles y la lógica de "solo se envía lo que
 * cambió" no se dupliquen ni se desincronicen entre ambas pantallas.
 */

import { useState } from "react";
import {
  useRegistrosAprobarRegistro,
  useRegistrosCorregirRegistro,
  useRegistrosRechazarRegistro,
} from "@/generated/api/registros/registros";
import type { RegistroSalida } from "@/generated/model";
import { useAbrirDocumento } from "../hooks/useAbrirDocumento";
import { Boton, Etiqueta, Fallo } from "@/shared/ui";

/** Campos corregibles y su etiqueta, en el orden del formulario. */
export const CAMPOS_CORREGIBLES = [
  { clave: "ruc_contribuyente", etiqueta: "RUC del arrendador" },
  { clave: "nombre_contribuyente", etiqueta: "Nombre / Razón social" },
  { clave: "tipo_doc_inquilino", etiqueta: "Tipo doc. inquilino" },
  { clave: "ruc_inquilino", etiqueta: "RUC del arrendatario" },
  { clave: "nombre_inquilino", etiqueta: "Inquilino" },
  { clave: "tipo_de_bien", etiqueta: "Tipo de bien" },
  { clave: "periodo", etiqueta: "Periodo (AAAAMM)" },
  { clave: "fecha_de_pago", etiqueta: "Fecha de pago (DD/MM/AAAA)" },
  { clave: "numero_de_operacion", etiqueta: "N.º de operación" },
  { clave: "monto_alquiler", etiqueta: "Monto de alquiler" },
  { clave: "tributo_resultante", etiqueta: "Tributo resultante" },
  { clave: "importe_pagado", etiqueta: "Importe pagado" },
  { clave: "intereses_moratorios", etiqueta: "Intereses moratorios" },
] as const;

export function FormularioDeCorreccion({
  registro,
  onResuelto,
}: {
  registro: RegistroSalida;
  onResuelto: () => void;
}) {
  const dudosos = new Set(registro.campos_dudosos);
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      CAMPOS_CORREGIBLES.map(({ clave }) => [
        clave,
        String(registro[clave as keyof RegistroSalida] ?? ""),
      ]),
    ),
  );

  const corregir = useRegistrosCorregirRegistro();
  const aprobar = useRegistrosAprobarRegistro();
  const rechazar = useRegistrosRechazarRegistro();
  const documento = useAbrirDocumento();

  const ocupado = corregir.isPending || aprobar.isPending || rechazar.isPending;
  const error = corregir.error ?? aprobar.error ?? rechazar.error;

  // Solo se envía lo que cambió. Mandar el formulario entero haría que
  // el backend marcase como "corregidos a mano" campos que nadie tocó,
  // y la confianza de todos subiría a 1.0 sin que nadie los mirase.
  const cambios = Object.fromEntries(
    CAMPOS_CORREGIBLES.map(({ clave }) => [clave, valores[clave] ?? ""]).filter(
      ([clave, valor]) =>
        valor !== String(registro[clave as keyof RegistroSalida] ?? ""),
    ),
  );
  const hayCambios = Object.keys(cambios).length > 0;

  const guardar = () => {
    if (!hayCambios) {
      aprobar.mutate({ registroId: registro.id }, { onSuccess: onResuelto });
      return;
    }
    corregir.mutate(
      { registroId: registro.id, data: { correcciones: cambios } },
      { onSuccess: onResuelto },
    );
  };

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar();
      }}
      className="flex flex-col gap-4"
    >
      <OrigenDelCorreo registro={registro} />

      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS_CORREGIBLES.map(({ clave, etiqueta }) => {
          const dudoso = dudosos.has(clave);
          const confianza = registro.confianza_por_campo[clave];
          return (
            <label key={clave} className="flex flex-col gap-1 text-sm">
              <span className="flex items-center gap-2">
                {etiqueta}
                {dudoso && (
                  <Etiqueta tono="aviso">
                    {confianza !== undefined
                      ? `${Math.round(confianza * 100)}%`
                      : "dudoso"}
                  </Etiqueta>
                )}
              </span>
              <input
                value={valores[clave] ?? ""}
                onChange={(evento) =>
                  setValores((previos) => ({
                    ...previos,
                    [clave]: evento.target.value,
                  }))
                }
                // El borde marca el campo dudoso, pero la etiqueta de
                // porcentaje de arriba es lo que lo comunica a quien
                // no distingue el color.
                className={`rounded-md border bg-[var(--color-fondo)] px-3 py-2 ${
                  dudoso
                    ? "border-[var(--color-aviso)]"
                    : "border-[var(--color-borde)]"
                }`}
              />
            </label>
          );
        })}
      </div>

      {error && <Fallo mensaje={mensajeDeError(error)} />}

      <div className="flex flex-wrap gap-2">
        <Boton
          type="button"
          variante="secundario"
          cargando={documento.cargando}
          onClick={() => void documento.abrir(registro.id)}
        >
          {documento.error ? "Reintentar" : "Ver documento"}
        </Boton>
        <Boton type="submit" cargando={ocupado}>
          {hayCambios ? "Guardar y aprobar" : "Aprobar sin cambios"}
        </Boton>
        <Boton
          type="button"
          variante="peligro"
          disabled={ocupado}
          onClick={() =>
            rechazar.mutate({ registroId: registro.id }, { onSuccess: onResuelto })
          }
        >
          Rechazar
        </Boton>
      </div>
    </form>
  );
}

/**
 * Procedencia del registro: de qué correo y archivo salió. Es lo que
 * permite a quien revisa saber qué documento está mirando antes de
 * corregir un campo a ciegas.
 */
function OrigenDelCorreo({ registro }: { registro: RegistroSalida }) {
  const tieneOrigen =
    registro.correo_remitente ||
    registro.correo_asunto ||
    registro.adjunto_nombre;
  if (!tieneOrigen) return null;

  const recibido = registro.correo_recibido_en
    ? new Date(registro.correo_recibido_en).toLocaleString("es-PE")
    : null;

  return (
    <dl className="grid gap-x-6 gap-y-1 rounded-md border border-[var(--color-borde)] bg-[var(--color-fondo)] p-3 text-sm sm:grid-cols-2">
      <DatoDeOrigen etiqueta="De" valor={registro.correo_remitente} />
      <DatoDeOrigen etiqueta="Asunto" valor={registro.correo_asunto} />
      <DatoDeOrigen etiqueta="Archivo" valor={registro.adjunto_nombre} />
      <DatoDeOrigen etiqueta="Recibido" valor={recibido} />
    </dl>
  );
}

function DatoDeOrigen({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string | null | undefined;
}) {
  if (!valor) return null;
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-[var(--color-texto-tenue)]">{etiqueta}:</dt>
      <dd className="truncate" title={valor}>
        {valor}
      </dd>
    </div>
  );
}

function mensajeDeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "No fue posible guardar los cambios.";
}
