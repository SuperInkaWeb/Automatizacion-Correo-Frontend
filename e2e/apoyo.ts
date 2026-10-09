/**
 * Apoyo para los tests E2E: sesión sellada y respuestas del BFF.
 *
 * Propósito
 *   Dar a cada test una sesión válida y un conjunto de respuestas de API
 *   deterministas, sin backend ni proveedor de identidad.
 *
 * Por qué se sella la cookie en lugar de recorrer el login
 *   El login real sale al proveedor de identidad. Reproducirlo exigiría
 *   credenciales en el repositorio y haría que la suite dependiera de un
 *   servicio de terceros. La cookie de `iron-session` se puede construir
 *   aquí con el mismo secreto que usa el servidor, de modo que lo que se
 *   prueba es exactamente lo que la aplicación lee en producción.
 *
 *   El flujo OIDC en sí no queda sin cubrir: sus piezas —construcción de
 *   la URL de autorización, verificación del `state`, intercambio del
 *   código— son del lado servidor y se prueban en `vitest`.
 */

import type { BrowserContext, Page } from "@playwright/test";
import { sealData } from "iron-session";
import { ENTORNO_DE_PRUEBAS } from "../playwright.config";

const NOMBRE_DE_COOKIE = "mailauto_sesion";
const OCHO_HORAS = 60 * 60 * 8;

