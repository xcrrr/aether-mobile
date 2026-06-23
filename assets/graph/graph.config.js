// ---- Aether Second Brain graph config (Obsidian-style) ----
// Loaded AFTER inlined three, three-spritetext, 3d-force-graph.
(function () {
  var el = document.getElementById('graph');

  var highlightNodes = new Set();
  var highlightLinks = new Set();
  var recentIds = new Set();          // facts learned in the latest extraction
  var hasFocus = false;

  // Bright accent for just-learned nodes so they pop out of the cluster.
  var RECENT_COLOR = '#EDE9FE';

  function dim(hex) { return 'rgba(120,120,140,0.12)'; }

  var Graph = ForceGraph3D()(el)
    .backgroundColor('#0B0B0F')
    .showNavInfo(false)
    .nodeRelSize(4)
    .nodeOpacity(0.95)
    .nodeColor(function (n) {
      if (recentIds.has(n.id)) return RECENT_COLOR;     // new facts always glow
      if (!hasFocus) return n.color;
      return highlightNodes.has(n.id) ? n.color : dim(n.color);
    })
    .nodeVal(function (n) {
      // New facts render noticeably larger so they read as "more visible".
      return recentIds.has(n.id) ? (n.val || 1) * 2.4 + 8 : n.val;
    })
    .nodeThreeObjectExtend(true)
    .nodeThreeObject(function (n) {
      var isRecent = recentIds.has(n.id);
      var s = new SpriteText(n.label || n.id);
      s.color = isRecent ? '#FFFFFF' : '#EAEAF0';
      s.textHeight = isRecent ? 6 : 4;
      s.fontWeight = isRecent ? 'bold' : 'normal';
      s.backgroundColor = isRecent ? 'rgba(124,58,237,0.9)' : 'rgba(11,11,15,0.55)';
      s.padding = isRecent ? 2.4 : 1.6;
      s.borderRadius = 2;
      s.position.set(0, isRecent ? 11 : 9, 0);
      return s;
    })
    .linkColor(function (l) {
      if (!hasFocus) return 'rgba(160,160,200,0.35)';
      return highlightLinks.has(l) ? 'rgba(200,200,255,0.9)' : 'rgba(120,120,140,0.06)';
    })
    .linkWidth(function (l) { return hasFocus && highlightLinks.has(l) ? 1.6 : 0.8; })
    .linkDirectionalParticles(function (l) { return hasFocus && highlightLinks.has(l) ? 3 : 1; })
    .linkDirectionalParticleWidth(1.4)
    .linkDirectionalParticleSpeed(0.006)
    .linkLabel('relation')
    .enableNodeDrag(true)
    .onNodeClick(function (n) {
      focusOn(n);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'nodeTap', key: n.id }));
      }
    })
    .onBackgroundClick(clearFocus);

  // Spread the cluster into a rounded ball, like Obsidian's graph.
  if (Graph.d3Force('charge')) Graph.d3Force('charge').strength(-90);
  if (Graph.d3Force('link')) Graph.d3Force('link').distance(36);

  function neighborsOf(node) {
    highlightNodes.clear();
    highlightLinks.clear();
    highlightNodes.add(node.id);
    var data = Graph.graphData();
    (data.links || []).forEach(function (l) {
      var s = typeof l.source === 'object' ? l.source.id : l.source;
      var t = typeof l.target === 'object' ? l.target.id : l.target;
      if (s === node.id || t === node.id) {
        highlightLinks.add(l);
        highlightNodes.add(s);
        highlightNodes.add(t);
      }
    });
  }

  function refresh() {
    Graph.nodeColor(Graph.nodeColor())
      .nodeVal(Graph.nodeVal())
      .linkColor(Graph.linkColor())
      .linkWidth(Graph.linkWidth())
      .linkDirectionalParticles(Graph.linkDirectionalParticles());
  }

  function focusOn(node) {
    hasFocus = true;
    neighborsOf(node);
    refresh();
    var dist = 90;
    var n = node;
    if (n.x != null) {
      var ratio = 1 + dist / Math.hypot(n.x, n.y, n.z || 0.0001);
      Graph.cameraPosition({ x: n.x * ratio, y: n.y * ratio, z: (n.z || 0) * ratio }, n, 800);
    }
    pauseSpin();
  }

  function clearFocus() {
    hasFocus = false;
    highlightNodes.clear();
    highlightLinks.clear();
    refresh();
  }

  // ---- Idle auto-rotate that yields to touch, like Obsidian ----
  var angle = 0, spinning = true, resumeTimer = null, dist = 240;
  setInterval(function () {
    if (!spinning) return;
    angle += 0.0015;
    Graph.cameraPosition({ x: dist * Math.sin(angle), z: dist * Math.cos(angle) });
  }, 30);
  function pauseSpin() {
    spinning = false;
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(function () { spinning = true; }, 4000);
  }
  try {
    var controls = Graph.controls();
    controls.addEventListener('start', pauseSpin);
  } catch (e) {}

  // ---- Category legend (also the color key) ----
  function buildLegend(nodes) {
    var seen = {};
    nodes.forEach(function (n) { if (n.category) seen[n.category] = n.color; });
    var box = document.getElementById('legend');
    if (!box) return;
    var cats = Object.keys(seen);
    box.style.display = cats.length ? 'block' : 'none';
    box.innerHTML = cats.map(function (c) {
      return '<div class="lg-row"><span class="lg-dot" style="background:' + seen[c] + '"></span>' + c + '</div>';
    }).join('');
  }

  // After data lands, if any nodes are freshly learned, frame the camera on them
  // so the new memories are front-and-centre. Delayed so the force layout warms up.
  function frameRecent() {
    if (!recentIds.size) return;
    pauseSpin();
    try {
      Graph.zoomToFit(900, 60, function (n) { return recentIds.has(n.id); });
    } catch (e) {}
  }

  function setData(payload) {
    try {
      var data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      var nodes = data.nodes || [];
      clearFocus();
      recentIds = new Set();
      nodes.forEach(function (n) { if (n.recent) recentIds.add(n.id); });
      Graph.graphData({ nodes: nodes, links: data.links || [] });
      buildLegend(nodes);
      refresh();
      if (recentIds.size) setTimeout(frameRecent, 1400);
    } catch (e) {}
  }

  // RN -> web bridge
  window.__setGraphData = setData;
  window.__focusNode = function (key) {
    var data = Graph.graphData();
    var node = (data.nodes || []).filter(function (n) { return n.id === key; })[0];
    if (node) focusOn(node);
  };
  document.addEventListener('message', function (e) { setData(e.data); });
  window.addEventListener('message', function (e) { setData(e.data); });

  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
})();
