/**
 * Ayuda de firma (signature help): mientras el cursor está dentro de los
 * paréntesis de una llamada a función/método, muestra un tooltip fijo
 * (no depende del hover con mouse) con los parámetros de esa llamada,
 * resaltando en cuál está el cursor. Reutiliza los mismos datos curados
 * que ya alimentan el autocompletado (globals.js, members.js) y los
 * símbolos propios del archivo (document-symbols.js) — no hay datos
 * nuevos que mantener, ni inferencia de tipos: si dos fuentes tienen un
 * método con el mismo nombre, se usa la misma prioridad que ya usa el
 * autocompletado (símbolos propios del archivo primero, luego miembros
 * comunes, luego funciones globales), para no contradecirlo.
 *
 * Diseño: findActiveCall()/resolveSignature()/computeSignatureTooltips()
 * son funciones puras (sin CodeMirror) y están testeadas directamente
 * contra texto plano y objetos "state" simulados. gdscriptSignatureHelp
 * es el único punto que toca la API real de CodeMirror: un StateField +
 * el facet showTooltip, siguiendo el patrón oficial documentado de
 * CodeMirror para "tooltips que siguen al cursor" (distinto del
 * hoverTooltip() que usa hover.js, pensado para el mouse). Es la pieza
 * de todo esto con menos garantías: un mock en Node puede demostrar que
 * la lógica de detección de la llamada es correcta, pero no puede
 * demostrar que showTooltip.computeN() se comporta en un CodeMirror real
 * dentro de Acode exactamente como en la documentación — eso solo se
 * confirma probando en el dispositivo.
 */

import { StateField } from "../runtime/codemirror-state.js";
import { showTooltip } from "../runtime/codemirror-view.js";
import { ALL_KEYWORDS, LITERAL_KEYWORDS } from "./keywords.js";
import { GLOBAL_FUNCTIONS } from "./globals.js";
import { COMMON_MEMBERS } from "./members.js";
import { scanDocumentSymbols, maskStringsAndComments } from "./document-symbols.js";

const OPENERS = "([{";
const CLOSERS = ")]}";
const NOT_A_CALL = new Set([...ALL_KEYWORDS, ...LITERAL_KEYWORDS]);

/**
 * Busca la llamada a función que envuelve `pos`, si la hay. Escanea
 * hacia atrás desde `pos` sobre el texto ENMASCARADO (sin contenido de
 * strings/comentarios, ver maskStringsAndComments en document-symbols.js),
 * llevando la cuenta de paréntesis/corchetes/llaves para no confundir un
 * paréntesis ya cerrado de una llamada anidada con el que sí sigue
 * abierto. Si lo primero que se encuentra a nivel superior es un "["/"{"
 * (el cursor está dentro de un array/dict literal), se considera que no
 * hay una llamada directa en este punto — no se intenta "atravesarlo"
 * para buscar una llamada más externa; alcance intencionalmente
 * limitado, ver README_EXT.md.
 *
 * @param {string} text texto completo del documento
 * @param {number} pos posición del cursor
 * @returns {{ name: string, argIndex: number, openParenPos: number } | null}
 */
export function findActiveCall(text, pos) {
  if (typeof text !== "string" || typeof pos !== "number") return null;
  if (pos < 0 || pos > text.length) return null;

  let masked;
  try {
    masked = maskStringsAndComments(text);
  } catch (_err) {
    return null;
  }

  let depth = 0;
  let openParenPos = -1;
  for (let i = pos - 1; i >= 0; i -= 1) {
    const ch = masked[i];
    if (CLOSERS.includes(ch)) {
      depth += 1;
      continue;
    }
    if (ch === "(") {
      if (depth === 0) {
        openParenPos = i;
        break;
      }
      depth -= 1;
      continue;
    }
    if ((ch === "[" || ch === "{") && depth === 0) {
      return null;
    }
    if (ch === "[" || ch === "{") {
      depth -= 1;
    }
  }
  if (openParenPos === -1) return null;

  const nameMatch = /([A-Za-z_]\w*)\s*$/.exec(masked.slice(0, openParenPos));
  if (!nameMatch) return null;
  const name = nameMatch[1];
  if (NOT_A_CALL.has(name)) return null;

  let argIndex = 0;
  let argDepth = 0;
  for (let i = openParenPos + 1; i < pos; i += 1) {
    const ch = masked[i];
    if (OPENERS.includes(ch)) argDepth += 1;
    else if (CLOSERS.includes(ch)) argDepth -= 1;
    else if (ch === "," && argDepth === 0) argIndex += 1;
  }

  return { name, argIndex, openParenPos };
}

