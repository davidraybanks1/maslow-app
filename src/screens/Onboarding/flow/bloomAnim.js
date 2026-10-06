// The bloom that pops up and fills with color on the hypotheses screen. A
// framework-free port of the Today screen's Bloom (same packing and lighting
// rules as src/components/Bloom.jsx), built so the screen can drive it beat by
// beat: create() lays the pieces out as bare black shapes, popIn() grows them,
// lightTo() lights them, showFinal() skips straight to the finished state.
// -- Bloom (ported from the app's src/components/Bloom.jsx, Clod layout) --
const BloomAnim = (function () {
  'use strict';
const MODE_ORDER = ['exploration', 'appreciation', 'nourishment', 'survival']

// Lit-mode gradient stops (2 or 3, spread evenly across the radial gradient).
// Exploration is a crisp, glossy white: bright through most of the sphere,
// with a firmer warm-grey edge so it keeps its shape against the paper.
// (The old forest green was ['#2E8A64', '#0C5038'].)
const MODE_LIT = {
  exploration:  ['#FFFFFF', '#FFFFFF', '#C9C4B5'],
  appreciation: ['#C7D4C1', '#9DB394'],
  nourishment:  ['#FFD166', '#F0A800'],
  survival:     ['#FF7A55', '#F03C10'],
}
// Unlit pieces and the core both borrow the exported UNLIT_DARK material
// above (same rich three-stop near-black ModeShapesRow's icons use at full
// strength) rather than a flatter two-stop local colour - same reasoning:
// it's "shiny black", not just dark.

// Pieces, area-weighted so the area units sum per mode to exactly 4:3:2:1.
const MODE_DEFS = [
  { mode: 'exploration',  areas: [1.36, 1.12, 0.88, 0.64] },
  { mode: 'appreciation', areas: [1.26, 0.99, 0.75] },
  { mode: 'nourishment',  areas: [0.84, 0.66, 0.50] },
  { mode: 'survival',     areas: [0.60, 0.40] },
]
// Total area units across the 12 pieces (~9.94) plus the core (1.352 . pi-ish
// weight of 1.82 in the packing-density formula below) ~ 11.8.
const TOTAL_AREA_UNITS = 11.8

function buildPieces() {
  const pieces = []
  let n = 0
  MODE_DEFS.forEach(md => {
    md.areas.forEach(a => {
      pieces.push({ mode: md.mode, a, kind: n % 4, rot: (n * 37) % 50 - 25, seed: n * 1.37 + 0.5 })
      n++
    })
  })
  return pieces
}

// Superellipse + wobble, sampled parametrically (independent rx/ry, unlike
// orbPathD's single-radius polar formula above - that's what lets "good orb"
// and "fine orb" read as slightly flattened rather than perfectly round).
function sp(cx, cy, rx, ry, n, rotDeg, wob, seed, steps = 96) {
  const rot = rotDeg * Math.PI / 180
  let d = ''
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t)
    const k = 1 + wob * (0.5 * Math.sin(3 * t + seed) + 0.3 * Math.sin(5 * t + seed * 2.1) + 0.2 * Math.sin(7 * t + seed * 3.3))
    const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * rx * k
    const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * ry * k
    d += (i ? 'L' : 'M') + (cx + x * Math.cos(rot) - y * Math.sin(rot)).toFixed(1) + ' ' + (cy + x * Math.sin(rot) + y * Math.cos(rot)).toFixed(1)
  }
  return d + 'Z'
}
function pathForPiece(p) {
  switch (p.kind) {
    case 0: return sp(p.x, p.y, p.r, p.r * 0.96, 2.2, p.rot, 0.05, p.seed) // good orb
    case 1: return sp(p.x, p.y, p.r * 0.9, p.r * 0.9, 4, p.rot, 0.02, p.seed) // rounded square
    case 2: return sp(p.x, p.y, p.r, p.r, 2, 0, 0, 0) // circle
    default: return sp(p.x, p.y, p.r, p.r * 0.94, 2.6, p.rot, 0.03, p.seed) // fine orb
  }
}
function pathForCore(core) {
  return sp(core.x, core.y, core.r, core.r * 0.97, 2.2, 0, 0.03, 4.1)
}

