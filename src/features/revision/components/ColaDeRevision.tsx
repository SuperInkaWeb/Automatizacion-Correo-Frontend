"use client";

/**
 * Cola de revisión humana.
 *
 * Es lo que convierte la imperfección inevitable del OCR en un flujo
 * cerrado: el pipeline marca lo dudoso, una persona lo corrige y el
 * registro queda aprobado con constancia de quién lo tocó.
 *
 * El formulario de corrección es compartido con la edición del listado
 * general (`FormularioDeCorreccion`): aquí solo se le pone encima la
 * cabecera que resalta cuántos campos leyó el motor con poca confianza.
 */

import {
  useRegistrosColaDeRevision,
} from "@/generated/api/registros/registros";
import type { RegistroSalida } from "@/generated/model";
import { FormularioDeCorreccion } from "@/features/registros/components/FormularioDeCorreccion";
import { Cargando, Etiqueta, Fallo, SinDatos, Tarjeta } from "@/shared/ui";

export function ColaDeRevision() {
  const cola = useRegistrosColaDeRevision({ limite: 25 });

  if (cola.isLoading) return <Cargando filas={5} />;

  if (cola.isError) {
    return (
      <Fallo
        mensaje="No fue posible cargar la cola de revisión."
        onReintentar={() => void cola.refetch()}
      />
    );
  }

  const registros = cola.data?.data ?? [];

  if (registros.length === 0) {
    return (
      <SinDatos
        titulo="No hay nada pendiente de revisar"
        descripcion="Los registros que el pipeline no pueda dar por buenos aparecerán aquí."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-[var(--color-texto-tenue)]">
        {registros.length} registro{registros.length === 1 ? "" : "s"} pendiente
        {registros.length === 1 ? "" : "s"}. Los campos resaltados son los que
        el motor leyó con poca confianza.
      </p>
      {registros.map((registro) => (
        <FichaDeRevision
          key={registro.id}
          registro={registro}
          onResuelto={() => void cola.refetch()}
        />
      ))}
    </div>
  );
}

function FichaDeRevision({
  registro,
  onResuelto,
}: {
  registro: RegistroSalida;
  onResuelto: () => void;
}) {
  const dudosos = registro.campos_dudosos.length;

  return (
    <Tarjeta
      // El RUC es el mejor identificador; si no se pudo leer, el nombre
      // del archivo dice más que un genérico "sin RUC".
      titulo={
        registro.ruc_contribuyente ??
        registro.adjunto_nombre ??
        "Documento sin identificar"
      }
      descripcion={`Leído por ${registro.estrategia_usada ?? "—"} · ${registro.completitud}`}
      acciones={
        <Etiqueta tono={dudosos > 0 ? "aviso" : "info"}>
          {dudosos > 0
            ? `${dudosos} campo${dudosos === 1 ? "" : "s"} dudoso${dudosos === 1 ? "" : "s"}`
            : "Revisión solicitada"}
        </Etiqueta>
      }
    >
      <FormularioDeCorreccion registro={registro} onResuelto={onResuelto} />
    </Tarjeta>
  );
}
