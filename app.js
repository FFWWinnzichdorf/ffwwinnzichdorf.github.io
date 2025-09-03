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
const mobileEpisodesBtn = document.getElementById("mobileEpisodesBtn");
const modeReadBtn = document.getElementById("modeRead");
const modeEpiBtn  = document.getElementById("modeEpisodes");

function inEpisodesMode() {
  return document.body.getAttribute("data-mode") === "episodes";
}

// builds the base status text (episode + panel)
function buildStatusBase() {
  const ep = DATA.episodes[epIndex];
  if (!ep) return "—";
  return `Episode: ${ep.title || ep.id} · Panel ${panelIndex + 1} of ${ep.panels.length}`;
}

// sets the footer text, adding the hint when appropriate
function updateStatusText() {
  let t = buildStatusBase();
  if (inEpisodesMode()) t += " · Tap here to return";
  statusEl.textContent = t;
}

function setMode(m) {
  document.body.setAttribute("data-mode", m);
  const isRead = m === "read";
  modeReadBtn?.setAttribute("aria-pressed", String(isRead));
  modeEpiBtn?.setAttribute("aria-pressed", String(!isRead));
  sessionStorage.setItem("mode", m);
  updateStatusInteractivity();
  updateStatusText();
}

function goTo(epId, panel) {
  const idx = findEpisodeIndex(epId);
  if (idx < 0) return;

  epIndex = idx;
  panelIndex = Math.max(0, Math.min(panel - 1, DATA.episodes[idx].panels.length - 1));

  // change the <img> source directly
  imgEl.src = DATA.episodes[epIndex].panels[panelIndex];

  // update URL without scrolling
  history.replaceState(null, "", `#${epId}:${panel}`);

  render(); // update caption, buttons, footer, etc.
}

// Parse location hash like #ep1:2  (episode id : 1-based panel)
function parseHash() {
  const h = (location.hash || "").replace(/^#/, "");
  if (!h) return null;
  const [epId, panelStr] = h.split(":");
  return { epId, panel: Math.max(1, parseInt(panelStr || "1", 10) || 1) };
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
  if (!ep) {
    imgEl.removeAttribute("src");
    imgEl.alt = "";
    capEl.textContent = "";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    updateStatusText();
    return;
  }

  panelIndex = Math.max(0, Math.min(panelIndex, ep.panels.length - 1));

  imgEl.src = ep.panels[panelIndex];
  imgEl.alt = `${ep.title || ep.id} — panel ${panelIndex + 1}`;
  capEl.textContent = `${ep.title || ep.id} — ${panelIndex + 1}/${ep.panels.length}`;

  prevBtn.disabled = panelIndex <= 0;
  nextBtn.disabled = panelIndex >= ep.panels.length - 1;

  updateStatusText(); // 🔑 let the helper own the footer text
}

// Navigation functions
function goNext() { panelIndex++; goTo(DATA.episodes[epIndex].id, panelIndex); }
function goPrev() { panelIndex--; goTo(DATA.episodes[epIndex].id, panelIndex); }

// Click left/right half to navigate
function setupClickZones() {
  imgEl.addEventListener("click", (e) => {
    const rect = imgEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    (x < rect.width / 2) ? goPrev() : goNext();
  });
}

// make footer clickable in episodes mode (mobile or not is fine; CSS handles the look)
statusEl.addEventListener("click", () => {
  if (inEpisodesMode()) setMode("read");
});
statusEl.addEventListener("keydown", (e) => {
  if (inEpisodesMode() && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    setMode("read");
  }
});

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

function setupVerticalSwipe() {
  let startY = null;
  imgEl.addEventListener("touchstart", e => { startY = e.touches[0].clientY; }, {passive:true});
  imgEl.addEventListener("touchend", e => {
    if (startY == null) return;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dy) > 50) {
      if (dy < 0) setMode("episodes"); // swipe up
      else setMode("read");            // swipe down
    }
    startY = null;
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
    if (inEpisodesMode()) setMode("read");
    return true;
  }
  return false;
}

function updateStatusInteractivity() {
  const active = inEpisodesMode();
  if (active) {
    statusEl.setAttribute("role", "button");
    statusEl.setAttribute("tabindex", "0");
    statusEl.setAttribute("aria-label", "Back to reading");
  } else {
    statusEl.removeAttribute("role");
    statusEl.setAttribute("tabindex", "-1");
    statusEl.removeAttribute("aria-label");
  }
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
  mobileEpisodesBtn?.addEventListener("click", () => setMode("episodes"));

  setMode(sessionStorage.getItem("mode") || "read");
  updateStatusInteractivity(); 
  
  setupClickZones();
  setupSwipe();
  setupKeys();
  setupVerticalSwipe();
  
  // react to hash changes (e.g., when user clicks left nav)
  window.addEventListener("hashchange", () => {
    if (loadFromHash()) render();
  });
}

init();
