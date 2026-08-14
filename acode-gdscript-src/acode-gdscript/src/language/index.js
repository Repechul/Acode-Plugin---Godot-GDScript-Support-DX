import { StreamLanguage, LanguageSupport, indentUnit } from "../runtime/codemirror-language.js";
import { hoverTooltip } from "../runtime/codemirror-view.js";
import { gdscriptStreamParser } from "./tokenizer.js";
import { gdscriptCompletionSource } from "./completions.js";
import { gdscriptFolding } from "./folding.js";
import { gdscriptHoverTooltip } from "./hover.js";
import { gdscriptSignatureHelp } from "./signature-help.js";

export const gdscriptLanguage = StreamLanguage.define(gdscriptStreamParser);

export function gdscript() {
  return new LanguageSupport(gdscriptLanguage, [
    gdscriptLanguage.data.of({ autocomplete: gdscriptCompletionSource }),
    gdscriptFolding,
    hoverTooltip(gdscriptHoverTooltip),
    gdscriptSignatureHelp,
    indentUnit.of("\t"),
  ]);
}
