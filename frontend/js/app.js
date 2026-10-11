/* Navegación entre secciones y juegos + diagrama de la red. */
window.Santiel = (() => {
  const state = { view: "chat", game: "constellations" };

  function emit() {
    document.dispatchEvent(new CustomEvent("santiel:change", { detail: { ...state } }));
  }

  function showView(name) {
    state.view = name;
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("is-active", v.id === `view-${name}`));
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.view === name));
    history.replaceState(null, "", `#${name}`);
    window.scrollTo({ top: 0 });
    emit();
  }

  function showGame(name) {
    state.game = name;
    document.querySelectorAll(".game").forEach((g) => g.classList.toggle("is-active", g.id === `game-${name}`));
    document.querySelectorAll(".subtab").forEach((b) => b.classList.toggle("is-active", b.dataset.game === name));
    emit();
  }

  document.querySelectorAll(".nav-btn").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
  document.querySelectorAll(".subtab").forEach((b) => b.addEventListener("click", () => showGame(b.dataset.game)));
  document.querySelector(".brand").addEventListener("click", (e) => { e.preventDefault(); showView("chat"); });

  const initial = location.hash.replace("#", "");
  if (["chat", "games", "train", "about"].includes(initial)) showView(initial);

  /* Diagrama decorativo de la red: entrada -> oculta -> salida */
  (function drawNet() {
    const svg = document.getElementById("net-svg");
    if (!svg) return;
    const NS = "http://www.w3.org/2000/svg";
    const layers = [
      { n: 6, x: 90, label: "Entrada (palabras)", color: "#7fd6ff" },
      { n: 7, x: 320, label: "Capa oculta (ReLU)", color: "#a78bfa" },
      { n: 5, x: 550, label: "Salida (temas)", color: "#f5c978" },
    ];
    const pos = layers.map((L) =>
      Array.from({ length: L.n }, (_, i) => ({ x: L.x, y: 30 + ((i + 0.5) * 190) / L.n + (7 - L.n) * 4 })),
    );
    const add = (tag, attrs, parent = svg) => {
      const el = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      parent.appendChild(el);
      return el;
    };
    for (let l = 0; l < pos.length - 1; l++) {
      for (const a of pos[l]) {
        for (const b of pos[l + 1]) {
          add("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "rgba(160,180,255,0.14)", "stroke-width": 1 });
        }
      }
    }
    pos.forEach((nodes, l) => {
      nodes.forEach((p) => add("circle", { cx: p.x, cy: p.y, r: 9, fill: layers[l].color, "fill-opacity": 0.85 }));
      const t = add("text", { x: layers[l].x, y: 252, "text-anchor": "middle", fill: "#9aa3c7", "font-size": 13 });
      t.textContent = layers[l].label;
    });
  })();

  return {
    get view() { return state.view; },
    get game() { return state.game; },
    isActive: (game) => state.view === "games" && state.game === game,
  };
})();
