// =============================
// LIFEQUEST — JSONBin-connected script.js
// =============================

// ====== KONFIGURASI ======
const TOTAL_LEVELS = 100;

// --- GANTI jika perlu: BIN ID & API KEY ---
// (Saat production, sebaiknya gunakan proxy agar API key tidak terekspos)
const BIN_ID = "68f6268b43b1c97be9734a48";
const API_KEY = "$2a$10$YUfC3pl63wHD07a3HVR01OFJTgLripv8C4YRNEi24WoSX/EhLIZ8q";
const JSONBIN_URL_BASE = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// ====== DATA LEVEL (auto generate dari 300k -> 60M di level 100) ======
const levels = [];
let startTarget = 300_000;
const endTarget = 60_000_000_000;
const factor = Math.pow(endTarget / startTarget, 1 / (TOTAL_LEVELS - 1));

for (let i = 1; i <= TOTAL_LEVELS; i++) {
  levels.push({
    level: i,
    target: Math.round(startTarget),
    tips:
      i % 10 === 0
        ? `🎯 Milestone Level ${i}: pertimbangkan diversifikasi investasi / scale usaha.`
        : `Fokus: tambah pendapatan & disiplin menabung.`
  });
  startTarget *= factor;
}

// ====== STATE ======
let currentLevel = 1;
let saving = false; // flag untuk mencegah klik ganda saat menyimpan

// ====== DOM ======
const levelList = document.getElementById("level-list");
const progressFill = document.getElementById("progress-fill");
const levelText = document.getElementById("level-text");
const progressPercent = document.getElementById("progress-percent");
const undoBtn = document.getElementById("undo-btn");

const modal = document.getElementById("tips-modal");
const modalLevel = document.getElementById("modal-level");
const modalTips = document.getElementById("modal-tips");
const closeModal = document.getElementById("close-modal");

// optional lightweight toast for feedback
function showToast(msg, time = 1800) {
  let t = document.createElement("div");
  t.textContent = msg;
  t.style.position = "fixed";
  t.style.left = "50%";
  t.style.bottom = "90px";
  t.style.transform = "translateX(-50%)";
  t.style.background = "rgba(0,0,0,0.7)";
  t.style.color = "#fff";
  t.style.padding = "8px 12px";
  t.style.borderRadius = "8px";
  t.style.zIndex = 1200;
  t.style.fontSize = "0.92rem";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), time);
}

// ====== JSONBin FUNCTIONS ======

