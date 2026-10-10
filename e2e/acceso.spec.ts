/**
 * Control de acceso al panel.
 *
 * Es lo primero que debe cubrir la suite E2E: la comprobación de sesión
 * vive en un Server Component y en un `redirect`, así que ningún test de
 * componente puede verla. Si la carpeta `(panel)` dejara de estar
 * protegida, nada más en el proyecto lo notaría.
 */

import { expect, test } from "@playwright/test";
import { iniciarSesion, simularApi } from "./apoyo";

const SECCIONES = ["/buzones", "/escaneos", "/revision", "/registros"] as const;

test.describe("sin sesión", () => {
  test("la entrada ofrece iniciar sesión y no filtra datos", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /iniciar sesión/i })).toBeVisible();
    // La navegación del panel no debe existir todavía.
    await expect(page.getByRole("navigation", { name: "Secciones" })).toHaveCount(0);
  });

  for (const seccion of SECCIONES) {
    test(`${seccion} redirige a la entrada`, async ({ page }) => {
      await page.goto(seccion);
      await expect(page).toHaveURL("/");
      await expect(page.getByRole("link", { name: /iniciar sesión/i })).toBeVisible();
    });
  }

  test("el error del callback se muestra sin revelar la causa", async ({ page }) => {
    await page.goto("/?error=acceso");

    // Se busca dentro de `main`: Next añade su propio anunciador de
    // rutas con `role="alert"`, y sin acotar la busqueda el localizador
    // encuentra dos elementos.
    const aviso = page.getByRole("main").getByRole("alert");
    await expect(aviso).toBeVisible();
    // Distinguir "firma inválida" de "código ya usado" solo le sirve a
    // quien sondea el proveedor de identidad.
    await expect(aviso).not.toContainText(/firma|state|token|código/i);
  });
});

test.describe("con sesión", () => {
  test.beforeEach(async ({ context, page }) => {
    await iniciarSesion(context);
    await simularApi(page);
  });

  test("la entrada lleva directamente al panel", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/escaneos");
  });

  test("la navegación da acceso a todas las secciones", async ({ page }) => {
    await page.goto("/escaneos");

    const navegacion = page.getByRole("navigation", { name: "Secciones" });
    await expect(navegacion).toBeVisible();

    for (const etiqueta of ["Buzones", "Escaneos", "Revisión", "Registros"]) {
      await expect(navegacion.getByRole("link", { name: new RegExp(etiqueta) })).toBeVisible();
    }
  });

  test("la sección actual se anuncia a los lectores de pantalla", async ({ page }) => {
    await page.goto("/registros");

    const actual = page.locator('nav[aria-label="Secciones"] [aria-current="page"]');
    await expect(actual).toHaveText(/Registros/);
  });

  test("la cabecera muestra el correo de la sesión", async ({ page }) => {
    await page.goto("/escaneos");
    await expect(page.getByText("operador@ejemplo.test")).toBeVisible();
  });

  test("cerrar sesión es un POST, no un enlace", async ({ page }) => {
    await page.goto("/escaneos");

    const boton = page.getByRole("button", { name: /salir/i });
    await expect(boton).toBeVisible();
    // Un GET lo dispararía una precarga del navegador o un rastreador.
    const formulario = page.locator('form[action="/api/auth/logout"]');
    await expect(formulario).toHaveAttribute("method", /post/i);
  });

  test("el contador de pendientes aparece en la navegación", async ({ page }) => {
    await page.goto("/escaneos");
    await expect(page.getByLabel(/1 registro pendiente de revisión/)).toBeVisible();
  });
});
