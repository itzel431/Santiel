/* Cielo estrellado animado: estrellas que titilan, paralaje con el ratón,
   nebulosas suaves y estrellas fugaces ocasionales. */
(() => {
  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let w = 0, h = 0, dpr = 1;
  let stars = [], shots = [], nebula = null;
  let mx = 0, my = 0, tx = 0, ty = 0;
  let nextShot = 2000, last = 0, rafId = 0;

  function buildNebula() {
    nebula = document.createElement("canvas");
    nebula.width = w; nebula.height = h;
    const n = nebula.getContext("2d");
    const bg = n.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#04060e");
    bg.addColorStop(0.6, "#070b1c");
    bg.addColorStop(1, "#0b0a1f");
    n.fillStyle = bg;
    n.fillRect(0, 0, w, h);
    const clouds = [
      [0.18, 0.28, 0.45, "rgba(110,80,200,0.20)"],
      [0.82, 0.18, 0.40, "rgba(50,110,200,0.17)"],
      [0.62, 0.80, 0.50, "rgba(150,60,160,0.14)"],
      [0.10, 0.88, 0.35, "rgba(40,150,170,0.12)"],
    ];
    for (const [cx, cy, r, color] of clouds) {
      const R = r * Math.max(w, h);
      const g = n.createRadialGradient(cx * w, cy * h, 0, cx * w, cy * h, R);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      n.fillStyle = g;
      n.fillRect(0, 0, w, h);
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round(Math.min(340, (w * h) / 5000));
    stars = Array.from({ length: count }, () => {
      const roll = Math.random();
      const hue = roll < 0.18 ? 32 : roll < 0.45 ? 205 : 225; // cálidas / azuladas
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(),                      // profundidad: 0 lejos, 1 cerca
        r: Math.random() * 1.2 + 0.25,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 1.6 + 0.5,
        color: `hsl(${hue} ${hue === 32 ? 70 : 55}% ${82 + Math.random() * 14}%)`,
      };
    });
    buildNebula();
    if (reduceMotion) draw(0);
  }

  function spawnShot() {
    const fromLeft = Math.random() < 0.5;
    const angle = (Math.PI / 180) * (20 + Math.random() * 25);
    const speed = 520 + Math.random() * 380;
    shots.push({
      x: fromLeft ? Math.random() * w * 0.5 : w * (0.5 + Math.random() * 0.5),
      y: Math.random() * h * 0.45,
      vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1),
      vy: Math.sin(angle) * speed,
      life: 0,
      max: 0.7 + Math.random() * 0.5,
    });
  }

  function draw(t) {
    ctx.drawImage(nebula, 0, 0, w, h);
    tx += (mx - tx) * 0.04;
    ty += (my - ty) * 0.04;

    for (const s of stars) {
      const tw = reduceMotion ? 0.8 : 0.55 + 0.45 * Math.sin(t * 0.001 * s.speed + s.phase);
      const px = s.x + tx * s.z * 22;
      const py = s.y + ty * s.z * 22;
      ctx.globalAlpha = tw * (0.45 + s.z * 0.55);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(px, py, s.r * (0.7 + s.z * 0.6), 0, Math.PI * 2);
      ctx.fill();
      if (s.r > 1.1 && s.z > 0.6) {            // destello en cruz para las más brillantes
        ctx.globalAlpha = tw * 0.35;
        ctx.fillRect(px - s.r * 4, py - 0.4, s.r * 8, 0.8);
        ctx.fillRect(px - 0.4, py - s.r * 4, 0.8, s.r * 8);
      }
    }
    ctx.globalAlpha = 1;

    for (const m of shots) {
      const k = m.life / m.max;
      const a = Math.sin(Math.min(k, 1) * Math.PI);
      const len = 120;
      const mag = Math.hypot(m.vx, m.vy);
      const gx = m.x - (m.vx / mag) * len;
      const gy = m.y - (m.vy / mag) * len;
      const g = ctx.createLinearGradient(m.x, m.y, gx, gy);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, "rgba(150,190,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(gx, gy);
      ctx.stroke();
    }
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    nextShot -= dt * 1000;
    if (nextShot <= 0) {
      spawnShot();
      nextShot = 3500 + Math.random() * 6000;
    }
    for (const m of shots) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life += dt;
    }
    shots = shots.filter((m) => m.life < m.max);
    draw(now);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (reduceMotion || rafId) return;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (e) => {
    mx = e.clientX / w - 0.5;
    my = e.clientY / h - 0.5;
  }, { passive: true });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

  resize();
  start();
})();