// Seeded so the layout is identical on every render for a given (W, H) -
// never Math.random().
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Deterministic gravity packing: seed random init positions, then 420
// iterations of pairwise collision resolution (18% allowed overlap, tighter
// than the Clod spec's original 14% so neighbours interlock with less gap
// between them) + gravity + a light pull to centre (the last 80 iterations
// only relax, no new forces), clamped to the frame/floor throughout. The
// core participates in collisions but never moves itself - all of the
// push-apart goes to the other body. Memoized on (W, H) alone: only the
// lighting depends on fills.
// Overall scale of the mound - pieces and the whole packed shape shrink or
// grow together since every radius derives from this one factor on `u`.
const SIZE_SCALE = 0.85
// How hard pieces get pulled back toward the horizontal centre each settling
// iteration. The Clod spec's original 0.05 fights the sideways push-apart
// from collisions hard enough that the mound piles up tall and narrow near
// the centre instead of spreading; this weaker pull still keeps the pile
// roughly centred overall (so it doesn't drift to one edge) while letting
// collisions carry pieces much further out, which is what actually widens
// the footprint and lets it settle flatter.
const CENTER_PULL = 0.015

function layout(W, H) {
  const u = SIZE_SCALE * Math.min(Math.sqrt(W * H * 0.85 / (Math.PI * TOTAL_AREA_UNITS)), H / 4.6)
  const floor = H - 10
  const core = { x: W / 2, y: floor - 1.35 * u, r: 1.35 * u, pinned: true }

  const pieces = buildPieces()
  pieces.forEach(p => { p.r = Math.sqrt(p.a) * u })

  const rand = mulberry32(11)
  pieces.forEach(p => {
    p.x = W / 2 + (rand() - 0.5) * W * 0.8
    p.y = H / 2 + (rand() - 0.5) * H * 0.6
  })

  const bodies = pieces.concat([core])
  for (let iter = 0; iter < 420; iter++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const bi = bodies[i], bj = bodies[j]
        let dx = bj.x - bi.x, dy = bj.y - bi.y
        let d = Math.sqrt(dx * dx + dy * dy)
        const minD = (bi.r + bj.r) * 0.76
        if (d < minD) {
          if (d < 1e-6) { d = 1e-6; dx = 0.001; dy = 0.001 }
          const nx = dx / d, ny = dy / d
          const overlap = minD - d
          if (bi.pinned || bj.pinned) {
            if (bi.pinned) { bj.x += nx * overlap; bj.y += ny * overlap }
            else { bi.x -= nx * overlap; bi.y -= ny * overlap }
          } else {
            bi.x -= nx * overlap * 0.5; bi.y -= ny * overlap * 0.5
            bj.x += nx * overlap * 0.5; bj.y += ny * overlap * 0.5
          }
        }
      }
    }
    if (iter <= 340) {
      pieces.forEach(p => {
        p.y += 1.4
        p.x += (W / 2 - p.x) * CENTER_PULL
      })
    }
    pieces.forEach(p => {
      p.x = Math.min(W - p.r, Math.max(p.r, p.x))
      p.y = Math.min(floor - p.r, Math.max(p.r, p.y))
    })
  }

  return { pieces, core, floor, u }
}

