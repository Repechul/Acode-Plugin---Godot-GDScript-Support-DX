/**
 * Escaneo del propio archivo en busca de símbolos que el usuario declara:
 * func / var / const / signal / class_name. NO es inferencia de tipos ni
 * un parser real — es una lectura línea a línea con regex anclados al
 * principio de cada línea (tras trim), pensada para ampliar el
 * autocompletado y el hover más allá de lo curado a mano en
 * classes.js/globals.js/members.js (que no saben nada del código que el
 * usuario escribe en su propio script).
 *
 * Diseño: igual que en indent.js/hover.js, toda la lógica de este módulo
 * es pura (sin CodeMirror) y se testea directamente contra texto plano.
 * Quien lo usa (completions.js, hover.js) es responsable de obtener el
 * texto del documento (`state.doc.toString()`) y de envolver la llamada
 * en try/catch — ver el comentario en esos archivos.
 *
 * Sobre falsos positivos: los regex están anclados al principio de línea,
 * así que un comentario ("# var x") nunca puede confundirse con una
 * declaración real (un comentario no puede EMPEZAR la línea después de
 * hacer trim y a la vez que la línea también empiece por "var"/"func"/...).
 * El caso que sí importa es un string triple multilínea que contenga texto
 * como "func fake():" en su interior (p. ej. diálogo o una plantilla
 * embebida) — para eso, maskStringsAndComments() reemplaza el contenido
 * de comentarios y strings (simples y triples) por espacios ANTES de
 * partir en líneas, preservando los saltos de línea para no desalinear
 * nada. No es el tokenizer completo de tokenizer.js (no clasifica tokens,
 * solo enmascara) — es intencionalmente una implementación separada y más
 * simple, ya que aquí no hace falta saber DÓNDE tokeniza cada cosa, solo
 * qué partes del texto no son código real.
 */

