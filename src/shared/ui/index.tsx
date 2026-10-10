/**
 * Design system mínimo.
 *
 * Propósito
 *   Que toda la interfaz tenga el mismo aspecto y el mismo
 *   comportamiento accesible sin repetir clases en cada pantalla.
 *
 * Decisión de diseño
 *   Un fichero con componentes pequeños, no una carpeta por
 *   componente. A este tamaño, repartir diez funciones de quince
 *   líneas en diez ficheros añade navegación sin añadir claridad. Se
 *   partirá cuando alguno crezca o cuando haya que testearlos por
 *   separado.
 *
 *   Los colores salen siempre de los tokens de `globals.css`, nunca
 *   literales: es lo que permite cambiar la paleta sin recorrer la
 *   interfaz entera, y lo que hace que el modo oscuro funcione solo.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

// ── Botón ────────────────────────────────────────────────────────────

type VarianteDeBoton = "primario" | "secundario" | "peligro";

const ESTILO_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 " +
  "text-sm font-medium transition-colors disabled:cursor-not-allowed " +
  "disabled:opacity-50";

const ESTILO_POR_VARIANTE: Record<VarianteDeBoton, string> = {
  primario:
    "bg-[var(--color-acento)] text-white hover:opacity-90",
  secundario:
    "border border-[var(--color-borde)] bg-[var(--color-superficie)] " +
    "hover:bg-[var(--color-fondo)]",
  peligro:
    "border border-[var(--color-error)] text-[var(--color-error)] " +
    "hover:bg-[var(--color-error)] hover:text-white",
};

interface PropiedadesDeBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteDeBoton;
  cargando?: boolean;
}

export function Boton({
  variante = "primario",
  cargando = false,
  disabled,
  children,
  className = "",
  ...resto
}: PropiedadesDeBoton) {
  return (
    <button
      {...resto}
      disabled={disabled === true || cargando}
      // `aria-busy` es lo que anuncia el estado de carga a un lector
      // de pantalla; el spinner visual por sí solo no lo hace.
      aria-busy={cargando}
      className={`${ESTILO_BASE} ${ESTILO_POR_VARIANTE[variante]} ${className}`}
    >
      {cargando && <Girador />}
      {children}
    </button>
  );
}

// ── Indicadores ──────────────────────────────────────────────────────

export function Girador({ etiqueta }: { etiqueta?: string | undefined }) {
  return (
    <span
      // `role="status"` con texto solo para lectores: sin él, quien
      // navega con lector no se entera de que algo está cargando.
      role="status"
      aria-live="polite"
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    >
      <span className="sr-only">{etiqueta ?? "Cargando"}</span>
    </span>
  );
}

type TonoDeEtiqueta = "neutro" | "exito" | "aviso" | "error" | "info";

const COLOR_POR_TONO: Record<TonoDeEtiqueta, string> = {
  neutro: "bg-[var(--color-fondo)] text-[var(--color-texto-tenue)]",
  exito: "bg-[var(--color-exito)]/15 text-[var(--color-exito)]",
  aviso: "bg-[var(--color-aviso)]/15 text-[var(--color-aviso)]",
  error: "bg-[var(--color-error)]/15 text-[var(--color-error)]",
  info: "bg-[var(--color-acento)]/15 text-[var(--color-acento)]",
};

export function Etiqueta({
  tono = "neutro",
  children,
}: {
  tono?: TonoDeEtiqueta;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_POR_TONO[tono]}`}
    >
      {children}
    </span>
  );
}

// ── Contenedores ─────────────────────────────────────────────────────

export function Tarjeta({
  titulo,
  descripcion,
  acciones,
  children,
}: {
  // `| undefined` explicito: con `exactOptionalPropertyTypes`, pasar
  // `descripcion={condicion ? texto : undefined}` es un error si el
  // tipo solo admite la ausencia de la prop.
  titulo?: string | undefined;
  descripcion?: string | undefined;
  acciones?: ReactNode | undefined;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-borde)] bg-[var(--color-superficie)]">
      {(titulo ?? acciones) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-borde)] px-5 py-4">
          <div>
            {titulo && <h2 className="font-semibold">{titulo}</h2>}
            {descripcion && (
              <p className="mt-1 text-sm text-[var(--color-texto-tenue)]">
                {descripcion}
              </p>
            )}
          </div>
          {acciones}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

// ── Estados ──────────────────────────────────────────────────────────

/**
 * Estado vacío.
 *
 * Diseñado explícitamente y no como una tabla sin filas: una pantalla
 * en blanco no distingue "no hay nada todavía" de "algo falló", y el
 * usuario se queda sin saber qué hacer.
 */
export function SinDatos({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string | undefined;
  accion?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="font-medium">{titulo}</p>
      {descripcion && (
        <p className="max-w-md text-sm text-[var(--color-texto-tenue)]">
          {descripcion}
        </p>
      )}
      {accion}
    </div>
  );
}

export function Fallo({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar?: (() => void) | undefined;
}) {
  return (
    <div
      // `role="alert"` interrumpe al lector de pantalla: un error es
      // justo lo que el usuario necesita oír sin esperar.
      role="alert"
      className="flex flex-col items-start gap-3 rounded-md border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 p-4"
    >
      <p className="text-sm">{mensaje}</p>
      {onReintentar && (
        <Boton variante="secundario" onClick={onReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}

export function Cargando({ filas = 3 }: { filas?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3"
      data-testid="cargando"
    >
      <span className="sr-only">Cargando contenido</span>
      {Array.from({ length: filas }, (_, indice) => (
        <div
          key={indice}
          className="h-10 animate-pulse rounded-md bg-[var(--color-borde)]/60"
        />
      ))}
    </div>
  );
}

// ── Tabla ────────────────────────────────────────────────────────────

export function Tabla({
  cabeceras,
  children,
  descripcion,
}: {
  // ReactNode y no solo string: alguna cabecera es un control, como la
  // casilla de "seleccionar todo" del listado de registros.
  cabeceras: readonly ReactNode[];
  children: ReactNode;
  descripcion: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {/* La leyenda describe la tabla a quien usa lector de pantalla
            y queda oculta visualmente. */}
        <caption className="sr-only">{descripcion}</caption>
        <thead>
          <tr className="border-b border-[var(--color-borde)] text-left">
            {cabeceras.map((cabecera, indice) => (
              <th
                key={indice}
                scope="col"
                className="px-3 py-2 font-medium text-[var(--color-texto-tenue)]"
              >
                {cabecera}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Celda({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

// ── Barra de progreso ────────────────────────────────────────────────

export function Progreso({
  porcentaje,
  etiqueta,
}: {
  porcentaje: number;
  etiqueta: string;
}) {
  const valor = Math.min(100, Math.max(0, porcentaje));
  return (
    <div
      // Los atributos ARIA de progressbar son lo que permite a un
      // lector anunciar el avance; una barra pintada no dice nada.
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={etiqueta}
      className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-borde)]"
    >
      <div
        className="h-full rounded-full bg-[var(--color-acento)] transition-[width] duration-500"
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}