// Rounds out the mound's right side: a few small-to-medium, mode-less accent
// pieces - sized the same way as the real mode pieces (area units through
// the same `u` scale), not shrunk-down marbles - dropped in between the
// current right-side dome peak and the lower-right anchor piece, then
// settled by gravity/collision against the already-fixed mound so the whole
// right profile reads as one continuous curve instead of stepping down to a
// single low piece with a gap above it. These never light (no mode, no
// progress of their own) and are purely compositional, the same reasoning
// as the old petal cluster's PLOT_FILLER clumps. The real pieces and core
// are treated as fixed obstacles here - only the filler itself moves - so
// this never disturbs the already-settled main layout; it's still fully
// deterministic, just a second, smaller settle pass run against the first
// one's result.
function buildFiller(pieces, core, W, floor, u) {
  const rightHalf = pieces.filter(p => p.x > W / 2)
  const domePeak = rightHalf.reduce((a, p) => (p.y < a.y ? p : a))
  const rightmost = pieces.reduce((a, p) => (p.x + p.r > a.x + a.r ? p : a))
  const obstacles = pieces.concat([core])

  const targetX = (domePeak.x + rightmost.x) / 2 + rightmost.r * 0.25
  const areas = [0.72, 0.56, 0.44]
  const filler = areas.map((a, i) => ({
    r: Math.sqrt(a) * u,
    x: targetX + (i - 1) * u * 0.25,
    y: domePeak.y - u * (1.2 + i * 0.35),
    kind: (i + 1) % 4, rot: (i * 41) % 50 - 25, seed: i * 1.91 + 0.9,
  }))

  const bodies = obstacles.concat(filler)
  for (let iter = 0; iter < 240; iter++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = 0; j < filler.length; j++) {
        const bj = filler[j]
        if (bodies[i] === bj) continue
        const bi = bodies[i]
        let dx = bj.x - bi.x, dy = bj.y - bi.y
        let d = Math.sqrt(dx * dx + dy * dy)
        const minD = (bi.r + bj.r) * 0.74
        if (d < minD) {
          if (d < 1e-6) { d = 1e-6; dx = 0.001; dy = 0.001 }
          const nx = dx / d, ny = dy / d
          const overlap = minD - d
          if (obstacles.includes(bi)) { bj.x += nx * overlap; bj.y += ny * overlap }
          else { bi.x -= nx * overlap * 0.5; bi.y -= ny * overlap * 0.5; bj.x += nx * overlap * 0.5; bj.y += ny * overlap * 0.5 }
        }
      }
    }
    filler.forEach(p => {
      p.y += 1.3
      p.x += (targetX - p.x) * 0.02
    })
    filler.forEach(p => {
      p.x = Math.min(W - p.r, Math.max(p.r, p.x))
      p.y = Math.max(p.r, Math.min(floor - p.r, p.y))
    })
  }

  return filler
}

