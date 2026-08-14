// Palabras clave "de control" y declarativas de GDScript 4.x.
export const CONTROL_KEYWORDS = [
  "if", "elif", "else", "for", "while", "match", "when",
  "break", "continue", "pass", "return", "await",
];

export const DECLARATION_KEYWORDS = [
  "class", "class_name", "extends", "func", "var", "const",
  "enum", "signal", "static",
];

export const OPERATOR_KEYWORDS = [
  "and", "or", "not", "in", "is", "as",
];

export const OTHER_KEYWORDS = [
  "self", "super", "preload", "assert", "breakpoint", "yield",
];

export const ALL_KEYWORDS = [
  ...CONTROL_KEYWORDS,
  ...DECLARATION_KEYWORDS,
  ...OPERATOR_KEYWORDS,
  ...OTHER_KEYWORDS,
];

export const LITERAL_KEYWORDS = ["true", "false", "null"];

// Anotaciones (@algo) de GDScript 4.x. A diferencia de ALL_KEYWORDS/
// BUILTIN_TYPES (arrays planos de strings), cada entrada aquí es un
// objeto { name, params?, info } — mismo espíritu que GLOBAL_FUNCTIONS.
// `params` solo está presente en anotaciones que se escriben CON
// paréntesis; su ausencia (anotación "bare", p.ej. @tool, @onready)
// importa: completions.js NO debe añadir "()" a una anotación que en
// GDScript real nunca lleva paréntesis.
//
// Para anotaciones de aridad variable (@export_enum, @export_flags,
// @export_node_path, @warning_ignore*) se usa un único tabstop cuyo
// texto por defecto ya incluye las comillas/comas de ejemplo, en vez de
// simular una cantidad fija de argumentos que no es real — el usuario
// edita ese único bloque para poner sus propios valores.
//
// Firmas verificadas contra la documentación oficial de Godot 4 antes
// de añadirlas (igual que en classes.js/globals.js).
export const ANNOTATIONS = [
  { name: "@export", info: "Exports the property: visible and editable in the Inspector, and saved with the resource/scene." },
  { name: "@export_enum", params: ['"A", "B", "C"'], info: "Exports an int/String as a dropdown of named values. Append \":N\" to a name to set its explicit value." },
  { name: "@export_range", params: ["min", "max", "step"], info: "Exports a number restricted to a range, shown as a slider in the Inspector." },
  { name: "@export_flags", params: ['"A", "B", "C"'], info: "Exports an int as a bit-flag checkbox field. Append \":N\" to a name to set its explicit bit value." },
  { name: "@export_flags_2d_physics", info: "Exports an int as a bit-flag field using the project's 2D physics layer names." },
  { name: "@export_flags_2d_render", info: "Exports an int as a bit-flag field using the project's 2D render layer names." },
  { name: "@export_flags_2d_navigation", info: "Exports an int as a bit-flag field using the project's 2D navigation layer names." },
  { name: "@export_flags_3d_physics", info: "Exports an int as a bit-flag field using the project's 3D physics layer names." },
  { name: "@export_flags_3d_render", info: "Exports an int as a bit-flag field using the project's 3D render layer names." },
  { name: "@export_flags_3d_navigation", info: "Exports an int as a bit-flag field using the project's 3D navigation layer names." },
  { name: "@export_category", params: ["name"], info: "Starts a new top-level category in the Inspector for the exports that follow." },
  { name: "@export_group", params: ["name"], info: "Starts a collapsible group in the Inspector for the exports that follow, until the next group/category." },
  { name: "@export_subgroup", params: ["name"], info: "Starts a collapsible subgroup nested within the current @export_group." },
  { name: "@export_multiline", info: "Exports a String with a multiline text box instead of a single-line field." },
  { name: "@export_file", params: ['"*.ext"'], info: "Exports a String as a path to a file, with an optional filter (e.g. \"*.png\"). Shows a file picker." },
  { name: "@export_dir", info: "Exports a String as a path to a directory. Shows a directory picker." },
  { name: "@export_global_file", params: ['"*.ext"'], info: "Like @export_file, but allows picking any file on disk, not just inside the project." },
  { name: "@export_global_dir", info: "Like @export_dir, but allows picking any directory on disk, not just inside the project." },
  { name: "@export_placeholder", params: ['"text"'], info: "Shows greyed-out placeholder text in the Inspector field when the String property is empty." },
  { name: "@export_color_no_alpha", info: "Exports a Color without the alpha (transparency) channel editable." },
  { name: "@export_node_path", params: ['"Type1", "Type2"'], info: "Exports a NodePath restricted to the given node type(s); shows a node picker in the Inspector." },
  { name: "@export_tool_button", params: ["text", '"icon_name"'], info: "Exports a Callable as a clickable button in the Inspector; pressing it calls the Callable." },
  { name: "@export_custom", params: ["hint", '"hint_string"'], info: "Exports with a raw PropertyHint + hint string, for hints with no dedicated @export_* annotation." },
  { name: "@export_storage", info: "Exports the property to be saved/loaded, but without showing it in the Inspector." },
  { name: "@export_exp_easing", info: "Exports a float edited via an exponential easing curve widget (e.g. for animation easing)." },
  { name: "@onready", info: "Assigns the value right before _ready(), instead of at object creation — needed when using $ to reference children." },
  { name: "@tool", info: "Makes the script also run inside the editor, not just at runtime." },
  { name: "@icon", params: ['"res://path/to/icon.svg"'], info: "Sets a custom editor icon for this class. Must be a string literal path, not an expression." },
  { name: "@rpc", params: ['"any_peer"'], info: "Marks a method as callable remotely via multiplayer RPCs. Full signature: mode, sync, transfer_mode, transfer_channel." },
  { name: "@static_unload", info: "Allows the script's static variables to be unloaded when no instances or references to it remain." },
  { name: "@warning_ignore", params: ['"unused_parameter"'], info: "Suppresses the given warning type(s) for the statement/declaration that follows." },
  { name: "@warning_ignore_start", params: ['"unused_parameter"'], info: "Suppresses the given warning type(s) from this point until @warning_ignore_restore (or end of file)." },
  { name: "@warning_ignore_restore", params: ['"unused_parameter"'], info: "Stops ignoring the given warning type(s) after a previous @warning_ignore_start." },
  { name: "@abstract", info: "Marks a class or method as abstract: no implementation, must be overridden by a non-abstract subclass." },
];

// Tipos básicos / integrados (para resaltado y autocompletado de tipos).
export const BUILTIN_TYPES = [
  "bool", "int", "float", "String", "StringName", "NodePath", "Variant", "void",
  "Vector2", "Vector2i", "Vector3", "Vector3i", "Vector4", "Vector4i",
  "Rect2", "Rect2i", "Transform2D", "Transform3D", "Basis", "Quaternion",
  "Plane", "AABB", "Projection", "Color",
  "Array", "Dictionary",
  "PackedByteArray", "PackedInt32Array", "PackedInt64Array",
  "PackedFloat32Array", "PackedFloat64Array", "PackedStringArray",
  "PackedVector2Array", "PackedVector3Array", "PackedVector4Array", "PackedColorArray",
  "Object", "RID", "Callable", "Signal",
];
