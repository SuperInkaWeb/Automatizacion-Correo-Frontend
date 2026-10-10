/**
 * Accesibilidad: lo verificable sin herramienta de auditoría.
 *
 * El objetivo declarado es WCAG 2.2 AA. Aquí no se audita contra el
 * estándar completo —eso exigiría `axe`, otra dependencia— sino las
 * decisiones concretas que el proyecto dice haber tomado: enlace de
 * salto, foco siempre visible, un único `h1` por página, tablas con
 * nombre accesible y `prefers-reduced-motion` respetado.
 *
 * Son las que se rompen al añadir una pantalla y nadie nota.
 */

import { expect, test } from "@playwright/test";
import { iniciarSesion, simularApi } from "./apoyo";

const PAGINAS = ["/buzones", "/escaneos", "/revision", "/registros"] as const;

test.beforeEach(async ({ context, page }) => {
  await iniciarSesion(context);
  await simularApi(page);
});

test("el enlace de salto al contenido es lo primero que recibe el foco", async ({ page }) => {
  await page.goto("/escaneos");
  await page.keyboard.press("Tab");

  const enfocado = page.locator(":focus");
  await expect(enfocado).toHaveText(/contenido/i);
  // Debe apuntar a un destino que exista en la página.
  const destino = await enfocado.getAttribute("href");
  expect(destino).toBeTruthy();
  await expect(page.locator(destino as string)).toHaveCount(1);
});

test("el foco es visible, no solo desplazado", async ({ page }) => {
  await page.goto("/escaneos");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");

  const contorno = await page.locator(":focus").evaluate((elemento) => {
    const estilo = getComputedStyle(elemento);
    return {
      ancho: estilo.outlineWidth,
      estilo: estilo.outlineStyle,
      sombra: estilo.boxShadow,
    };
  });

  // Un `outline: none` sin sustituto deja a quien navega con teclado sin
  // saber dónde está.
  const tieneIndicador =
    (contorno.estilo !== "none" && contorno.ancho !== "0px") || contorno.sombra !== "none";
  expect(tieneIndicador).toBe(true);
});

for (const ruta of PAGINAS) {
  test(`${ruta} tiene un único h1 y jerarquía de encabezados`, async ({ page }) => {
    await page.goto(ruta);

    // Varios `h1` dejan sin referencia a quien navega por encabezados.
    await expect(page.locator("h1")).toHaveCount(1);

    const niveles = await page.locator("h1, h2, h3, h4").evaluateAll((elementos) =>
      elementos.map((elemento) => Number(elemento.tagName[1])),
    );
    // Ningún salto de nivel: de un h2 no se pasa a un h4.
    for (let i = 1; i < niveles.length; i += 1) {
      const anterior = niveles[i - 1] as number;
      const actual = niveles[i] as number;
      expect(actual - anterior).toBeLessThanOrEqual(1);
    }
  });
}

test("cada tabla tiene nombre accesible y cabeceras declaradas", async ({ page }) => {
  await page.goto("/registros");

  const tablas = page.getByRole("table");
  // Se espera a la primera: contar sin esperar mide el estado de carga,
  // no la pagina.
  await expect(tablas.first()).toBeVisible();
  const total = await tablas.count();

  for (let i = 0; i < total; i += 1) {
    const tabla = tablas.nth(i);
    // Sin nombre, un lector de pantalla anuncia "tabla" y nada más.
    await expect(tabla).toHaveAccessibleName(/.+/);
    await expect(tabla.locator("th").first()).toBeVisible();
  }
});

test("los campos de los formularios tienen etiqueta asociada", async ({ page }) => {
  await page.goto("/registros");

  const campos = page.locator("input:not([type=hidden]), select, textarea");
  await expect(campos.first()).toBeVisible();
  const total = await campos.count();

  for (let i = 0; i < total; i += 1) {
    // Un `placeholder` no es una etiqueta: desaparece al escribir.
    await expect(campos.nth(i)).toHaveAccessibleName(/.+/);
  }
});

test("con movimiento reducido no hay transiciones largas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/escaneos");

  // Se convierten a segundos en la propia pagina: `transitionDuration`
  // puede venir en `ms` o en `s`, y como lista separada por comas cuando
  // hay varias propiedades en transicion. Comparar la cadena con
  // `parseFloat` mezclaria unidades y daria NaN con un valor vacio.
  const duraciones: number[] = await page.locator("body *").evaluateAll((elementos) => {
    const aSegundos = (valor: string): number[] =>
      valor
        .split(",")
        .map((parte) => parte.trim())
        .filter(Boolean)
        .map((parte) =>
          parte.endsWith("ms") ? Number.parseFloat(parte) / 1000 : Number.parseFloat(parte),
        )
        .filter((numero) => Number.isFinite(numero));

    return elementos.slice(0, 300).flatMap((elemento) => {
      const estilo = getComputedStyle(elemento);
      return [...aSegundos(estilo.transitionDuration), ...aSegundos(estilo.animationDuration)];
    });
  });

  expect(duraciones.length).toBeGreaterThan(0);
  // 50 ms es el umbral por debajo del cual el movimiento deja de
  // percibirse como animacion.
  for (const segundos of duraciones) {
    expect(segundos).toBeLessThanOrEqual(0.05);
  }
});

test("la aplicación pide no ser indexada", async ({ page }) => {
  await page.goto("/escaneos");

  // Maneja datos tributarios: no debe aparecer en buscadores.
  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveAttribute("content", /noindex/);
});

test("el idioma del documento está declarado", async ({ page }) => {
  await page.goto("/escaneos");

  // Sin `lang`, un lector de pantalla lee español con fonética inglesa.
  await expect(page.locator("html")).toHaveAttribute("lang", /^es/);
});
