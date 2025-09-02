// --- state ---
let DATA = { episodes: [] };
let epIndex = 0;         // which episode
let panelIndex = 0;      // which panel (0-based)

// --- helpers ---
const $ = s => document.querySelector(s);
const episodeListEl = $("#episodeList");
const imgEl = $("#panelImg");
const capEl = $("#panelCaption");
const statusEl = $("#statusText");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");

// Parse location hash like #ep1:2  (episode id : 1-based panel)
function parseHash() {
  const h = (location.hash || "").replace(/^#/, "");
  if (!h) return null;
  const [epId, panelStr] = h.split(":");
  return { epId, panel: Math.max(1, parseInt(panelStr || "1", 10) || 1) };
}

function setHash(epId, panel1based) {
  location.hash = `${epId}:${panel1based}`;
}

// Find episode index by id
function findEpisodeIndex(id) {
  return DATA.episodes.findIndex(e => e.id === id);
}

// Render left nav
function buildNav() {
  episodeListEl.innerHTML = "";
  DATA.episodes.forEach(ep => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${ep.id}:1`;
    a.textContent = ep.title || ep.id;
    li.appendChild(a);
    episodeListEl.appendChild(li);
  });
}

// Show current panel
function render() {
  const ep = DATA.episodes[epIndex];
  if (!ep) return;

  // clamp panel
  panelIndex = Math.max(0, Math.min(panelIndex, ep.panels.length - 1));

  const src = ep.panels[panelIndex];
  imgEl.src = src;
  imgEl.alt = ep.title ? `${ep.title} — panel ${panelIndex + 1}` : `panel ${panelIndex + 1}`;
  capEl.textContent = `${ep.title || ep.id} — ${panelIndex + 1}/${ep.panels.length}`;
  statusEl.textContent = `Episode: ${ep.title || ep.id} · Panel ${panelIndex + 1} of ${ep.panels.length}`;

  // update hash to keep URL shareable
  setHash(ep.id, panelIndex + 1);

  // enable/disable buttons
  prevBtn.disabled = panelIndex <= 0;
  nextBtn.disabled = panelIndex >= ep.panels.length - 1;
}

// Navigation functions
function goNext() { panelIndex++; render(); }
function goPrev() { panelIndex--; render(); }

// Click left/right half to navigate
function setupClickZones() {
  imgEl.addEventListener("click", (e) => {
    const rect = imgEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    (x < rect.width / 2) ? goPrev() : goNext();
  });
}

// Swipe (basic)
function setupSwipe() {
  let startX = null;
  imgEl.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, {passive:true});
  imgEl.addEventListener("touchend", e => {
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) (dx < 0 ? goNext() : goPrev());
    startX = null;
  }, {passive:true});
}

// Keyboard arrows
function setupKeys() {
  window.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") goNext();
    if (e.key === "ArrowLeft") goPrev();
  });
}

// Sync state from hash
function loadFromHash() {
  const info = parseHash();
  if (!info) return false;

  const idx = findEpisodeIndex(info.epId);
  if (idx >= 0) {
    epIndex = idx;
    panelIndex = Math.max(0, Math.min((info.panel|0) - 1, DATA.episodes[idx].panels.length - 1));
    return true;
  }
  return false;
}

// Init
async function init() {
  const res = await fetch("comics.json");
  DATA = await res.json();

  buildNav();

  // choose initial episode/panel
  if (!loadFromHash()) {
    epIndex = 0;
    panelIndex = 0;
  }
  render();

  // wire controls
  nextBtn.addEventListener("click", goNext);
  prevBtn.addEventListener("click", goPrev);
  setupClickZones();
  setupSwipe();
  setupKeys();

  // react to hash changes (e.g., when user clicks left nav)
  window.addEventListener("hashchange", () => {
    if (loadFromHash()) render();
  });
}

init();
