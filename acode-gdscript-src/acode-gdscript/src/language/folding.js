import { foldService } from "../runtime/codemirror-language.js";

/** Ancho de tabulación asumido solo para *comparar* niveles de indentación. */
const TAB_WIDTH = 8;

// Igual que en el editor de Godot: sin espacio entre "#" y "region"/"endregion".
// El nombre de la región es opcional; si hay algo después, debe ir separado
// por un espacio (así "#regionX" no cuenta como región).
const REGION_START_RE = /^#region(?:\s|$)/;
const REGION_END_RE = /^#endregion(?:\s|$)/;

export function indentOf(lineText) {
  let count = 0;
  for (const ch of lineText) {
    if (ch === " ") count += 1;
    else if (ch === "\t") count += TAB_WIDTH - (count % TAB_WIDTH);
    else break;
  }
  return count;
}

/**
 * Lógica pura (sin dependencias de CodeMirror): dado un array de textos de
 * línea y el índice de una línea que termina en ':', calcula el índice
 * (0-based) de la última línea que pertenece a su bloque indentado.
 * Devuelve null si el bloque está vacío (nada que plegar).
 *
 * @param {string[]} lines
 * @param {number} startIndex
 * @returns {number | null}
 */
export function computeFoldEndIndex(lines, startIndex) {
  const startText = lines[startIndex];
  if (!startText || startText.trim().endsWith(":") === false) return null;

  const baseIndent = indentOf(startText);
  let lastNonBlank = startIndex;

  for (let i = startIndex + 1; i < lines.length; i++) {
    const text = lines[i];
    if (text.trim().length === 0) continue; // las líneas vacías no cortan el bloque
    if (indentOf(text) <= baseIndent) break;
    lastNonBlank = i;
  }

  return lastNonBlank === startIndex ? null : lastNonBlank;
}

/**
 * Lógica pura (sin dependencias de CodeMirror): dado un array de textos de
 * línea y el índice de una línea "#region ...", calcula el índice (0-based)
 * del "#endregion" que le corresponde, soportando regiones anidadas (cada
 * "#region" interno suma profundidad, cada "#endregion" la resta; el fold
 * termina cuando la profundidad vuelve a 0). Devuelve null si la línea no es
 * un "#region" o si no hay un "#endregion" que la cierre.
 *
 * @param {string[]} lines
 * @param {number} startIndex
 * @returns {number | null}
 */
export function computeRegionFoldEndIndex(lines, startIndex) {
  const startText = lines[startIndex];
  if (!startText || !REGION_START_RE.test(startText.trim())) return null;

  let depth = 1;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (REGION_START_RE.test(trimmed)) {
      depth += 1;
    } else if (REGION_END_RE.test(trimmed)) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return null; // "#region" sin "#endregion" correspondiente: no se pliega
}

/** Fold por indentación (bloques que terminan en ':') sobre el Text de CM6. */
function tryIndentFold(doc, startLine) {
  const trimmed = startLine.text.trim();
  if (trimmed.length === 0 || !trimmed.endsWith(":")) return null;

  const baseIndent = indentOf(startLine.text);
  let lastLine = startLine;
  let cursor = startLine;

  while (cursor.number < doc.lines) {
    const next = doc.line(cursor.number + 1);
    if (next.text.trim().length === 0) {
      cursor = next;
      continue;
    }
    if (indentOf(next.text) <= baseIndent) break;
    lastLine = next;
    cursor = next;
  }

  if (lastLine.number === startLine.number) return null;
  return { from: startLine.to, to: lastLine.to };
}

/** Fold de "#region" / "#endregion" (con anidamiento) sobre el Text de CM6. */
function tryRegionFold(doc, startLine) {
  if (!REGION_START_RE.test(startLine.text.trim())) return null;

  let depth = 1;
  let cursor = startLine;

  while (cursor.number < doc.lines) {
    const next = doc.line(cursor.number + 1);
    const nextTrimmed = next.text.trim();
    if (REGION_START_RE.test(nextTrimmed)) {
      depth += 1;
    } else if (REGION_END_RE.test(nextTrimmed)) {
      depth -= 1;
      if (depth === 0) return { from: startLine.to, to: next.to };
    }
    cursor = next;
  }
  return null; // "#region" sin "#endregion" correspondiente: no se pliega
}

/** Extensión foldService: primero prueba regiones, luego indentación. */
export const gdscriptFolding = foldService.of((state, lineStart /*, lineEnd */) => {
  const doc = state.doc;
  const startLine = doc.lineAt(lineStart);
  return tryRegionFold(doc, startLine) || tryIndentFold(doc, startLine);
});
