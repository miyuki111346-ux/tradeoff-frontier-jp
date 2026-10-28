// Per-site mobile fixes, appended after the shared patch (or alone when generic is false).
// Each fix only acts at screen widths of 640px or less, so the PC display is unchanged.

const CLIP = '<style>@media (max-width: 640px) { html, body { overflow-x: clip !important; } }</style>';

// Keeps only the tab bar pinned on phones when a tall sticky panel (tabs + search/filters) covers the screen:
// the panel's inner wrapper is shown in reverse order so the tabs sit at the bottom of the panel,
// and the panel's sticky top is moved up so only the tabs stay visible while scrolling.
function pinTabs(pins) {
  return `<script>
(function () {
  var PINS = ${JSON.stringify(pins)};
  var mq = window.matchMedia('(max-width: 640px)');
  function pin(sSel, iSel, bSel) {
    var s = document.querySelector(sSel), i = document.querySelector(iSel), b = document.querySelector(bSel);
    if (!s || !i || !b) return;
    if (!mq.matches) { i.style.removeProperty('display'); i.style.removeProperty('flex-direction'); s.style.removeProperty('top'); return; }
    i.style.setProperty('display', 'flex', 'important');
    i.style.setProperty('flex-direction', 'column-reverse', 'important');
    s.style.setProperty('top', '0px', 'important');
    var off = Math.round(b.getBoundingClientRect().top - s.getBoundingClientRect().top);
    s.style.setProperty('top', (-Math.max(0, off)) + 'px', 'important');
  }
  function run() { PINS.forEach(function (p) { try { pin(p[0], p[1], p[2]); } catch (e) {} }); }
  var t = null;
  function later() { clearTimeout(t); t = setTimeout(run, 200); }
  if (document.readyState === 'complete') { setTimeout(run, 700); setTimeout(run, 2000); }
  else window.addEventListener('load', function () { setTimeout(run, 700); setTimeout(run, 2000); });
  window.addEventListener('resize', later);
  if (mq.addEventListener) mq.addEventListener('change', later);
})();
</script>`;
}

module.exports = {
  'the-richness-of-leaving-things-unsaid': {
    generic: false,
    html: '<style>@media (max-width: 640px) { header h1 { white-space: normal !important; font-size: clamp(24px, 7vw, 33px) !important; } }</style>' + CLIP
  },
  'jra-payments-to-the-national-treasury': { generic: true, html: '' },
  'tax-cut-simulation-easy-jp': {
    generic: true,
    html: '<style>@media (max-width: 640px) { table.minitbl { min-width: 0 !important; } }</style>' + CLIP
  },
  'sangyo-kyosoryoku-kyokaho-kaiseiho-jp': { generic: true, html: pinTabs([['.controls', '.controls', '#tabnav']]) },
  'antarctic-treaty-organization-jp': {
    generic: true,
    html: '<style>@media (max-width: 640px) { .search-row { flex-wrap: wrap !important; } .search-row label { flex-basis: 100% !important; } .search-row input { flex: 1 1 auto !important; min-width: 0 !important; } }</style>' +
      pinTabs([['.controls', '.controls-inner', '.controls nav.tabs']])
  },
  'local-financial-boost-plan-jp': { generic: true, html: pinTabs([['.controls', '.controls > .wrap', '.controls nav.tabs']]) },
  'cross-reference-precision-mapping-jp': { generic: true, html: pinTabs([['.toolbar', '.toolbar > .wrap', '.toolbar .tbrow']]) },
  'disaster-damage-ai-utilization-jp': { generic: true, html: CLIP },
  'powerr-gx-jp': {
    generic: true,
    html: '<style>@media (max-width: 640px) { table.data { max-width: 100% !important; } table.data th, table.data td { overflow-wrap: anywhere; padding-left: 6px !important; padding-right: 6px !important; } }</style>' + CLIP
  },
  'space-activity-law-kaisei-jp': {
    generic: true,
    html: '<style>@media (max-width: 640px) { .search-row { flex-wrap: wrap !important; } .search-row label { flex-basis: 100% !important; } .search-row input { flex: 1 1 auto !important; min-width: 0 !important; } }</style>' + CLIP
  },
  'shiryo-kensho-chiseigaku-chishiki': { generic: true, html: '' },
  'sdsa-simulator-jp': { generic: true, html: '' }
};
