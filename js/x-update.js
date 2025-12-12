 const API_BASE = "http://localhost:3300";

    const $ = (s) => document.querySelector(s);

    const statusDot = $("#statusDot");
    const statusText = $("#statusText");
    const apiLine = $("#apiLine");
    const list = $("#list");
    const note = $("#note");
    const statsBox = $("#statsBox");
    const search = $("#search");

    apiLine.textContent = `API: ${API_BASE}`;

    const timeoutFetch = async (url, ms = 12000) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        const ct = res.headers.get("content-type") || "";
        const data = ct.includes("json") ? await res.json().catch(() => null) : await res.text().catch(() => "");
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, data });
        return data;
      } finally {
        clearTimeout(t);
      }
    };

    const setStatus = (kind, text) => {
      statusDot.classList.toggle("ok", kind === "ok");
      statusDot.classList.toggle("bad", kind === "bad");
      statusText.textContent = text;
    };

    const fmtDate = (v) => {
      try {
        const d = new Date(v);
        return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
      } catch { return String(v || ""); }
    };

    const render = (updates) => {
      const q = (search.value || "").trim().toLowerCase();
      const filtered = (updates || []).filter(u => {
        const s = `${u.title || ""} ${u.text || ""} ${u.body || ""}`.toLowerCase();
        return !q || s.includes(q);
      });

      list.innerHTML = "";
      if (!filtered.length) {
        list.innerHTML = `<div class="item"><div class="title">No updates</div><div class="text">Either nothing happened, or your API didn’t return anything. Both are believable.</div></div>`;
        return;
      }

      for (const u of filtered) {
        const title = u.title || u.name || "Update";
        const text = u.text || u.body || u.message || "";
        const at = u.date || u.created_at || u.timestamp || "";
        const tag = u.tag || u.type || u.level || "info";

        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
          <div class="title">${escapeHtml(title)}</div>
          <div class="meta">
            <span class="mono">${escapeHtml(tag)}</span>
            <span>${escapeHtml(at ? fmtDate(at) : "")}</span>
          </div>
          ${text ? `<div class="text">${escapeHtml(text)}</div>` : ``}
        `;
        list.appendChild(div);
      }
    };

    const escapeHtml = (s) =>
      String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));

    const loadUpdates = async () => {
      setStatus("warn", "Checking…");
      note.textContent = "";

      try {
        const data = await timeoutFetch(`${API_BASE}/v1/updates`);
        const updates = Array.isArray(data) ? data : (data.updates || data.data || []);
        localStorage.setItem("x_updates_cache", JSON.stringify({ at: Date.now(), updates }));
        setStatus("ok", "Online");
        render(updates);
        note.textContent = `Last updated: ${fmtDate(Date.now())}`;
      } catch (e) {
        setStatus("bad", "Offline");
        const cached = safeParse(localStorage.getItem("x_updates_cache"));
        if (cached?.updates?.length) {
          render(cached.updates);
          note.textContent = `API failed. Showing cached updates from ${fmtDate(cached.at)}.`;
        } else {
          list.innerHTML = `<div class="item"><div class="title">Can’t reach API</div><div class="text">Set API_BASE in update.html, and make sure your server allows CORS for GitHub Pages.</div></div>`;
          note.textContent = e?.message || "Fetch failed";
        }
      }
    };

    const loadStats = async () => {
      try {
        const data = await timeoutFetch(`${API_BASE}/v1/stats`);
        statsBox.textContent = JSON.stringify(data, null, 2);
      } catch {
        statsBox.textContent = "Stats unavailable (optional endpoint).";
      }
    };

    const safeParse = (s) => { try { return JSON.parse(s); } catch { return null; } };

    $("#refreshBtn").addEventListener("click", () => { loadUpdates(); loadStats(); });
    search.addEventListener("input", () => {
      const cached = safeParse(localStorage.getItem("x_updates_cache"));
      render(cached?.updates || []);
    });

    loadUpdates();
    loadStats();
    // Auto-refresh every 60s
    setInterval(loadUpdates, 60000);