/** Añade al contexto una cookie de sesión válida. */
export async function iniciarSesion(contexto: BrowserContext): Promise<void> {
  const ahora = Math.floor(Date.now() / 1000);
  const sellada = await sealData(
    {
      accessToken: "token-de-pruebas",
      refreshToken: "refresco-de-pruebas",
      venceEn: ahora + OCHO_HORAS,
      sub: "auth0|pruebas",
      email: "operador@ejemplo.test",
    },
    { password: ENTORNO_DE_PRUEBAS.SESSION_SECRET, ttl: OCHO_HORAS },
  );

  await contexto.addCookies([
    {
      name: NOMBRE_DE_COOKIE,
      value: sellada,
      url: ENTORNO_DE_PRUEBAS.APP_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Envoltorio de respuesta que usa la API. */
function respuesta(data: unknown, meta?: unknown) {
  return meta === undefined ? { data } : { data, meta };
}

export const BUZON_ACTIVO = {
  id: "11111111-1111-4111-8111-111111111111",
  proveedor: "google",
  correo_de_la_cuenta: "contabilidad@ejemplo.test",
  estado: "active",
  alcances_concedidos: ["https://www.googleapis.com/auth/gmail.readonly"],
  expira_en: "2027-01-01T00:00:00Z",
  verificada_en: "2026-10-01T10:00:00Z",
};

export const ESCANEO_TERMINADO = {
  id: "22222222-2222-4222-8222-222222222222",
  estado: "succeeded",
  fase: "done",
  progreso_porcentaje: 100,
  contadores: {
    mensajes_revisados: 12,
    mensajes_con_adjuntos: 9,
    adjuntos_descargados: 9,
    adjuntos_rechazados: 0,
    adjuntos_duplicados: 1,
    errores: 0,
  },
  encolado_en: "2026-10-04T09:00:00Z",
};

export const ESCANEO_EN_CURSO = {
  ...ESCANEO_TERMINADO,
  id: "33333333-3333-4333-8333-333333333333",
  estado: "running",
  fase: "downloading",
  progreso_porcentaje: 45,
};

// Los registros llevan TODOS los campos que el contrato marca como
// requeridos. Un fixture incompleto no es un atajo: la interfaz confia en
// el contrato y omitir un campo requerido prueba un backend que no existe.
export const REGISTRO_COMPLETO = {
  id: "44444444-4444-4444-8444-444444444444",
  adjunto_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  trabajo_id: ESCANEO_TERMINADO.id,
  perfil: "sunat_arrendamiento",
  ruc_contribuyente: "20123456789",
  nombre_contribuyente: "Inmobiliaria Ejemplo SAC",
  tipo_doc_inquilino: "RUC",
  ruc_inquilino: "10456789123",
  nombre_inquilino: "Juan Pérez",
  tipo_de_bien: "PREDIO",
  periodo: "202609",
  fecha_de_pago: "2026-09-18",
  numero_de_operacion: "0098765",
  monto_alquiler: "6500.00",
  tributo_resultante: "325.00",
  importe_pagado: "1250.00",
  intereses_moratorios: "0.00",
  moneda: "PEN",
  completitud: "complete",
  estado_de_revision: "not_required",
  campos_dudosos: [] as string[],
  confianza_por_campo: {} as Record<string, number>,
  estrategia_usada: "pdf_texto",
  creado_en: "2026-10-04T09:12:00Z",
};

export const REGISTRO_PENDIENTE = {
  ...REGISTRO_COMPLETO,
  id: "55555555-5555-4555-8555-555555555555",
  ruc_contribuyente: null,
  importe_pagado: null,
  completitud: "partial",
  estado_de_revision: "pending",
  campos_dudosos: ["ruc_contribuyente", "importe_pagado"],
  confianza_por_campo: { ruc_contribuyente: 0.41, importe_pagado: 0.38 },
  estrategia_usada: "ocr",
};

/**
 * Rutas que la interfaz consulta, con respuestas por defecto.
 *
 * Las claves son `METODO ruta`, con la ruta tal como la pide el
 * navegador al BFF. Cada test puede sobrescribir las que le interesen.
 */
type Respuestas = Record<string, unknown>;

const POR_DEFECTO: Respuestas = {
  "GET /mailboxes": respuesta([BUZON_ACTIVO]),
  "GET /scans": respuesta([ESCANEO_TERMINADO]),
  "GET /records": respuesta([REGISTRO_COMPLETO], { cursor: null, hay_mas: false }),
  "GET /review": respuesta([REGISTRO_PENDIENTE], { cursor: null, hay_mas: false }),
  "GET /review/count": respuesta({ pendientes: 1 }),
  "GET /reports/exports": respuesta([]),
};

/**
 * Intercepta las llamadas al BFF.
 *
 * Se interceptan en el navegador y no con un servidor falso porque
 * `/api/bff/**` es una petición del propio navegador: TanStack Query
 * corre en el cliente. Lo que queda cubierto es la interfaz; el proxy
 * del BFF —su allowlist y el refresco de token— tiene sus propios tests
 * en `vitest`, donde se puede inspeccionar la petición saliente.
 */
export async function simularApi(page: Page, sobrescrituras: Respuestas = {}): Promise<void> {
  const respuestas = { ...POR_DEFECTO, ...sobrescrituras };

  await page.route("**/api/bff/**", async (ruta) => {
    const peticion = ruta.request();
    const url = new URL(peticion.url());
    const camino = url.pathname.replace(/^\/api\/bff/, "");
    const clave = `${peticion.method()} ${camino}`;

    const cuerpo = respuestas[clave];
    if (cuerpo === undefined) {
      // Un 501 explícito y no un 404: así un test que toque una ruta no
      // prevista falla señalando la ruta, en vez de mostrar el estado
      // vacío de la pantalla y parecer correcto.
      await ruta.fulfill({
        status: 501,
        contentType: "application/problem+json",
        body: JSON.stringify({
          type: "urn:pruebas:ruta-no-simulada",
          title: `Ruta no simulada en el test: ${clave}`,
        }),
      });
      return;
    }

    await ruta.fulfill({
      status: peticion.method() === "POST" ? 201 : 200,
      contentType: "application/json",
      body: JSON.stringify(cuerpo),
    });
  });
}

/** Construye un cuerpo SSE con los eventos indicados, en orden. */
export function flujoSse(eventos: Array<{ tipo: string; datos: unknown }>): string {
  return (
    eventos.map(({ tipo, datos }) => `event: ${tipo}\ndata: ${JSON.stringify(datos)}\n\n`).join("") +
    // El servidor cierra al terminar; sin cierre, `EventSource`
    // reintentaría y el test quedaría esperando.
    "\n"
  );
}

export { respuesta };