// Fetch progress from JSONBin (reads latest)
async function fetchProgressFromBin() {
  try {
    const resp = await fetch(`${JSONBIN_URL_BASE}/latest`, {
      method: "GET",
      headers: {
        "X-Master-Key": API_KEY
      }
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const json = await resp.json();
    // v3 response stores user data in json.record
    const rec = json && json.record;
    if (rec && rec.userProgress && typeof rec.userProgress.currentLevel === "number") {
      currentLevel = Math.max(1, Math.min(TOTAL_LEVELS, rec.userProgress.currentLevel));
      return true;
    } else {
      // if bin exists but doesn't have structure, initialize it
      currentLevel = 1;
      await writeProgressToBin(); // seed
      return true;
    }
  } catch (err) {
    console.error("fetchProgressFromBin error:", err);
    showToast("Gagal ambil progress (cek koneksi). Mode offline.");
    currentLevel = 1;
    return false;
  }
}

// Write/update progress to JSONBin (PUT)
async function writeProgressToBin() {
  // Prevent concurrent saves
  if (saving) return false;
  saving = true;
  try {
    const payload = { userProgress: { currentLevel } };
    const resp = await fetch(JSONBIN_URL_BASE, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    saving = false;
    return true;
  } catch (err) {
    saving = false;
    console.error("writeProgressToBin error:", err);
    showToast("Gagal menyimpan progress. Coba lagi.");
    return false;
  }
}

// ====== RENDER UI ======
function renderLevels() {
  levelList.innerHTML = "";

  // tampilkan 5 level: currentLevel - 2 .. currentLevel + 2 (bounded)
  const start = Math.max(1, currentLevel - 2);
  const end = Math.min(TOTAL_LEVELS, currentLevel + 2);

  for (let i = start; i <= end; i++) {
    const item = levels[i - 1];

    const card = document.createElement("div");
    card.className = "level-card";

    const info = document.createElement("div");
    info.className = "level-info";
    info.innerHTML = `
      <div class="level-number">Level ${item.level}</div>
      <span>💰 Target: Rp ${item.target.toLocaleString("id-ID")}</span>
    `;

    const btn = document.createElement("button");
    btn.className = "ready-btn";
    // Jika level sudah terlewati (level < currentLevel) tampilkan '✓ Selesai'
    if (item.level < currentLevel) {
      btn.textContent = "✓ Selesai";
      btn.disabled = true;
      btn.style.opacity = 0.7;
    } else if (item.level === currentLevel) {
      btn.textContent = "Saya Sudah";
      btn.disabled = false;
    } else {
      btn.textContent = "Terkunci";
      btn.disabled = true;
    }

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await handleLevelClick(item.level);
    });

    card.appendChild(info);
    card.appendChild(btn);
    levelList.appendChild(card);
  }
  // update undo button state
  undoBtn.disabled = currentLevel <= 1;
  updateProgress();
}

// ====== LEVEL CLICK / UNDO ======
async function handleLevelClick(level) {
  if (saving) {
    showToast("Sedang menyimpan... tunggu sebentar");
    return;
  }
  // hanya boleh klik pada currentLevel
  if (level !== currentLevel) return;

  // optimistically update UI
  currentLevel = Math.min(TOTAL_LEVELS, currentLevel + 1);
  renderLevels();
  updateProgress();

  const ok = await writeProgressToBin();
  if (ok) {
    showToast("Progress tersimpan ✅");
    // jika milestone (10,20,...) tampil tips (modal)
    if ((level) % 10 === 0) {
      showTips(level);
    }
  } else {
    // jika gagal simpan, revert (pilihan: revert otomatis atau beri peringatan)
    showToast("Simpan gagal — mencoba ulang saat koneksi stabil.");
    // Optional: try one more time in background (not forcing revert)
    // await writeProgressToBin();
  }
}

undoBtn.addEventListener("click", async () => {
  if (saving) {
    showToast("Sedang menyimpan... tunggu sebentar");
    return;
  }
  if (currentLevel <= 1) return;
  // optimistically decrement
  currentLevel = Math.max(1, currentLevel - 1);
  renderLevels();
  updateProgress();

  const ok = await writeProgressToBin();
  if (ok) {
    showToast("Level dikembalikan ✅");
  } else {
    showToast("Gagal menyimpan perubahan undo.");
  }
});

// ====== PROGRESS BAR ======
function updateProgress() {
  const percent = Math.min((currentLevel / TOTAL_LEVELS) * 100, 100);
  if (progressFill) progressFill.style.width = `${percent}%`;
  if (levelText) levelText.textContent = `Level ${currentLevel} dari ${TOTAL_LEVELS}`;
  if (progressPercent) progressPercent.textContent = `${Math.floor(percent)}%`;
}

// ====== MODAL ======
function showTips(level) {
  const item = levels[level - 1];
  if (!modal || !modalLevel || !modalTips) return;
  modalLevel.textContent = level;
  modalTips.textContent = item.tips;
  modal.classList.remove("hidden");
}

if (closeModal) {
  closeModal.addEventListener("click", () => {
    modal.classList.add("hidden");
  });
}

// ====== INIT ======
async function init() {
  // fetch from JSONBin; if fails, currentLevel stays at 1
  await fetchProgressFromBin();
  renderLevels();
  updateProgress();
}

init();
