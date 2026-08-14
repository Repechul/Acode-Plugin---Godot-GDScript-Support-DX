/**
 * Indentación automática al pulsar Enter (y al reindentar sobre la marcha
 * al escribir "else"/"elif", vía indentOnInput en tokenizer.js). Reglas,
 * igual que en Python/GDScript:
 *   - Una línea cuyo código (sin comentario) termina en ':' abre un
 *     bloque: la siguiente línea sube un nivel.
 *   - Tras "pass" / "break" / "continue" / "return" (con o sin
 *     expresión), se asume que el bloque terminó: la siguiente línea baja
 *     un nivel (nunca por debajo de 0). Es una heurística — no siempre es
 *     el final real del bloque — pero acierta en el caso común, igual que
 *     hacen los modos de Python de otros editores.
 *   - Al escribir "else"/"elif" al principio de una línea, se realinea
 *     con la línea que abre el bloque que se está cerrando (usando una
 *     pila de los prefijos de indentación de bloques todavía abiertos).
 *
 * Diseño (v3): TODA la información se mantiene incrementalmente en el
 * propio `state` del StreamParser (trackLine(), llamada desde token() en
 * tokenizer.js al llegar al final de cada línea real de código) — igual
 * que en v2, no se accede a context.pos / context.state.doc en absoluto
 * (ver el porqué en el CHANGELOG, entrada 0.1.3: la v1 sí los usaba y no
 * funcionó en un Acode real).
 *
 * La diferencia con v2: v2 asumía que "una unidad de indentación" es
 * literalmente el carácter "\t" (INDENT_UNIT_TEXT), y contaba repeticiones
 * de ese carácter al principio de cada línea. Eso funcionaba para el
 * primer nivel (que no necesita LEER nada: basta con devolver
 * context.unit en columnas), pero se rompía a partir del segundo nivel en
 * cuanto Acode representa un nivel de indentación con algo que no sea un
 * tab literal (p.ej. espacios — que es justo la convención de Godot:
 * "4 espacios como alternativa a tabulación"). Al leer esa línea de
 * vuelta, countLeadingUnits() no encontraba tabs, devolvía null, y
 * CodeMirror caía a su comportamiento por defecto (copiar la línea
 * anterior tal cual, sin profundizar) — la indentación se quedaba
 * "atascada" en el primer nivel.
 *
 * v3 ya no asume NADA sobre qué carácter representa un nivel: guarda el
 * texto de indentación CRUDO de cada línea (trackLine) y solo lo
 * convierte a columnas dentro de gdscriptIndent(), en el momento en que
 * context.unit (el ancho real de un nivel, tal como lo tiene configurado
 * CodeMirror) está disponible — algo que trackLine(), al ejecutarse
 * dentro de token(), no puede consultar. Así, sea cual sea el carácter
 * que Acode use realmente para indentar (tab, espacios, o incluso una
 * mezcla), la profundidad se mide de forma consistente.
 *
 * analyzeLine()/trackLine()/computeIndentFromState() son funciones puras
 * (sin CodeMirror) y están testeadas directamente. gdscriptIndent() es el
 * único punto que toca context.unit y lo hace de forma defensiva.
 */

const DEDENT_AFTER_RE = /^(pass|break|continue|return(?:\s+.*)?)$/;
const ELSE_ELIF_RE = /^(else|elif)\b/;
const LEADING_WS_RE = /^[ \t]*/;
const DEFAULT_TAB_SIZE = 4;

/** Quita un comentario de línea "# ..." sin romper strings que contengan '#'. */
function stripLineComment(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "#") return text.slice(0, i);
  }
  return text;
}

/** Prefijo de espacios/tabs al principio de una línea (texto crudo, sin interpretar). */
function leadingWhitespaceOf(text) {
  return LEADING_WS_RE.exec(text)[0];
}

/**
 * Ancho en columnas de un prefijo de indentación (solo espacios/tabs),
 * tratando cada tab como un salto hasta el siguiente múltiplo de tabSize
 * (igual que hace cualquier editor de verdad), no como "tabSize columnas
 * siempre". Es el mismo algoritmo que indentOf() en folding.js, pero
 * parametrizado en tabSize en vez de una constante fija — aquí SÍ importa
 * que coincida con el ancho de nivel real (context.unit), porque el
 * resultado se usa en aritmética ("un nivel más"), no solo para comparar
 * profundidades relativas como hace folding.js.
 */
