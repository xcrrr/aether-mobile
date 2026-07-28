// Aether Second Brain knowledge globe. Self-contained Three.js scene.
// RN bridge: window.__setGraphData / __focusNode / __clearFocus /
// __resetView / __setPaused / __setReducedMotion / __setViewportPadding.
// postMessage {type:'ready'} | {type:'nodeTap',key} | {type:'clearFocus'} | {type:'error',error}.
//
// Rendering strategy: node meshes are created once per data load and then only
// mutated in place (material swap + scale) on selection changes. Edges are a
// single LineSegments buffer with RGBA vertex colors. graph.refresh() is never
// called — the old refresh path recreated every mesh at the origin with no
// tick left to re-place them, which is what made tapped nodes "disappear".
(function () {
  function post(o) {
    try {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o));
    } catch (e) {}
  }

  window.onerror = function (msg, src, line) {
    post({ type: 'error', error: String(msg) + ' @' + line });
  };

  if (typeof THREE === 'undefined') {
    post({ type: 'error', error: 'THREE undefined' });
    return;
  }
  if (typeof ThreeForceGraph === 'undefined') {
    post({ type: 'error', error: 'ThreeForceGraph undefined' });
    return;
  }

  var BG = '#181818';
  var NODE_DIM = '#5d5b60';
  var NODE_FADE = '#343336';
  var EDGE_NEUTRAL = new THREE.Color('#8A8490');
  var EDGE_DIRECT = new THREE.Color('#CBBFDD');
  var EDGE_NEAR = new THREE.Color('#6D6674');
  var TEXT = '#ECE8F2';
  var AETHER = '#9A87C6';
  var CATEGORY_COLORS = {
    projects: '#8B78B2',
    work: '#718BA1',
    people: '#A77F8A',
    learning: '#AB936A',
    health: '#789B8D',
    travel: '#6F99A3',
    personal: '#8D8393',
    uncategorized: '#737373',
  };

  var canvas = document.getElementById('c');
  var renderer, scene, camera, graph;
  var W = 0, H = 0;
  var nodes = [];
  var links = [];
  var nodeById = {};
  var linksByNode = {};
  var meshByNode = {};
  var selectedKey = '';
  var directNeighbors = {};
  var secondNeighbors = {};
  var paused = false;
  var reducedMotion = false;
  var settled = true;
  var raf = 0;
  var needsRender = true;
  var lastTap = 0;
  var defaultRadius = 360;
  var globalCenter = new THREE.Vector3(0, 0, 0);
  var labelLayer;
  var labelCache = {};
  var labelSprites = {};
  var labelDirty = true;
  var selectedRing;
  var graphReady = false;
  var graphRadius = 22;
  var clusterCenters = {};
  var padTop = 0;
  var padBottom = 0;
  var userAdjusted = false;
  var lastNodeCount = -1;
  var fog;

  var linkLines = null;
  var linkPosAttr = null;
  var linkColAttr = null;

  var cam = {
    theta: 0.76,
    phi: 0.94,
    radius: 120,
    targetRadius: 120,
    target: new THREE.Vector3(0, 0, 0),
    targetGoal: new THREE.Vector3(0, 0, 0),
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function isObject(v) { return v && typeof v === 'object'; }
  function linkSourceId(l) { return isObject(l.source) ? l.source.id : l.source; }
  function linkTargetId(l) { return isObject(l.target) ? l.target.id : l.target; }
  function linkSourceNode(l) { return isObject(l.source) ? l.source : nodeById[l.source]; }
  function linkTargetNode(l) { return isObject(l.target) ? l.target : nodeById[l.target]; }
  function relationStrength(l) { return clamp(l.relationshipStrength == null ? 0.4 : l.relationshipStrength, 0.1, 1); }

  function init() {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    renderer.setClearColor(new THREE.Color(BG), 1);

    scene = new THREE.Scene();
    fog = new THREE.Fog(new THREE.Color(BG), 100, 500);
    scene.fog = fog;
    camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 6000);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    var key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(80, 140, 100);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0xbfd2e6, 0.32);
    fill.position.set(-90, -50, -80);
    scene.add(fill);

    graph = new ThreeForceGraph()
      .nodeId('id')
      .nodeThreeObject(nodeMesh)
      .linkSource('source')
      .linkTarget('target')
      .linkVisibility(false)
      .linkWidth(0)
      .linkDirectionalParticles(0)
      .numDimensions(3)
      .warmupTicks(0)
      .cooldownTicks(160)
      .cooldownTime(2200)
      .d3AlphaDecay(0.045)
      .d3VelocityDecay(0.62)
      .onEngineTick(function () {
        settled = false;
        labelDirty = true;
        updateLinkPositions();
      })
      .onEngineStop(function () {
        settled = true;
        updateLinkPositions();
        frameDefaultView();
        if (!selectedKey && !userAdjusted) {
          cam.targetGoal.copy(globalCenter);
          cam.targetRadius = defaultRadius;
        }
        requestRender();
      });

    graph.d3Force('categoryAnchor', categoryAnchorForce());
    graph.d3Force('globalGravity', globalGravityForce());
    graph.d3Force('containment', containmentForce());
    configureForces();
    scene.add(graph);

    labelLayer = new THREE.Group();
    scene.add(labelLayer);

    selectedRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.05, 8, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(AETHER), transparent: true, opacity: 0.88, depthWrite: false, fog: false }),
    );
    selectedRing.visible = false;
    scene.add(selectedRing);

    applyCamera(true);
    bindInput();
    window.addEventListener('resize', onResize);
    graphReady = true;
    requestFrame();
  }

  function configureForces() {
    try {
      var charge = graph.d3Force('charge');
      if (charge && charge.strength) {
        charge
          .strength(function (n) { return -3.2 - (n.val || 1) * 1.4; })
          .distanceMax(Math.max(30, graphRadius * 1.7))
          .distanceMin(1.5);
      }
      var link = graph.d3Force('link');
      if (link && link.distance) {
        link
          .distance(function (l) { return 4 + (1 - relationStrength(l)) * 10; })
          .strength(function (l) { return 0.3 + relationStrength(l) * 0.6; });
      }
    } catch (e) {}
  }

  function sanitizeNode(n) {
    if (!isFinite(n.x) || !isFinite(n.y) || !isFinite(n.z)) {
      n.x = 0; n.y = 0; n.z = 0;
    }
    if (!isFinite(n.vx) || !isFinite(n.vy) || !isFinite(n.vz)) {
      n.vx = 0; n.vy = 0; n.vz = 0;
    }
  }

  // Pull every node toward its category's cluster center. Low-degree nodes get
  // pulled harder — links aren't holding them anywhere, the cluster should.
  function categoryAnchorForce() {
    var forceNodes = [];
    function force(alpha) {
      for (var i = 0; i < forceNodes.length; i++) {
        var n = forceNodes[i];
        sanitizeNode(n);
        var anchor = clusterCenters[n.category];
        if (!anchor) continue;
        var degree = (linksByNode[n.id] || []).length;
        var strength = (degree < 2 ? 0.055 : 0.022) * alpha;
        n.vx += (anchor.x - n.x) * strength;
        n.vy += (anchor.y - n.y) * strength;
        n.vz += (anchor.z - n.z) * strength;
      }
    }
    force.initialize = function (ns) { forceNodes = ns || []; };
    return force;
  }

  function globalGravityForce() {
    var forceNodes = [];
    function force(alpha) {
      for (var i = 0; i < forceNodes.length; i++) {
        var n = forceNodes[i];
        var strength = 0.016 * alpha;
        n.vx += -n.x * strength;
        n.vy += -n.y * strength;
        n.vz += -n.z * strength;
      }
    }
    force.initialize = function (ns) { forceNodes = ns || []; };
    return force;
  }

  // Firm spherical bound at the globe radius: this is what gives the graph a
  // globe silhouette instead of letting repulsion stretch it into scatter.
  function containmentForce() {
    var forceNodes = [];
    function force(alpha) {
      for (var i = 0; i < forceNodes.length; i++) {
        var n = forceNodes[i];
        sanitizeNode(n);
        var r = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
        var limit = graphRadius;
        if (r > limit && r > 0) {
          var inward = (r - limit) * 0.2 * alpha;
          n.vx -= (n.x / r) * inward;
          n.vy -= (n.y / r) * inward;
          n.vz -= (n.z / r) * inward;
        }
      }
    }
    force.initialize = function (ns) { forceNodes = ns || []; };
    return force;
  }

  var sphereGeo = null;
  var nodeMatCache = {};

  function selectionState(n) {
    if (!selectedKey) return 'base';
    if (n.id === selectedKey) return 'selected';
    if (directNeighbors[n.id]) return 'neighbor';
    if (secondNeighbors[n.id]) return 'second';
    return 'far';
  }

  function materialFor(n) {
    var state = selectionState(n);
    var color = n.color || NODE_DIM;
    var op = n.opacity == null ? 0.95 : n.opacity;
    var emissive = 0.24;
    if (state === 'selected') { op = 1; emissive = 0.5; }
    else if (state === 'neighbor') { op = Math.min(1, op + 0.04); emissive = 0.34; }
    else if (state === 'second') { color = mixHex(color, NODE_DIM, 0.34); op *= 0.8; emissive = 0.14; }
    else if (state === 'far') { color = NODE_FADE; op *= 0.5; emissive = 0.05; }
    var matKey = color + '|' + op.toFixed(2) + '|' + emissive;
    var mat = nodeMatCache[matKey];
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.38,
        metalness: 0.1,
        transparent: true,
        opacity: op,
        emissive: new THREE.Color(color),
        emissiveIntensity: emissive,
      });
      nodeMatCache[matKey] = mat;
    }
    return mat;
  }

  function baseRadius(n) {
    return 1.45 * Math.cbrt(n.val || 1);
  }

  function displayScale(n) {
    var r = baseRadius(n);
    var state = selectionState(n);
    if (state === 'selected') return r * 1.28;
    if (state === 'neighbor') return r * 1.1;
    return r;
  }

  function nodeMesh(n) {
    if (!sphereGeo) sphereGeo = new THREE.SphereGeometry(1, 24, 24);
    var mesh = new THREE.Mesh(sphereGeo, materialFor(n));
    var r = displayScale(n);
    mesh.scale.set(r, r, r);
    meshByNode[n.id] = mesh;
    return mesh;
  }

  function mixHex(a, b, amount) {
    var ca = new THREE.Color(a);
    var cb = new THREE.Color(b);
    ca.lerp(cb, amount);
    return '#' + ca.getHexString();
  }

  function rebuildFocusSets() {
    directNeighbors = {};
    secondNeighbors = {};
    if (!selectedKey) return;
    var firstLinks = linksByNode[selectedKey] || [];
    for (var i = 0; i < firstLinks.length; i++) {
      var l = firstLinks[i];
      var other = linkSourceId(l) === selectedKey ? linkTargetId(l) : linkSourceId(l);
      directNeighbors[other] = true;
    }
    Object.keys(directNeighbors).forEach(function (id) {
      var nodeLinks = linksByNode[id] || [];
      for (var i = 0; i < nodeLinks.length; i++) {
        var l = nodeLinks[i];
        var other = linkSourceId(l) === id ? linkTargetId(l) : linkSourceId(l);
        if (other !== selectedKey && !directNeighbors[other]) secondNeighbors[other] = true;
      }
    });
  }

  // --- Edge layer: one LineSegments draw call, RGBA vertex colors -----------

  function rebuildLinkBuffers() {
    var count = links.length;
    var geo = new THREE.BufferGeometry();
    linkPosAttr = new THREE.BufferAttribute(new Float32Array(count * 6), 3);
    linkPosAttr.setUsage(THREE.DynamicDrawUsage);
    linkColAttr = new THREE.BufferAttribute(new Float32Array(count * 8), 4);
    geo.setAttribute('position', linkPosAttr);
    geo.setAttribute('color', linkColAttr);
    if (!linkLines) {
      var mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
      linkLines = new THREE.LineSegments(geo, mat);
      linkLines.renderOrder = -1;
      linkLines.frustumCulled = false;
      scene.add(linkLines);
    } else {
      linkLines.geometry.dispose();
      linkLines.geometry = geo;
    }
    updateLinkPositions();
    updateLinkColors();
  }

  function updateLinkPositions() {
    if (!linkPosAttr) return;
    var arr = linkPosAttr.array;
    for (var i = 0; i < links.length; i++) {
      var s = linkSourceNode(links[i]);
      var t = linkTargetNode(links[i]);
      var o = i * 6;
      arr[o] = s && isFinite(s.x) ? s.x : 0;
      arr[o + 1] = s && isFinite(s.y) ? s.y : 0;
      arr[o + 2] = s && isFinite(s.z) ? s.z : 0;
      arr[o + 3] = t && isFinite(t.x) ? t.x : 0;
      arr[o + 4] = t && isFinite(t.y) ? t.y : 0;
      arr[o + 5] = t && isFinite(t.z) ? t.z : 0;
    }
    linkPosAttr.needsUpdate = true;
  }

  var tmpColor = new THREE.Color();

  function writeVertexColor(arr, offset, color, alpha) {
    arr[offset] = color.r;
    arr[offset + 1] = color.g;
    arr[offset + 2] = color.b;
    arr[offset + 3] = alpha;
  }

  // Unselected: each edge is a subtle gradient between its endpoint cluster
  // colors pulled toward neutral, alpha scaled by relationship strength — the
  // structure is visible, the strong ties read stronger. Selected: edges of
  // the selected node light up, the rest recede without vanishing.
  function updateLinkColors() {
    if (!linkColAttr) return;
    var arr = linkColAttr.array;
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      var s = linkSourceNode(l);
      var t = linkTargetNode(l);
      var o = i * 8;
      var st = relationStrength(l);
      if (!selectedKey) {
        var alpha = 0.15 + st * 0.33;
        tmpColor.set((s && s.color) || '#8A8490').lerp(EDGE_NEUTRAL, 0.42);
        writeVertexColor(arr, o, tmpColor, alpha);
        tmpColor.set((t && t.color) || '#8A8490').lerp(EDGE_NEUTRAL, 0.42);
        writeVertexColor(arr, o + 4, tmpColor, alpha);
      } else {
        var sid = linkSourceId(l);
        var tid = linkTargetId(l);
        if (sid === selectedKey || tid === selectedKey) {
          writeVertexColor(arr, o, EDGE_DIRECT, 0.92);
          writeVertexColor(arr, o + 4, EDGE_DIRECT, 0.92);
        } else if (directNeighbors[sid] || directNeighbors[tid]) {
          writeVertexColor(arr, o, EDGE_NEAR, 0.3);
          writeVertexColor(arr, o + 4, EDGE_NEAR, 0.3);
        } else {
          writeVertexColor(arr, o, EDGE_NEAR, 0.05);
          writeVertexColor(arr, o + 4, EDGE_NEAR, 0.05);
        }
      }
    }
    linkColAttr.needsUpdate = true;
  }

  // --------------------------------------------------------------------------

  function setData(payload) {
    try {
      var d = typeof payload === 'string' ? JSON.parse(payload) : payload;
      nodes = (d.nodes || []).map(function (n) {
        var next = Object.assign({}, n);
        next.color = next.color || CATEGORY_COLORS[next.category] || CATEGORY_COLORS.uncategorized;
        next.val = clamp(next.val == null ? 0.56 + (next.importance || 0.35) * 1.1 : next.val, 0.42, 2.35);
        return next;
      });
      links = (d.links || []).map(function (l) { return Object.assign({}, l); });
      var layout = d.layout || {};
      graphRadius = isFinite(layout.radius) && layout.radius > 0
        ? layout.radius
        : 8 + 5.5 * Math.cbrt(Math.max(1, nodes.length));
      clusterCenters = {};
      var rawCenters = layout.clusterCenters || {};
      Object.keys(rawCenters).forEach(function (cat) {
        var p = rawCenters[cat];
        if (p && isFinite(p[0]) && isFinite(p[1]) && isFinite(p[2])) {
          clusterCenters[cat] = new THREE.Vector3(p[0], p[1], p[2]);
        }
      });
      if (nodes.length !== lastNodeCount) {
        userAdjusted = false;
        lastNodeCount = nodes.length;
      }
      nodeById = {};
      linksByNode = {};
      meshByNode = {};
      nodes.forEach(function (n) { nodeById[n.id] = n; });
      links.forEach(function (l) {
        var s = linkSourceId(l);
        var t = linkTargetId(l);
        (linksByNode[s] || (linksByNode[s] = [])).push(l);
        (linksByNode[t] || (linksByNode[t] = [])).push(l);
      });
      selectedKey = nodeById[selectedKey] ? selectedKey : '';
      rebuildFocusSets();
      clearLabels();
      graph.graphData({ nodes: nodes, links: links });
      configureForces();
      graph.resetCountdown();
      settled = reducedMotion || nodes.length < 2;
      if (reducedMotion) {
        for (var i = 0; i < 90; i++) graph.tickFrame();
        settled = true;
      }
      rebuildLinkBuffers();
      frameDefaultView();
      if (!selectedKey && !userAdjusted) {
        cam.targetGoal.copy(globalCenter);
        cam.targetRadius = defaultRadius;
      }
      updateStyles();
      requestRender();
    } catch (e) {
      post({ type: 'error', error: 'setData ' + (e && e.message) });
    }
  }

  function clearLabels() {
    Object.keys(labelSprites).forEach(function (key) {
      labelLayer.remove(labelSprites[key]);
    });
    labelSprites = {};
    labelDirty = true;
  }

  // Auto-fit: compute the graph's real 3D bounds and place the camera at the
  // exact distance where the whole globe fills the usable viewport (screen
  // minus the header/status overlays), with a comfortable margin.
  function frameDefaultView() {
    if (!nodes.length) {
      defaultRadius = 120;
      globalCenter.set(0, 0, 0);
      cam.targetGoal.copy(globalCenter);
      cam.targetRadius = defaultRadius;
      return;
    }
    var min = new THREE.Vector3(Infinity, Infinity, Infinity);
    var max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    nodes.forEach(function (n) {
      var x = isFinite(n.x) ? n.x : 0;
      var y = isFinite(n.y) ? n.y : 0;
      var z = isFinite(n.z) ? n.z : 0;
      min.x = Math.min(min.x, x); min.y = Math.min(min.y, y); min.z = Math.min(min.z, z);
      max.x = Math.max(max.x, x); max.y = Math.max(max.y, y); max.z = Math.max(max.z, z);
    });
    globalCenter.copy(min).add(max).multiplyScalar(0.5);
    var maxR = 9;
    nodes.forEach(function (n) {
      var dx = (isFinite(n.x) ? n.x : 0) - globalCenter.x;
      var dy = (isFinite(n.y) ? n.y : 0) - globalCenter.y;
      var dz = (isFinite(n.z) ? n.z : 0) - globalCenter.z;
      var r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      maxR = Math.max(maxR, r + baseRadius(n) * 1.6);
    });
    var fovTan = Math.tan(camera.fov * Math.PI / 360);
    var usableH = Math.max(140, H - padTop - padBottom);
    var effV = fovTan * (usableH / Math.max(1, H));
    var effH = fovTan * camera.aspect * 0.92;
    var dist = (maxR * 1.14) / Math.min(effV, effH);
    defaultRadius = clamp(dist, 24, 900);
  }

  function focusNode(key, notify) {
    var n = nodeById[key];
    if (!n) return;
    selectedKey = key;
    rebuildFocusSets();
    cam.targetGoal.set(n.x || 0, n.y || 0, n.z || 0);
    cam.targetRadius = clamp(defaultRadius * 0.55, 20, 200);
    labelDirty = true;
    updateStyles();
    if (notify) post({ type: 'nodeTap', key: selectedKey });
  }

  function clearFocus(notify) {
    if (!selectedKey) return;
    selectedKey = '';
    rebuildFocusSets();
    cam.targetGoal.copy(globalCenter);
    cam.targetRadius = defaultRadius;
    selectedRing.visible = false;
    labelDirty = true;
    updateStyles();
    if (notify) post({ type: 'clearFocus' });
  }

  function resetView() {
    selectedKey = '';
    userAdjusted = false;
    rebuildFocusSets();
    frameDefaultView();
    cam.theta = 0.76;
    cam.phi = 0.94;
    cam.targetGoal.copy(globalCenter);
    cam.targetRadius = defaultRadius;
    selectedRing.visible = false;
    labelDirty = true;
    updateStyles();
    post({ type: 'clearFocus' });
  }

  // In-place restyle: swap cached materials and rescale existing meshes.
  // Never rebuilds the scene graph, so positions are always preserved.
  function updateStyles() {
    if (!graphReady) return;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var mesh = meshByNode[n.id];
      if (!mesh) continue;
      mesh.material = materialFor(n);
      var s = displayScale(n);
      mesh.scale.set(s, s, s);
    }
    updateLinkColors();
    requestRender();
  }

  var lookTarget = new THREE.Vector3();
  var screenUp = new THREE.Vector3();

  function applyCamera(force) {
    var lerp = reducedMotion || force ? 1 : 0.16;
    cam.radius += (cam.targetRadius - cam.radius) * lerp;
    cam.target.lerp(cam.targetGoal, lerp);
    var r = cam.radius;
    var ph = cam.phi;
    var th = cam.theta;
    camera.position.set(
      cam.target.x + r * Math.sin(ph) * Math.cos(th),
      cam.target.y + r * Math.cos(ph),
      cam.target.z + r * Math.sin(ph) * Math.sin(th),
    );
    camera.lookAt(cam.target);
    // Depth cue: fog thresholds track the camera distance so the far side of
    // the globe always recedes slightly, at any zoom level.
    fog.near = r * 0.85;
    fog.far = r + Math.max(40, graphRadius * 3.2);
    // Center the globe within the band between the header and the status pill:
    // shift the look-at point along screen-up so the visible content lands in
    // the unobstructed part of the viewport.
    var padShift = (padTop - padBottom) / 2;
    if (padShift !== 0 && H > 0) {
      var worldPerPx = (2 * r * Math.tan(camera.fov * Math.PI / 360)) / H;
      screenUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
      lookTarget.copy(cam.target).addScaledVector(screenUp, padShift * worldPerPx);
      camera.lookAt(lookTarget);
    }
    return (
      Math.abs(cam.targetRadius - cam.radius) > 0.1 ||
      cam.target.distanceTo(cam.targetGoal) > 0.1
    );
  }

  function requestRender() {
    needsRender = true;
    requestFrame();
  }

  function requestFrame() {
    if (!raf && !paused) raf = requestAnimationFrame(frame);
  }

  function frame() {
    raf = 0;
    if (paused || !renderer) return;
    var active = !settled;
    if (active) graph.tickFrame();
    var cameraMoving = applyCamera(false);
    if (cameraMoving) labelDirty = true;
    updateSelectionRing();
    if (labelDirty || active || cameraMoving || needsRender) updateLabels();
    if (active || cameraMoving || needsRender) {
      renderer.render(scene, camera);
      needsRender = false;
    }
    if (active || cameraMoving || needsRender) requestFrame();
  }

  function updateSelectionRing() {
    if (!selectedKey || !nodeById[selectedKey]) {
      selectedRing.visible = false;
      return;
    }
    var n = nodeById[selectedKey];
    selectedRing.visible = true;
    selectedRing.position.set(n.x || 0, n.y || 0, n.z || 0);
    selectedRing.quaternion.copy(camera.quaternion);
    var s = Math.max(2.4, displayScale(n) * 1.5);
    selectedRing.scale.set(s, s, s);
  }

  // Texture + on-screen metrics for a label, cached by text and colour. Split
  // from sprite creation so a candidate can be measured and collision-tested
  // before anything is added to the scene.
  function labelInfo(n) {
    var key = n.label + '|' + n.color;
    var cached = labelCache[key];
    if (cached) return cached;
    var dpr = 2;
    var padX = 10;
    var fontSize = 16;
    var cv = document.createElement('canvas');
    var ctx = cv.getContext('2d');
    ctx.font = '500 ' + fontSize + 'px "Instrument Sans", "Roboto", Arial, sans-serif';
    var screenW = Math.ceil(ctx.measureText(n.label).width) + padX * 2;
    var w = Math.ceil(screenW * dpr);
    var h = Math.ceil(26 * dpr);
    cv.width = w;
    cv.height = h;
    ctx.scale(dpr, dpr);
    ctx.font = '500 ' + fontSize + 'px "Instrument Sans", "Roboto", Arial, sans-serif';
    ctx.fillStyle = 'rgba(22,22,24,0.62)';
    roundRect(ctx, 0.5, 0.5, w / dpr - 1, h / dpr - 1, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.stroke();
    ctx.fillStyle = TEXT;
    ctx.textBaseline = 'middle';
    ctx.fillText(n.label, padX, h / dpr / 2 + 1);
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    var info = { tex: tex, screenW: screenW, screenH: h / dpr };
    labelCache[key] = info;
    return info;
  }

  function getLabelSprite(n, info) {
    if (labelSprites[n.id]) return labelSprites[n.id];
    var mat = new THREE.SpriteMaterial({ map: info.tex, transparent: true, depthWrite: false, opacity: 0, fog: false });
    var sp = new THREE.Sprite(mat);
    sp.scale.set(info.screenW * 0.09, info.screenH * 0.09, 1);
    sp.userData = { nodeId: n.id, screenW: info.screenW, screenH: info.screenH };
    labelLayer.add(sp);
    labelSprites[n.id] = sp;
    return sp;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function nodePriority(n) {
    var p = (n.importance || 0.4) * 120 + (n.centralityScore || 0) * 130 + (n.connectionCount || 0) * 2;
    if (n.id === selectedKey) p += 1000;
    else if (directNeighbors[n.id]) p += 520;
    else if (secondNeighbors[n.id]) p += 180;
    return p;
  }

  // How many labels the scene is allowed to draw. This used to be a flat 7 at
  // the default whole-globe framing, so a twenty-memory graph rendered twenty
  // spheres but named only seven of them and read as a seven-memory brain. The
  // budget now tracks the graph's own size; the real limiter is the collision
  // test below, which drops only labels that have nowhere to sit.
  function labelBudget(zoomRatio) {
    if (selectedKey) return 28;
    if (zoomRatio > 0.82) return clamp(nodes.length, 16, 60);
    if (zoomRatio > 0.5) return clamp(nodes.length, 24, 80);
    return Math.max(80, nodes.length);
  }

  function updateLabels() {
    labelDirty = false;
    var zoomRatio = defaultRadius ? cam.radius / defaultRadius : 1;
    var maxLabels = labelBudget(zoomRatio);
    var candidates = nodes.slice().sort(function (a, b) { return nodePriority(b) - nodePriority(a); }).slice(0, Math.min(nodes.length, maxLabels * 3));
    var used = [];
    var visibleIds = {};
    var shown = 0;
    var pos = new THREE.Vector3();

    // Labels render at a constant on-screen size regardless of zoom, so they
    // stay small and readable instead of dwarfing the nodes.
    var worldPerPx = (2 * Math.max(1, cam.radius) * Math.tan(camera.fov * Math.PI / 360)) / Math.max(1, H);

    for (var i = 0; i < candidates.length && shown < maxLabels; i++) {
      var n = candidates[i];
      var nodeR = displayScale(n);
      pos.set(n.x || 0, (n.y || 0) + nodeR + 21 * worldPerPx, n.z || 0);
      var screen = worldToScreen(pos);
      if (!screen || screen.x < -60 || screen.x > W + 60 || screen.y < -40 || screen.y > H + 40) continue;
      var info = labelInfo(n);
      var rect = {
        x: screen.x - info.screenW / 2,
        y: screen.y - info.screenH / 2,
        w: info.screenW,
        h: info.screenH,
      };
      if (n.id !== selectedKey && collides(rect, used)) continue;
      used.push(rect);
      visibleIds[n.id] = true;
      shown += 1;
      var sp = getLabelSprite(n, info);
      var labelScale = worldPerPx * 0.78;
      if (n.id === selectedKey) labelScale *= 1.1;
      sp.scale.set(info.screenW * labelScale, info.screenH * labelScale, 1);
      sp.position.copy(pos);
      sp.material.opacity = n.id === selectedKey ? 1 : directNeighbors[n.id] ? 0.88 : 0.66;
    }

    Object.keys(labelSprites).forEach(function (id) {
      if (!visibleIds[id]) labelSprites[id].material.opacity = 0;
    });
  }

  function worldToScreen(v) {
    var p = v.clone().project(camera);
    if (p.z < -1 || p.z > 1) return null;
    return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H };
  }

  function collides(rect, used) {
    for (var i = 0; i < used.length; i++) {
      var r = used[i];
      if (
        rect.x < r.x + r.w + 8 &&
        rect.x + rect.w + 8 > r.x &&
        rect.y < r.y + r.h + 6 &&
        rect.y + rect.h + 6 > r.y
      ) return true;
    }
    return false;
  }

  function nearestNodeAt(x, y) {
    if (!nodes.length) return null;
    var best = null;
    var bestD = 28 * 28;
    var p = new THREE.Vector3();
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      p.set(n.x || 0, n.y || 0, n.z || 0);
      var s = worldToScreen(p);
      if (!s) continue;
      var d = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
      var tolerance = Math.pow(18 + baseRadius(n) * 1.7, 2);
      var limit = Math.max(bestD, tolerance);
      if (d < limit && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  function bindInput() {
    var sx = 0, sy = 0, st = 0, moved = false, mode = 0, pinch0 = 0, rad0 = 0, lx = 0, ly = 0;
    function dist2(ts) { return Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY); }

    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        mode = 1;
        var t = e.touches[0];
        sx = lx = t.clientX;
        sy = ly = t.clientY;
        st = Date.now();
        moved = false;
      } else if (e.touches.length === 2) {
        mode = 2;
        pinch0 = dist2(e.touches);
        rad0 = cam.targetRadius;
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', function (e) {
      if (mode === 1 && e.touches.length === 1) {
        var t = e.touches[0];
        var dx = t.clientX - lx;
        var dy = t.clientY - ly;
        lx = t.clientX;
        ly = t.clientY;
        if (Math.abs(t.clientX - sx) + Math.abs(t.clientY - sy) > 10) moved = true;
        if (moved) userAdjusted = true;
        cam.theta -= dx * 0.0048;
        cam.phi = clamp(cam.phi - dy * 0.0044, 0.28, Math.PI - 0.28);
        labelDirty = true;
        requestRender();
      } else if (mode === 2 && e.touches.length === 2 && pinch0 > 0) {
        userAdjusted = true;
        cam.targetRadius = clamp(
          rad0 * pinch0 / dist2(e.touches),
          Math.max(16, defaultRadius * 0.3),
          Math.max(160, defaultRadius * 2.2),
        );
        labelDirty = true;
        requestRender();
      }
    }, { passive: true });

    canvas.addEventListener('touchend', function () {
      if (mode === 1 && !moved && Date.now() - st < 360) tapAt(sx, sy);
      mode = 0;
    }, { passive: true });
  }

  function tapAt(x, y) {
    var now = Date.now();
    var n = nearestNodeAt(x, y);
    if (n) {
      focusNode(n.id, true);
      lastTap = 0;
      return;
    }
    if (now - lastTap < 280) resetView();
    else clearFocus(true);
    lastTap = now;
  }

  function onResize() {
    W = window.innerWidth;
    H = window.innerHeight;
    if (!renderer) return;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    labelDirty = true;
    requestRender();
  }

  window.__setGraphData = setData;
  window.__setViewportPadding = function (top, bottom) {
    padTop = isFinite(top) ? Math.max(0, top) : 0;
    padBottom = isFinite(bottom) ? Math.max(0, bottom) : 0;
    if (graphReady) {
      frameDefaultView();
      if (!selectedKey && !userAdjusted) {
        cam.targetGoal.copy(globalCenter);
        cam.targetRadius = defaultRadius;
      }
      labelDirty = true;
      requestRender();
    }
  };
  window.__focusNode = function (key) { focusNode(key, false); };
  window.__clearFocus = function () { clearFocus(false); };
  window.__resetView = resetView;
  window.__setPaused = function (p) {
    paused = !!p;
    if (!paused) requestRender();
  };
  window.__setReducedMotion = function (value) {
    reducedMotion = !!value;
    graph.cooldownTicks(reducedMotion ? 0 : 160).cooldownTime(reducedMotion ? 0 : 2200);
  };

  window.addEventListener('message', function (e) { setData(e.data); });
  document.addEventListener('message', function (e) { setData(e.data); });

  try {
    init();
    post({ type: 'ready' });
  } catch (e) {
    post({ type: 'error', error: 'init ' + (e && e.message) });
  }
})();
