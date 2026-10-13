// Chat assistant panel. Talks to the Cloudflare Worker at chat.liuyutong.dev.
(() => {
  const BASE = "https://chat.liuyutong.dev";
  const API = `${BASE}/chat`;
  const STORE = "lyt-chat-v1";
  const SEEN = "lyt-chat-seen"; // localStorage: greeted on an earlier visit
  const UPDATES_CACHE = "lyt-chat-updates";

  // Greeting text in the visitor's browser language (the bot itself replies in any language).
  const LANG = (() => {
    const l = (navigator.language || "en").toLowerCase();
    return l.startsWith("zh") ? "zh" : l.startsWith("es") ? "es" : "en";
  })();
  const T = {
    en: {
      hello: ["Up late? 🦉", "Good morning! ☀️", "Good afternoon! 👋", "Good evening! 🌙"],
      back: "Welcome back! 👋",
      intro: "I'm Yutong's lab assistant, the AI who keeps up with everything she builds.",
      introBack: "Good to see you again.",
      news: (d, t) => `🔬 Fresh from the lab (${d}): ${t}`,
      ask: "Ask me about her robots, teaching or research, or leave her a message.",
      chips: ["What's new? ✨", "Tell me about SB01", "I'd like to talk with Yutong"],
    },
    zh: {
      hello: ["夜猫子你好 🦉", "早上好！☀️", "下午好！👋", "晚上好！🌙"],
      back: "欢迎回来！👋",
      intro: "我是 Yutong 的实验室助手，一个了解她所有项目的 AI。",
      introBack: "很高兴再见到你。",
      news: (d, t) => `🔬 实验室新鲜事（${d}）：${t}`,
      ask: "可以问我她的机器人、课程和研究，也可以给她留言。",
      chips: ["最近有什么新进展？✨", "介绍一下 SB01", "我想和 Yutong 聊聊"],
    },
    es: {
      hello: ["¿Despierto a estas horas? 🦉", "¡Buenos días! ☀️", "¡Buenas tardes! 👋", "¡Buenas noches! 🌙"],
      back: "¡Bienvenido de nuevo! 👋",
      intro: "Soy el asistente de laboratorio de Yutong, la IA que está al día con todo lo que construye.",
      introBack: "Qué gusto verte otra vez.",
      news: (d, t) => `🔬 Recién salido del laboratorio (${d}): ${t}`,
      ask: "Pregúntame por sus robots, sus clases o su investigación, o déjale un mensaje.",
      chips: ["¿Qué hay de nuevo? ✨", "Cuéntame sobre SB01", "Me gustaría hablar con Yutong"],
    },
  }[LANG];

  // Illustrated mini-Yutong with a little G1 sidekick. Inline so eyes can blink via CSS.
  const AVATAR = `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="#ffe6d6"/>
      <path d="M22 54C17 30 31 13 50 13s33 17 28 41l3 22c-11 7-51 7-62 0z" fill="#7a3b2a"/>
      <path d="M16 100c2-17 16-24 34-24s32 7 34 24z" fill="#2d3142"/>
      <rect x="44" y="66" width="12" height="12" rx="4" fill="#f0c2a2"/>
      <ellipse cx="50" cy="50" rx="22" ry="24" fill="#f9d6be"/>
      <path d="M27 50C26 30 38 19 51 19c14 0 24 10 22 28-3-6-7-10-12-11-2 4-6 7-11 8 3-3 4-6 3-9-7 2-15 6-20 12-2 1-4 2-6 3z" fill="#7a3b2a"/>
      <path d="M28 45c-3 11-2 21 2 29l3-2c-3-9-3-18-1-26zM72 45c3 11 2 21-2 29l-3-2c3-9 3-18 1-26z" fill="#7a3b2a"/>
      <path d="M36 45q5-2.5 10 0M54 45q5-2.5 10 0" stroke="#5a2a1d" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <g class="av-eyes">
        <ellipse cx="41" cy="52" rx="3" ry="3.7" fill="#3a2620"/>
        <ellipse cx="59" cy="52" rx="3" ry="3.7" fill="#3a2620"/>
        <circle cx="42.1" cy="50.7" r="1.1" fill="#fff"/>
        <circle cx="60.1" cy="50.7" r="1.1" fill="#fff"/>
      </g>
      <ellipse cx="35" cy="59" rx="4" ry="2.4" fill="#f29c9a" opacity=".55"/>
      <ellipse cx="65" cy="59" rx="4" ry="2.4" fill="#f29c9a" opacity=".55"/>
      <path d="M43 61q7 7 14 0q-7 3-14 0z" fill="#fff" stroke="#b5464f" stroke-width="1.5" stroke-linejoin="round"/>
      <g class="av-bot">
        <rect x="66" y="70" width="19" height="17" rx="6" fill="#dfe3e8" stroke="#9aa3ad" stroke-width="1.2"/>
        <rect x="69" y="74" width="13" height="7.5" rx="3.7" fill="#1d2330"/>
        <circle class="av-bot-eye" cx="73" cy="77.8" r="1.4" fill="#6fe3ff"/>
        <circle class="av-bot-eye" cx="78" cy="77.8" r="1.4" fill="#6fe3ff"/>
      </g>
    </svg>`;

  let history = [];
  try { history = JSON.parse(sessionStorage.getItem(STORE) || "[]"); } catch { history = []; }
  const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify(history)); } catch {} };

  let returning = false;
  try { returning = localStorage.getItem(SEEN) === "1"; } catch {}

  let greeting = null; // built once the latest update arrives (or times out)

  const root = document.createElement("aside");
  root.className = "chat";
  root.setAttribute("aria-label", "Chat with Yutong's assistant");
  root.innerHTML = `
    <div class="chat-head">
      <div class="chat-id">
        <div class="chat-av chat-av-lg">${AVATAR}<span class="chat-online" title="Online"></span></div>
        <div>
          <div class="chat-title">Yutong's lab assistant</div>
          <div class="chat-sub">AI · knows her latest work · any language</div>
        </div>
      </div>
      <button class="chat-close" type="button" aria-label="Close chat">×</button>
    </div>
    <div class="chat-log" role="log" aria-live="polite"></div>
    <div class="chat-chips"></div>
    <form class="chat-form">
      <textarea rows="1" maxlength="2000" placeholder="Type a message…" aria-label="Message"></textarea>
      <button type="submit" aria-label="Send">Send</button>
    </form>
    <div class="chat-note">Messages you leave here are saved and read by Yutong.</div>`;
  const toggle = document.createElement("button");
  toggle.className = "chat-toggle";
  toggle.type = "button";
  toggle.innerHTML = `<span class="chat-av chat-av-sm">${AVATAR}</span><span>Chat</span>`;
  toggle.setAttribute("aria-label", "Open chat");
  document.body.append(root, toggle);

  const log = root.querySelector(".chat-log");
  const chips = root.querySelector(".chat-chips");
  const form = root.querySelector(".chat-form");
  const input = form.querySelector("textarea");
  const send = form.querySelector("button");

  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const format = (s) =>
    esc(s)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");

  function bubble(role, text, { typing = false, wave = false } = {}) {
    const el = document.createElement("div");
    el.className = `chat-msg ${role}${typing ? " typing" : ""}`;
    el.innerHTML = typing ? "<span></span><span></span><span></span>" : format(text);
    if (role === "assistant") {
      const row = document.createElement("div");
      row.className = "chat-row";
      row.innerHTML = `<div class="chat-av chat-av-xs${wave ? " wave" : ""}">${AVATAR}</div>`;
      row.append(el);
      log.append(row);
    } else {
      log.append(el);
    }
    log.scrollTop = log.scrollHeight;
    return el.closest(".chat-row") || el;
  }

  function buildGreeting(update) {
    const h = new Date().getHours();
    const hello = returning ? T.back : T.hello[h < 5 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3];
    const parts = [`${hello} ${returning ? T.introBack : T.intro}`];
    if (update && update.teaser && update.teaser[LANG]) {
      const d = new Intl.DateTimeFormat(LANG === "zh" ? "zh-CN" : LANG, { month: "short", day: "numeric" })
        .format(new Date(`${update.date}T12:00:00`));
      parts.push(T.news(d, update.teaser[LANG]));
    }
    parts.push(T.ask);
    return parts.join("\n\n");
  }

  function render({ wave = false } = {}) {
    log.innerHTML = "";
    if (greeting) bubble("assistant", greeting, { wave });
    else bubble("assistant", "", { typing: true });
    history.forEach((m) => bubble(m.role, m.content));
    chips.innerHTML = "";
    if (history.length === 0 && greeting) {
      T.chips.forEach((s) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = s;
        b.addEventListener("click", () => ask(s));
        chips.append(b);
      });
    }
  }

  async function latestUpdate() {
    try {
      const cached = sessionStorage.getItem(UPDATES_CACHE);
      if (cached) return JSON.parse(cached);
    } catch {}
    try {
      const res = await fetch(`${BASE}/updates`);
      const data = await res.json();
      const u = (data.updates || [])[0] || null;
      try { sessionStorage.setItem(UPDATES_CACHE, JSON.stringify(u)); } catch {}
      return u;
    } catch {
      return null;
    }
  }

  async function greet() {
    const timeout = new Promise((r) => setTimeout(() => r(null), 1500));
    const pause = new Promise((r) => setTimeout(r, history.length ? 0 : 700)); // brief "typing…"
    const [update] = await Promise.all([Promise.race([latestUpdate(), timeout]), pause]);
    greeting = buildGreeting(update);
    render({ wave: history.length === 0 });
    try { localStorage.setItem(SEEN, "1"); } catch {}
  }

  async function ask(text) {
    text = text.trim();
    if (!text || send.disabled) return;
    if (history.length >= 28) history = history.slice(-20); // keep requests small
    history.push({ role: "user", content: text });
    save();
    render();
    input.value = "";
    autosize();
    send.disabled = true;
    const typing = bubble("assistant", "", { typing: true });
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = data.reply || "Sorry, something went wrong. Please try again.";
      if (data.reply && res.ok) {
        history.push({ role: "assistant", content: reply });
        save();
      } else {
        history.pop(); // let the visitor resend
        save();
      }
      typing.remove();
      render();
      if (!res.ok) bubble("assistant", reply);
    } catch {
      typing.remove();
      history.pop();
      save();
      render();
      bubble("assistant", "I couldn't reach the server. Please check your connection and try again.");
    } finally {
      send.disabled = false;
      input.focus();
    }
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); }
  });
  input.addEventListener("input", autosize);
  toggle.addEventListener("click", () => { root.classList.add("open"); toggle.hidden = true; input.focus(); render({ wave: history.length === 0 && !!greeting }); });
  root.querySelector(".chat-close").addEventListener("click", () => { root.classList.remove("open"); toggle.hidden = false; });

  render();
  greet();
})();
