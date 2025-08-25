// Dreh & Trink – app.js (Emoji-Trigger für Übersicht, stabile Buttons, sauberes Cleanup)
// Ergebnis = exakt der anvisierte Keil
// Restart setzt Rad so, dass "Shots 4 all" (wedge 0) auf 12 Uhr steht

// ----------------------------------------------------
// Inhalte
// ----------------------------------------------------
const sectorDefs = {
  instant: {
    id: "instant",
    label: "Shots 4 all 🥃",
    desc: "Sofortgewinn: Alle Teilnehmer trinken einen Shot. SALUTE 🍻",
  },
  sps: {
    id: "sps",
    label: "S-P-S ✊✋✌️",
    desc: "Stein-Papier-Schere – 3 Runden. Sieger trinkt einen Shot.",
  },
  quiz: {
    id: "quiz",
    label: "Ehe Quiz 🤔",
    desc: "3 Fragen zur Ehe oder Hochzeit. Gewinner trinkt einen Shot.",
  },
  panto: {
    id: "panto",
    label: "Pantomime 🙌",
    desc: "Begriffe pantomimisch darstellen. Crew rät. Sieger bekommt einen Shot.",
  },
  crew: {
    id: "crew",
    label: "Crew Choice 🍄",
    desc: "Crew denkt sich frei etwas aus. Beispiel: 10 Liegestütze und „Ja, ich will“ sagen.",
  },
  sps2: {
    id: "sps2",
    label: "S-P-S ✊✋✌️",
    desc: "Nochmals Stein-Papier-Schere – 3 Runden. Sieger trinkt.",
  },
  quiz2: {
    id: "quiz2",
    label: "Ehe Quiz 🤔",
    desc: "3 Fragen – Gewinner bekommt einen Shot.",
  },
  panto2: {
    id: "panto2",
    label: "Pantomime 🙌",
    desc: "Nochmals Pantomime. Sieger bekommt einen Shot.",
  },
};

// ----------------------------------------------------
// Reihenfolge ab 12 Uhr im Uhrzeigersinn
// ----------------------------------------------------
const wedgeOrder = [
  "instant",
  "sps",
  "quiz",
  "panto",
  "crew",
  "sps2",
  "quiz2",
  "panto2",
];

// ----------------------------------------------------
// Kalibrierung / Zeiten
// ----------------------------------------------------
const wheelZeroDeg = 0; // ggf. ±22.5 testen
const totalMs = 3000,
  accelMs = 500,
  decelMs = 600,
  extraTurnsBase = 4,
  extraTurnsRand = 1;
const BOUNCE = [
  { d: +1.4, ms: 90 },
  { d: -1.0, ms: 110 },
  { d: +0.4, ms: 90 },
  { d: 0.0, ms: 100 },
];

// ----------------------------------------------------
// DOM
// ----------------------------------------------------
const elWheel = document.getElementById("wheel");
const btnSpin = document.getElementById("btnSpin");
const btnRestart = document.getElementById("btnRestart");

const dialogEl = document.getElementById("result");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const resultClose = document.getElementById("resultClose");

// Stats-Modal
const statsModal = document.getElementById("statsModal");
const statsBodyEl = document.getElementById("statsBody");
const statsClose = document.getElementById("statsClose");
const statsReset = document.getElementById("statsReset");

// ----------------------------------------------------
// State & Mathe
// ----------------------------------------------------
let spinning = false;
let currentRotation = 0;
let lastTargetWedge = null;

const count = wedgeOrder.length;
const segment = 360 / count;

const norm360 = (a) => {
  let x = a % 360;
  if (x < 0) x += 360;
  return x;
};
const centerAngleForWedge = (i) => norm360(wheelZeroDeg + i * segment);

// ----------------------------------------------------
// Emoji-Trigger (letztes Zeichen im <p> unter dem <h1>)
// ----------------------------------------------------
let statsTrigger = null;

