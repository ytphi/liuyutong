// Chat assistant panel. Talks to the Cloudflare Worker at chat.liuyutong.dev.
(() => {
  const API = "https://chat.liuyutong.dev/chat";
  const STORE = "lyt-chat-v1";
  const GREETING =
    "Hi! I'm Yutong's assistant. Ask me about her projects, teaching or research — " +
    "or leave her a message if you'd like to talk.";
  const SUGGESTIONS = ["What does Yutong build?", "Tell me about SB01", "I'd like to talk with Yutong"];

  let history = [];
  try { history = JSON.parse(sessionStorage.getItem(STORE) || "[]"); } catch { history = []; }
  const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify(history)); } catch {} };

  const root = document.createElement("aside");
  root.className = "chat";
  root.setAttribute("aria-label", "Chat with Yutong's assistant");
  root.innerHTML = `
    <div class="chat-head">
      <div>
        <div class="chat-title">Ask about my work</div>
        <div class="chat-sub">AI assistant · replies in your language</div>
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
  toggle.textContent = "Chat";
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

  function bubble(role, text) {
    const el = document.createElement("div");
    el.className = `chat-msg ${role}`;
    el.innerHTML = format(text);
    log.append(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function render() {
    log.innerHTML = "";
    bubble("assistant", GREETING);
    history.forEach((m) => bubble(m.role, m.content));
    chips.innerHTML = "";
    if (history.length === 0) {
      SUGGESTIONS.forEach((s) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = s;
        b.addEventListener("click", () => ask(s));
        chips.append(b);
      });
    }
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
    const typing = bubble("assistant typing", "…");
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
  toggle.addEventListener("click", () => { root.classList.add("open"); toggle.hidden = true; input.focus(); });
  root.querySelector(".chat-close").addEventListener("click", () => { root.classList.remove("open"); toggle.hidden = false; });

  render();
})();
