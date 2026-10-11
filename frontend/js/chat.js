/* Chat con Santiel. El texto siempre se inserta con textContent (nunca innerHTML). */
(() => {
  const log = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const chips = document.getElementById("chips");
  const submit = form.querySelector("button");

  const SUGGESTIONS = [
    "¿Qué es un agujero negro?",
    "Háblame de Marte",
    "¿Por qué brilla el Sol?",
    "¿Qué es una estrella fugaz?",
    "¿Cómo observo el cielo?",
    "Quiero jugar",
  ];

  function addMessage(text, who, meta) {
    const el = document.createElement("div");
    el.className = `msg ${who}`;
    const p = document.createElement("span");
    p.textContent = text;
    el.appendChild(p);
    if (meta) {
      const m = document.createElement("span");
      m.className = "meta";
      m.textContent = meta;
      el.appendChild(m);
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function typingBubble() {
    const el = document.createElement("div");
    el.className = "msg bot typing";
    el.innerHTML = "<span></span><span></span><span></span>"; // contenido fijo, sin datos externos
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  async function ask(text) {
    addMessage(text, "user");
    input.value = "";
    submit.disabled = true;
    const typing = typingBubble();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      await new Promise((r) => setTimeout(r, 350)); // pequeña pausa para que se sienta natural
      typing.remove();
      if (!res.ok) {
        addMessage(data.error || "Algo salió mal.", "bot");
      } else {
        const meta = data.intent
          ? `Tema: ${data.intent.replace(/_/g, " ")} · confianza ${Math.round(data.confidence * 100)} %`
          : `Confianza baja (${Math.round(data.confidence * 100)} %)`;
        addMessage(data.reply, "bot", meta);
      }
    } catch {
      typing.remove();
      addMessage("No puedo conectarme con el servidor. ¿Está corriendo `python backend/app.py`?", "bot");
    } finally {
      submit.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) ask(text);
  });

  SUGGESTIONS.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = s;
    b.addEventListener("click", () => ask(s));
    chips.appendChild(b);
  });

  addMessage("¡Hola! Soy Santiel ✨ Una red neuronal pequeña que solo sabe de astronomía. ¿Qué quieres saber del universo?", "bot");
})();