const FUNC_RE = /^(?:static\s+)?func\s+([A-Za-z_]\w*)\s*\(([^()]*)\)\s*(?:->\s*([^:]+?))?\s*:/;
const FUNC_NAME_ONLY_RE = /^(?:static\s+)?func\s+([A-Za-z_]\w*)\s*\(/;
const SIGNAL_RE = /^signal\s+([A-Za-z_]\w*)\s*(\(([^()]*)\))?/;
const CLASS_NAME_RE = /^class_name\s+([A-Za-z_]\w*)/;
const CONST_RE = /^(?:@[A-Za-z_]\w*(?:\([^()]*\))?\s+)*const\s+([A-Za-z_]\w*)/;
const VAR_RE = /^(?:@[A-Za-z_]\w*(?:\([^()]*\))?\s+)*(?:static\s+)?var\s+([A-Za-z_]\w*)/;

const LOCAL_SYMBOL_INFO = "Declared in this file.";

/**
 * Reemplaza el contenido de comentarios y strings (simples, dobles,
 * triples) por espacios, preservando '\n' en su posición original. Un
 * carácter de escape dentro de una string simple ("\\\"") no cuenta como
 * cierre. Las strings simples sin cerrar no cruzan de línea (igual que en
 * tokenizer.js); las triples sí, hasta encontrar el cierre o el final del
 * texto.
 *
 * @param {string} text
 * @returns {string} mismo largo/mismas líneas que `text`, sin comentarios
 *   ni contenido de strings.
 */
function maskStringsAndComments(text) {
  let out = "";
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (ch === "#") {
      while (i < n && text[i] !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      const triple = text.startsWith(ch + ch + ch, i);
      const marker = triple ? ch + ch + ch : ch;
      out += " ".repeat(marker.length);
      i += marker.length;

      let escaped = false;
      let closed = false;
      while (i < n) {
        if (!triple && text[i] === "\n") break; // string simple sin cerrar: no cruza línea
        if (!escaped && text.startsWith(marker, i)) {
          out += " ".repeat(marker.length);
          i += marker.length;
          closed = true;
          break;
        }
        escaped = !escaped && text[i] === "\\";
        out += text[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      void closed; // sin cerrar: simplemente se acaba el texto, nada más que hacer
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/** Recorta lo que sigue a una declaración hasta el primer '=' de nivel
 *  superior (asignación), para poder buscar una anotación de tipo "': Tipo'"
 *  sin toparse con un '=' que pudiera aparecer dentro del valor por defecto. */
function extractTypeAnnotation(rest) {
  if (!rest) return null;
  const eq = rest.indexOf("=");
  let head = eq === -1 ? rest : rest.slice(0, eq);
  head = head.trim();
  if (head.startsWith(":=")) return null; // tipo inferido, no hay anotación explícita
  if (head.startsWith(":")) {
    const type = head.slice(1).trim();
    return type || null;
  }
  return null;
}

/** "a: int, b: String = 'x'" -> ["a", "b"] (para tabstops del snippet). */
function extractParamNames(paramsRaw) {
  if (!paramsRaw) return [];
  return paramsRaw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^([A-Za-z_]\w*)/);
      return m ? m[1] : p;
    });
}

function buildFuncDetail(paramsRaw, returnRaw) {
  const params = (paramsRaw || "").trim();
  const ret = (returnRaw || "").trim();
  return ret ? `(${params}) -> ${ret}` : `(${params})`;
}

/**
 * Escanea el texto completo de un documento GDScript y devuelve los
 * símbolos que el usuario declara: funciones, variables, constantes,
 * señales y el class_name del script. No resuelve alcance (scope): una
 * variable local dentro de una función se trata igual que un miembro de
 * clase — es una lista plana de "cosas que existen en este archivo", no
 * un árbol de scopes.
 *
 * @param {string} text
 * @returns {Array<{name: string, kind: "function"|"variable"|"constant"|"signal"|"class", detail: string|null, info: string, paramNames?: string[]}>}
 */
export function scanDocumentSymbols(text) {
  if (typeof text !== "string" || text.length === 0) return [];

  let masked;
  try {
    masked = maskStringsAndComments(text);
  } catch (_err) {
    return []; // best-effort: ante cualquier caso raro, mejor sin símbolos que romper
  }

  const seen = new Set(); // dedupe por "kind:name" (nos quedamos con la primera aparición)
  const symbols = [];

  function add(symbol) {
    const key = `${symbol.kind}:${symbol.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    symbols.push(symbol);
  }

  for (const rawLine of masked.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    let m = FUNC_RE.exec(line);
    if (m) {
      add({
        name: m[1],
        kind: "function",
        detail: buildFuncDetail(m[2], m[3]),
        info: LOCAL_SYMBOL_INFO,
        paramNames: extractParamNames(m[2]),
      });
      continue;
    }
    // Firma que el regex "completo" de arriba no pudo capturar del todo
    // (p. ej. paréntesis anidados en un valor por defecto) — nos
    // quedamos al menos con el nombre, sin detalle de parámetros/retorno,
    // en vez de perder el símbolo entero.
    m = FUNC_NAME_ONLY_RE.exec(line);
    if (m) {
      add({ name: m[1], kind: "function", detail: null, info: LOCAL_SYMBOL_INFO, paramNames: [] });
      continue;
    }

    m = SIGNAL_RE.exec(line);
    if (m) {
      add({
        name: m[1],
        kind: "signal",
        detail: m[2] ? `(${(m[3] || "").trim()})` : "()",
        info: LOCAL_SYMBOL_INFO,
      });
      continue;
    }

    m = CLASS_NAME_RE.exec(line);
    if (m) {
      add({ name: m[1], kind: "class", detail: null, info: LOCAL_SYMBOL_INFO });
      continue;
    }

    m = CONST_RE.exec(line);
    if (m) {
      const rest = line.slice(m.index + m[0].length);
      add({ name: m[1], kind: "constant", detail: extractTypeAnnotation(rest), info: LOCAL_SYMBOL_INFO });
      continue;
    }

    m = VAR_RE.exec(line);
    if (m) {
      const rest = line.slice(m.index + m[0].length);
      add({ name: m[1], kind: "variable", detail: extractTypeAnnotation(rest), info: LOCAL_SYMBOL_INFO });
      continue;
    }
  }

  return symbols;
}

export { LOCAL_SYMBOL_INFO, maskStringsAndComments };
