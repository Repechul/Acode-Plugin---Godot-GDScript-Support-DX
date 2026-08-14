// Empaqueta plugin.json, dist/main.js, icon.png, README.md (resumen
// corto, el que apunta plugin.json > readme) / README_EXT.md /
// README_EXT_ES.md (documentación extendida) y CHANGELOG.md/
// CHANGELOG_ES.md en un .zip listo para instalar en Acode
// (Settings > Plugins > "+" > Local).
//
// Requiere haber corrido antes `npm run build` (para generar dist/main.js)
// y tener instalada la dependencia de desarrollo "archiver"
// (ya está en package.json → `npm install`).
import fs from "fs";
import path from "path";
import archiver from "archiver";

const pkg = JSON.parse(fs.readFileSync("plugin.json", "utf8"));
const outName = `${pkg.id}-${pkg.version}.zip`;

if (!fs.existsSync("dist/main.js")) {
  console.error('dist/main.js does not exist. Run "npm run build" first.');
  process.exit(1);
}

const output = fs.createWriteStream(outName);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  console.log(`Done: ${outName} (${(archive.pointer() / 1024).toFixed(1)} KB)`);
});
archive.on("warning", (err) => console.warn(err));
archive.on("error", (err) => {
  throw err;
});

archive.pipe(output);

const filesToInclude = [
  "plugin.json",
  "README.md",
  "README_EXT.md",
  "README_EXT_ES.md",
  "CHANGELOG.md",
  "CHANGELOG_ES.md",
  "icon.png",
];
for (const file of filesToInclude) {
  if (fs.existsSync(file)) archive.file(file, { name: file });
}
archive.file("dist/main.js", { name: "dist/main.js" });

archive.finalize();
