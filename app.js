// Dreh & Trink – app.js (3s, deterministisches Ergebnis + sauberer Restart)
// Ergebnis = exakt der anvisierte Keil
// "Weiter" schließt nur; Restart setzt Rad so, dass "Shots 4 all" (wedge 0) auf 12 Uhr steht

// ----------------------------------------------------
// 1) Inhalte
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
    desc: "Stein-Papier-Schere – 3 Runden. Sieger trinkt.",
  },
  quiz2: {
    id: "quiz2",
    label: "Ehe Quiz 🤔",
    desc: "3 Fragen – Gewinner bekommt einen Shot.",
  },
  panto2: {
    id: "panto2",
    label: "Pantomime 🙌",
    desc: "Pantomime. Sieger bekommt einen Shot.",
  },
};

// ----------------------------------------------------
// 2) Sichtbare Reihenfolge (ab 12 Uhr, im Uhrzeigersinn)
// Shots → S-P-S → Ehe Quiz → Pantomime → Crew Choice → S-P-S → Ehe Quiz → Pantomime
// ----------------------------------------------------
const wedgeOrder = [
  "instant", // 0: oben (unter Marker)
  "sps", // 1
  "quiz", // 2
  "panto", // 3
  "crew", // 4
  "sps2", // 5
  "quiz2", // 6
  "panto2", // 7
];

// ----------------------------------------------------
// 3) Kalibrierung
// (falls PNG minimal versetzt:  wheelZeroDeg = ±22.5 testen)
// ----------------------------------------------------
const wheelZeroDeg = 0;

// ----------------------------------------------------
// 4) Zeit / Show (3 s)
// ----------------------------------------------------
const totalMs = 3000;
const accelMs = 500; // Ease-In
const decelMs = 600; // Ease-Out
const extraTurnsBase = 4;
const extraTurnsRand = 1;

// dezenter Bounce (endet exakt am Ziel)
const BOUNCE = [
  { d: +1.6, ms: 90 },
  { d: -1.2, ms: 110 },
  { d: +0.4, ms: 90 },
  { d: -0.6, ms: 100 },
  { d: 0.0, ms: 80 },
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

// ----------------------------------------------------
// State & Mathe
// ----------------------------------------------------
let spinning = false;
let currentRotation = 0; // absolute Grad (kann >360°)
let lastTargetWedge = null; // anvisierter Keil für deterministisches Ergebnis

const count = wedgeOrder.length;
const segment = 360 / count;

const norm360 = (a) => {
  let x = a % 360;
  if (x < 0) x += 360;
  return x;
};
const centerAngleForWedge = (i) => norm360(wheelZeroDeg + i * segment);

// ----------------------------------------------------
// Initiale Ausrichtung: "Shots 4 all" auf 12 Uhr
// ----------------------------------------------------
function setWheelToStartPose(animateMs = 0) {
  const startAngle = centerAngleForWedge(0); // Keil 0 = "instant" (Shots) unter Marker
  currentRotation = startAngle; // State setzen
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

// Set direkt beim Laden
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

// 3-Phasen-RAF: Ease-In → Cruise → Ease-Out (endet exakt auf toDeg)
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
      } // Ease-In
      else if (now <= endC) {
        v = vMax;
      } // Cruise
      else if (now <= endD) {
        const t = endD - now;
        v = b * t;
      } // Ease-Out
      else {
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

// Vollbild-Konfetti im Dialog-Layer (über Card, unter OK-Button)
function confettiOverlay(btn, { duration = 1000, particles = 180 } = {}) {
  return new Promise((resolve) => {
    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      resolve();
      return;
    }

    // Canvas in den Dialog hängen (Top Layer), eigener Z-Index via CSS
    const canvas = document.createElement("canvas");
    canvas.className = "confetti-canvas";
    const ctx = canvas.getContext("2d");
    dialogEl.appendChild(canvas);

    // Größe = Viewport
    function fit() {
      canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
      canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
    fit();

    // Emissionszentrum = Button-Mitte im Viewport
    const r = btn.getBoundingClientRect();
    const origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };

    const COLORS = ["#b75cff", "#8a53ff", "#18e0b8", "#2aa5ff", "#ffd166"];
    const parts = Array.from({ length: particles }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 300 + Math.random() * 260; // px/s
      return {
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150, // leicht nach oben
        size: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 10, // rot/s
        col: COLORS[(Math.random() * COLORS.length) | 0],
        life: 0.6 + Math.random() * 0.6, // s
      };
    });

    const g = 900; // Gravitation (px/s^2)
    const start = performance.now();

    function tick(now) {
      const t = (now - start) / 1000;
      const dt = 1 / 60;
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
      else {
        canvas.remove();
        resolve();
      }
    }
    requestAnimationFrame(tick);

    const onResize = () => fit();
    window.addEventListener("resize", onResize, { passive: true });
    setTimeout(() => {
      window.removeEventListener("resize", onResize);
      canvas.remove();
      resolve();
    }, duration + 2000);
  });
}

