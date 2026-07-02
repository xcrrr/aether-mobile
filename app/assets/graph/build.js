// Build the self-contained Second Brain graph page bundled into the app.
// graph.html = HTML shell + inlined three.min.js + three-forcegraph + scene.
// Run: node assets/graph/build.js
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const threePath = path.join(dir, '../../node_modules/three/build/three.min.js');
const forceGraphPath = path.join(dir, '../../node_modules/three-forcegraph/dist/three-forcegraph.min.js');
const scenePath = path.join(dir, 'knowledge-graph.scene.js');
const outPath = path.join(dir, 'graph.html');

const three = fs.readFileSync(threePath, 'utf8');
const forceGraph = fs.readFileSync(forceGraphPath, 'utf8');
const scene = fs.readFileSync(scenePath, 'utf8');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #181818; overflow: hidden; }
  #c { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>${three}</script>
<script>${forceGraph}</script>
<script>${scene}</script>
</body>
</html>
`;

fs.writeFileSync(outPath, html);
console.log('graph.html rebuilt (' + html.length + ' bytes)');
