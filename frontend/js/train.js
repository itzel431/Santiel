/* Panel de entrenamiento: lanza el entrenamiento, dibuja la curva en vivo y permite enseñar frases. */
(() => {
  const $ = (id) => document.getElementById(id);
  const statsBox = $("stats"), trainForm = $("train-form"), btn = $("t-btn");
  const bar = $("t-bar"), statusLine = $("t-status"), canvas = $("t-chart");
  const ctx = canvas.getContext("2d");
  const tagSel = $("teach-tag"), newTagWrap = $("teach-newtag-wrap"), respWrap = $("teach-response-wrap");
  const NEW = "__new__";
  let pollTimer = null;

  function setStatus(el, text, kind) {
    el.textContent = text;
    el.className = `status-line${kind ? " " + kind : ""}`;
  }

  /* ---------- estadísticas ---------- */
  function statBox(value, label) {
    const d = document.createElement("div");
    d.className = "stat";
    const b = document.createElement("b");
    b.textContent = value;
    const s = document.createElement("span");
    s.textContent = label;
    d.append(b, s);
    return d;
  }

  async function loadStats() {
    try {
      const s = await (await fetch("/api/stats")).json();
      statsBox.replaceChildren(
        statBox(s.topics, "temas"),
        statBox(s.patterns, "preguntas de ejemplo"),
        statBox(s.model ? s.model.parameters.toLocaleString("es") : "—", "parámetros"),
        statBox(s.model && s.model.cv_accuracy != null ? `${Math.round(s.model.cv_accuracy * 100)} %` : "—",
                "precisión con frases nuevas*"),
      );
      const foot = document.createElement("small");
      foot.style.cssText = "grid-column:1/-1;color:var(--muted)";
      foot.textContent = "* Estimación conservadora (validación cruzada): se prueba con frases que la red no vio al entrenar. Mejora con más ejemplos.";
      statsBox.appendChild(foot);
    } catch {
      statsBox.textContent = "No se pudieron cargar las estadísticas.";
    }
  }

  /* ---------- gráfica ---------- */
  function drawChart(loss, acc) {
    const W = canvas.width, H = canvas.height, pad = { l: 40, r: 12, t: 12, b: 26 };
    ctx.clearRect(0, 0, W, H);
    ctx.font = "12px Figtree, sans-serif";
    ctx.fillStyle = "#9aa3c7";
    ctx.strokeStyle = "rgba(160,180,255,0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ((H - pad.t - pad.b) * i) / 4;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillText(`${100 - i * 25}%`, 4, y + 4);
    }
    ctx.fillText("época →", W - 62, H - 8);
    if (!loss.length) return;

    const n = Math.max(loss.length, 2);
    const lossMax = Math.max(...loss, 0.01);
    const x = (i) => pad.l + ((W - pad.l - pad.r) * i) / (n - 1);
    const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v);

    const line = (arr, norm, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      arr.forEach((v, i) => (i ? ctx.lineTo(x(i), y(norm(v))) : ctx.moveTo(x(i), y(norm(v)))));
      ctx.stroke();
    };
    line(loss, (v) => v / lossMax, "#f5c978");
    line(acc, (v) => v, "#7fd6ff");
  }

  /* ---------- entrenamiento ---------- */
  async function poll() {
    try {
      const s = await (await fetch("/api/train/status")).json();
      bar.style.width = s.epochs ? `${Math.round((s.epoch / s.epochs) * 100)}%` : "0%";
      drawChart(s.loss, s.acc);
      if (s.running) {
        const last = s.loss.length ? s.loss[s.loss.length - 1] : null;
        setStatus(statusLine,
          s.phase === "evaluando"
            ? "Evaluando con validación cruzada…"
            : `Época ${s.epoch}/${s.epochs}${last != null ? ` · pérdida ${last}` : ""}`);
        pollTimer = setTimeout(poll, 350);
        return;
      }
      btn.disabled = false;
      if (s.phase === "listo") {
        bar.style.width = "100%";
        setStatus(statusLine, `¡Listo! Precisión estimada con frases nuevas: ${Math.round(s.cv_accuracy * 100)} %`, "good");
        loadStats();
      } else if (s.phase === "error") {
        setStatus(statusLine, `Error: ${s.error}`, "bad");
      }
    } catch {
      btn.disabled = false;
      setStatus(statusLine, "Se perdió la conexión con el servidor.", "bad");
    }
  }

  trainForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    btn.disabled = true;
    setStatus(statusLine, "Iniciando…");
    try {
      const res = await fetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          epochs: Number($("t-epochs").value),
          hidden: Number($("t-hidden").value),
          lr: Number($("t-lr").value),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar.");
      clearTimeout(pollTimer);
      poll();
    } catch (err) {
      btn.disabled = false;
      setStatus(statusLine, err.message, "bad");
    }
  });

  /* ---------- enseñar ---------- */
  async function loadTopics() {
    try {
      const topics = await (await fetch("/api/topics")).json();
      tagSel.replaceChildren();
      topics.forEach((t) => {
        const o = document.createElement("option");
        o.value = t.tag;
        o.textContent = `${t.tag.replace(/_/g, " ")} (${t.patterns})`;
        tagSel.appendChild(o);
      });
      const n = document.createElement("option");
      n.value = NEW;
      n.textContent = "➕ Tema nuevo…";
      tagSel.appendChild(n);
    } catch { /* se reintentará al enviar */ }
  }

  tagSel.addEventListener("change", () => {
    const isNew = tagSel.value === NEW;
    newTagWrap.hidden = !isNew;
    respWrap.hidden = !isNew;
  });

  $("teach-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const isNew = tagSel.value === NEW;
    const tag = isNew
      ? $("teach-newtag").value.trim().toLowerCase().replace(/\s+/g, "_")
      : tagSel.value;
    const status = $("teach-status");
    try {
      const res = await fetch("/api/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tag,
          pattern: $("teach-pattern").value,
          response: isNew ? $("teach-response").value : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      const n = data.patterns;
      setStatus(status, `${data.note} (${n} ejemplo${n === 1 ? "" : "s"} en «${data.tag}»)`, "good");
      $("teach-pattern").value = "";
      if (isNew) { $("teach-newtag").value = ""; $("teach-response").value = ""; }
      loadTopics().then(() => { tagSel.value = data.tag; tagSel.dispatchEvent(new Event("change")); });
      loadStats();
    } catch (err) {
      setStatus(status, err.message, "bad");
    }
  });

  document.addEventListener("santiel:change", (e) => {
    if (e.detail.view === "train") { loadStats(); loadTopics(); }
  });

  drawChart([], []);
  loadStats();
  loadTopics();
  fetch("/api/train/status").then((r) => r.json()).then((s) => {
    if (s.running) { btn.disabled = true; poll(); }
  }).catch(() => {});
})();