(function initStatsTrigger() {
  const p =
    document.querySelector(".title-wrap p") || document.querySelector("h1 + p");
  if (!p) return;

  // kompletten Text holen
  const text = p.textContent.trimEnd();
  if (!text) return;

  // Match: letztes Emoji-Cluster (Extended_Pictographic + optionale VS + ggf. ZWJ-Ketten)
  const emojiRe =
    /(\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)$/u;
  const m = text.match(emojiRe);

  // Wenn kein Emoji am Ende: nimm das letzte sichtbare Zeichen
  const endChunk = m ? m[1] : text.slice(-1);
  const head = m ? text.slice(0, -endChunk.length) : text.slice(0, -1);

  // Inlinespan einsetzen
  p.innerHTML = `${head}<span class="stats-emoji" id="statsTrigger" aria-label="Übersicht öffnen" role="button" tabindex="0">${endChunk}</span>`;
  statsTrigger = document.getElementById("statsTrigger");

  // Klick & Enter/Space öffnen IMMER das Stats-Modal
  const openStats = () => {
    renderStats();
    statsModal.showModal();
  };
  statsTrigger.addEventListener("click", openStats);
  statsTrigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openStats();
    }
  });
})();

// ----------------------------------------------------
// Startpose ("Shots 4 all" oben)
// ----------------------------------------------------
function setWheelToStartPose(animateMs = 0) {
  const startAngle = centerAngleForWedge(0);
  currentRotation = startAngle;
  if (animateMs > 0) {
    elWheel.style.transition = `transform ${animateMs}ms cubic-bezier(.25,.8,.25,1)`;
    requestAnimationFrame(
      () => (elWheel.style.transform = `rotate(${currentRotation}deg)`)
    );
    setTimeout(() => (elWheel.style.transition = ""), animateMs + 20);
  } else {
    elWheel.style.transition = "";
    elWheel.style.transform = `rotate(${currentRotation}deg)`;
  }
}
setWheelToStartPose(0);

// ----------------------------------------------------
// Animationen
// ----------------------------------------------------
function tinyTo(angleDeg, ms) {
  return new Promise((res) => {
    elWheel.style.transition = `transform ${ms}ms cubic-bezier(.25,.8,.25,1)`;
    requestAnimationFrame(() => {
      elWheel.style.transform = `rotate(${angleDeg}deg)`;
    });
    setTimeout(() => res(), ms);
  });
}
function spinRAF3Phase(fromDeg, toDeg, msTotal, msAccel, msDecel) {
  return new Promise((resolve) => {
    const start = performance.now();
    const tA = Math.max(0, Math.min(msAccel, msTotal));
    const tD = Math.max(0, Math.min(msDecel, msTotal - tA));
    const tC = Math.max(0, msTotal - tA - tD);
    const endA = start + tA,
      endC = endA + tC,
      endD = endC + tD;

    const s = toDeg - fromDeg;
    const vMax = s / (tC + 0.5 * (tA + tD));
    const a = tA > 0 ? vMax / tA : 0;
    const b = tD > 0 ? vMax / tD : 0;

    let prev = start,
      angle = fromDeg;
    function frame(now) {
      const dt = now - prev;
      prev = now;
      let v;
      if (now <= endA) {
        const t = now - start;
        v = a * t;
      } else if (now <= endC) {
        v = vMax;
      } else if (now <= endD) {
        const t = endD - now;
        v = b * t;
      } else {
        v = 0;
      }

      angle += v * dt;
      elWheel.style.transition = "";
      elWheel.style.transform = `rotate(${angle}deg)`;
      if (now < endD) requestAnimationFrame(frame);
      else {
        elWheel.style.transform = `rotate(${toDeg}deg)`;
        resolve(toDeg);
      }
    }
    requestAnimationFrame(frame);
  });
}
async function bounceSettle(finalAngle) {
  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    elWheel.style.transition = "";
    elWheel.style.transform = `rotate(${finalAngle}deg)`;
    return;
  }
  for (const step of BOUNCE) {
    await tinyTo(finalAngle + step.d, step.ms);
  }
  elWheel.style.transition = "";
  elWheel.style.transform = `rotate(${finalAngle}deg)`;
}

