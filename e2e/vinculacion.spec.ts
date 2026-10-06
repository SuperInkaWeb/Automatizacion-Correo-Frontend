/**
 * Retorno de la vinculación de un buzón (`/oauth/callback`).
 *
 * Esta página es el punto exacto al que Google y Microsoft devuelven al
 * usuario tras autorizar su correo. Su ausencia —que existió— dejaba un 404
 * justo ahí: el usuario autorizaba su buzón y no pasaba nada. Estos tests
 * impiden que vuelva a desaparecer sin que nadie lo note.
 */

import { expect, test } from "@playwright/test";
import { BUZON_ACTIVO, iniciarSesion, respuesta, simularApi } from "./apoyo";

test.beforeEach(async ({ context }) => {
  await iniciarSesion(context);
});

test("con código y state válidos completa y vuelve a buzones", async ({ page }) => {
  let recibido: unknown = null;
  await simularApi(page);
  await page.route("**/api/bff/mailboxes/callback", async (ruta) => {
    recibido = ruta.request().postDataJSON();
    await ruta.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(respuesta(BUZON_ACTIVO)),
    });
  });

  await page.goto("/oauth/callback?code=codigo-de-google&state=un-state-de-16-mas");

  // Termina llevando al usuario a la pantalla de buzones.
  await expect(page).toHaveURL("/buzones");
  // Y lo que envió al backend es lo que vino en la URL, sin inventar nada.
  expect(recibido).toEqual({ codigo: "codigo-de-google", state: "un-state-de-16-mas" });
});

test("si el proveedor devuelve un error, no se queda atascado", async ({ page }) => {
  await simularApi(page);
  let seLlamoAlBackend = false;
  await page.route("**/api/bff/mailboxes/callback", async (ruta) => {
    seLlamoAlBackend = true;
    await ruta.fulfill({ status: 201, body: "{}" });
  });

  // El usuario canceló en la pantalla de Google: vuelve con `error`.
  await page.goto("/oauth/callback?error=access_denied");

  await expect(page.getByText("No se pudo conectar el buzón")).toBeVisible();
  // No se intenta canjear nada: no hay código que canjear.
  expect(seLlamoAlBackend).toBe(false);
  // Y hay salida: un botón para volver, no un callejón sin salida.
  await page.getByRole("button", { name: /volver a buzones/i }).click();
  await expect(page).toHaveURL("/buzones");
});

test("un state ya consumido muestra el error del backend", async ({ page }) => {
  await simularApi(page);
  await page.route("**/api/bff/mailboxes/callback", async (ruta) => {
    await ruta.fulfill({
      status: 400,
      contentType: "application/problem+json",
      body: JSON.stringify({
        type: "urn:mailauto:error:state-invalido",
        title: "Vinculación inválida",
        detail: "La solicitud de vinculación expiró o ya se usó.",
      }),
    });
  });

  await page.goto("/oauth/callback?code=c&state=state-reutilizado-xxxx");

  await expect(page.getByText("La solicitud de vinculación expiró o ya se usó.")).toBeVisible();
});

test("una llegada sin código ni state no revienta", async ({ page }) => {
  await simularApi(page);
  // Alguien abre /oauth/callback a mano, sin venir del proveedor.
  await page.goto("/oauth/callback");
  await expect(page.getByText("No se pudo conectar el buzón")).toBeVisible();
});