function extractReturnType(detail) {
  if (!detail) return null;
  const m = /->\s*(.+)$/.exec(detail);
  return m ? m[1].trim() : null;
}

/**
 * Busca la firma de `name`: primero entre las funciones que el usuario
 * declaró en este mismo archivo, luego entre los miembros comunes
 * curados (métodos), y por último entre las funciones globales. Misma
 * prioridad y mismas fuentes que ya usa el autocompletado.
 *
 * @param {string} name
 * @param {string} text texto completo del documento (para los símbolos propios)
 * @returns {{ name: string, params: string[], returnType: string | null } | null}
 */
export function resolveSignature(name, text) {
  if (!name) return null;

  try {
    const localFn = scanDocumentSymbols(text || "").find((s) => s.kind === "function" && s.name === name);
    if (localFn) {
      return { name, params: localFn.paramNames || [], returnType: extractReturnType(localFn.detail) };
    }
  } catch (_err) {
    // ante cualquier fallo escaneando el documento, seguimos con las fuentes curadas
  }

  const member = COMMON_MEMBERS.find((m) => m.kind === "method" && m.name === name);
  if (member) return { name, params: member.params || [], returnType: null };

  const globalFn = GLOBAL_FUNCTIONS.find((f) => f.name === name);
  if (globalFn) return { name, params: globalFn.params || [], returnType: globalFn.detail || null };

  return null;
}

function buildSignatureDom(sig, argIndex) {
  const dom = document.createElement("div");
  dom.style.cssText =
    "max-width: 320px; padding: 4px 8px; font-size: 12px; line-height: 1.4; " +
    "font-family: monospace; white-space: nowrap;";

  const line = document.createElement("div");
  line.appendChild(document.createTextNode(`${sig.name}(`));
  sig.params.forEach((p, i) => {
    if (i > 0) line.appendChild(document.createTextNode(", "));
    const span = document.createElement("span");
    span.textContent = p;
    if (i === argIndex) span.style.cssText = "font-weight: 700; text-decoration: underline;";
    line.appendChild(span);
  });
  line.appendChild(document.createTextNode(")"));
  if (sig.returnType) line.appendChild(document.createTextNode(` -> ${sig.returnType}`));
  dom.appendChild(line);

  return dom;
}

/**
 * A partir de un `state` de CodeMirror (o de un objeto que se le parezca
 * lo suficiente para tests: `{ selection: { ranges }, doc: { toString } }`),
 * calcula la lista de tooltips de ayuda de firma a mostrar — normalmente
 * 0 o 1, salvo con selección múltiple. Nunca lanza: ante cualquier forma
 * inesperada de `state`, devuelve `[]` (sin tooltips) en vez de romper.
 *
 * @param {any} state
 * @returns {any[]}
 */
export function computeSignatureTooltips(state) {
  try {
    const ranges = state.selection.ranges.filter((r) => r.empty);
    const text = state.doc.toString();
    const tooltips = [];
    for (const range of ranges) {
      const call = findActiveCall(text, range.head);
      if (!call) continue;
      const sig = resolveSignature(call.name, text);
      if (!sig || sig.params.length === 0) continue; // sin parámetros, no aporta nada mostrar el tooltip
      tooltips.push({
        pos: call.openParenPos + 1,
        above: true,
        create: () => ({ dom: buildSignatureDom(sig, call.argIndex) }),
      });
    }
    return tooltips;
  } catch (_err) {
    return [];
  }
}

/**
 * Extensión de CodeMirror: StateField que mantiene la lista de tooltips
 * de ayuda de firma actualizada en cada cambio de documento o de
 * selección, y la expone vía el facet showTooltip (mismo mecanismo que
 * usa internamente hoverTooltip(), aquí armado a mano porque esto debe
 * reaccionar al cursor, no al mouse).
 */
export const gdscriptSignatureHelp = StateField.define({
  create: computeSignatureTooltips,
  update(tooltips, tr) {
    if (!tr.docChanged && !tr.selection) return tooltips;
    return computeSignatureTooltips(tr.state);
  },
  provide: (f) => showTooltip.computeN([f], (state) => state.field(f)),
});
