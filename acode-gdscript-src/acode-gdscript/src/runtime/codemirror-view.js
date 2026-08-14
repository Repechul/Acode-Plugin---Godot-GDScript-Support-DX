import { resolveCmModule } from "./resolve-cm-module.js";

const mod = resolveCmModule("@codemirror/view");

export const {
  EditorView,
  keymap,
  Decoration,
  WidgetType,
  ViewPlugin,
  ViewUpdate,
  gutter,
  GutterMarker,
  gutters,
  hoverTooltip,
  showTooltip,
  tooltips,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  placeholder,
  lineNumbers,
  crosshairCursor,
  dropCursor,
  rectangularSelection,
} = mod;

export default mod;