// ----------------------------------------------------
// Ergebnis-UI (zeigt genau lastTargetWedge)
// ----------------------------------------------------
function openResultForTarget() {
  const key = wedgeOrder[lastTargetWedge];
  const s = sectorDefs[key];
  resultTitle.textContent = s.label;
  resultText.textContent = s.desc;
  dialogEl.showModal();

  try {
    const counts = JSON.parse(localStorage.getItem("dd-counts") || "{}");
    counts[s.id] = (counts[s.id] || 0) + 1;
    counts._rounds = (counts._rounds || 0) + 1;
    localStorage.setItem("dd-counts", JSON.stringify(counts));
  } catch (e) {}
}

// ----------------------------------------------------
// Spin
// ----------------------------------------------------
async function startSpin() {
  if (spinning) return;
  spinning = true;

  btnSpin.disabled = true;
  btnRestart.disabled = true;

  // Zufälligen Keil wählen und dessen Zentrum ansteuern
  lastTargetWedge = Math.floor(Math.random() * count);
  const targetCenter = centerAngleForWedge(lastTargetWedge);

  const extraTurns =
    extraTurnsBase + Math.floor(Math.random() * (extraTurnsRand + 1)); // 4..5
  const delta =
    360 * extraTurns + norm360(targetCenter - norm360(currentRotation));
  const finalRotation = currentRotation + delta;

  // 3s: Ease-In → Cruise → Ease-Out
  await spinRAF3Phase(
    currentRotation,
    finalRotation,
    totalMs,
    accelMs,
    decelMs
  );
  currentRotation = finalRotation;

  // Bounce (endet exakt auf targetCenter)
  await bounceSettle(currentRotation);

  // Ergebnis = exakt der anvisierte Keil
  openResultForTarget();

  btnSpin.disabled = false;
  btnRestart.disabled = false;
  spinning = false;
}

// ----------------------------------------------------
// Events
// ----------------------------------------------------
btnSpin.addEventListener("click", startSpin);

// RESTART: Zurück auf Startpose (Shots oben), Dialog schließen, Buttons freigeben
btnRestart.addEventListener("click", () => {
  if (spinning) return;
  dialogEl.close?.();
  lastTargetWedge = null;

  // sanftes Zurücksetzen (300 ms). 0 ms, wenn du es ohne Animation willst.
  setWheelToStartPose(300);

  btnSpin.disabled = false;
  btnRestart.disabled = false;
});

// „Weiter“: Konfetti hinter dem Button → Dialog schließen
resultClose.addEventListener("click", async (e) => {
  e.preventDefault();
  resultClose.disabled = true; // Doppelklick verhindern
  await confettiOverlay(resultClose, { duration: 1000, particles: 300 });
  dialogEl.close();
  resultClose.disabled = false;
  btnSpin.disabled = false;
  btnRestart.disabled = false;
});

// Fallback ohne <dialog>
if (typeof HTMLDialogElement === "undefined") {
  dialogEl.style.position = "fixed";
  dialogEl.style.inset = "0";
}
