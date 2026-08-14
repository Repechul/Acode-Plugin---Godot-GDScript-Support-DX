import { resolveCmModule } from "./resolve-cm-module.js";

const mod = resolveCmModule("@lezer/highlight");

export const { tags, Tag, styleTags, tagHighlighter, highlightTree, classHighlighter } = mod;

export default mod;
