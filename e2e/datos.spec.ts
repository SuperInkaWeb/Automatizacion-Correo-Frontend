/**
 * Registros, cola de revisión y reportes.
 *
 * Son las pantallas donde el usuario trabaja con los datos extraídos.
 * Lo que se verifica aquí es lo que un test de componente no alcanza: la
 * navegación entre páginas del listado y que lo que se envía al backend
 * al corregir o exportar sea lo que el usuario rellenó.
 */

import { expect, test } from "@playwright/test";
import {
  REGISTRO_COMPLETO,
  REGISTRO_PENDIENTE,
  iniciarSesion,
  respuesta,
  simularApi,
} from "./apoyo";

test.beforeEach(async ({ context }) => {
  await iniciarSesion(context);
});

test.describe("registros", () => {
  test("el listado muestra los campos extraídos", async ({ page }) => {
    await simularApi(page);
    await page.goto("/registros");

    const tabla = page.getByRole("table", { name: /registros tributarios/i });
    await expect(tabla.getByText("20123456789")).toBeVisible();
    await expect(tabla.getByText("Inmobiliaria Ejemplo SAC")).toBeVisible();
    await expect(tabla.getByText("Completo")).toBeVisible();
  });

  test("filtrar por RUC se envía al backend y reinicia la paginación", async ({ page }) => {
    const consultas: string[] = [];
    await simularApi(page);
    await page.route("**/api/bff/records?**", async (ruta) => {
      consultas.push(new URL(ruta.request().url()).search);
      await ruta.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(respuesta([REGISTRO_COMPLETO], { cursor: null, hay_mas: false })),
      });
    });

    await page.goto("/registros");
    await page.getByLabel("RUC arrendador").fill("20123456789");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();

    await expect.poll(() => consultas.some((c) => c.includes("ruc=20123456789"))).toBe(true);
    // Conservar el cursor daría una página intermedia de otro listado.
    const ultima = consultas.at(-1) ?? "";
    expect(ultima).not.toContain("cursor=");
  });

  test("la paginación avanza y retrocede por cursor", async ({ page }) => {
    const segundaPagina = { ...REGISTRO_COMPLETO, id: "66666666-6666-4666-8666-666666666666" };
    await simularApi(page);
    await page.route("**/api/bff/records?**", async (ruta) => {
      const parametros = new URL(ruta.request().url()).searchParams;
      const esSegunda = parametros.get("cursor") === "cursor-2";
      await ruta.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          esSegunda
            ? respuesta([segundaPagina], { cursor: null, hay_mas: false })
            : respuesta([REGISTRO_COMPLETO], { cursor: "cursor-2", hay_mas: true }),
        ),
      });
    });

    await page.goto("/registros");

    const anterior = page.getByRole("button", { name: "Anterior" });
    const siguiente = page.getByRole("button", { name: "Siguiente" });
    // En la primera página no hay nada atrás.
    await expect(anterior).toBeDisabled();

    await siguiente.click();
    await expect(page.getByText("Inmobiliaria Ejemplo SAC")).toBeVisible();
    await expect(anterior).toBeEnabled();
    // Sin más páginas, el botón de avanzar se apaga.
    await expect(siguiente).toBeDisabled();

    await anterior.click();
    await expect(anterior).toBeDisabled();
  });

  test("un listado vacío lo dice, no se queda en blanco", async ({ page }) => {
    await simularApi(page, {
      "GET /records": respuesta([], { cursor: null, hay_mas: false }),
    });
    await page.goto("/registros");

    await expect(page.getByText("Ningún registro con esos criterios")).toBeVisible();
  });

  test("un fallo del backend ofrece reintentar", async ({ page }) => {
    await simularApi(page);
    // El QueryClient reintenta un 5xx un par de veces por su cuenta, asi
    // que el fallo se mantiene con una bandera en lugar de contar
    // llamadas: contarlas haria que la consulta acabara teniendo exito
    // sola y el boton de reintentar no llegara a aparecer.
    let fallando = true;
    await page.route("**/api/bff/records?**", async (ruta) => {
      if (fallando) {
        await ruta.fulfill({
          status: 503,
          contentType: "application/problem+json",
          body: JSON.stringify({ title: "Servicio no disponible" }),
        });
        return;
      }
      await ruta.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(respuesta([REGISTRO_COMPLETO], { cursor: null, hay_mas: false })),
      });
    });

    await page.goto("/registros");

    const reintentar = page.getByRole("button", { name: "Reintentar" });
    await expect(reintentar).toBeVisible({ timeout: 15_000 });

    fallando = false;
    await reintentar.click();
    await expect(page.getByText("Inmobiliaria Ejemplo SAC")).toBeVisible();
  });
});

