"use client";

import { useState } from "react";
import { registrosVerDocumento } from "@/generated/api/registros/registros";

/**
 * Abre el documento original de un registro en una pestaña nueva.
 *
 * La URL es prefirmada y de vida corta, así que se pide en el momento y
 * no se guarda. La pestaña se abre de forma SÍNCRONA en el clic (en
 * blanco) y se redirige cuando llega la URL: abrirla después del `await`
 * la haría caer en el bloqueador de ventanas emergentes. `opener = null`
 * evita que la pestaña del documento pueda tocar esta aplicación.
 */
export function useAbrirDocumento() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);

  const abrir = async (registroId: string) => {
    if (cargando) return;
    setError(false);
    setCargando(true);

    const pestana = window.open("about:blank", "_blank");
    if (pestana) pestana.opener = null;

    try {
      const respuesta = await registrosVerDocumento(registroId);
      if (pestana) pestana.location.href = respuesta.data.url;
    } catch {
      pestana?.close();
      setError(true);
    } finally {
      setCargando(false);
    }
  };

  return { abrir, cargando, error };
}
