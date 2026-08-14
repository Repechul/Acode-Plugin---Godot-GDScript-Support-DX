# Godot - GDScript Support DX — Documentación Extendida

> Esta es la documentación extendida/para desarrolladores: arquitectura,
> internals de runtime, cómo ampliar los datos curados, y limitaciones
> conocidas. Para una descripción breve (en inglés), ver
> [README.md](https://github.com/Repechul/Acode-Plugin---Godot-GDScript-Support-DX/blob/main/acode-gdscript-src/acode-gdscript/README.md).
> También disponible en inglés: [README_EXT.md](https://github.com/Repechul/Acode-Plugin---Godot-GDScript-Support-DX/blob/main/acode-gdscript-src/acode-gdscript/README_EXT.md).

Soporte de GDScript 4.x para Acode 1.12.x+ (motor CodeMirror 6): resaltado de
sintaxis, autocompletado (palabras clave, anotaciones — con tabstops de
parámetros para las que los necesitan, desde 0.7.0 — tipos, clases/nodos
comunes de Godot, funciones y constantes globales, miembros comunes tras
`.`, y — desde 0.2.0 — tus propias funciones/variables/constantes/señales/
class_name declaradas en el archivo actual), snippets, folding de código
por indentación/`#region`, indentación automática al pulsar Enter,
tooltips al mantener el cursor sobre un símbolo (hover), y — desde 0.5.0 —
ayuda de firma (signature help) mientras escribís una llamada a función.

## Estado del proyecto

Versión 0.9.2. El tokenizador, el folding, los datos de autocompletado, el
escaneo de símbolos del documento, y la detección de llamada/argumento de
la ayuda de firma tienen tests automáticos (`npm test`) y pasan. Además,
todas las versiones hasta la 0.5.0 se confirmaron funcionando en un
dispositivo real, incluida la parte conectada a mano con `StateField`/
`showTooltip` detrás de la ayuda de firma (los 8 escenarios del script de
prueba manual) que los tests automáticos por sí solos no podían
garantizar del todo. Los cambios de tags de tokenizer/highlighting de
0.9.2 (ver `CHANGELOG_ES.md`) están cubiertos por tests de regresión
nuevos pero, a diferencia de versiones anteriores, todavía no se
confirmaron contra un build real de esbuild ni en un dispositivo real.
Aun así, los tests automáticos solo prueban la lógica de forma aislada —
ver la sección "El punto delicado: los shims de runtime" abajo antes de
instalar un build que este README no haya señalado específicamente como
probado en dispositivo, y "Limitaciones conocidas" abajo para lo que es
un límite de alcance deliberado y no un riesgo abierto.

## Instalación (para usar el plugin)

1. `npm install`
2. `npm run build` → genera `dist/main.js`
3. `npm run zip` → genera un `.zip` instalable
4. En Acode: Ajustes → Plugins → "+" → Local → selecciona el `.zip`

También puedes usar `npm run dev` (servidor local con recarga) y añadir el
plugin como "Remote" en Acode apuntando a `http://<tu-ip>:3000`, útil
mientras depuras en tu propio dispositivo/emulador.

## Antes de nada: personaliza `plugin.json`

Cambia `id` (usa tu propio dominio/nombre inverso, p. ej.
`com.tuusuario.gdscript`), `author.name`, `author.email` y, si quieres,
`author.github`. El `id` debe ser único y coincide con el que usa
`src/main.js` (constante `PLUGIN_ID`) — si lo cambias en uno, cámbialo en
el otro.

## El punto delicado: los shims de runtime

Acode ya carga su propia copia de `@codemirror/*` y `@lezer/*`. Si este
plugin empaquetara **su propia** copia de esos paquetes (lo normal al
hacer `npm install @codemirror/language` y bundlear), las comprobaciones
de identidad internas de CodeMirror 6 (Facets, StateFields) fallarían en
silencio: el resaltado, el folding o el autocompletado no se aplicarían,
sin ningún error visible obvio.

Por eso este plugin **no** instala esos paquetes como dependencias reales.
En su lugar:

- Cada archivo de `src/runtime/` intenta obtener, vía
  `acode.require("@codemirror/language")` (y variantes), la **misma
  instancia** que ya usa Acode. Esto es exactamente el patrón que usa el
  plugin oficial `Acode-Foundation/acode-additional-langmodes`.
- **Esa resolución es perezosa a propósito.** `main.js` ya no importa
  `src/language/index.js` de forma estática: lo hace con `import()`
  dinámico, dentro del `loader` que se pasa a `editorLanguages.register(...)`.
  Gracias a eso, `register()` (que es lo que hace que Acode reconozca la
  extensión `.gd`) se ejecuta **sin tocar ningún módulo de CodeMirror/Lezer**,
  y solo cuando Acode invoca ese loader — es decir, cuando de verdad hace
  falta el modo "gdscript" para un archivo — se resuelven esos módulos.
  Esto elimina la condición de carrera de arranque que antes podía dejar
  toda la carga del plugin abortada si `acode.require(...)` no estaba
  listo en el instante exacto en que Acode evaluaba el script del plugin
  (típicamente al reabrir la app con un `.gd` ya abierto de antes).
- **Antes de disparar ese `import()`, se espera activamente (con reintentos)
  a que `@codemirror/language`/`@lezer/highlight` estén listos**
  (`waitForCmRuntime` en `main.js`, hasta 4s, sondeando cada 60ms). Esto
  hizo falta porque, al verificarlo con un build real y ejecutando el
  bundle compilado (no solo leyendo el código), se comprobó que ese
  `import()` dinámico solo se puede intentar de verdad **una vez** por
  sesión de la app tal como lo compila esbuild — si ese único intento cae
  justo en el instante en que Acode aún no publicó esos módulos, no se
  recupera solo aunque Acode los publique un instante después. Sondear
  antes con `resolveCmModule` (que sí es reintentable porque solo cachea
  éxitos) evita desperdiciar ese único intento con un fallo transitorio de
  arranque.
- Como red de seguridad adicional para pestañas que Acode restaure de una
  sesión anterior, `main.js` también escucha
  `editorManager.on("init-open-file-list", ...)` y fuerza
  `file.setMode("gdscript")` en cualquier `.gd`/`.gdscript` ya abierto que
  no lo tenga — por si la restauración de pestañas de Acode ocurre antes
  de que este plugin llegue a registrarse.

Esto sigue siendo un **mejor esfuerzo, no una garantía**, en cuanto a qué
nombre exacto usa `acode.require(...)` para exponer los paquetes de
CodeMirror/Lezer en tu versión concreta de Acode — eso no ha cambiado. Si
al instalar el plugin el resaltado o el autocompletado no aparecen:

1. Conecta tu dispositivo/emulador y abre `chrome://inspect` en Chrome de
   escritorio → inspecciona la WebView de Acode.
2. En la consola, busca el error que imprime
   `src/runtime/resolve-cm-module.js` (empieza por `[gdscript] No se pudo
   resolver el módulo...`) — lista los nombres que probó.
3. Explora qué expone Acode, por ejemplo:
   ```js
   Object.keys(acode._modules || acode.modules || {})
   ```
   o revisa el propio código fuente de Acode
   (`Acode-Foundation/Acode` en GitHub) buscando dónde registra
   `"editorLanguages"` para ver si registra también los paquetes de
   CodeMirror con algún nombre.
4. Añade el nombre correcto al principio del array correspondiente en
   `CANDIDATE_ALIASES` dentro de `src/runtime/resolve-cm-module.js` y
   vuelve a compilar.

Si prefieres no depender de esto, la alternativa es contribuir el soporte
de GDScript directamente como módulo dentro de
`Acode-Foundation/acode-additional-langmodes` (ellos ya tienen resueltos
estos shims); lo dejé fuera de este plugin porque pediste un plugin
standalone con marca propia.

## Opcional: `minVersionCode`

`plugin.json` no incluye `minVersionCode` (código mínimo de versión de
Acode) porque no he podido verificar qué valor corresponde exactamente a
1.12.x. Si quieres forzar una versión mínima, consulta
`docs.acode.app/docs/plugin-essentials/manifest` para el valor correcto y
añádelo tú mismo.

## Arquitectura

```
src/
  main.js                 Punto de entrada: acode.setPluginInit/setPluginUnmount,
                           registra "gdscript" vía acode.require("editorLanguages")
  language/
    tokenizer.js           StreamParser (resaltado) + tabla de tags propia
    keywords.js             Palabras clave, anotaciones, tipos básicos
    globals.js               Funciones/constantes de @GDScript y @GlobalScope
    classes.js                 Clases/nodos comunes del motor (alcance "amplio")
    members.js                  Miembros comunes de Node/Object para autocompletar tras "."
    document-symbols.js          Escanea el archivo actual en busca de func/var/
                                  const/signal/class_name propios del usuario (0.2.0)
    snippets.js                    Snippets con tabstops (func, _ready, if, for, match...)
    completions.js                   Fuente de autocompletado que combina todo lo anterior
    folding.js                         Folding por indentación y por #region/#endregion (foldService)
    indent.js                            Indentación automática al pulsar Enter (indent() del StreamParser)
    hover.js                               Tooltip sobre símbolos conocidos (datos curados +
                                            document-symbols.js; los propios tienen prioridad)
    signature-help.js                        Ayuda de firma mientras se escribe una llamada:
                                              qué función, qué argumento (StateField + showTooltip)
    index.js                                   Ensambla StreamLanguage + LanguageSupport
  runtime/
    resolve-cm-module.js    Resolutor best-effort (ver sección de arriba)
    codemirror-*.js          Shims que reexportan desde el runtime de Acode
    lezer-*.js
test/
  mock-acode.mjs           Mock de `acode` + de los módulos CM/Lezer para testear con Node
  fake-stream.mjs           Mock mínimo de StringStream
  *.test.mjs                 Tests (tokenizer, folding, completions, símbolos del documento,
                              ayuda de firma, integración)
```

## Cómo ampliar los datos

Todo el conocimiento de GDScript vive en simples arrays/objetos de datos,
pensados para editarse sin tocar lógica:

- **Más palabras clave/anotaciones/tipos** → `src/language/keywords.js`
- **Más funciones o constantes globales** → `src/language/globals.js`
  (añade `{ name, params, detail, info }`)
- **Más clases/nodos del motor** → `src/language/classes.js`
  (añade `{ name, info }`) — el alcance actual es "amplio" (núcleo +
  nodos 2D/3D/UI comunes), no la API completa de Godot (serían varios
  cientos de clases). Si quieres ampliarlo, la fuente más fiable es el
  volcado XML de `doc/classes/*.xml` del propio repositorio de Godot.
- **Más miembros tras "."** → `src/language/members.js`. Ten en cuenta que
  el plugin no hace inferencia de tipos real: siempre ofrece el mismo
  conjunto curado, independientemente del tipo real de la expresión.
- **Más snippets** → `src/language/snippets.js` (formato
  `${n:placeholder}` de `@codemirror/autocomplete`)

Los tooltips al pasar el cursor (`hover.js`) se construyen automáticamente
a partir de los campos `info`/`detail` de
`classes.js`/`globals.js`/`members.js`/`keywords.js` — ampliar cualquiera
de esos archivos también amplía lo que cubre el hover, sin ningún paso
aparte.

Tus propias declaraciones de `func`/`var`/`const`/`signal`/`class_name`
no necesitan ningún dato curado: `document-symbols.js` escanea
directamente el texto del archivo actual y alimenta tanto el
autocompletado como el hover automáticamente (ver "Limitaciones
conocidas" abajo para lo que este escaneo hace y no hace).

## Ejecutar los tests

```
npm test
```

Corre `node --test test/*.test.mjs`. Los tests usan un mock de `acode` y
de los paquetes de CodeMirror/Lezer, así que verifican la lógica propia
(tokenizador, folding, datos de autocompletado) pero **no** sustituyen a
probar el plugin de verdad en Acode.

## Limitaciones conocidas

- El autocompletado tras "." no infiere el tipo real de la expresión;
  ofrece un conjunto curado de miembros comunes de Node/Object.
- La indentación automática al pulsar Enter (`indent.js`) sube/baja de
  nivel por heurística de texto (`:` al final de línea,
  `pass`/`break`/`continue`/`return`, realineado de `else`/`elif`), igual
  que hacen los modos de Python de otros editores — no es un parser real,
  así que hay casos raros que no acierta (p.ej. un `pass` que de verdad no
  es la última sentencia del bloque). **Nota de diseño (v3, 0.1.5):** no
  asume qué carácter representa "un nivel" — guarda el texto de
  indentación crudo de cada línea y solo lo convierte a columnas usando
  `context.unit` (el ancho real de nivel configurado) en el momento en
  que ese valor está disponible dentro de `indent()`, no mientras
  tokeniza. Esto evita depender de `context.state.doc`/`context.pos` (ver
  la entrada del changelog de 0.1.3 sobre por qué la primerísima versión
  de esto se rompió en un dispositivo real) y funciona igual con tabs,
  espacios, o (dentro de una misma línea) una mezcla.
- El conjunto de clases del motor es "amplio" pero no exhaustivo (ver
  arriba cómo ampliarlo).
- Los tooltips al pasar el cursor (`hover.js`) cubren tanto los datos
  curados (clases/globals/miembros/tipos) **como**, desde 0.2.0, tus
  propias declaraciones en el archivo actual (`document-symbols.js`) —
  pero sigue sin haber inferencia de tipos real: pasar el cursor por
  `enemy` en `enemy.queue_free()` no te dirá que es un `Enemy`, solo
  reconoce el identificador `enemy` en sí si está declarado en algún
  punto del archivo. También depende del `hoverTooltip` de CodeMirror,
  que escucha el hover del ratón; en una pantalla táctil sin ratón/lápiz
  conectado puede que no se dispare nunca, dependiendo de si la WebView
  de Acode sintetiza eventos de hover para una pulsación mantenida. Más
  fiable con un ratón externo conectado al dispositivo.
- **Escaneo de símbolos del documento (`document-symbols.js`, 0.2.0)** —
  alimenta tanto el autocompletado como el hover para tus propios
  `func`/`var`/`const`/`signal`/`class_name`. Es un escaneo por líneas
  con regex, no un parser, así que:
  - Las firmas de función multilínea no se reconocen (todo
    `func nombre(...) -> Tipo:` debe caber en una sola línea); si no se
    encuentra el `)` de cierre en la misma línea, la función igual puede
    aparecer en el autocompletado (solo el nombre, sin detalle de
    parámetros/retorno) pero no en todos los casos — ver los tests de
    `test/document-symbols.test.mjs` para el comportamiento exacto de
    ese respaldo.
  - Sin resolución de alcance (scope): una variable local declarada
    dentro de una función se ofrece en todo el archivo, igual que un
    miembro de clase. Es una lista plana de "cosas declaradas en este
    archivo", no una tabla de símbolos real.
  - Los comentarios y las strings (simples y triples) se enmascaran
    antes de escanear (para que un "func" suelto dentro de una string
    multilínea no se confunda con una declaración real) — es
    best-effort, no una copia completa del manejo de strings/comentarios
    de `tokenizer.js`.
- **Ayuda de firma (`signature-help.js`, 0.5.0)** — muestra los
  parámetros de la función/método en la que está el cursor, usando los
  mismos datos curados `params` que el autocompletado (más tus propias
  funciones de `document-symbols.js`). Aplican las mismas limitaciones
  de "sin inferencia de tipos real", más las propias:
  - **Confirmada funcionando en un dispositivo real** (los 8 escenarios
    del script de prueba manual — llamadas anidadas, llamadas
    multilínea, las funciones propias con prioridad sobre las curadas,
    el tooltip apareciendo/actualizándose en vivo mientras se escribe, y
    correctamente *sin* aparecer en los casos de abajo). A diferencia de
    todo lo demás, esto está conectado a mano con un `StateField` crudo
    + el método `.computeN()` del facet `showTooltip` — todo lo demás
    pasa por un helper de más alto nivel de CodeMirror (`StreamLanguage`,
    `foldService`, `hoverTooltip`) — siguiendo el patrón documentado
    oficialmente por CodeMirror para "tooltips que siguen al cursor". Los
    tests automáticos solo podían demostrar la lógica de detección de
    llamada/argumento y que la conexión llama a las funciones correctas,
    no que `showTooltip.computeN()` se comporta dentro del CodeMirror
    real de Acode exactamente como describe la documentación — esa parte
    ahora está respaldada por la prueba en dispositivo de arriba, no solo
    por los mocks.
  - Los constructores (`Vector2(...)`, `Color(...)`, etc.) no muestran
    nada — de esos solo existen los nombres en `BUILTIN_TYPES`, sin
    datos de parámetros curados.
  - Si el cursor está dentro de un array/diccionario literal que es a su
    vez uno de los argumentos de la llamada (p.ej. `foo([1, 2, |])`), no
    se muestra la firma de la llamada externa — decisión deliberada,
    para mantener simple la lógica de detección (`findActiveCall()` en
    `signature-help.js`) en vez de intentar "ver a través" de literales
    anidados.
  - Las llamadas sin parámetros no muestran ningún tooltip (no hay nada
    útil que resaltar).
- **Anotaciones (`ANNOTATIONS` en `keywords.js`, 0.7.0)** — las
  anotaciones `@export_*` con parámetros ahora insertan un snippet con
  tabstops (`@export_range(min, max, step)`) en vez de solo el nombre
  suelto, y pasar el cursor sobre una anotación ahora muestra qué hace
  (ambas cosas faltaban antes de 0.7.0 — las anotaciones eran
  autocompletados de solo nombre, sin ningún soporte de hover). Las de
  aridad variable (`@export_enum`, `@export_flags`,
  `@export_node_path`, `@warning_ignore*`) reciben un *único* tabstop
  precargado con texto de ejemplo (p.ej. `"A", "B", "C"`) en vez de una
  cantidad fija de campos, ya que la cantidad real de argumentos varía.
  Curado, no exhaustivo — el conjunto completo de anotaciones es
  suficientemente chico como para que esto cubra la gran mayoría, pero
  si una versión menor de Godot 4.x más nueva añade alguna que esto
  todavía no conoce, simplemente no se autocompletará. Las constantes
  `PROPERTY_HINT_*` (`GLOBAL_CONSTANTS` en `globals.js`) son un
  subconjunto curado del enum `PropertyHint` (~40 entradas), priorizando
  las que no tienen un `@export_*` más cómodo
  (`PROPERTY_HINT_TYPE_STRING`, `PROPERTY_HINT_EXPRESSION`,
  `PROPERTY_HINT_LINK`, etc.) más las más comunes útiles para un
  `_get_property_list()` manual.
- **`COMMON_MEMBERS` (0.8.0)** deliberadamente NO incluye miembros de
  singletons como `Input`, `Engine`, `OS`, `ProjectSettings` — aunque
  algo como `Input.is_action_pressed()` se use constantemente. Motivo:
  `memberOptions` también se mezcla en `topLevelOptions` (los métodos se
  llaman sin `self.` en GDScript), así que cualquier cosa que se agregue
  aquí aparece TANTO tras un punto COMO suelta, en cualquier parte del
  código. Eso es correcto para `queue_free()` (válido por sí solo, como
  método con self implícito) pero sería engañoso para
  `is_action_pressed()` (solo es válido como
  `Input.is_action_pressed()`, nunca suelto) — ofrecerlo suelto
  sugeriría una llamada inválida como si fuera un método propio del
  script.
- **`GLOBAL_FUNCTIONS` (0.9.0)** recibió su primera revisión de huecos
  desde la base original del proyecto (107 → 118): funciones
  hiperbólicas inversas (`acosh`/`asinh`/`atanh`), `angle_difference`,
  interpolación Bézier/cúbica, conversión de decibelios
  (`db_to_linear`/`linear_to_db`), `is_same`, `get_stack`,
  `error_string`, y las variantes `_with_objects` de
  `bytes_to_var`/`var_to_bytes`. Deliberadamente **no** se añadieron:
  `cubic_interpolate_in_time`/`cubic_interpolate_angle_in_time` —
  funciones reales de @GlobalScope, pero con 8 parámetros cada una
  (tiempo custom por punto de control), demasiado especializadas y
  pesadas para que un snippet aporte valor real; las versiones simples
  `cubic_interpolate`/`cubic_interpolate_angle` cubren el caso común.
- Los shims de runtime siguen siendo best-effort en cuanto al nombre
  exacto que expone `acode.require(...)` — ver la sección dedicada arriba
  — aunque desde 0.1.3 un fallo ahí ya no puede tumbar la carga de todo
  el plugin ni el reconocimiento de la extensión `.gd`.

## Créditos

Arquitectura de build (redirección de `@codemirror/*`/`@lezer/*` a shims
locales) inspirada en el plugin oficial `acode-additional-langmodes` de
Acode-Foundation, adaptada aquí para un plugin standalone.