// ----------------------------------------------------
// Konfetti (Overlay im Dialog-Layer, zwischen Card und Button)
// ----------------------------------------------------
function confettiOverlay(btn, { duration = 900, particles = 160 } = {}) {
  return new Promise((resolve) => {
    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      resolve();
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.className = "confetti-canvas";
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      zIndex: "1002",
      pointerEvents: "none",
    });
    const ctx = canvas.getContext("2d");
    dialogEl.appendChild(canvas);

    function fit() {
      canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
      canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
    fit();

    const r = btn.getBoundingClientRect();
    const origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const COLORS = ["#b75cff", "#8a53ff", "#18e0b8", "#2aa5ff", "#ffd166"];
    const parts = Array.from({ length: particles }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 300 + Math.random() * 240;
      return {
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 140,
        size: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 10,
        col: COLORS[(Math.random() * COLORS.length) | 0],
        life: 0.55 + Math.random() * 0.55,
      };
    });

    const g = 900;
    const start = performance.now();
    function tick(now) {
      const t = (now - start) / 1000,
        dt = 1 / 60;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.vy += g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const lifeFrac = Math.min(1, t / p.life);
        const alpha = 1 - Math.max(0, (lifeFrac - 0.5) * 2);
        if (alpha <= 0) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
        ctx.restore();
      }
      if (now - start < duration) requestAnimationFrame(tick);
      else end();
    }
    function end() {
      window.removeEventListener("resize", onResize);
      canvas.remove();
      resolve();
    }
    const onResize = () => fit();
    window.addEventListener("resize", onResize, { passive: true });
    requestAnimationFrame(tick);
    setTimeout(end, duration + 1500); // Safety
  });
}

// ----------------------------------------------------
// STATS (localStorage)
// ----------------------------------------------------
const STATS_KEY = "dd-stats-v1";
const stats = {
  _now() {
    return new Date().toISOString();
  },
  _empty() {
    return {
      rounds: 0,
      hits: {
        instant: 0,
        sps: 0,
        quiz: 0,
        panto: 0,
        crew: 0,
        sps2: 0,
        quiz2: 0,
        panto2: 0,
      },
      lastPlayed: null,
    };
  },
  load() {
    try {
      return JSON.parse(localStorage.getItem(STATS_KEY)) || this._empty();
    } catch {
      return this._empty();
    }
  },
  save(d) {
    localStorage.setItem(STATS_KEY, JSON.stringify(d));
  },
  reset() {
    this.save(this._empty());
  },
  record(hitId) {
    const d = this.load();
    d.rounds += 1;
    if (d.hits[hitId] == null) d.hits[hitId] = 0;
    d.hits[hitId] += 1;
    d.lastPlayed = this._now();
    this.save(d);
  },
};
function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "–";
  }
}

// Stats-Rendering & Events
function renderStats() {
  const s = stats.load();
  const rows = [
    ["Runden insgesamt", s.rounds],
    ["Shots 4 all", s.hits.instant],
    ["Stein-Papier-Schere", s.hits.sps + s.hits.sps2],
    ["Ehe-Quiz", s.hits.quiz + s.hits.quiz2],
    ["Pantomime", s.hits.panto + s.hits.panto2],
    ["Crew Choice", s.hits.crew],
    ["Zuletzt gespielt", s.lastPlayed ? fmtDate(s.lastPlayed) : "–"],
  ];
  const detail = [
    ["S-P-S (1)", s.hits.sps],
    ["S-P-S (2)", s.hits.sps2],
    ["Quiz (1)", s.hits.quiz],
    ["Quiz (2)", s.hits.quiz2],
    ["Panto (1)", s.hits.panto],
    ["Panto (2)", s.hits.panto2],
  ];
  statsBodyEl.innerHTML = `
    <div class="stats-grid">
      ${rows
        .map(
          ([k, v]) =>
            `<div class="stats-label">${k}</div><div class="stats-val">${v}</div>`
        )
        .join("")}
    </div>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:10px 0;">
    <div class="stats-grid">
      ${detail
        .map(
          ([k, v]) =>
            `<div class="stats-label">${k}</div><div class="stats-val">${v}</div>`
        )
        .join("")}
    </div>
  `;
}
statsTrigger?.addEventListener("click", () => {
  if (statsTrigger.classList.contains("is-disabled")) return;
  renderStats();
  statsModal.showModal();
});
statsClose?.addEventListener("click", () => statsModal.close());
statsReset?.addEventListener("click", () => {
  stats.reset();
  renderStats();
});

