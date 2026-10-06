# Automatización de Correos — Frontend

Interfaz de operación de la [plataforma de automatización de correos](https://github.com/SuperInkaWeb/Automatizacion-Correo-Backend):
vincular buzones, lanzar escaneos, seguir su progreso en vivo, revisar
registros y descargar reportes.

**Next.js 16** (App Router) · **React 19** · **TypeScript strict** · **Tailwind CSS 4** ·
**TanStack Query** · cliente de API generado desde el contrato del backend.

---

## Estado

Implementadas las **fases 0 y 6**, y los tests E2E de la **fase 7**, del
[plan de arquitectura](https://github.com/SuperInkaWeb/Automatizacion-Correo-Backend/blob/main/ARQUITECTURA.md#17-plan-de-implementación-por-fases).

| Pieza | Estado |
|-------|--------|
| Configuración de entorno validada, separando servidor y cliente | ✅ |
| Cliente HTTP contra el BFF, con traducción de errores RFC 9457 | ✅ |
| Cliente de API generado desde el contrato del backend (42 ficheros) | ✅ |
| Cabeceras de seguridad, tokens de diseño, accesibilidad base | ✅ |
| CI: linting, tipado, tests, build, auditoría y sincronía de contrato | ✅ |
| Rutas del BFF (login OIDC, sesión, proxy) | ✅ |
| Features: buzones, escaneos, registros, revisión, reportes | ✅ |
| E2E en navegador real con Playwright | ✅ |

**Verificación actual:** 21 tests de unidad y 43 E2E en verde, `eslint` y `tsc --noEmit`
limpios (cliente generado incluido), build de producción correcto, cero vulnerabilidades
en dependencias de producción.

Los E2E encontraron dos defectos que ningún test de componente podía ver:

- **Todas las peticiones de datos recibían un 403.** El cliente generado reproduce las
  rutas del contrato, con su prefijo `/api/v1`, y el mutator les añadía `/api/bff`
  delante: la petición llegaba como `/api/bff/api/v1/records`, cuyo primer segmento es
  `api`, y la allowlist del proxy la rechazaba. No una ruta rota: todas. El test que
  existía usaba rutas ya cortas, así que pasaba.
- **El contador de la cola de revisión nunca aparecía.** `Navegacion` lo recibía por una
  prop que ningún llamante pasaba, porque el layout que la monta es un Server Component y
  no puede ejecutar la consulta. Ahora lo pide ella misma.

---

## Puesta en marcha

```bash
cp .env.example .env.local
```

Genera el secreto de sesión y pégalo en `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

```bash
npm install && npm run dev
```

La aplicación queda en http://localhost:3000. Necesita el backend en `API_URL`
(por defecto `http://localhost:8000`).

---

## Verificación

Lo mismo que ejecuta el CI:

```bash
npm run verify
```

Equivale a `lint` + `typecheck` + `test`. Para el build de producción:

```bash
npm run build
```

Los E2E van aparte porque arrancan un navegador y un servidor:

```bash
npx playwright install chromium
```

```bash
npm run e2e
```

No necesitan backend ni proveedor de identidad: las respuestas de datos se interceptan en
`/api/bff/**` —que es una petición del navegador a este mismo servidor— y la sesión se
construye sellando una cookie `iron-session` con el mismo secreto que usa la aplicación.
Montar un Auth0 real para probar la interfaz haría la suite lenta, frágil y dependiente de
credenciales que no deben estar en el repositorio.

Corren contra el build de producción y no contra el servidor de desarrollo: en modo
desarrollo Next recompila bajo demanda y los tests se vuelven inestables por esperas que
no tienen nada que ver con la aplicación.

---

## Cliente de API

Backend y frontend viven en repositorios separados, así que el cliente TypeScript no
puede regenerarse en el mismo commit que cambia la API. El contrato compartido es el
`openapi.json` del backend, del que este repositorio guarda una copia versionada en
`contrato/openapi.json`.

```bash
npm run api:generate
```

Lee el contrato versionado y regenera `src/generated/`. **El CI falla si el resultado
difiere de lo commiteado**, de modo que nadie puede editar el cliente a mano.

Se lee de disco y no de una URL para que el CI no dependa de la disponibilidad de otro
repositorio en el camino crítico de cada pull request.

**Refresco del contrato.** Lo hace
[`sincronizar-contrato.yml`](.github/workflows/sincronizar-contrato.yml): trae el
`openapi.json` del backend, regenera el cliente, comprueba que la interfaz sigue
compilando contra él y **abre un pull request** si algo cambió. Un campo que desaparece
se ve así en la revisión y no al desplegar.

> No necesita ningún secreto: el repositorio del backend es público y el contrato se
> descarga de forma anónima. Corre manualmente y cada lunes.
>
> La verificación del tipado se ejecuta **dentro de ese workflow**, antes de abrir el
> pull request, porque GitHub no dispara los checks de `pull_request` en los que abre el
> `GITHUB_TOKEN`: sin eso, el pull request llegaría a la revisión sin ningún check.

Para trabajar contra un backend local con cambios sin publicar:

```bash
OPENAPI_URL=http://localhost:8000/openapi.json npm run api:generate
```

`src/generated/` está excluido del linting y de los tests: su corrección la garantiza el
contrato, no una prueba escrita a mano.

---

## Estructura

```
src/
├── app/           Rutas (App Router) — solo composición
│   ├── api/auth/  login OIDC, callback y logout
│   ├── api/bff/   proxy al backend con el token del lado servidor
│   └── (panel)/   páginas protegidas por la sesión
├── features/      Feature-sliced: cada carpeta es autocontenida
│   ├── escaneos/   lanzar, seguir en vivo (SSE), historial
│   ├── revision/   cola de revisión y corrección
│   ├── registros/  listado con filtros y cursor
│   ├── reportes/   exportación asíncrona
│   └── buzones/    vincular y desvincular cuentas
├── shared/
│   ├── config/    configuración de entorno validada
│   ├── lib/       cliente del BFF, utilidades
│   └── ui/        design system
└── generated/     ⚠ GENERADO desde OpenAPI — no editar a mano

e2e/               Tests de navegador (Playwright)
```

Cada feature agrupa su UI, su lógica y sus llamadas. Es lo que evita el hook de 350
líneas que concentraba estado, polling, OAuth y notificaciones en el sistema de
referencia: cada feature expone dos o tres hooks pequeños y testeables.

---

## Seguridad

**El access token nunca llega al navegador.** El login OIDC se completa en route handlers
del servidor; el navegador solo recibe una cookie de sesión `httpOnly`, `Secure`,
`SameSite=Lax`. Las llamadas pasan por el BFF, que adjunta el token del lado servidor y
lo refresca de forma transparente antes de que venza.

**El proxy del BFF tiene allowlist de prefijos.** Sin ella sería un proxy abierto:
cualquiera con sesión podría alcanzar rutas internas del backend pasando por aquí. Se
permite exactamente lo que la interfaz usa.

Esto elimina una clase entera de ataques: con el token en memoria accesible desde
JavaScript —como ocurre con las librerías OIDC de cliente habituales—, cualquier XSS lo
roba y obtiene acceso directo a la API. Aquí lo máximo que consigue es hacer peticiones
desde la sesión ya abierta: un daño acotado, auditable y revocable cerrando la sesión.

El linter lo respalda: `localStorage` y `sessionStorage` están prohibidos por regla, con
un mensaje que explica por qué.

**Otros controles.** Cabeceras de endurecimiento (`X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS) declaradas en
`next.config.ts` para que apliquen también a los recursos estáticos. `poweredByHeader`
desactivado. La configuración de entorno se valida con Zod al arrancar, con esquemas
separados para servidor y cliente de modo que un secreto no pueda acabar en el bundle
por un import descuidado. Metadatos con `robots: noindex`: la aplicación maneja datos
fiscales y no debe aparecer en buscadores.

**Nota sobre `npm audit`.** Las dependencias de producción están limpias. Quedan avisos
de severidad alta en la cadena de `eslint-config-next` (`fast-glob` → `micromatch` →
`braces`) **sin versión parcheada disponible**: el rango afectado es `*`. Las `overrides`
del `package.json` ya fuerzan lo último publicado. El CI audita producción desde
severidad moderada y desarrollo solo ante críticas, para no tener el pipeline en rojo
permanente por algo que nadie puede arreglar todavía.

---

## Accesibilidad

Objetivo WCAG 2.2 AA. Ya en los cimientos: enlace de salto al contenido, `:focus-visible`
siempre visible, `prefers-reduced-motion` respetado, y tokens de color definidos en
`oklch` con variante para modo oscuro, declarados una sola vez para que la paleta se
pueda cambiar sin recorrer la interfaz entera.

---

## Despliegue

```bash
docker build -t automatizacion-correos-frontend .
```

Imagen en tres etapas con la salida `standalone` de Next: la imagen final lleva solo los
módulos que el build determina que se usan, corre como usuario sin privilegios e incluye
sonda de salud.