test.describe("cola de revisión", () => {
  test("muestra lo que el pipeline no pudo dar por bueno", async ({ page }) => {
    await simularApi(page);
    await page.goto("/revision");

    // Los valores se presentan en campos editables, no como texto: es un
    // formulario de correccion, no una vista.
    await expect(page.getByLabel("Periodo (AAAAMM)")).toHaveValue("202609");
    // El registro pendiente llega sin RUC: es justo lo que el operador
    // tiene que completar.
    await expect(page.getByLabel("RUC del arrendador")).toHaveValue("");
  });

  test("aprobar un registro lo envía y lo saca de la cola", async ({ page }) => {
    let aprobado = false;
    await simularApi(page);
    await page.route(`**/api/bff/records/${REGISTRO_PENDIENTE.id}/approve`, async (ruta) => {
      aprobado = true;
      await ruta.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          respuesta({ ...REGISTRO_PENDIENTE, estado_de_revision: "approved" }),
        ),
      });
    });

    await page.goto("/revision");
    // Sin ediciones el boton aprueba directamente; al tocar un campo
    // pasa a "Guardar y aprobar".
    await page.getByRole("button", { name: "Aprobar sin cambios" }).first().click();

    await expect.poll(() => aprobado).toBe(true);
  });

  test("un error de render no se lleva por delante el panel", async ({ page }) => {
    // Un campo requerido que el backend deja de enviar hace estallar el
    // render. Lo que no debe pasar es que desaparezcan la cabecera y la
    // navegación: el usuario se quedaría sin forma de ir a otra sección
    // ni de cerrar sesión.
    const incompleto = { ...REGISTRO_PENDIENTE } as Record<string, unknown>;
    delete incompleto.confianza_por_campo;

    await simularApi(page, {
      "GET /review": respuesta([incompleto], { cursor: null, hay_mas: false }),
    });
    await page.goto("/revision");

    await expect(page.getByText("Esta sección no se pudo mostrar")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Secciones" })).toBeVisible();
    await expect(page.getByRole("button", { name: /salir/i })).toBeVisible();

    // Y se puede salir de la pantalla rota.
    await page.getByRole("link", { name: /^Registros/ }).click();
    await expect(page).toHaveURL("/registros");
  });

  test("una cola vacía lo dice", async ({ page }) => {
    await simularApi(page, {
      "GET /review": respuesta([], { cursor: null, hay_mas: false }),
      "GET /review/count": respuesta({ pendientes: 0 }),
    });
    await page.goto("/revision");

    await expect(page.getByText("No hay nada pendiente de revisar")).toBeVisible();
  });
});

test.describe("reportes", () => {
  test("solicitar una exportación y esperar el enlace", async ({ page }) => {
    const exportacionId = "77777777-7777-4777-8777-777777777777";
    let consultas = 0;

    await simularApi(page, {
      "POST /reports/exports": respuesta({
        id: exportacionId,
        estado: "queued",
        formato: "xlsx",
        total_filas: 0,
        url_de_descarga: null,
      }),
    });
    await page.route(`**/api/bff/reports/exports/${exportacionId}`, async (ruta) => {
      consultas += 1;
      const listo = consultas > 1;
      await ruta.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          respuesta({
            id: exportacionId,
            estado: listo ? "ready" : "running",
            formato: "xlsx",
            total_filas: listo ? 42 : 0,
            url_de_descarga: listo ? "https://almacen.ejemplo.test/reporte.xlsx?firma=x" : null,
          }),
        ),
      });
    });

    await page.goto("/reportes");
    await page.getByRole("button", { name: "Generar" }).click();

    // El enlace solo debe aparecer cuando el reporte está listo: ofrecerlo
    // antes da una descarga que falla.
    await expect(page.getByRole("link", { name: /descargar/i })).toBeVisible({ timeout: 15_000 });
  });

  test("el formulario de exportación acepta filtros opcionales", async ({ page }) => {
    let cuerpo: unknown = null;
    await simularApi(page);
    await page.route("**/api/bff/reports/exports", async (ruta) => {
      if (ruta.request().method() !== "POST") {
        await ruta.fallback();
        return;
      }
      cuerpo = ruta.request().postDataJSON();
      await ruta.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(
          respuesta({
            id: "88888888-8888-4888-8888-888888888888",
            estado: "queued",
            formato: "csv",
            total_filas: 0,
            url_de_descarga: null,
          }),
        ),
      });
    });

    await page.goto("/reportes");
    await page.getByLabel("RUC (opcional)").fill("20123456789");
    await page.getByRole("button", { name: "Generar" }).click();

    await expect.poll(() => cuerpo).not.toBeNull();
    expect(JSON.stringify(cuerpo)).toContain("20123456789");
  });
});