// ----------------------------------------------------
// Ergebnis-Dialog (zählt genau 1x)
// ----------------------------------------------------

function setStatsEnabled(/* enabled */) {
  // absichtlich leer
}

function openResultForTarget() {
  const key = wedgeOrder[lastTargetWedge];
  const s = sectorDefs[key];
  resultTitle.textContent = s.label;
  resultText.textContent = s.desc;
  dialogEl.showModal();

  // Count exakt EINMAL hier
  stats.record(s.id);

  // Spin ist fertig -> Stats-Emoji freigeben
  setStatsEnabled(true);
}

// ----------------------------------------------------
// Spin
// ----------------------------------------------------
async function startSpin() {
  if (spinning) return;
  spinning = true;

  // Buttons während des Spins sperren
  btnSpin.disabled = true;
  btnRestart.disabled = true;
  setStatsEnabled(false); // Emoji während Spin NICHT klickbar

  // Zufälligen Keil wählen und dessen Zentrum ansteuern
  lastTargetWedge = Math.floor(Math.random() * count);
  const targetCenter = centerAngleForWedge(lastTargetWedge);

  const extraTurns =
    extraTurnsBase + Math.floor(Math.random() * (extraTurnsRand + 1)); // 4..5
  const delta =
    360 * extraTurns + norm360(targetCenter - norm360(currentRotation));
  const finalRotation = currentRotation + delta;

  await spinRAF3Phase(
    currentRotation,
    finalRotation,
    totalMs,
    accelMs,
    decelMs
  );
  currentRotation = finalRotation;

  await bounceSettle(currentRotation);

  openResultForTarget(); // aktiviert Emoji

  // Spin-Buttons wieder erlauben (Dialog bleibt offen)
  btnSpin.disabled = false;
  btnRestart.disabled = false;

  spinning = false;
}

// ----------------------------------------------------
// Events
// ----------------------------------------------------
btnSpin.addEventListener("click", startSpin);
btnSpin.addEventListener("click", () => {
  // Animation-Klasse hinzufügen
  btnSpin.classList.add("is-bouncing");

  // Nach Ende der Animation wieder entfernen (damit sie erneut triggerbar ist)
  btnSpin.addEventListener(
    "animationend",
    () => {
      btnSpin.classList.remove("is-bouncing");
    },
    { once: true }
  );

  // Dein Spin starten
  startSpin();
});

// Restart: zurück auf Startpose (Shots oben)
btnRestart.addEventListener("click", () => {
  if (spinning) return;
  document.querySelectorAll(".confetti-canvas").forEach((n) => n.remove()); // Cleanup
  dialogEl.close?.();
  lastTargetWedge = null;
  setWheelToStartPose(300);
  btnSpin.disabled = false;
  btnRestart.disabled = false;
  setStatsEnabled(true); // Emoji nach Restart klickbar
});

// „Weiter“: Konfetti → Dialog schließen → alles aktiv
resultClose.addEventListener("click", async (e) => {
  e.preventDefault();
  resultClose.disabled = true;

  await confettiOverlay(resultClose, { duration: 900, particles: 160 });

  dialogEl.close();

  // Cleanup & Buttons aktivieren
  document.querySelectorAll(".confetti-canvas").forEach((n) => n.remove());
  resultClose.disabled = false;
  btnSpin.disabled = false;
  btnRestart.disabled = false;
  setStatsEnabled(true); // Emoji aktiv lassen
});

// Fallback ohne <dialog>
if (typeof HTMLDialogElement === "undefined") {
  dialogEl.style.position = "fixed";
  dialogEl.style.inset = "0";
  statsModal.style.position = "fixed";
  statsModal.style.inset = "0";
}
