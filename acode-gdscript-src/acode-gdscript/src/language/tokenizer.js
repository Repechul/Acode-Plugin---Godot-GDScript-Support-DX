import { tags } from "../runtime/lezer-highlight.js";
import { ALL_KEYWORDS, CONTROL_KEYWORDS, DECLARATION_KEYWORDS, OPERATOR_KEYWORDS, LITERAL_KEYWORDS } from "./keywords.js";
import { BUILTIN_TYPES } from "./keywords.js";
import { ENGINE_CLASSES } from "./classes.js";
import { GLOBAL_FUNCTIONS } from "./globals.js";
import { gdscriptIndent, trackLine } from "./indent.js";

function toSet(list) {
  const set = Object.create(null);
  for (const item of list) set[item] = true;
  return set;
}

const controlKeywordSet = toSet(CONTROL_KEYWORDS);
const declarationKeywordSet = toSet(DECLARATION_KEYWORDS);
const operatorKeywordSet = toSet(OPERATOR_KEYWORDS);
const otherKeywordSet = toSet(["preload", "assert", "breakpoint", "yield"]);
const literalSet = toSet(LITERAL_KEYWORDS);
const allKeywordSet = toSet(ALL_KEYWORDS);
// Separados (antes un solo knownTypeSet): en Godot real "Base Type Color"
// (int, float, Vector2...) y "Engine Type Color" (Node2D, Control...) son
// colores independientes. "Object" está en ambas listas a la vez; se
// resuelve como BUILTIN_TYPES (chequeado primero) ya que ahí es donde
// GDScript lo trata como tipo de Variant.
const builtinTypeSet = toSet(BUILTIN_TYPES);
const engineTypeSet = toSet(ENGINE_CLASSES.map((c) => c.name));
const globalFunctionSet = toSet(GLOBAL_FUNCTIONS.map((f) => f.name));

const IDENT_START = /[A-Za-z_]/;
const IDENT_CONT = /[A-Za-z0-9_]/;

/** Mapa propio de nombres de token -> Tag de @lezer/highlight. */
export const gdscriptTokenTable = {
  lineComment: tags.lineComment,
  docComment: tags.docComment,
  string: tags.string,
  specialString: tags.special(tags.string),
  number: tags.number,
  controlKeyword: tags.controlKeyword,
  definitionKeyword: tags.definitionKeyword,
  operatorKeyword: tags.operatorKeyword,
  keyword: tags.keyword,
  selfKeyword: tags.self,
  bool: tags.bool,
  null: tags.null,
  annotation: tags.attributeName,
  typeName: tags.typeName,
  engineType: tags.standard(tags.typeName),
  className: tags.definition(tags.className),
  functionName: tags.function(tags.variableName),
  variableDefinition: tags.definition(tags.variableName),
  constantDefinition: tags.constant(tags.variableName),
  propertyName: tags.propertyName,
  methodName: tags.function(tags.propertyName),
  globalFunctionCall: tags.standard(tags.variableName),
  variableName: tags.variableName,
  operator: tags.operator,
  punctuation: tags.punctuation,
  paren: tags.paren,
  squareBracket: tags.squareBracket,
  brace: tags.brace,
  nodePath: tags.url,
  invalid: tags.invalid,
};

function readString(quote, triple) {
  return function (stream, state) {
    let escaped = false;
    if (triple) {
      // Busca el cierre de comillas triples, puede abarcar varias líneas.
      while (!stream.eol()) {
        if (!escaped && stream.match(quote + quote + quote)) {
          state.tokenize = null;
          return "string";
        }
        escaped = !escaped && stream.next() === "\\";
      }
      return "string"; // continúa en la siguiente línea
    }
    // Comillas simples: no debería cruzar líneas; si ocurre, se corta (error de origen).
    while (!stream.eol()) {
      const ch = stream.next();
      if (!escaped && ch === quote) {
        state.tokenize = null;
        return "string";
      }
      escaped = !escaped && ch === "\\";
    }
    state.tokenize = null; // string sin cerrar: no seguir a la siguiente línea
    return "invalid";
  };
}

function startString(stream, state, tagName) {
  const quoteChar = stream.next(); // ' o "
  const triple = stream.match(quoteChar + quoteChar, false) ? (stream.match(quoteChar + quoteChar), true) : false;
  const reader = readString(quoteChar, triple);
  state.tokenize = reader;
  const result = reader(stream, state);
  return tagName || result;
}

