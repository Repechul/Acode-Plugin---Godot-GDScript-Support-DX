# Changelog

> Este changelog también está disponible en inglés: [CHANGELOG.md](https://github.com/Repechul/Acode-Plugin---Godot-GDScript-Support-DX/blob/main/acode-gdscript-src/acode-gdscript/CHANGELOG.md).

## 0.9.2

- **Corrección: inconsistencias de coloreado encontradas al cruzar
  `tokenizer.js`/`keywords.js` contra el plugin Spectrum Theme,
  mantenido aparte** (un tema de editor, no forma parte de este paquete,
  que mapea nuestros tags a colores). Comparar lo que emite el
  tokenizer contra las reglas y los comentarios de paleta del tema sacó
  a la luz varios casos donde se elegía el tag equivocado, o donde dos
  conceptos distintos terminaban compartiendo un mismo tag:
  - Las anotaciones `@export`/`@onready`/etc. ahora usan
    `tags.attributeName` en vez de `tags.meta`, coincidiendo con el
    espacio dedicado del tema para "Annotation Color".
  - `void` ahora resuelve a `typeName`, igual que `int`/`float`/`bool`,
    en vez de quedar atrapada antes como keyword genérica — estaba
    listada tanto en `BUILTIN_TYPES` como en `OTHER_KEYWORDS`; se sacó
    de esta última.
  - `extends MiClase` ahora tagea el nombre de la clase base como
    `engineType` si es una clase del motor, o `className` si no (se
    asume una clase propia declarada con `class_name` en otro archivo —
    ver `engineType` más abajo). Antes solo funcionaba por casualidad con
    clases del motor (se capturaba más tarde en el chequeo de tipos
    conocidos); cualquier otro caso caía a un color de variable genérico.
  - Los comentarios de documentación `##` (sintaxis real de GDScript 4,
    distinta de un `#` simple) ahora tagean como `docComment` en vez de
    `lineComment`. `#region`/`#endregion` mantienen a propósito el tag
    `lineComment` normal: en el editor de Godot son puramente una
    convención de folding, sin color de texto especial, y `folding.js`
    ya los detecta por su cuenta a partir del texto crudo de la línea.
  - `const` ahora tagea su nombre con un token nuevo,
    `constantDefinition` (`tags.constant(tags.variableName)`), distinto
    del `variableDefinition` de `var` — antes ambos eran idénticos.
  - Una llamada a método justo tras un punto (`sprite.play()`) ahora
    tagea con un token nuevo, `methodName`
    (`tags.function(tags.propertyName)`), distinto del simple acceso a
    propiedad (`sprite.position`) — antes ambos eran siempre
    `propertyName`.
  - `functionName` se simplificó: pasó de un tag con dos modificadores
    apilados (`function(definition(variableName))` — sin regla exacta
    en el tema, dependiendo de un desempate no documentado entre dos
    reglas parciales igual de específicas) a `function(variableName)`
    simple, que coincide exactamente con la regla "Function Definition
    Color" que el tema ya tenía.
  - `nodePath` (`$Path`, `%Unique`, `^"..."`) ahora usa `tags.url` en vez
    de compartir `tags.special(tags.string)` con los literales
    StringName (`&"..."`), para que ambos puedan tener colores
    distintos.

  8 tests de regresión nuevos (`test/tokenizer.test.mjs`), incluyendo
  chequeos directos contra `gdscriptTokenTable` para los tres fixes que
  solo cambian a qué `Tag` mapea un token, no el string del token en sí
  (invisibles para asserts basados en strings). Se extendió el mock de
  test (`test/mock-acode.mjs`) con los tags `docComment`/`attributeName`/
  `url` y el modificador `constant()`, que antes ningún camino de código
  ejercitaba.

- **Corrección: tres inconsistencias de coloreado más, encontradas en una
  segunda pasada tras reorganizar la paleta de Spectrum Theme con
  comentarios que nombran los ajustes reales de Text Editor > Theme >
  Highlighting de Godot.** Cruzar el tokenizer contra esas etiquetas sacó
  a la luz más casos donde Godot usa colores independientes que nuestros
  tags no distinguían:
  - Las clases del motor (`Node2D`, `Control`...) ahora tagean con un
    token nuevo, `engineType` (`tags.standard(tags.typeName)`), separado
    de `typeName` (`BUILTIN_TYPES`: `Vector2`, `float`, `bool`...). Antes
    ambas listas alimentaban un solo set combinado y siempre devolvían
    `typeName`. (`Object` está en ambas listas; gana `BUILTIN_TYPES`, que
    se chequea primero.)
  - Una llamada sin punto (`_refresh_inspector()`, self implícito) ahora
    se detecta de verdad — antes solo una llamada justo tras un punto
    (`sprite.play()`) se reconocía como llamada; cualquier otro caso caía
    a `variableName` plano. Una llamada sin punto ahora tagea
    `methodName` (mismo token que una llamada con punto), o con un token
    nuevo, `globalFunctionCall` (`tags.standard(tags.variableName)`),
    cuando el nombre coincide con `GLOBAL_FUNCTIONS` — el `@GlobalScope`
    real de Godot: `print`, `randi`, `lerp`, etc.
  - `extends` reutiliza la misma separación `engineType`/`className` (ver
    arriba), en vez de tagear siempre `typeName` sin importar el tipo de
    clase.

  6 tests de regresión nuevos. Se extendió el mock de test con el
  modificador `standard()`. `npm test`: 212/212 en verde.

  Las dos rondas solo cambian qué tag emite `tokenizer.js`. Para que los
  tags nuevos se vean con colores realmente distintos —además de separar
  las llamadas a método/función (`function(propertyName)`) de las
  definiciones de función, que seguían compartiendo color aunque el tag
  ya era distinto— hicieron falta cambios equivalentes del lado de
  Spectrum Theme, aplicados directamente en el `main.js` de ese plugin
  (fuera de este paquete, no cubierto por el `npm test` de acá). Todavía
  sin validar contra un build real de esbuild ni en un dispositivo real.

- **Rebranding de cara al lanzamiento público: el plugin pasó a
  llamarse "Godot - GDScript Support DX"** — se actualizaron `name` e
  `id` en `plugin.json` (ahora
  `acode.plugin.repechul.godot.gdscript.support.dx`), reflejado en la
  constante `PLUGIN_ID` de `src/main.js` (los dos deben coincidir — ver
  el comentario al lado). Ícono nuevo del plugin (`icon.png`), también
  con temática de Godot.
- **Documentación reorganizada de cara al lanzamiento público.** Los
  antiguos `README.md`/`README_ES.md` — documentación técnica completa
  sobre los shims de runtime, la arquitectura, cómo ampliar los datos
  curados, y las limitaciones conocidas — ahora son
  `README_EXT.md`/`README_EXT_ES.md`. `README.md` es nuevo: una
  descripción corta, solo en inglés, de qué hace el plugin y qué
  aspectos de GDScript cubre, con enlaces al repositorio de GitHub y a
  su tracker de issues. Sigue siendo el archivo al que apunta el campo
  `readme` de `plugin.json`, así que es lo que Acode muestra para el
  plugin. Se actualizó la lista `filesToInclude` de `pack-zip.js`, y los
  comentarios del código que apuntaban a `README.md` para detalles de
  troubleshooting/limitaciones (`resolve-cm-module.js`,
  `signature-help.js`, `esbuild.config.mjs`), para que apunten a
  `README_EXT.md`, donde ahora vive ese contenido.

## 0.9.0

- **Nuevo: primera revisión de huecos de `GLOBAL_FUNCTIONS` desde la
  base original del proyecto** (107 → 118) — cierra la sugerencia del
  roadmap actualizado de revisar el único archivo de datos que nunca
  se había repasado. Añadido: funciones hiperbólicas inversas
  (`acosh`, `asinh`, `atanh`), `angle_difference` (diferencia angular
  normalizada en [-PI, +PI]), funciones de curvas Bézier
  (`bezier_interpolate`, `bezier_derivative`), interpolación cúbica
  (`cubic_interpolate`, `cubic_interpolate_angle`), conversión de
  decibelios de audio (`db_to_linear`, `linear_to_db`), `is_same`
  (comparación de identidad de referencia, distinta de `==`),
  `get_stack` (el stack de llamadas como datos, complementa a
  `print_stack`), `error_string` (texto legible para un código
  `Error` — combina naturalmente con `push_error()`), y las variantes
  `_with_objects` de `bytes_to_var`/`var_to_bytes` (permiten
  codificar/decodificar Objects, no solo Variants simples). Cada firma
  se verificó contra fuentes oficiales de Godot antes de añadirla —
  varias (el trío hiperbólico inverso, `angle_difference`, las
  funciones Bézier/cúbicas) se confirmaron con las listas exactas de
  parámetros de la propia referencia RST de `@GlobalScope` de Godot.
  Excluido deliberadamente:
  `cubic_interpolate_in_time`/`cubic_interpolate_angle_in_time`
  (reales, pero con 8 parámetros cada una y demasiado especializadas
  como para que valga la pena un snippet) y un `wrap()` genérico (solo
  parecen existir las tipadas `wrapf`/`wrapi`; sin evidencia de una
  variante `Variant`, a diferencia de `abs`/`ceil`/`floor` y
  compañía). 5 tests nuevos de verificación puntual
  (`completions.test.mjs`, `hover.test.mjs`). `npm test`: 198/198 en
  verde.
  **Actualización: confirmado funcionando en un dispositivo real.**

## 0.8.0

- **Nuevo: más clases y miembros, cerrando la pasada de cobertura de
  datos "@export/PROPERTY_HINT + clases/miembros" iniciada en 0.7.0.**
  `ENGINE_CLASSES` 151 → 164: `VisibleOnScreenNotifier2D/3D`,
  `ResourcePreloader`, `AnimationNodeStateMachine`,
  `MultiplayerSpawner`/`MultiplayerSynchronizer` (los nodos de
  multijugador de alto nivel de Godot 4), `HTTPClient`, `Thread`,
  `Mutex`, `WeakRef`, `ResourceSaver`, `DisplayServer`, `ClassDB`. Antes
  de añadir nada, se verificó que los tipos matemáticos (`Rect2`,
  `Transform2D/3D`, `Basis`, `Quaternion`, `Plane`, `AABB`) y
  `Callable`/`Signal` YA estaban correctamente en `BUILTIN_TYPES`
  (`keywords.js`), no faltaban — sin adiciones duplicadas o mal
  ubicadas. `COMMON_MEMBERS` 68 → 91 (sin tocar desde la base original
  del proyecto, antes de que esta conversación ampliara ningún otro
  archivo de datos): grupos de nodos
  (`add_to_group`/`remove_from_group`/`is_in_group`),
  `show`/`hide`/`queue_redraw` (nombre de Godot 4, reemplaza al viejo
  `update()`), `rotation_degrees`/`global_rotation`/`look_at`,
  `is_queued_for_deletion`/`get_instance_id`/`set_process`/
  `set_physics_process`, más dos grupos de miembros nuevos para clases
  que ya existían en `ENGINE_CLASSES` pero no tenían ningún miembro
  cubierto: Timer
  (`start`/`stop`/`wait_time`/`one_shot`/`autostart`/`timeout`) y
  AnimationPlayer
  (`play`/`is_playing`/`current_animation`/`animation_finished`).
  **Excluido deliberadamente: miembros de singletons**
  (`Input.is_action_pressed()` y similares) — `memberOptions` se mezcla
  en `topLevelOptions`, así que cualquier cosa añadida ahí se ofrecería
  incorrectamente como una llamada suelta con self implícito; ver el
  README para el razonamiento completo. Cada nombre/firma se verificó
  contra fuentes oficiales de Godot 4 antes de añadirlo (`queue_redraw`
  en particular tiene una historia real de renombrado Godot-3-vs-4 fácil
  de errar). 7 tests nuevos de verificación puntual. `npm test`:
  195/195 en verde.
  **Actualización: confirmado funcionando en un dispositivo real.**

## 0.7.0

- **Nuevo: cobertura completa de @export/PROPERTY_HINT, con
  funcionalidad real detrás, no solo nombres.** `ANNOTATIONS`
  (`keywords.js`) se refactorizó de un array plano de strings a objetos
  ricos (`{name, params?, info}`), y se añadieron 6 anotaciones que
  faltaban (`@export_flags_2d_navigation`, `@export_flags_3d_navigation`,
  `@export_storage`, `@export_exp_easing`, `@warning_ignore_start`,
  `@warning_ignore_restore`), pasando de 28 a 34. La mejora real es de
  comportamiento: `completions.js` ahora inserta un snippet con tabstops
  de parámetros para toda anotación que los lleva
  (`@export_range(${1:min}, ${2:max}, ${3:step})`, `@export_custom`,
  `@icon`, `@rpc`, `@export_tool_button`, etc.) en vez de solo el nombre
  suelto — las anotaciones bare (`@tool`, `@onready`, `@abstract`...) se
  mantienen sin paréntesis, ya que añadirles "()" sería un error de
  sintaxis. Las de aridad variable (`@export_enum`, `@export_flags`,
  `@export_node_path`, `@warning_ignore*`) reciben un tabstop precargado
  con texto de ejemplo en vez de una cantidad fija de argumentos
  inventada. `hover.js` ahora también indexa `ANNOTATIONS` por primera
  vez — pasar el cursor sobre `export_range` en `@export_range(...)`
  muestra qué hace; antes de 0.7.0 las anotaciones no tenían ningún
  soporte de hover. También se añadió un subconjunto curado de 19
  constantes `PROPERTY_HINT_*` a `GLOBAL_CONSTANTS` (45 → 64),
  priorizando los hints sin un `@export_*` más cómodo. Cada firma con
  parámetros (`@export_range`, `@rpc`, `@export_tool_button`,
  `@export_group`, `@export_custom`...) se verificó contra la
  documentación oficial de Godot 4 antes de escribirla, misma
  disciplina que classes.js/globals.js en versiones anteriores. 10
  tests nuevos (`completions.test.mjs`, `hover.test.mjs`). `npm test`:
  189/189 en verde.
  **Actualización: confirmado funcionando en un dispositivo real.**

## 0.6.0

- **Nuevo: 4 snippets más** (`SNIPPETS`, 20 → 24) — item 7 del roadmap,
  del tipo solo-datos y bajo riesgo, mismo espíritu que 0.3.0/0.4.0. Tres
  callbacks del motor más: `_draw()` (CanvasItem — Node2D/Control, sin
  parámetros, para dibujo personalizado), `_enter_tree()` y
  `_exit_tree()` (sin parámetros, se ejecutan cuando un nodo entra/sale
  del árbol de escena — `_enter_tree` en particular se ejecuta *antes*
  que `_ready`, útil para configuración que debe pasar más temprano).
  Firmas verificadas contra la documentación oficial de Godot 4 y
  ejemplos reales de GDScript antes de añadirlas, misma práctica que en
  0.3.0/0.4.0. Estos tres funcionan automáticamente con la rama de
  autocompletado existente "escribir `func ` + nombre parcial"
  (`funcCallbackNameOptions` en `completions.js`, sin cambios), ya que
  esa lógica ya deriva su lista de cualquier entrada de `SNIPPETS` cuyo
  label empiece con `"func "` — no hizo falta tocar completions.js.
  También se añadió **"script skeleton"**: `extends`/`class_name`/
  `_ready` de una sola vez, para arrancar un script nuevo rápido. Se
  amplió el test parametrizado ya existente que cubre la rama "func " +
  nombre parcial (ahora cubre 8 nombres de callback en vez de 5), más 2
  tests nuevos dedicados. `npm test`: 179/179 en verde.
  **Actualización: confirmado funcionando en un dispositivo real.**

## 0.5.0

- **Nuevo: ayuda de firma (signature help).** Mientras el cursor está
  dentro de los paréntesis de una llamada a función/método, ahora un
  tooltip muestra los parámetros de esa llamada, resaltando en cuál está
  el cursor — reutiliza exactamente los mismos datos curados `params`
  que ya alimentan el autocompletado (`GLOBAL_FUNCTIONS`,
  `COMMON_MEMBERS`), más tus propias funciones de `document-symbols.js`
  (0.2.0), con la misma prioridad que ya usa el autocompletado. Sin
  datos nuevos que mantener. Módulo nuevo `signature-help.js`:
  `findActiveCall(text, pos)` recorre hacia atrás desde el cursor sobre
  el mismo texto enmascarado (sin strings/comentarios) que ya usa
  `document-symbols.js`, para encontrar la llamada envolvente y en qué
  argumento separado por comas está el cursor — maneja correctamente
  llamadas anidadas, llamadas multilínea, e ignora paréntesis que viven
  dentro de strings; `resolveSignature(name, text)` busca la lista de
  parámetros de esa llamada.
  **A diferencia de todo lo demás añadido hasta ahora, esto se conecta
  directamente con el `StateField` de CodeMirror + el método
  `.computeN()` del facet `showTooltip`**, siguiendo el patrón
  documentado oficialmente por CodeMirror para tooltips que siguen al
  cursor — `hover.js`, en cambio, usa el helper de más alto nivel
  `hoverTooltip()`, que este proyecto ya había puesto a prueba con éxito
  en un dispositivo real. Esta conexión de más bajo nivel es terreno
  nuevo: los tests con mocks demuestran que la lógica de detección de
  llamada/argumento es correcta y que `create`/`update`/`provide` están
  conectados a las funciones correctas, pero no pueden demostrar que
  `showTooltip.computeN()` se comporta dentro del CodeMirror real de
  Acode exactamente como describe la documentación. Límites de alcance
  deliberados, ver el README: sin firma para llamadas anidadas dentro de
  un argumento que es un array/diccionario literal, sin datos para
  constructores de tipos básicos (`Vector2(...)`, etc.), sin tooltip
  para llamadas sin parámetros. 24 tests nuevos en
  `test/signature-help.test.mjs`; también se mejoró
  `test/mock-acode.mjs` (`StateField.define` ahora preserva su spec en
  vez de descartarlo, el mock de `showTooltip` ahora tiene
  `.computeN()`) para poder ejercitar la conexión en sí, no solo la
  lógica pura detrás. `npm test`: 177/177 en verde.
  **Actualización (mismo día): confirmado funcionando en un dispositivo
  real**, los 8 escenarios de un script de prueba manual dedicado
  (llamadas anidadas, llamadas multilínea, funciones propias con
  prioridad sobre las curadas, actualización en vivo mientras se
  escribe, y correctamente ausente para constructores/llamadas sin
  parámetros/literales anidados) — incluida la parte conectada a mano
  con `StateField`/`showTooltip` que los tests con mocks por sí solos no
  podían garantizar del todo.

## 0.4.0

- **Nuevo: ~40 constantes globales más reconocidas en autocompletado y
  hover** (`GLOBAL_CONSTANTS`, 4 → 45). Cambio solo de datos, igual que
  0.3.0 (item 3 del roadmap). Hasta ahora esto solo cubría las
  constantes matemáticas (`PI`, `TAU`, `INF`, `NAN`). Se añadió un
  subconjunto curado de los enums del motor que GDScript expone como
  constantes globales planas (a diferencia de un enum propio del
  usuario, estas no necesitan prefijo `NombreDelEnum.`): códigos de
  `Error` comunes (`OK`, `FAILED`, `ERR_FILE_NOT_FOUND`,
  `ERR_CANT_CONNECT`, `ERR_INVALID_PARAMETER`...) para el patrón
  habitual `if err != OK: ...`, teclas (`Key`) comunes (`KEY_SPACE`,
  `KEY_ESCAPE`, `KEY_ENTER`, flechas...), constantes de `MouseButton`
  (`MOUSE_BUTTON_LEFT/RIGHT/MIDDLE`, rueda arriba/abajo), y un pequeño
  subconjunto de `JoyButton` (`JOY_BUTTON_A/B/X/Y`, `JOY_BUTTON_START`).
  Nombres verificados contra la referencia oficial de clases de Godot 4.
  Sigue siendo un subconjunto curado, no el enum `Error` completo (~49
  entradas) ni el enum `Key` completo (cientos de entradas) — ver el
  comentario del propio `globals.js` para el porqué. Se añadieron dos
  tests de verificación puntual (`completions.test.mjs`,
  `hover.test.mjs`), mismo razonamiento que en 0.3.0: el código que
  convierte `GLOBAL_CONSTANTS` en entradas de autocompletado/hover no se
  tocó. `npm test`: 153/153 en verde.
  **Actualización: confirmado funcionando en un dispositivo real.**

## 0.3.0

- **Nuevo: ~50 clases/nodos del motor más reconocidos en autocompletado
  y hover** (`ENGINE_CLASSES`, 102 → 151). Cambio solo de datos, sin
  tocar lógica (item 2 del roadmap). Adiciones destacadas: `ShapeCast2D`/
  `ShapeCast3D`, `NavigationRegion2D`/`NavigationRegion3D`,
  `CollisionPolygon3D`, `CanvasLayer`, `CanvasModulate`, `Marker2D`/
  `Marker3D`, `PointLight2D`/`DirectionalLight2D`, `GPUParticles2D`/
  `GPUParticles3D`, `CPUParticles2D`/`CPUParticles3D`, `SubViewport`/
  `SubViewportContainer`, `Sprite3D`/`AnimatedSprite3D`/`Label3D`,
  `Path3D`/`PathFollow3D`, `WorldEnvironment`/`Environment`, una tanda de
  controles de UI que eran huecos habituales (`SpinBox`, `MenuButton`,
  `HSeparator`/`VSeparator`, `HSplitContainer`/`VSplitContainer`,
  `HFlowContainer`/`VFlowContainer`, `AspectRatioContainer`,
  `NinePatchRect`, `TextureButton`, `TextureProgressBar`,
  `ColorPickerButton`, `ConfirmationDialog`, `TabBar`), y algunas clases
  de utilidad/recursos de uso frecuente (`RandomNumberGenerator`,
  `JSON`, `ConfigFile`, `ProjectSettings`, `TileSet`, `AtlasTexture`,
  `Curve2D`/`Curve3D`, `StyleBoxFlat`, `ParticleProcessMaterial`).
  Nombres verificados contra la referencia oficial de clases de Godot 4
  antes de añadirlos. Sigue siendo "amplio, no exhaustivo" — ver el
  README para cómo seguir ampliándolo. Se añadieron dos tests de
  verificación puntual (`completions.test.mjs`, `hover.test.mjs`); el
  resto de la cobertura depende de los tests genéricos ya existentes
  para `classOptions`/`HOVER_INDEX`, ya que esto no tocó el código que
  convierte `ENGINE_CLASSES` en entradas de autocompletado/hover.
  `npm test`: 151/151 en verde.
  **Actualización: confirmado funcionando en un dispositivo real.**

## 0.2.0

- **Nuevo: el autocompletado y el hover ahora incluyen tus propias
  declaraciones de `func`/`var`/`const`/`signal`/`class_name` en el
  archivo actual.** Hasta ahora el plugin solo conocía datos curados a
  mano (`classes.js`/`globals.js`/`members.js`) — escribir
  `func take_damage(amount): ...` en tu propio script y luego teclear
  `take_d` en otro punto no ofrecía nada, y pasar el cursor sobre
  `take_damage` tampoco mostraba nada. Nuevo módulo
  `document-symbols.js`: escanea el texto del documento actual (regex
  por líneas, no un parser) y extrae esos cinco tipos de declaración;
  tanto `completions.js` como `hover.js` lo consumen, y los símbolos
  propios tienen prioridad sobre los curados si hay coincidencia de
  nombre. Los símbolos propios llevan `boost: 1` en la lista de
  autocompletado (igual que los snippets), así que aparecen cerca de
  arriba en vez de mezclados con las palabras clave. Los comentarios y
  las strings (simples y triples) se enmascaran antes de escanear, para
  que un "func"/"var" suelto dentro de una string multilínea (p.ej.
  texto de diálogo embebido) no se confunda con una declaración real.
  Ver "Limitaciones conocidas" en el README para lo que el escaneo no
  cubre (firmas de función multilínea, resolución de alcance). 25 tests
  nuevos en `test/document-symbols.test.mjs`, más tests nuevos/
  actualizados en `completions.test.mjs` y `hover.test.mjs`
  (`npm test`: 149/149 en verde). **Actualización: confirmado
  funcionando en un dispositivo real.**
- **Cambio de comportamiento en un test (intencional):** el test de
  hover que afirmaba que un identificador propio del usuario siempre
  devuelve `null` se reescribió — eso solo era cierto porque el plugin
  no tenía forma de reconocer declaraciones propias. Ahora devuelve
  correctamente info para un identificador declarado en el archivo, y
  sigue devolviendo `null` para uno que no está declarado en ningún
  punto del documento.

## 0.1.5

- **Arreglo: la indentación anidada no escalaba más allá del primer
  nivel.** Reportado tras usar en un dispositivo real el arreglo de
  indentación de 0.1.3: `func x():` + Enter indentaba bien, pero un
  segundo nivel de anidamiento (p.ej. un `if` dentro de esa función) se
  quedaba a la misma profundidad que la línea anterior en vez de bajar un
  nivel más. Causa: `indent.js` asumía que un carácter de tab literal
  (`"\t"`) representaba "un nivel", y contaba repeticiones de ese
  carácter — pero el primer nivel nunca necesita leer nada de vuelta
  (solo devuelve `context.unit` en columnas), mientras que el segundo sí
  necesita leer la indentación de la línea anterior, y si Acode
  representa un nivel con espacios en vez de un tab literal (la propia
  convención de Godot: 4 espacios como alternativa a tabulación), ese
  conteo no encontraba tabs, devolvía null, y CodeMirror caía a su
  comportamiento por defecto (copiar la línea anterior tal cual, sin
  profundizar) — la indentación se quedaba "atascada" en el primer nivel.
  Rediseñado (v3): ya no asume qué carácter representa un nivel.
  `trackLine()` ahora guarda el texto de indentación crudo de cada línea;
  `gdscriptIndent()` lo convierte a columnas usando `context.unit` (el
  ancho real de nivel configurado) justo en el momento en que ese valor
  está disponible, en vez de adivinarlo durante la tokenización. Validado
  con tests nuevos que reproducen el escenario exacto reportado
  (anidamiento con espacios, no tabs) y, contra el build real con
  esbuild, ejecutando `parser.token()`/`copyState()`/`indent()` tal cual
  los invoca CodeMirror a través de varios niveles de anidamiento.
- **Arreglo: el parámetro de una lambda (o el siguiente identificador sin
  relación) podía etiquetarse por error como definición de función.**
  Encontrado en una auditoría de código del tokenizador, no reportado por
  el usuario. `afterDeclKeyword` (usado para etiquetar el nombre justo
  tras `func`/`class`/`var`/`const`) nunca se limpiaba cuando la palabra
  clave de declaración NO iba seguida de un nombre — lo cual solo pasa
  con `func` usado como lambda anónima (`var f = func(x): ...`) o un
  `enum { A, B }` anónimo. La marca quedaba "pegada" hasta que apareciera
  el siguiente identificador en cualquier parte — el propio primer
  parámetro de la lambda, en el caso común — y se etiquetaba como
  `functionName` en vez de un nombre normal. Arreglado replicando el
  patrón que ya existía para `afterDot`: soltar la marca en cuanto lo que
  sigue (tras saltar cualquier espacio) no es el principio de un
  identificador. Las funciones con nombre no se ven afectadas (tests de
  regresión incluidos).
- **Arreglo (bonus, misma familia de bug que la duplicación de "func"
  arreglada en 0.1.4): `var (export)`/`var (onready)` ya no producen
  `var @export var ...`.** Sus plantillas empiezan por
  `@export`/`@onready`, no por `"var "`, así que la técnica anterior de
  "recortar el prefijo compartido" no aplicaba aquí — en su lugar, cuando
  lo escrito tras `var ` parece que podría ir hacia "export" u "onready",
  el rango a reemplazar se extiende hacia atrás para cubrir también el
  `var ` ya escrito, de forma que la plantilla correcta lo sustituye
  entero en vez de insertarse después. Una declaración de variable normal
  (`var health`) no se ve afectada — la rama nueva solo se activa cuando
  lo escrito es un prefijo plausible de "export" u "onready".
- **Nuevo: tooltip al pasar el cursor sobre símbolos conocidos**
  (`src/language/hover.js`). Pasar el cursor sobre una clase del motor,
  función/constante global, miembro común, o tipo básico ahora muestra un
  tooltip pequeño reutilizando el mismo texto `info`/`detail` que ya se
  usa en el autocompletado — no es contenido nuevo, solo un sitio nuevo
  donde mostrarlo. Acotado a propósito: solo símbolos de los que
  realmente tenemos datos curados (no hay inferencia de tipos real, así
  que una variable propia del usuario no mostrará nada). **Aviso
  importante:** el `hoverTooltip` de CodeMirror escucha eventos de hover
  del ratón; en una pantalla táctil sin ratón/lápiz conectado, puede que
  simplemente nunca se dispare, dependiendo de si la WebView de Acode
  sintetiza eventos de hover para una pulsación mantenida. Esto
  funcionará de forma más fiable con un ratón externo conectado al
  dispositivo. Por favor confirma en tu configuración real.

## 0.1.4

- **Nuevo estándar del proyecto, sin cambios funcionales:** todo el texto
  del código en `src/` (labels, campos `detail`/`info`, mensajes de
  error, mensajes de log) ahora está en inglés; los comentarios se
  mantienen en español. `README.md`/`CHANGELOG.md` pasan a ser las
  versiones en inglés; `README_ES.md`/`CHANGELOG_ES.md` guardan las
  versiones en español de aquí en adelante. Se actualizaron `plugin.json`
  y `pack-zip.js` para apuntar a los nuevos nombres de archivo
  (referenciaban los antiguos `readme.md`/`changelogs.md`, que ya no
  existen). No se sube versión, porque no cambió ningún comportamiento
  del código — ver las entradas de 0.1.4 de abajo para el arreglo real de
  esta versión.
- **Arreglo: autocompletado de callbacks del motor duplicaba "func"**
  (`func _ready` con espacio + seleccionar → `func func _ready() -> void:`).
  Causa: la plantilla de esos snippets (`func _ready() -> void:\n\tpass`)
  empieza por `"func "`, pero el rango que la fuente de autocompletado
  calculaba para reemplazar solo cubría la última palabra (`matchBefore`
  corta en el espacio) — al insertar la plantilla completa ahí, el
  `"func "` ya escrito y el de la plantilla quedaban los dos. Solo pasaba
  escribiendo con el espacio ("func_ready" sin espacio ya funcionaba bien,
  porque ahí sí se reemplazaba la palabra completa).
  Arreglo: nueva rama en `gdscriptCompletionSource` que detecta
  `func <nombre parcial>` y en ese caso ofrece variantes derivadas de los
  mismos snippets pero SIN el `"func "` inicial (ni en label ni en
  plantilla) — se siguen generando automáticamente a partir de
  `SNIPPETS`, no hay datos duplicados a mano. El caso de escribir el
  nombre del callback desde cero (con o sin `func` pegado) sigue
  ofreciendo la plantilla completa, sin cambios.
  Validado con 8 tests nuevos (incluida una simulación de "cortar en
  `from` y pegar la plantilla", el mismo mecanismo que usa CodeMirror) y,
  contra el build real con esbuild, reproduciendo tu caso exacto
  (`func _ready` con espacio) y el caso que ya funcionaba (`func_ready`
  sin espacio, para no meter una regresión).

## 0.1.3

- **Arreglo de condición de carrera al arrancar Acode** (causa de que un
  `.gd` reabierto quedara a veces en modo "text"): `main.js` ya no importa
  `language/index.js` de forma estática. Ahora `editorLanguages.register(...)`
  se ejecuta sin depender en absoluto de `@codemirror/*`/`@lezer/*`, y solo
  cuando Acode invoca de verdad el loader (es decir, cuando ya necesita el
  modo "gdscript") se hace `import()` dinámico de `language/index.js`, que
  es donde se resuelven esos módulos. Validado con un build real de esbuild
  y un arnés que ejecuta el bundle compilado simulando el runtime de Acode:
  la resolución de CM6/Lezer queda comprobadamente diferida hasta ese punto.
- **Espera corta y reintentable antes de ese `import()`** (`waitForCmRuntime`
  en `main.js`): al verificar el punto anterior en runtime (no solo
  leyendo el código) se descubrió que el `import()` dinámico, tal como lo
  compila esbuild, solo se puede "intentar de verdad" una vez por sesión
  de la app — si ese único intento cae justo en el instante en que Acode
  aún no expone `@codemirror/*`/`@lezer/*`, ya no se recupera solo, ni
  aunque Acode los publique un instante después. `waitForCmRuntime` sondea
  `resolveCmModule(...)` (que sí es reintentable) cada 60ms hasta 4s ANTES
  de disparar ese único intento, para no desperdiciarlo con un fallo
  transitorio de arranque. `resolveCmModule` ahora acepta `{ silent: true }`
  para que esa espera no llene la consola de errores mientras es normal
  que aún no esté listo.
- **Reconciliación de pestañas restauradas**: al iniciar, y en el evento
  `editorManager.on("init-open-file-list", ...)`, se recorren los archivos
  ya abiertos y se fuerza `file.setMode("gdscript")` en cualquier `.gd`/`.gdscript`
  que no lo tenga — repara pestañas que Acode haya podido restaurar antes de
  que el plugin llegara a registrarse.
- (Confirmado, sin cambios de código) El folding de `#region` / `#endregion`
  que pediste ya estaba implementado y cubierto por tests desde la v0.1.0
  (`computeRegionFoldEndIndex` / `tryRegionFold` en `folding.js`), con
  soporte de regiones anidadas y nombre de región opcional, igual que en
  Godot.
- **Indentación automática al pulsar Enter** (`src/language/indent.js`):
  sube un nivel tras una línea que abre bloque (termina en `:`, ignorando
  comentario y un posible `if x: return` de una sola línea); baja un
  nivel tras `pass`/`break`/`continue`/`return` (heurística, como en los
  modos de Python de otros editores); realinea `else`/`elif` con la línea
  que abre el bloque que cierran, incluso con varios niveles de anidamiento.
  Si la indentación de una línea no sigue la convención de tabs del
  proyecto (p.ej. un archivo pegado con espacios), no opina y deja el
  comportamiento por defecto del editor, en vez de arriesgarse a
  estropearla. De paso se corrigió `indentOnInput` (tenía `except`, que es
  de Python — GDScript no tiene excepciones).
  - **Primer intento (roto):** calculaba la indentación consultando
    `context.state.doc`/`context.pos` (la posición de la nueva línea).
    Probado en Acode real, el caso más simple —`func x():` + Enter— no
    indentaba nada. Diagnóstico: `context.pos`, en el momento exacto en
    que CodeMirror calcula la indentación para una línea que Enter
    todavía no ha insertado, casi seguro no apunta donde se asumía
    (CodeMirror simula ese salto de línea de una forma que no se pudo
    verificar sin un Acode real a mano — ver "El punto delicado" más
    abajo).
  - **Rediseño (v2):** ya no se toca `context.pos` ni `context.state.doc`
    en absoluto. El nivel de indentación se mantiene incrementalmente en
    el propio `state` del `StreamParser` (`trackLine()`, llamada desde
    `token()` en `tokenizer.js` al llegar al final de cada línea de
    código real), incluida una pila (`blockStack`) de los bloques `:`
    todavía abiertos para el realineado de `else`/`elif`. `indent()` solo
    lee ese `state` — que CodeMirror garantiza que refleja todo lo
    tokenizado hasta el final de la línea anterior — y usa `context.unit`
    únicamente para convertir el nivel en columnas. Se añadió
    `copyState()` explícito (antes no existía) para clonar `blockStack`
    correctamente entre líneas.
  - Validado con 33 tests (incluidos varios de integración real usando
    `gdscriptStreamParser.token()`/`copyState()`/`indent()` tal cual los
    invoca CodeMirror, no solo simulados a mano) y, contra el build real
    con esbuild, reproduciendo el caso exacto reportado
    (`func _mi_funcion():` + Enter). Aun así, `context.unit` sigue siendo
    una suposición sobre la API de `IndentContext` que no se pudo
    verificar sin acceso a un Acode real — confírmalo con el mismo
    archivo que falló antes.

## 0.1.0

- Primera versión: resaltado de sintaxis, autocompletado (palabras clave, tipos,
  anotaciones, clases/nodos comunes, funciones/constantes globales, miembros
  comunes tras "."), snippets y folding por indentación para GDScript 4.x.
