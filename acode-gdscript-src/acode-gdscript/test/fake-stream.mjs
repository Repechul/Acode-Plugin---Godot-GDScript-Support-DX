// Reimplementación mínima (subconjunto) de la StringStream que @codemirror/language
// pasa a StreamParser.token(stream, state). Solo cubre los métodos que usa
// src/language/tokenizer.js.
export class FakeStringStream {
  constructor(line) {
    this.string = line;
    this.pos = 0;
    this.start = 0;
  }
  eol() {
    return this.pos >= this.string.length;
  }
  sol() {
    return this.pos === 0;
  }
  peek() {
    return this.pos < this.string.length ? this.string.charAt(this.pos) : undefined;
  }
  next() {
    if (this.pos < this.string.length) return this.string.charAt(this.pos++);
    return undefined;
  }
  eatSpace() {
    const start = this.pos;
    while (this.pos < this.string.length && /[ \t]/.test(this.string.charAt(this.pos))) this.pos++;
    return this.pos > start;
  }
  eatWhile(match) {
    const start = this.pos;
    while (this.pos < this.string.length && this._test(match, this.string.charAt(this.pos))) this.pos++;
    return this.pos > start;
  }
  _test(match, ch) {
    if (match instanceof RegExp) return match.test(ch);
    if (typeof match === "function") return match(ch);
    return false;
  }
  match(pattern, consume = true) {
    if (pattern instanceof RegExp) {
      const sub = this.string.slice(this.pos);
      const src = pattern.source.startsWith("^") ? pattern.source : "^(?:" + pattern.source + ")";
      const anchored = new RegExp(src, pattern.flags.replace("g", ""));
      const m = anchored.exec(sub);
      if (!m) return null;
      if (consume) this.pos += m[0].length;
      return m;
    }
    if (typeof pattern === "string") {
      const found = this.string.slice(this.pos, this.pos + pattern.length) === pattern;
      if (found && consume) this.pos += pattern.length;
      return found;
    }
    return null;
  }
  current() {
    return this.string.slice(this.start, this.pos);
  }
  skipToEnd() {
    this.pos = this.string.length;
  }
}

/**
 * Tokeniza una línea completa con un StreamParser, replicando el bucle que
 * usa @codemirror/language internamente (start = pos antes de cada token).
 * @returns {Array<[string|null, string]>} pares [nombreToken, texto]
 */
export function tokenizeLine(parser, state, lineText, maxTokens = 2000) {
  const stream = new FakeStringStream(lineText);
  const out = [];
  let guard = 0;
  while (!stream.eol()) {
    stream.start = stream.pos;
    const tok = parser.token(stream, state);
    if (stream.pos === stream.start) {
      throw new Error(
        `El tokenizador no avanzó la posición (posible bucle infinito) en pos=${stream.pos}, resto="${stream.string.slice(stream.pos)}"`
      );
    }
    out.push([tok, stream.current()]);
    if (++guard > maxTokens) throw new Error("Demasiados tokens: posible bucle infinito");
  }
  return out;
}