function tokenBase(stream, state) {
  if (stream.eatSpace()) return null;
  if (stream.eol()) return null;

  // Comentarios: "##" es un doc-comment real en GDScript 4 (genera
  // documentación); "#" simple es un comentario común. "#region"/"#endregion"
  // siguen siendo comentarios normales acá a propósito: en el editor de
  // Godot son puramente un mecanismo de folding (no cambian de color ahí
  // tampoco), y folding.js ya los detecta por su cuenta sobre el texto
  // crudo de la línea, sin depender de esta tokenización.
  if (stream.peek() === "#") {
    const isDocComment = stream.match(/^##/, false);
    stream.skipToEnd();
    return isDocComment ? "docComment" : "lineComment";
  }

  // Literales con prefijo: StringName &"...", NodePath ^"..."
  if ((stream.peek() === "&" || stream.peek() === "^") && /["']/.test(stream.string.charAt(stream.pos + 1) || "")) {
    stream.next(); // consume el prefijo
    startString(stream, state);
    return "specialString";
  }

  // Referencias de nodo: $Path/To/Node, $"Path con espacios", %UniqueName
  if (stream.peek() === "$" || stream.peek() === "%") {
    stream.next();
    if (stream.peek() === '"' || stream.peek() === "'") {
      startString(stream, state);
    } else {
      stream.eatWhile(/[A-Za-z0-9_/]/);
    }
    return "nodePath";
  }

  // Cadenas normales / triples
  const ch = stream.peek();
  if (ch === '"' || ch === "'") {
    return startString(stream, state);
  }

  // Números: hex, bin, float, científica, con separadores '_'
  if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(stream.string.charAt(stream.pos + 1) || ""))) {
    if (stream.match(/^0x[0-9a-fA-F_]+/)) return "number";
    if (stream.match(/^0b[01_]+/)) return "number";
    if (stream.match(/^[0-9][0-9_]*\.[0-9_]*([eE][+-]?[0-9]+)?/)) return "number";
    if (stream.match(/^\.[0-9][0-9_]*([eE][+-]?[0-9]+)?/)) return "number";
    if (stream.match(/^[0-9][0-9_]*[eE][+-]?[0-9]+/)) return "number";
    if (stream.match(/^[0-9][0-9_]*/)) return "number";
  }

  // Anotaciones: @export, @onready, etc.
  if (ch === "@") {
    stream.next();
    stream.eatWhile(IDENT_CONT);
    return "annotation";
  }

  // Identificadores / palabras clave / tipos
  if (IDENT_START.test(ch)) {
    stream.eatWhile(IDENT_CONT);
    const word = stream.current();

    if (literalSet[word]) return word === "null" ? "null" : "bool";
    if (word === "self" || word === "super") return "selfKeyword";
    if (controlKeywordSet[word]) return "controlKeyword";
    if (declarationKeywordSet[word]) {
      state.afterDeclKeyword = word;
      return "definitionKeyword";
    }
    if (operatorKeywordSet[word]) return "operatorKeyword";
    if (otherKeywordSet[word]) return "keyword";
    if (allKeywordSet[word]) return "keyword";

    // Nombre justo tras 'func' -> función definida; tras 'class'/'class_name' -> clase;
    // tras 'var' -> variable definida; tras 'const' -> constante; tras
    // 'extends' -> nombre de tipo (clase base), sea del motor o propia.
    if (state.afterDeclKeyword === "func") {
      state.afterDeclKeyword = null;
      return "functionName";
    }
    if (state.afterDeclKeyword === "class" || state.afterDeclKeyword === "class_name") {
      state.afterDeclKeyword = null;
      return "className";
    }
    if (state.afterDeclKeyword === "var") {
      state.afterDeclKeyword = null;
      return "variableDefinition";
    }
    if (state.afterDeclKeyword === "const") {
      state.afterDeclKeyword = null;
      return "constantDefinition";
    }
    if (state.afterDeclKeyword === "extends") {
      state.afterDeclKeyword = null;
      // Consistente con cómo se tagea el mismo nombre en cualquier otro
      // lado: si es una clase del motor, engineType; si no, se asume una
      // clase propia (class_name en otro archivo) y se trata como className.
      return engineTypeSet[word] ? "engineType" : "className";
    }

    if (builtinTypeSet[word]) return "typeName";
    if (engineTypeSet[word]) return "engineType";

    // Si lo que sigue es '(' (con o sin espacios de por medio), el nombre
    // se está LLAMANDO, no solo referenciando.
    const isCall = /^\s*\(/.test(stream.string.slice(stream.pos));

    // Nombre.propiedad / Nombre.metodo() -> el siguiente identificador tras
    // un '.' se marca aparte (el '.' ya se tokenizó abajo).
    if (state.afterDot) {
      state.afterDot = false;
      return isCall ? "methodName" : "propertyName";
    }

    // Llamada "desnuda" (sin punto, self implícito): foo() en vez de
    // self.foo(). Si el nombre coincide con GLOBAL_FUNCTIONS (@GlobalScope
    // real de Godot: abs, print, randi, lerp...) es "Global Function
    // Color"; cualquier otra (método propio o heredado del motor) cae en
    // el mismo balde que una llamada con punto (methodName).
    if (isCall) return globalFunctionSet[word] ? "globalFunctionCall" : "methodName";

    return "variableName";
  }

  // Puntuación y operadores
  if (ch === ".") {
    stream.next();
    state.afterDot = true;
    return "punctuation";
  }
  // Los operadores compuestos (incl. ':=') se prueban ANTES que la
  // puntuación suelta, para que ':' no "tape" a ':=', etc.
  if (stream.match(/^(->|<<=|>>=|<<|>>|<=|>=|==|!=|:=|\*\*=|\*\*|\/\/=|\/\/|&&|\|\||[-+*/%&|^~!<>=]=?)/)) {
    return "operator";
  }
  if (",;:".includes(ch)) {
    stream.next();
    return "punctuation";
  }
  if ("([".includes(ch)) {
    stream.next();
    return ch === "(" ? "paren" : "squareBracket";
  }
  if (")]".includes(ch)) {
    stream.next();
    return ch === ")" ? "paren" : "squareBracket";
  }
  if ("{}".includes(ch)) {
    stream.next();
    return "brace";
  }

  // Carácter no reconocido: se consume para no quedar atascados.
  stream.next();
  return "invalid";
}

export const gdscriptStreamParser = {
  name: "gdscript",

  startState() {
    return {
      tokenize: null,
      afterDeclKeyword: null,
      afterDot: false,
      // Seguimiento incremental para indent.js (ver comentario allí):
      // texto de indentación crudo de la última línea de código completa
      // que se procesó, y la pila de indentaciones de los bloques ':'
      // todavía abiertos.
      prevLineIndentText: "",
      prevLineOpensBlock: false,
      prevLineIsDedentStatement: false,
      blockStack: [],
    };
  },

  copyState(state) {
    return {
      tokenize: state.tokenize,
      afterDeclKeyword: state.afterDeclKeyword,
      afterDot: state.afterDot,
      prevLineIndentText: state.prevLineIndentText,
      prevLineOpensBlock: state.prevLineOpensBlock,
      prevLineIsDedentStatement: state.prevLineIsDedentStatement,
      blockStack: Array.isArray(state.blockStack) ? state.blockStack.slice() : [],
    };
  },

  token(stream, state) {
    // Un identificador tras '.' consume el flag afterDot; para cualquier otro
    // token distinto de identificador, hay que limpiarlo antes de tokenizar.
    const isIdentNext = IDENT_START.test(stream.peek() || "");
    if (state.afterDot && !isIdentNext) state.afterDot = false;

    if (state.afterDeclKeyword) {
      if (stream.eatSpace()) return null; // puede que el nombre venga tras el espacio
      if (!IDENT_START.test(stream.peek() || "")) {
        // La palabra clave de declaración no va seguida de un nombre
        // (p.ej. una lambda "func(x):" o un enum anónimo "enum { A, B }"):
        // soltar la marca. Si no se soltara, el próximo identificador que
        // aparezca en cualquier parte (el primer parámetro de la lambda,
        // o algo mucho más lejos si no hay ninguno) se etiquetaría por
        // error como "functionName".
        state.afterDeclKeyword = null;
      }
    }

    const result = state.tokenize ? state.tokenize(stream, state) : tokenBase(stream, state);

    // Al llegar al final de una línea real de código (no en medio de una
    // cadena multilínea), registrarla para indent.js. stream.string es el
    // texto completo de la línea, independientemente de por dónde vaya la
    // tokenización.
    if (stream.eol() && !state.tokenize) {
      trackLine(state, stream.string);
    }

    return result;
  },

  blankLine(state) {
    state.afterDeclKeyword = null;
    state.afterDot = false;
  },

  indent(state, textAfter, context) {
    return gdscriptIndent(state, textAfter, context);
  },

  languageData: {
    commentTokens: { line: "#" },
    closeBrackets: { brackets: ["(", "[", "{", '"', "'"] },
    // "except"/"finally" son de Python, no existen en GDScript (sin excepciones).
    indentOnInput: /^\s*(elif|else)\b$/,
    wordChars: "_",
  },

  tokenTable: gdscriptTokenTable,
};
