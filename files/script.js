/* ===========================================================
   Expedition Journal — app logic
   Plain JavaScript, no build step, no frameworks.
   Data is stored in the browser via localStorage.
   =========================================================== */

const STORAGE_KEY = "expeditionJournalData";

// The four levels of the hierarchy, in order.
const CHILD_KEYS = ["countries", "provinces", "cities", "places"];
const LEVEL_LABELS = ["Country", "Province / Region", "City", "Place"];
const LEVEL_LABELS_PLURAL = ["Countries", "Provinces & Regions", "Cities", "Places"];

// currentPath holds the ids of the selected country / province / city / place.
// An empty array means we are looking at the root (the list of countries).
let currentPath = [];

let data = loadData();

// -----------------------------------------------------------
// Storage
// -----------------------------------------------------------
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.countries)) {
      return parsed;
    }
  }
  return { countries: [] };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function makeNode(name, level) {
  const node = { id: makeId(), name: name, notes: "", photos: [] };
  if (level < 3) {
    node[CHILD_KEYS[level + 1]] = [];
  }
  return node;
}

// -----------------------------------------------------------
// Navigation helpers
// -----------------------------------------------------------

// Walks currentPath and returns the chain of node objects from root to focus.
function getChain(path) {
  const chain = [];
  let list = data.countries;
  for (let i = 0; i < path.length; i++) {
    const node = list.find((n) => n.id === path[i]);
    if (!node) break;
    chain.push(node);
    list = node[CHILD_KEYS[i + 1]] || [];
  }
  return chain;
}

// Returns the array of children that should be listed at the current level.
function getChildren(focus, level) {
  if (level === 0) return data.countries;
  const key = CHILD_KEYS[level];
  if (!focus[key]) focus[key] = [];
  return focus[key];
}

function countAll() {
  const totals = { countries: 0, provinces: 0, cities: 0, places: 0, photos: 0 };
  for (const country of data.countries) {
    totals.countries++;
    totals.photos += country.photos.length;
    for (const province of country.provinces || []) {
      totals.provinces++;
      totals.photos += province.photos.length;
      for (const city of province.cities || []) {
        totals.cities++;
        totals.photos += city.photos.length;
        for (const place of city.places || []) {
          totals.places++;
          totals.photos += place.photos.length;
        }
      }
    }
  }
  return totals;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

// -----------------------------------------------------------
// DOM references
// -----------------------------------------------------------
const statsBarEl = document.getElementById("statsBar");
const breadcrumbEl = document.getElementById("breadcrumb");
const appEl = document.getElementById("app");
const lightboxEl = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxDelete = document.getElementById("lightboxDelete");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");

let lightboxContext = null; // { node, index } of the photo currently shown

// -----------------------------------------------------------
// Rendering
// -----------------------------------------------------------
function render() {
  renderStats();
  renderBreadcrumb();
  renderApp();
}

function renderStats() {
  const t = countAll();
  statsBarEl.innerHTML = `
    <div class="stamp"><span class="stamp-number">${t.countries}</span><span class="stamp-label">Countries</span></div>
    <div class="stamp"><span class="stamp-number">${t.provinces}</span><span class="stamp-label">Provinces</span></div>
    <div class="stamp"><span class="stamp-number">${t.cities}</span><span class="stamp-label">Cities</span></div>
    <div class="stamp"><span class="stamp-number">${t.places}</span><span class="stamp-label">Places</span></div>
    <div class="stamp"><span class="stamp-number">${t.photos}</span><span class="stamp-label">Photos</span></div>
  `;
}

function renderBreadcrumb() {
  const chain = getChain(currentPath);
  let html = `<button class="crumb" data-index="0">World</button>`;
  chain.forEach((node, i) => {
    html += `<span class="crumb-sep">/</span><button class="crumb" data-index="${i + 1}">${escapeHtml(node.name)}</button>`;
  });
  breadcrumbEl.innerHTML = html;
  breadcrumbEl.querySelectorAll(".crumb").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentPath = currentPath.slice(0, parseInt(btn.dataset.index, 10));
      render();
    });
  });
}

function renderApp() {
  const chain = getChain(currentPath);
  const level = chain.length;
  const focus = level > 0 ? chain[level - 1] : null;

  appEl.innerHTML = "";

  if (focus) {
    appEl.appendChild(buildFocusPanel(focus, level));
  }

  // A place (level 4) is the deepest layer: it has no children to list.
  if (level < 4) {
    appEl.appendChild(buildChildrenSection(focus, level));
  }
}

function buildFocusPanel(focus, level) {
  const panel = document.createElement("section");
  panel.className = "focus-panel";
  panel.innerHTML = `
    <p class="eyebrow">${LEVEL_LABELS[level - 1]}</p>
    <div class="title-row">
      <input type="text" class="title-input" />
    </div>
    <textarea class="notes-input" placeholder="Notes from this stop — what happened, what to remember, what to do differently next time…"></textarea>
    <div class="photo-section">
      <div class="photo-grid"></div>
      <label class="btn btn-ghost photo-upload-label">Add photos
        <input type="file" accept="image/*" multiple hidden class="photo-input" />
      </label>
    </div>
  `;

  const titleInput = panel.querySelector(".title-input");
  titleInput.value = focus.name;
  titleInput.addEventListener("change", () => {
    focus.name = titleInput.value.trim() || focus.name;
    saveData();
    renderBreadcrumb();
  });

  const notesInput = panel.querySelector(".notes-input");
  notesInput.value = focus.notes;
  notesInput.addEventListener("input", () => {
    focus.notes = notesInput.value;
    saveData();
  });

  const photoGrid = panel.querySelector(".photo-grid");
  fillPhotoGrid(photoGrid, focus);

  const photoInput = panel.querySelector(".photo-input");
  photoInput.addEventListener("change", () => {
    handlePhotoUpload(photoInput.files, focus);
  });

  return panel;
}