// Lighting rule - smallest to largest, area-honest: a piece lights once the
// mode's fill covers at least half of that piece's own area, so lit area
// tracks fill, quantized to the nearest piece. Returns a boolean array
// aligned to `pieces` rather than mutating them, so the memoized layout
// stays a pure function of (W, H).
function computeLit(pieces, fillByMode) {
  const byMode = {}
  pieces.forEach((p, i) => { (byMode[p.mode] ||= []).push({ i, a: p.a }) })
  const lit = new Array(pieces.length).fill(false)
  Object.keys(byMode).forEach(mode => {
    const list = byMode[mode].slice().sort((x, y) => x.a - y.a)
    const modeTotal = list.reduce((s, p) => s + p.a, 0)
    const fill = Math.max(0, Math.min(1, fillByMode[mode] || 0))
    let cum = 0
    list.forEach(({ i, a }) => {
      lit[i] = (cum + a / 2) <= fill * modeTotal
      cum += a
    })
  })
  return lit
}


  // -- Animated port ------------------------------------------------------
  var SVGNS = 'http://www.w3.org/2000/svg';
  var UNLIT_DARK = ['#4A453E', '#191612', '#060505'];
  var DIMS = { plot: { w: 280, h: 220 } };

  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function radial(defs, id, stops) {
    var g = el('radialGradient', { id: id, cx: '0.34', cy: '0.26', r: '0.55' }, defs);
    stops.forEach(function (s) { el('stop', { offset: s[0], 'stop-color': s[1] }, g); });
  }

  // Builds the Today screen's Bloom (the "plot" variant) as bare black
  // shapes, hidden, and hands back handles to pop them in and light them.
  function create(container, uid) {
    var W = DIMS.plot.w, H = DIMS.plot.h;
    var L = layout(W, H);
    var pieces = L.pieces, core = L.core;
    var filler = buildFiller(pieces, core, W, L.floor, L.u);

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'The bloom' }, container);
    svg.style.cssText = 'width:100%;height:auto;display:block;overflow:visible';
    var defs = el('defs', {}, svg);
    MODE_ORDER.forEach(function (mode) {
      var lit = MODE_LIT[mode];
      radial(defs, 'lg-' + mode + '-' + uid, lit.map(function (c, i) { return [(i / (lit.length - 1)) * 100 + '%', c]; }));
    });
    radial(defs, 'ug-' + uid, [['0%', UNLIT_DARK[0]], ['45%', UNLIT_DARK[1]], ['100%', UNLIT_DARK[2]]]);

    var drawable = pieces.map(function (p, i) { return { p: p, filler: false, idx: i }; })
      .concat(filler.map(function (p) { return { p: p, filler: true, idx: -1 }; }))
      .sort(function (a, b) { return a.p.y - b.p.y; });

    var root = el('g', {}, svg);
    var items = drawable.map(function (d) {
      var g = el('g', {}, root);
      g.style.transformBox = 'fill-box';
      g.style.transformOrigin = '50% 85%';
      g.style.opacity = '0';
      g.style.transform = 'translateY(16px) scale(.15)';
      var pd = pathForPiece(d.p);
      el('path', { d: pd, fill: 'url(#ug-' + uid + ')' }, g);
      var litPath = null;
      if (!d.filler) {
        litPath = el('path', { d: pd, fill: 'url(#lg-' + d.p.mode + '-' + uid + ')' }, g);
        litPath.style.opacity = '0';
        litPath.style.transition = 'opacity 760ms cubic-bezier(.2,.7,.2,1)';
      }
      return { g: g, litPath: litPath, d: d };
    });
    // the dark "loam core" at the bottom centre
    var coreG = el('g', {}, root);
    coreG.style.transformBox = 'fill-box';
    coreG.style.transformOrigin = '50% 85%';
    coreG.style.opacity = '0';
    coreG.style.transform = 'translateY(16px) scale(.15)';
    el('path', { d: pathForCore(core), fill: 'url(#ug-' + uid + ')' }, coreG);
    // sits under the pieces in draw order, like the real Bloom
    root.insertBefore(coreG, root.firstChild);

    // Pop order: the core first, then the mound builds from the floor up.
    var popOrder = [{ g: coreG, y: core.y + 1e6 }].concat(items.map(function (it) { return { g: it.g, y: it.d.p.y }; }))
      .sort(function (a, b) { return b.y - a.y; });

    function popIn(stepMs, done) {
      popOrder.forEach(function (o, i) {
        setTimeout(function () {
          o.g.style.transition = 'transform 620ms cubic-bezier(.34,1.56,.64,1), opacity 260ms ease-out';
          o.g.style.opacity = '1';
          o.g.style.transform = 'translateY(0) scale(1)';
        }, i * stepMs);
      });
      if (done) setTimeout(done, popOrder.length * stepMs + 500);
    }

    // Lights pieces one at a time toward the given per-mode fill, smallest to
    // largest within each mode, round-robin across modes.
    function lightTo(fillByMode, stepMs, canceled) {
      var lit = computeLit(pieces, fillByMode);
      var byMode = {};
      pieces.forEach(function (p, i) { if (lit[i]) (byMode[p.mode] = byMode[p.mode] || []).push(i); });
      MODE_ORDER.forEach(function (m) { if (byMode[m]) byMode[m].sort(function (a, b) { return pieces[a].a - pieces[b].a; }); });
      var order = [], more = true;
      while (more) {
        more = false;
        MODE_ORDER.forEach(function (m) { if (byMode[m] && byMode[m].length) { order.push(byMode[m].shift()); more = true; } });
      }
      var byIdx = {};
      items.forEach(function (it) { if (it.d.idx >= 0) byIdx[it.d.idx] = it; });
      order.forEach(function (idx, i) {
        setTimeout(function () {
          if (canceled && canceled()) return;
          var it = byIdx[idx];
          it.litPath.style.opacity = '1';
          if (it.g.animate) {
            it.g.animate(
              [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-3px) scale(1.08)' }, { transform: 'translateY(0) scale(1)' }],
              { duration: 640, easing: 'cubic-bezier(.2,.7,.2,1)' }
            );
          }
        }, i * stepMs);
      });
      return order.length * stepMs;
    }

    // Reduced motion / skipping: show the finished state immediately.
    function showFinal(fillByMode) {
      popOrder.forEach(function (o) { o.g.style.transition = 'none'; o.g.style.opacity = '1'; o.g.style.transform = 'none'; });
      var lit = computeLit(pieces, fillByMode);
      items.forEach(function (it) { if (it.d.idx >= 0 && lit[it.d.idx]) { it.litPath.style.transition = 'none'; it.litPath.style.opacity = '1'; } });
    }

    return { popIn: popIn, lightTo: lightTo, showFinal: showFinal };
  }

  return { create: create };
})();

export default BloomAnim
