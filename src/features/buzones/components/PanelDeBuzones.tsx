"use client";

/**
 * Vinculación y desvinculación de buzones.
 *
 * El flujo OAuth se inicia pidiendo la URL de consentimiento al
 * backend y redirigiendo. El `state` y el PKCE quedan del lado
 * servidor: el navegador solo sigue un enlace.
 */

import {
  useBuzonesAutorizar,
  useBuzonesDesvincular,
  useBuzonesListar,
} from "@/generated/api/buzones/buzones";
import type { BuzonSalida } from "@/generated/model";
import {
  Boton,
  Cargando,
  Etiqueta,
  Fallo,
  SinDatos,
  Tarjeta,
} from "@/shared/ui";

const PROVEEDORES = [
  { valor: "google", etiqueta: "Gmail" },
  { valor: "microsoft", etiqueta: "Outlook" },
] as const;

const TONO_POR_ESTADO = {
  active: "exito",
  expired: "aviso",
  revoked: "error",
  error: "error",
} as const;

const TEXTO_POR_ESTADO: Record<string, string> = {
  active: "Conectado",
  expired: "Caducado",
  revoked: "Revocado",
  error: "Con error",
};

export function PanelDeBuzones() {
  const buzones = useBuzonesListar();
  const autorizar = useBuzonesAutorizar();
  const desvincular = useBuzonesDesvincular();

  const conectar = (proveedor: string) => {
    autorizar.mutate(
      {
        data: {
          proveedor,
          redirect_uri: `${window.location.origin}/oauth/callback`,
        },
      },
      {
        onSuccess: (respuesta) => {
          // Navegación completa, no `router.push`: el destino es el
          // proveedor de identidad, fuera de esta aplicación.
          window.location.href = respuesta.data.url_de_autorizacion;
        },
      },
    );
  };

  if (buzones.isLoading) return <Cargando filas={3} />;

  if (buzones.isError) {
    return (
      <Fallo
        mensaje="No fue posible cargar los buzones."
        onReintentar={() => void buzones.refetch()}
      />
    );
  }

  const conexiones = buzones.data?.data ?? [];

  // Qué proveedor tiene la autorización en curso. Mientras la mutación
  // está pendiente, `variables` guarda los datos de la llamada en vuelo:
  // así solo el botón pulsado muestra «cargando» y no ambos.
  const proveedorEnCurso = autorizar.isPending
    ? autorizar.variables?.data.proveedor
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <Tarjeta
        titulo="Conectar un buzón"
        descripcion="Se solicita permiso de solo lectura. La aplicación nunca envía ni modifica correo."
      >
        <div className="flex flex-wrap gap-2">
          {PROVEEDORES.map(({ valor, etiqueta }) => (
            <Boton
              key={valor}
              variante="secundario"
              cargando={proveedorEnCurso === valor}
              disabled={autorizar.isPending && proveedorEnCurso !== valor}
              onClick={() => conectar(valor)}
            >
              Conectar {etiqueta}
            </Boton>
          ))}
        </div>
        {autorizar.isError && (
          <div className="mt-4">
            <Fallo mensaje={mensajeDeError(autorizar.error)} />
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Buzones conectados">
        {conexiones.length === 0 ? (
          <SinDatos
            titulo="Ningún buzón conectado"
            descripcion="Conecta una cuenta para empezar a escanear correos."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-borde)]">
            {conexiones.map((conexion) => (
              <FilaDeBuzon
                key={conexion.id}
                conexion={conexion}
                onDesvincular={() =>
                  desvincular.mutate(
                    { conexionId: conexion.id },
                    { onSuccess: () => void buzones.refetch() },
                  )
                }
                ocupado={desvincular.isPending}
              />
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}

function FilaDeBuzon({
  conexion,
  onDesvincular,
  ocupado,
}: {
  conexion: BuzonSalida;
  onDesvincular: () => void;
  ocupado: boolean;
}) {
  const tono =
    TONO_POR_ESTADO[conexion.estado as keyof typeof TONO_POR_ESTADO];

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <span className="font-medium">
          {conexion.correo_de_la_cuenta || "Cuenta sin correo"}
        </span>
        <span className="text-xs text-[var(--color-texto-tenue)]">
          {conexion.proveedor === "google" ? "Gmail" : "Outlook"} · vence el{" "}
          {new Date(conexion.expira_en).toLocaleString("es-PE")}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Etiqueta tono={tono ?? "neutro"}>
          {TEXTO_POR_ESTADO[conexion.estado] ?? conexion.estado}
        </Etiqueta>
        <Boton variante="peligro" disabled={ocupado} onClick={onDesvincular}>
          Desvincular
        </Boton>
      </div>
    </li>
  );
}

function mensajeDeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "No fue posible completar la operación.";
}