function fillPhotoGrid(gridEl, node) {
  gridEl.innerHTML = "";
  node.photos.forEach((src, index) => {
    const thumb = document.createElement("div");
    thumb.className = "photo-thumb";
    thumb.innerHTML = `<button type="button" aria-label="Open photo"><img src="${src}" alt=""></button>`;
    thumb.querySelector("button").addEventListener("click", () => {
      openLightbox(node, index);
    });
    gridEl.appendChild(thumb);
  });
}

function buildChildrenSection(focus, level) {
  const children = getChildren(focus, level);
  const section = document.createElement("section");

  const label = document.createElement("div");
  label.className = "section-label";
  label.innerHTML = `<h2>${LEVEL_LABELS_PLURAL[level]}</h2><span class="count-pill">${children.length}</span>`;
  section.appendChild(label);

  if (children.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = `No ${LEVEL_LABELS_PLURAL[level].toLowerCase()} logged yet — add the first one below.`;
    section.appendChild(empty);
  } else {
    const grid = document.createElement("div");
    grid.className = "grid";
    children.forEach((child) => grid.appendChild(buildCard(child, level)));
    section.appendChild(grid);
  }

  const form = document.createElement("form");
  form.className = "add-form";
  form.innerHTML = `
    <input type="text" placeholder="Add a ${LEVEL_LABELS[level]}…" required />
    <button type="submit" class="btn btn-primary">Add</button>
  `;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = form.querySelector("input");
    const name = input.value.trim();
    if (!name) return;
    children.push(makeNode(name, level));
    saveData();
    renderApp();
    renderStats();
  });
  section.appendChild(form);

  return section;
}

function buildCard(node, level) {
  const card = document.createElement("div");
  card.className = "card";

  const thumbHtml = node.photos.length
    ? `<img src="${node.photos[0]}" alt="">`
    : "✦";

  let meta = "";
  if (level === 0) meta = `${(node.provinces || []).length} provinces · ${node.photos.length} photos`;
  if (level === 1) meta = `${(node.cities || []).length} cities · ${node.photos.length} photos`;
  if (level === 2) meta = `${(node.places || []).length} places · ${node.photos.length} photos`;
  if (level === 3) meta = `${node.photos.length} photos`;

  card.innerHTML = `
    <button type="button" class="card-delete" aria-label="Remove">×</button>
    <div class="card-thumb">${thumbHtml}</div>
    <h3 class="card-title"></h3>
    <p class="card-meta">${meta}</p>
  `;
  card.querySelector(".card-title").textContent = node.name;

  card.querySelector(".card-delete").addEventListener("click", (e) => {
    e.stopPropagation();
    const ok = confirm(`Remove "${node.name}" and everything inside it? This cannot be undone.`);
    if (!ok) return;
    removeNode(node.id, level);
  });

  card.addEventListener("click", () => {
    currentPath = currentPath.concat(node.id);
    render();
  });

  return card;
}

function getCurrentList(level) {
  const chain = getChain(currentPath);
  const focus = level > 0 ? chain[level - 1] : null;
  return getChildren(focus, level);
}

function removeNode(id, level) {
  const list = getCurrentList(level);
  const index = list.findIndex((n) => n.id === id);
  if (index !== -1) list.splice(index, 1);
  saveData();
  renderApp();
  renderStats();
}

// -----------------------------------------------------------
// Photos: resize on upload so localStorage doesn't fill up
// -----------------------------------------------------------
function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 900;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handlePhotoUpload(fileList, node) {
  const files = Array.from(fileList);
  for (const file of files) {
    const dataUrl = await resizeImage(file);
    node.photos.push(dataUrl);
  }
  saveData();
  renderApp();
  renderStats();
}

// -----------------------------------------------------------
// Lightbox
// -----------------------------------------------------------
function openLightbox(node, index) {
  lightboxContext = { node, index };
  lightboxImg.src = node.photos[index];
  lightboxEl.hidden = false;
}

function closeLightbox() {
  lightboxEl.hidden = true;
  lightboxContext = null;
}

lightboxClose.addEventListener("click", closeLightbox);
lightboxEl.addEventListener("click", (e) => {
  if (e.target === lightboxEl) closeLightbox();
});
lightboxDelete.addEventListener("click", () => {
  if (!lightboxContext) return;
  const ok = confirm("Delete this photo?");
  if (!ok) return;
  lightboxContext.node.photos.splice(lightboxContext.index, 1);
  saveData();
  closeLightbox();
  renderApp();
  renderStats();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !lightboxEl.hidden) closeLightbox();
});

// -----------------------------------------------------------
// Export / import backup
// -----------------------------------------------------------
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "travel-log-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", () => {
  const file = importInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const parsed = JSON.parse(e.target.result);
    if (!parsed || !Array.isArray(parsed.countries)) {
      alert("That file does not look like a valid travel log backup.");
      return;
    }
    const ok = confirm("This will replace your current travel log. Continue?");
    if (!ok) return;
    data = parsed;
    saveData();
    currentPath = [];
    render();
  };
  reader.readAsText(file);
  importInput.value = "";
});

// -----------------------------------------------------------
// Start
// -----------------------------------------------------------
render();