function columnWidth(indentText, tabSize) {
  let col = 0;
  for (const ch of indentText) {
    if (ch === " ") col += 1;
    else if (ch === "\t") col += tabSize - (col % tabSize);
    else break;
  }
  return col;
}

/**
 * Lógica pura: analiza una línea de código completa (texto crudo tal cual
 * está en el documento).
 *
 * @param {string} lineText
 * @returns {{ indentText: string, opensBlock: boolean, isDedentStatement: boolean }}
 */
export function analyzeLine(lineText) {
  const indentText = leadingWhitespaceOf(lineText);
  const code = stripLineComment(lineText).trim();
  return {
    indentText,
    opensBlock: code.length > 0 && code.endsWith(":"),
    isDedentStatement: DEDENT_AFTER_RE.test(code),
  };
}

/**
 * Actualiza en sitio el estado incremental del parser con la información
 * de una línea de código YA COMPLETA (se llama al llegar al final de cada
 * línea no vacía; ver tokenizer.js). No se llama para líneas en blanco
 * (blankLine() en tokenizer.js no la invoca), así que estas se saltan de
 * forma natural.
 *
 * blockStack guarda TEXTO crudo de indentación (no columnas todavía) de
 * cada cabecera de bloque ':' aún abierta, para el realineado de
 * "else"/"elif". La comparación de profundidad entre líneas (para decidir
 * cuándo hemos salido de un bloque) se hace por longitud de texto, que
 * basta para saber "más/menos profundo" sin necesitar tabSize todavía.
 *
 * @param {any} state state del StreamParser (se muta)
 * @param {string} lineText
 */
export function trackLine(state, lineText) {
  const { indentText, opensBlock, isDedentStatement } = analyzeLine(lineText);

  if (!Array.isArray(state.blockStack)) state.blockStack = [];
  while (state.blockStack.length > 0 && state.blockStack[state.blockStack.length - 1].length >= indentText.length) {
    state.blockStack.pop();
  }
  if (opensBlock) state.blockStack.push(indentText);

  state.prevLineIndentText = indentText;
  state.prevLineOpensBlock = opensBlock;
  state.prevLineIsDedentStatement = isDedentStatement;
}

/**
 * Lógica pura: columnas de indentación para una nueva línea, a partir del
 * estado incremental ya actualizado por trackLine() y el ancho real de un
 * nivel de indentación (tabSize — normalmente context.unit).
 *
 * @param {any} state
 * @param {string} textAfter Lo que ya hay escrito en la nueva línea (para
 *   detectar "else"/"elif" al reindentar sobre la marcha).
 * @param {number} tabSize
 * @returns {number | null}
 */
export function computeIndentFromState(state, textAfter, tabSize) {
  if (!state || typeof state.prevLineIndentText !== "string") return null;
  const size = tabSize > 0 ? tabSize : DEFAULT_TAB_SIZE;

  const typedElseElif = ELSE_ELIF_RE.test(String(textAfter || "").trim());
  if (typedElseElif) {
    const stack = state.blockStack;
    const targetText = Array.isArray(stack) && stack.length > 0 ? stack[stack.length - 1] : "";
    return columnWidth(targetText, size);
  }

  const prevWidth = columnWidth(state.prevLineIndentText, size);
  if (state.prevLineOpensBlock) return prevWidth + size;
  if (state.prevLineIsDedentStatement) return Math.max(0, prevWidth - size);
  return prevWidth;
}

/**
 * Punto de contacto real con CodeMirror (se asigna como `indent` en el
 * StreamParser de tokenizer.js). Deliberadamente defensivo: si
 * context.unit no está disponible, devuelve null (comportamiento por
 * defecto de CodeMirror) en vez de lanzar.
 *
 * @param {any} state
 * @param {string} textAfter
 * @param {any} context IndentContext de @codemirror/language
 * @returns {number | null}
 */
export function gdscriptIndent(state, textAfter, context) {
  try {
    if (state && state.tokenize) return null; // dentro de una cadena multilínea: no tocar
    if (!context || typeof context.unit !== "number") return null;

    return computeIndentFromState(state, textAfter, context.unit);
  } catch (_err) {
    return null; // best-effort: nunca romper el tecleo por esto
  }
}
