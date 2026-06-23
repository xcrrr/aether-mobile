// Rebuild graph.html by swapping in the current graph.config.js.
// The inlined libraries (three, three-spritetext, 3d-force-graph) in graph.html
// are huge and unchanged; only the trailing config IIFE is regenerated here.
//   run: node assets/graph/build.js
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const htmlPath = path.join(dir, 'graph.html');
const configPath = path.join(dir, 'graph.config.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const config = fs.readFileSync(configPath, 'utf8').replace(/\s*$/, '\n');

const marker = '// ---- Aether Second Brain graph config (Obsidian-style) ----';
const idx = html.indexOf(marker);
if (idx < 0) { console.error('config marker not found in graph.html'); process.exit(1); }

const head = html.slice(0, idx);            // ends with "<script>\n"
const tail = '</script>\n</body>\n</html>\n';
fs.writeFileSync(htmlPath, head + config + tail);
console.log('graph.html rebuilt (' + (head.length + config.length + tail.length) + ' bytes)');
