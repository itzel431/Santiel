/* Juegos de Santiel: constelaciones, cuestionario, cazameteoros y ordena los planetas.
   Cada juego solo anima mientras su pestaña está visible. */
(() => {
  "use strict";

  /* ---------------------------------------------------------- utilidades */
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const secs = (s) => `${Math.floor(s)} s`;
  const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
  function canvasPoint(canvas, e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height };
  }
  function setMsg(el, text, kind) {
    el.textContent = text;
    el.className = `game-msg${kind ? " " + kind : ""}`;
  }
  function shake(el) {
    el.classList.remove("shake");
    void el.offsetWidth; // reinicia la animación
    el.classList.add("shake");
  }

  /* ===================================================== 1. CONSTELACIONES */
  const CONSTELLATIONS = [
    {
      name: "Osa Mayor",
      clue: "Siete estrellas que forman una gran cacerola con un mango largo.",
      fact: "Sus dos estrellas del borde de la cacerola, Dubhe y Merak, apuntan hacia la Estrella Polar.",
      stars: [[0.80, 0.30], [0.76, 0.58], [0.56, 0.64], [0.54, 0.40], [0.38, 0.36], [0.22, 0.28], [0.06, 0.40]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
    },
    {
      name: "Casiopea",
      clue: "Cinco estrellas en zigzag que dibujan una W (o una M, según la hora).",
      fact: "Casiopea está al lado opuesto de la Osa Mayor respecto a la Estrella Polar.",
      stars: [[0.06, 0.32], [0.27, 0.74], [0.50, 0.40], [0.73, 0.76], [0.94, 0.26]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    },
    {
      name: "Orión",
      clue: "El cazador: tres estrellas del cinturón al centro, dos hombros arriba, dos pies abajo y una cabeza.",
      fact: "Las tres estrellas del cinturón son «las Tres Marías». Betelgeuse es una supergigante roja y Rigel, una supergigante azul.",
      stars: [[0.30, 0.12], [0.68, 0.15], [0.49, 0.03], [0.40, 0.50], [0.50, 0.48], [0.60, 0.46], [0.34, 0.90], [0.70, 0.86]],
      edges: [[0, 3], [1, 5], [0, 2], [1, 2], [3, 4], [4, 5], [3, 6], [5, 7]],
    },
    {
      name: "Cisne",
      clue: "Una cruz: una línea larga de cola a pico, cruzada por las dos alas.",
      fact: "También se llama Cruz del Norte. Su estrella Deneb forma, con Vega y Altair, el Triángulo de Verano.",
      stars: [[0.50, 0.06], [0.50, 0.46], [0.50, 0.94], [0.14, 0.40], [0.86, 0.30]],
      edges: [[0, 1], [1, 2], [3, 1], [1, 4]],
    },
  ];

  const Constellations = (() => {
    const canvas = $("c-canvas");
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const el = {
      name: $("c-name"), errors: $("c-errors"), time: $("c-time"),
      hint: $("c-hint"), clue: $("c-clue"), msg: $("c-msg"), next: $("c-next"),
    };
    const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

    let order = [], round = 0, con = null, pts = [], edges = new Set(), drawn = new Set();
    let selected = -1, hover = -1, errors = 0, hints = 0, elapsed = 0;
    let roundDone = false, gameDone = false, hintKey = null, hintUntil = 0;
    let decoys = [], started = false, running = false, last = 0;

    function loadRound() {
      con = order[round];
      pts = con.stars.map(([x, y]) => ({ x: 90 + x * (W - 180), y: 65 + y * (H - 130) }));
      edges = new Set(con.edges.map(([a, b]) => key(a, b)));
      drawn = new Set();
      selected = -1; roundDone = false; hintKey = null;
      decoys = Array.from({ length: 70 }, () => ({ x: rand(10, W - 10), y: rand(10, H - 10), r: rand(0.4, 1.3), p: rand(0, 6.28) }));
      el.name.textContent = `${round + 1}/${order.length} · ${con.name}`;
      el.clue.textContent = con.clue;
      el.next.hidden = true;
      el.next.textContent = round === order.length - 1 ? "Ver resultado" : "Siguiente constelación";
      el.hint.disabled = false;
      setMsg(el.msg, "Haz clic en una estrella y luego en otra para unirlas con una línea.");
    }

    function start() {
      order = shuffle(CONSTELLATIONS);
      round = 0; errors = 0; hints = 0; elapsed = 0; gameDone = false;
      loadRound();
      el.errors.textContent = "0";
    }

    function nearest(p) {
      let best = -1, bestD = 30;
      pts.forEach((s, i) => {
        const d = Math.hypot(s.x - p.x, s.y - p.y);
        if (d < bestD) { best = i; bestD = d; }
      });
      return best;
    }

    function finishRound() {
      roundDone = true;
      el.hint.disabled = true;
      setMsg(el.msg, `¡${con.name} completada! ${con.fact}`, "good");
      el.next.hidden = false;
    }

    canvas.addEventListener("pointermove", (e) => {
      if (!pts.length) return;
      hover = nearest(canvasPoint(canvas, e));
      canvas.style.cursor = hover >= 0 ? "pointer" : "crosshair";
    });

    canvas.addEventListener("pointerdown", (e) => {
      if (roundDone || gameDone) return;
      const i = nearest(canvasPoint(canvas, e));
      if (i < 0) { selected = -1; return; }
      if (selected < 0) { selected = i; return; }
      if (selected === i) { selected = -1; return; }

      const k = key(selected, i);
      if (edges.has(k)) {
        if (!drawn.has(k)) {
          drawn.add(k);
          setMsg(el.msg, `¡Bien! ${drawn.size}/${edges.size} líneas.`, "good");
        }
        selected = i; // se puede seguir el trazo desde la última estrella
        if (drawn.size === edges.size) finishRound();
      } else {
        errors++;
        el.errors.textContent = String(errors);
        shake(canvas);
        setMsg(el.msg, "Esas dos estrellas no se unen en esta constelación. Prueba otra pareja.", "bad");
        selected = -1;
      }
    });

    el.hint.addEventListener("click", () => {
      if (roundDone || gameDone) return;
      const missing = [...edges].find((k) => !drawn.has(k));
      if (!missing) return;
      hintKey = missing; hintUntil = performance.now() + 1600; hints++;
      setMsg(el.msg, "Esa línea punteada es una pista (cuenta en tu resultado).");
    });

    el.next.addEventListener("click", () => {
      if (gameDone) { start(); return; }
      if (round < order.length - 1) { round++; loadRound(); return; }
      gameDone = true;
      el.name.textContent = "¡Completado!";
      el.clue.textContent = "";
      el.next.textContent = "Jugar otra vez";
      setMsg(el.msg, `Uniste las ${order.length} constelaciones en ${secs(elapsed)}, con ${errors} error(es) y ${hints} pista(s).`, "good");
    });

    function line(a, b, color, width, dash) {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
      ctx.setLineDash(dash || []);
      ctx.shadowColor = color; ctx.shadowBlur = dash ? 0 : 10;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
    }

    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      for (const d of decoys) {
        ctx.globalAlpha = 0.22 + 0.2 * Math.sin(now * 0.001 + d.p);
        ctx.fillStyle = "#cfd8ff";
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const k of drawn) {
        const [a, b] = k.split("-").map(Number);
        line(pts[a], pts[b], "#f5c978", 2.5);
      }
      if (hintKey && now < hintUntil) {
        const [a, b] = hintKey.split("-").map(Number);
        line(pts[a], pts[b], "#7fd6ff", 2, [8, 8]);
      }

      pts.forEach((s, i) => {
        const active = i === selected, hot = i === hover;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, active ? 30 : 22);
        g.addColorStop(0, "rgba(255,244,214,0.95)");
        g.addColorStop(0.25, active ? "rgba(245,201,120,0.55)" : "rgba(170,190,255,0.35)");
        g.addColorStop(1, "rgba(120,140,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s.x, s.y, active ? 30 : 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fffaf0";
        ctx.beginPath(); ctx.arc(s.x, s.y, hot || active ? 6.5 : 5, 0, Math.PI * 2); ctx.fill();
        if (active) {
          ctx.strokeStyle = "#f5c978"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(s.x, s.y, 14 + 2 * Math.sin(now * 0.008), 0, Math.PI * 2); ctx.stroke();
        }
      });
    }

    function frame(now) {
      if (!Santiel.isActive("constellations")) { running = false; return; }
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!roundDone && !gameDone) elapsed += dt;
      el.time.textContent = secs(elapsed);
      draw(now);
      requestAnimationFrame(frame);
    }

    return {
      resume() {
        if (!Santiel.isActive("constellations")) return;
        if (!started) { started = true; start(); }
        if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      },
    };
  })();

  /* ========================================================== 2. CUESTIONARIO */
  const QUESTIONS = [
    { q: "¿Cuál es el planeta más cercano al Sol?", o: ["Mercurio", "Venus", "Marte", "Tierra"], a: 0, why: "Mercurio da una vuelta al Sol cada 88 días." },
    { q: "¿Qué planeta es conocido como «el planeta rojo»?", o: ["Júpiter", "Marte", "Venus", "Mercurio"], a: 1, why: "Su color viene del óxido de hierro de su superficie." },
    { q: "¿Cuántos planetas tiene el sistema solar?", o: ["7", "8", "9", "10"], a: 1, why: "Son ocho desde que Plutón fue reclasificado como planeta enano en 2006." },
    { q: "Un año luz es una unidad de…", o: ["Tiempo", "Velocidad", "Distancia", "Brillo"], a: 2, why: "Es lo que recorre la luz en un año: unos 9,46 billones de km." },
    { q: "¿Cómo se llama nuestra galaxia?", o: ["Andrómeda", "Vía Láctea", "Triángulo", "Sombrero"], a: 1, why: "Es una espiral barrada con cientos de miles de millones de estrellas." },
    { q: "¿Qué planeta es famoso por sus anillos visibles?", o: ["Saturno", "Marte", "Mercurio", "Tierra"], a: 0, why: "Sus anillos son de hielo y roca." },
    { q: "¿Qué telescopio orbita el punto L2 y observa en infrarrojo?", o: ["Hubble", "Kepler", "James Webb", "Galileo"], a: 2, why: "El James Webb se lanzó el 25 de diciembre de 2021." },
    { q: "¿Qué ocurre durante un eclipse solar?", o: ["La Tierra tapa al Sol", "La Luna tapa al Sol", "Marte tapa al Sol", "El Sol se apaga"], a: 1, why: "La Luna se interpone entre el Sol y la Tierra." },
    { q: "¿Quién fue la primera persona en pisar la Luna?", o: ["Yuri Gagarin", "Buzz Aldrin", "Neil Armstrong", "John Glenn"], a: 2, why: "Fue el 20 de julio de 1969, en la misión Apolo 11." },
    { q: "¿De qué está hecho principalmente el Sol?", o: ["Hierro y roca", "Hidrógeno y helio", "Agua y hielo", "Oxígeno y carbono"], a: 1, why: "En su núcleo fusiona hidrógeno en helio." },
    { q: "¿Cuál es el planeta más grande del sistema solar?", o: ["Saturno", "Neptuno", "Júpiter", "Urano"], a: 2, why: "Caben más de 1.300 Tierras dentro de Júpiter." },
    { q: "¿Cuántas constelaciones reconoce oficialmente la Unión Astronómica Internacional?", o: ["12", "48", "88", "108"], a: 2, why: "Son 88, y cubren todo el cielo." },
    { q: "¿Qué planeta gira prácticamente «acostado»?", o: ["Urano", "Venus", "Júpiter", "Mercurio"], a: 0, why: "Su eje está inclinado unos 98°." },
    { q: "Una «estrella fugaz» es en realidad…", o: ["Una estrella que cae", "Un meteoro", "Un cometa entero", "Un satélite"], a: 1, why: "Es un grano de polvo o roca que se quema en la atmósfera." },
    { q: "¿Cuál es el planeta más caliente?", o: ["Mercurio", "Venus", "Marte", "Júpiter"], a: 1, why: "Venus llega a unos 465 °C por su efecto invernadero." },
  ];

  const Quiz = (() => {
    const el = {
      n: $("q-n"), score: $("q-score"), text: $("q-text"),
      options: $("q-options"), msg: $("q-msg"), next: $("q-next"),
    };
    const TOTAL = 8;
    let deck = [], i = 0, score = 0, answered = false, started = false;

    function render() {
      const item = deck[i];
      answered = false;
      el.n.textContent = `${i + 1}/${deck.length}`;
      el.score.textContent = String(score);
      el.text.textContent = item.q;
      el.msg.textContent = ""; el.msg.className = "game-msg";
      el.next.hidden = true;
      el.next.textContent = i === deck.length - 1 ? "Ver resultado" : "Siguiente";
      el.options.replaceChildren();
      shuffle(item.o.map((label, idx) => ({ label, idx }))).forEach(({ label, idx }) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "q-opt"; b.textContent = label; b.dataset.idx = String(idx);
        b.addEventListener("click", () => answer(b, idx));
        el.options.appendChild(b);
      });
    }

    function answer(btn, idx) {
      if (answered) return;
      answered = true;
      const item = deck[i];
      const ok = idx === item.a;
      if (ok) score++;
      el.score.textContent = String(score);
      el.options.querySelectorAll(".q-opt").forEach((b) => {
        b.disabled = true;
        if (Number(b.dataset.idx) === item.a) b.classList.add("right");
      });
      if (!ok) btn.classList.add("wrong");
      setMsg(el.msg, `${ok ? "¡Correcto!" : `Casi: era «${item.o[item.a]}».`} ${item.why}`, ok ? "good" : "bad");
      el.next.hidden = false;
    }

    function finish() {
      const pct = score / deck.length;
      const verdict = pct === 1 ? "¡Astrónomo perfecto! 🌟" : pct >= 0.7 ? "¡Muy bien, tienes buen ojo para el cielo!" : pct >= 0.4 ? "Vas por buen camino. ¡Pregúntale a Santiel y vuelve a intentarlo!" : "Todo explorador empieza así. ¡Conversa con Santiel y reintenta!";
      el.n.textContent = "Fin";
      el.text.textContent = `Acertaste ${score} de ${deck.length}`;
      el.options.replaceChildren();
      setMsg(el.msg, verdict, "good");
      el.next.textContent = "Jugar otra vez";
      el.next.hidden = false;
    }

    function start() {
      deck = shuffle(QUESTIONS).slice(0, TOTAL);
      i = 0; score = 0;
      render();
    }

    el.next.addEventListener("click", () => {
      if (el.n.textContent === "Fin") { start(); return; }
      if (i < deck.length - 1) { i++; render(); } else { finish(); }
    });

    return { init() { if (!started) { started = true; start(); } } };
  })();

  /* ========================================================== 3. CAZAMETEOROS */
  const Meteors = (() => {
    const canvas = $("m-canvas");
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const el = {
      score: $("m-score"), combo: $("m-combo"), time: $("m-time"), best: $("m-best"),
      overlay: $("m-overlay"), title: $("m-title"), sub: $("m-sub"), start: $("m-start"),
    };
    const KEY = "santiel_meteor_best", DURATION = 30;
    const backdrop = Array.from({ length: 90 }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(0.3, 1.2), p: rand(0, 6.28) }));

    let state = "idle", objs = [], sparks = [], pops = [];
    let score = 0, combo = 0, left = DURATION, spawnIn = 0, elapsed = 0, running = false, last = 0;
    let best = Number(safeGet(KEY)) || 0;
    el.best.textContent = String(best);

    const mult = () => Math.min(4, 1 + Math.floor(combo / 3));
    const hud = () => {
      el.score.textContent = String(score);
      el.combo.textContent = `x${mult()}`;
      el.time.textContent = String(Math.ceil(left));
    };

    function spawn() {
      if (Math.random() < 0.18) {
        const fromLeft = Math.random() < 0.5, speed = rand(80, 135);
        objs.push({ type: "sat", x: fromLeft ? -40 : W + 40, y: rand(60, H - 80), vx: fromLeft ? speed : -speed, vy: rand(-12, 12) });
      } else {
        objs.push({ type: "meteor", x: rand(40, W - 40), y: -20, vx: rand(-220, 220), vy: rand(170, 260) + elapsed * 4, r: rand(12, 17) });
      }
    }

    function burst(x, y, color) {
      for (let n = 0; n < 16; n++) {
        const a = rand(0, Math.PI * 2), s = rand(60, 220);
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rand(0.35, 0.7), color });
      }
    }

    function begin() {
      objs = []; sparks = []; pops = [];
      score = 0; combo = 0; left = DURATION; elapsed = 0; spawnIn = 0.4;
      state = "playing";
      el.overlay.hidden = true;
      hud();
      resume();
    }

    function end() {
      state = "over";
      const record = score > best;
      if (record) { best = score; safeSet(KEY, String(best)); el.best.textContent = String(best); }
      el.title.textContent = "¡Tiempo!";
      el.sub.textContent = `Lograste ${score} punto(s)${record ? " · ¡nuevo récord! 🏆" : "."}`;
      el.start.textContent = "Jugar otra vez";
      el.overlay.hidden = false;
    }

    function hit(p) {
      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        if (o.type === "meteor" && Math.hypot(p.x - o.x, p.y - o.y) <= o.r + 18) {
          const gain = mult();
          score += gain; combo++;
          burst(o.x, o.y, "255,210,130");
          pops.push({ x: o.x, y: o.y, text: `+${gain}`, life: 0, color: "#f5c978" });
          objs.splice(i, 1);
          return;
        }
        if (o.type === "sat" && Math.abs(p.x - o.x) <= 34 && Math.abs(p.y - o.y) <= 22) {
          score = Math.max(0, score - 3); combo = 0;
          burst(o.x, o.y, "170,180,220");
          pops.push({ x: o.x, y: o.y, text: "−3 satélite", life: 0, color: "#ff7b8a" });
          objs.splice(i, 1);
          shake(canvas);
          return;
        }
      }
    }

    function update(dt) {
      elapsed += dt; left -= dt;
      if (left <= 0) { left = 0; end(); return; }
      spawnIn -= dt;
      if (spawnIn <= 0) { spawn(); spawnIn = Math.max(0.32, 0.85 - elapsed * 0.014) * rand(0.7, 1.2); }
      for (const o of objs) {
        o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.y > H + 40 || o.x < -80 || o.x > W + 80) {
          o.dead = true;
          if (o.type === "meteor") combo = 0; // se escapó un meteoro
        }
      }
      objs = objs.filter((o) => !o.dead);
      for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life += dt; }
      sparks = sparks.filter((s) => s.life < s.max);
      for (const p of pops) { p.y -= 40 * dt; p.life += dt; }
      pops = pops.filter((p) => p.life < 0.9);
    }

    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#cfd8ff";
      for (const b of backdrop) {
        ctx.globalAlpha = 0.2 + 0.2 * Math.sin(now * 0.001 + b.p);
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const o of objs) {
        if (o.type === "meteor") {
          const mag = Math.hypot(o.vx, o.vy);
          const tx = o.x - (o.vx / mag) * 95, ty = o.y - (o.vy / mag) * 95;
          const tail = ctx.createLinearGradient(o.x, o.y, tx, ty);
          tail.addColorStop(0, "rgba(255,220,150,0.95)");
          tail.addColorStop(1, "rgba(255,140,60,0)");
          ctx.strokeStyle = tail; ctx.lineWidth = o.r * 0.9; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(tx, ty); ctx.stroke();
          const head = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 1.7);
          head.addColorStop(0, "#ffffff");
          head.addColorStop(0.35, "rgba(255,205,120,0.95)");
          head.addColorStop(1, "rgba(255,150,60,0)");
          ctx.fillStyle = head;
          ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 1.7, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.save();
          ctx.translate(o.x, o.y);
          ctx.fillStyle = "#4a6fd0"; ctx.strokeStyle = "#9db4ff"; ctx.lineWidth = 1;
          ctx.fillRect(-32, -5, 20, 10); ctx.strokeRect(-32, -5, 20, 10);
          ctx.fillRect(12, -5, 20, 10); ctx.strokeRect(12, -5, 20, 10);
          ctx.fillStyle = "#aeb7d6"; ctx.fillRect(-10, -8, 20, 16);
          ctx.fillStyle = "#6b7497"; ctx.fillRect(-10, -8, 20, 4);
          if (Math.floor(now / 300) % 2) { ctx.fillStyle = "#ff5a6a"; ctx.beginPath(); ctx.arc(0, -12, 2.5, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        }
      }
      for (const s of sparks) {
        ctx.fillStyle = `rgba(${s.color},${1 - s.life / s.max})`;
        ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
      }
      ctx.font = "700 20px Syne, sans-serif"; ctx.textAlign = "center";
      for (const p of pops) {
        ctx.globalAlpha = 1 - p.life / 0.9;
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      if (state !== "playing" || !Santiel.isActive("meteors")) { running = false; return; }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      update(dt);
      draw(now);
      hud();
      if (state === "playing") requestAnimationFrame(frame); else running = false;
    }

    function resume() {
      if (state === "playing" && !running && Santiel.isActive("meteors")) {
        running = true; last = performance.now(); requestAnimationFrame(frame);
      }
    }

    canvas.addEventListener("pointerdown", (e) => { if (state === "playing") hit(canvasPoint(canvas, e)); });
    el.start.addEventListener("click", begin);
    draw(0);
    return { resume };
  })();

  /* ====================================================== 4. ORDENA PLANETAS */
  const PLANETS = [
    { name: "Mercurio", c: ["#d6d6d6", "#7d7d7d"], fact: "Mercurio da una vuelta al Sol cada 88 días." },
    { name: "Venus", c: ["#f6dfb4", "#b98a48"], fact: "Venus es el planeta más caliente: unos 465 °C." },
    { name: "Tierra", c: ["#8cc8ff", "#2a63c9"], fact: "La Tierra es el único mundo conocido con vida." },
    { name: "Marte", c: ["#f08a5d", "#9c3418"], fact: "Marte tiene el volcán más alto conocido: el Monte Olimpo." },
    { name: "Júpiter", c: ["#e8c9a0", "#9d6f3f"], fact: "Dentro de Júpiter cabrían más de 1.300 Tierras." },
    { name: "Saturno", c: ["#f1e2b0", "#a98b4c"], fact: "Los anillos de Saturno son de hielo y roca." },
    { name: "Urano", c: ["#b4f0f2", "#3fa5af"], fact: "Urano gira «acostado», inclinado unos 98°." },
    { name: "Neptuno", c: ["#7f9bff", "#2436b8"], fact: "Neptuno tiene los vientos más veloces del sistema solar." },
  ];

  const Planets = (() => {
    const el = {
      grid: $("p-grid"), progress: $("p-progress"), errors: $("p-errors"),
      time: $("p-time"), msg: $("p-msg"), restart: $("p-restart"),
    };
    let next = 0, errors = 0, elapsed = 0, begun = false, finished = false, inited = false;

    function build() {
      next = 0; errors = 0; elapsed = 0; begun = false; finished = false;
      el.progress.textContent = `0/${PLANETS.length}`;
      el.errors.textContent = "0";
      el.time.textContent = "0 s";
      el.restart.hidden = true;
      setMsg(el.msg, "¿Cuál es el planeta más cercano al Sol? Empieza por ahí.");
      el.grid.replaceChildren();
      shuffle(PLANETS.map((p, idx) => ({ p, idx }))).forEach(({ p, idx }) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "planet";
        const orb = document.createElement("span");
        orb.className = "orb";
        orb.style.background = `radial-gradient(circle at 30% 30%, ${p.c[0]}, ${p.c[1]})`;
        const name = document.createElement("span");
        name.textContent = p.name;
        const ord = document.createElement("span");
        ord.className = "order";
        b.append(orb, name, ord);
        b.addEventListener("click", () => pick(b, idx, ord));
        el.grid.appendChild(b);
      });
    }

    function pick(btn, idx, ordEl) {
      if (finished || btn.disabled) return;
      begun = true;
      if (idx === next) {
        btn.disabled = true; btn.classList.add("done");
        ordEl.textContent = `#${next + 1}`;
        setMsg(el.msg, PLANETS[idx].fact, "good");
        next++;
        el.progress.textContent = `${next}/${PLANETS.length}`;
        if (next === PLANETS.length) {
          finished = true;
          setMsg(el.msg, `¡Sistema solar completo en ${secs(elapsed)} con ${errors} error(es)! 🪐`, "good");
          el.restart.hidden = false;
        }
      } else {
        errors++;
        el.errors.textContent = String(errors);
        shake(btn);
        setMsg(el.msg, "Ese no es el siguiente en la fila. ¡Sigue intentando!", "bad");
      }
    }

    setInterval(() => {
      if (begun && !finished && Santiel.isActive("planets")) {
        elapsed++;
        el.time.textContent = secs(elapsed);
      }
    }, 1000);

    el.restart.addEventListener("click", build);
    return { init() { if (!inited) { inited = true; build(); } } };
  })();

  /* ------------------------------------------------ activación por pestaña */
  function sync() {
    Constellations.resume();
    Meteors.resume();
    Planets.init();
    Quiz.init();
  }
  document.addEventListener("santiel:change", sync);
  sync();
})();
