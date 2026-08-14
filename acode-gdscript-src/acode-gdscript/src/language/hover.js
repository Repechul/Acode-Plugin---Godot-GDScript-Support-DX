/**
 * Tooltip al mantener el cursor/dedo sobre un símbolo conocido: puede ser
 * curado a mano (clase del motor, función/constante global, miembro
 * común, tipo básico — de classes.js/globals.js/members.js/keywords.js)
 * o un símbolo que el propio usuario declaró en este archivo (func/var/
 * const/signal/class_name — ver document-symbols.js). En ambos casos
 * reutiliza el mismo texto `info`/`detail` que ya se usa en el
 * autocompletado, no genera contenido nuevo. Si un nombre coincide en
 * ambos sitios, gana el símbolo propio del archivo: es lo más relevante
 * para lo que se está mirando en ese momento.
 *
 * Diseño: wordAt()/hoverInfoFor() son funciones puras (sin CodeMirror) y
 * están testeadas directamente. gdscriptHoverTooltip() es el único punto
 * que toca la API real de CodeMirror (view.state.doc, la forma exacta
 * del objeto Tooltip) y lo hace de forma defensiva — si algo no es como
 * se espera, no muestra tooltip en vez de romper el hover.
 */

import { ANNOTATIONS, BUILTIN_TYPES } from "./keywords.js";
import { GLOBAL_FUNCTIONS, GLOBAL_CONSTANTS } from "./globals.js";
import { ENGINE_CLASSES } from "./classes.js";
import { COMMON_MEMBERS } from "./members.js";
import { scanDocumentSymbols } from "./document-symbols.js";

const WORD_CHAR_RE = /[A-Za-z0-9_]/;

/**
 * Encuentra el identificador que contiene la columna `col` (0-based)
 * dentro de `lineText`, o que empieza justo ahí. null si esa posición no
 * cae sobre un identificador.
 *
 * @param {string} lineText
 * @param {number} col
 * @returns {{ start: number, end: number, text: string } | null}
 */
export function wordAt(lineText, col) {
  if (typeof lineText !== "string" || typeof col !== "number") return null;
  if (col < 0 || col > lineText.length) return null;

  const isWordChar = (ch) => !!ch && WORD_CHAR_RE.test(ch);

  let start = col;
  let end = col;
  // Si el cursor está justo tras una palabra (p.ej. al final de línea, o
  // entre la palabra y el siguiente carácter no-palabra), usar esa.
  if (!isWordChar(lineText[col]) && isWordChar(lineText[col - 1])) {
    start = col - 1;
    end = col - 1;
  }
  if (!isWordChar(lineText[start]) && !isWordChar(lineText[end])) return null;

  while (start > 0 && isWordChar(lineText[start - 1])) start -= 1;
  while (end < lineText.length && isWordChar(lineText[end])) end += 1;
  if (start === end) return null;

  return { start, end, text: lineText.slice(start, end) };
}

function buildHoverIndex() {
  const index = new Map();
  for (const c of ENGINE_CLASSES) index.set(c.name, { title: c.name, detail: "class", info: c.info });
  for (const f of GLOBAL_FUNCTIONS) index.set(f.name, { title: f.name, detail: f.detail, info: f.info });
  for (const c of GLOBAL_CONSTANTS) index.set(c.name, { title: c.name, detail: c.detail, info: c.info });
  for (const m of COMMON_MEMBERS) {
    if (!index.has(m.name)) index.set(m.name, { title: m.name, detail: m.kind, info: m.info });
  }
  for (const t of BUILTIN_TYPES) {
    if (!index.has(t)) index.set(t, { title: t, detail: "type", info: null });
  }
  // ANNOTATIONS: la clave se guarda SIN el "@" inicial, porque wordAt()
  // no trata "@" como carácter de palabra — al pasar el cursor sobre
  // "export_range" en "@export_range", la palabra detectada es
  // "export_range" (sin el símbolo). El título sí conserva el "@" para
  // que el tooltip siga mostrando el nombre real de la anotación.
  for (const a of ANNOTATIONS) {
    const key = a.name.replace(/^@/, "");
    if (!index.has(key)) index.set(key, { title: a.name, detail: "annotation", info: a.info });
  }
  return index;
}

/** name -> { title, detail, info } */
export const HOVER_INDEX = buildHoverIndex();

/**
 * @param {string} word
 * @returns {{ title: string, detail: string, info: string | null } | null}
 */
export function hoverInfoFor(word) {
  if (!word) return null;
  return HOVER_INDEX.get(word) || null;
}

/**
 * Índice name -> {title, detail, info} de los símbolos que el usuario
 * declara en ESTE archivo (ver document-symbols.js). A diferencia de
 * HOVER_INDEX (estático, calculado una sola vez), este se reconstruye en
 * cada hover porque depende del contenido actual del documento.
 *
 * Punto de contacto real con CM6 (view.state.doc.toString()): envuelto
 * en try/catch a propósito, igual que el resto de gdscriptHoverTooltip —
 * ante cualquier fallo, se prefiere no mostrar símbolos locales antes que
 * romper el hover.
 *
 * @param {any} view
 * @returns {Map<string, {title: string, detail: string|null, info: string}> | null}
 */
function buildLocalHoverIndex(view) {
  try {
    const text = view.state.doc.toString();
    const symbols = scanDocumentSymbols(text);
    const index = new Map();
    for (const s of symbols) {
      if (!index.has(s.name)) index.set(s.name, { title: s.name, detail: s.detail, info: s.info });
    }
    return index;
  } catch (_err) {
    return null;
  }
}

function buildTooltipDom(entry) {
  const dom = document.createElement("div");
  dom.style.cssText =
    "max-width: 320px; padding: 6px 8px; font-size: 12px; line-height: 1.4; " +
    "font-family: sans-serif; white-space: normal;";

  const title = document.createElement("div");
  title.style.cssText = "font-weight: 600; font-family: monospace; font-size: 13px;";
  title.textContent = entry.detail ? `${entry.title}  ·  ${entry.detail}` : entry.title;
  dom.appendChild(title);

  if (entry.info) {
    const body = document.createElement("div");
    body.style.cssText = "margin-top: 2px; opacity: 0.85;";
    body.textContent = entry.info;
    dom.appendChild(body);
  }

  return dom;
}

/**
 * Punto de contacto real con CodeMirror: firma de `source` para
 * hoverTooltip() de @codemirror/view. Deliberadamente defensivo: ante
 * cualquier suposición que falle sobre la forma de `view`, devuelve null
 * (sin tooltip) en vez de lanzar.
 *
 * @param {any} view EditorView
 * @param {number} pos
 * @param {-1 | 1} _side
 * @returns {any | null}
 */
export function gdscriptHoverTooltip(view, pos, _side) {
  try {
    const doc = view && view.state && view.state.doc;
    if (!doc || typeof doc.lineAt !== "function") return null;

    const line = doc.lineAt(pos);
    const col = pos - line.from;
    const word = wordAt(line.text, col);
    if (!word) return null;

    const localIndex = buildLocalHoverIndex(view);
    const entry = (localIndex && localIndex.get(word.text)) || hoverInfoFor(word.text);
    if (!entry) return null;

    return {
      pos: line.from + word.start,
      end: line.from + word.end,
      above: true,
      create() {
        return { dom: buildTooltipDom(entry) };
      },
    };
  } catch (_err) {
    return null; // best-effort: nunca romper el hover por esto
  }
}
