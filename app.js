(() => {
  "use strict";

  const FEATURED_ID = "c26-093";
  const TZ = "America/Guatemala";
  const DAY_META = {
    "2026-11-10": { weekday: "Tuesday", short: "Tue" },
    "2026-11-11": { weekday: "Wednesday", short: "Wed" },
    "2026-11-12": { weekday: "Thursday", short: "Thu" },
    "2026-11-13": { weekday: "Friday", short: "Fri" },
  };

  const state = {
    program: null,
    day: null,
    query: "",
    type: "",
    room: "",
  };

  const $ = (id) => document.getElementById(id);

  function asset(path) {
    const p = location.pathname;
    const root = /\/$/.test(p)
      ? p
      : /\.[a-zA-Z0-9]+$/.test(p)
        ? p.replace(/\/[^/]*$/, "/")
        : p + "/";
    return root + path.replace(/^\//, "");
  }

  function nowParts() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      time: `${get("hour")}:${get("minute")}`,
    };
  }

  function isLive(session, now) {
    return session.date === now.date && session.start <= now.time && now.time < session.end;
  }

  function isFeatured(session) {
    return session.id === FEATURED_ID;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function dayLabel(date, { long = false } = {}) {
    const meta = DAY_META[date] || {};
    const d = date.slice(8);
    const month = "Nov";
    if (long) return `${meta.weekday || ""}, ${d} ${month} 2026`;
    return `${meta.short || ""}\n${d} ${month}`;
  }

  function haystack(session) {
    const papers = (session.papers || [])
      .map((p) => `${p.title} ${p.authors} ${p.time || ""}`)
      .join(" ");
    return [
      session.title,
      session.speakers,
      session.org,
      session.room,
      session.type,
      session.notes,
      session.id,
      session.code,
      papers,
    ]
      .join(" ")
      .toLowerCase();
  }

  function matches(session) {
    if (session.date !== state.day) return false;
    if (state.type && session.type !== state.type) return false;
    if (state.room && session.room !== state.room) return false;
    if (state.query) {
      const q = state.query.trim().toLowerCase();
      if (q && !haystack(session).includes(q)) return false;
    }
    return true;
  }

  function roomLabel(room) {
    if (!room) return "";
    if (/^all rooms$/i.test(room)) return "All rooms";
    if (/^not stated$/i.test(room)) return "Room not stated";
    if (/^room\b/i.test(room) || /^sal[oó]n\b/i.test(room) || /^hotel\b/i.test(room) || /^auditorium/i.test(room)) {
      return room;
    }
    return "Room " + room;
  }

  function publicNotes(session) {
    const notes = (session.notes || "").trim();
    if (!notes) return "";
    if (/^jaime'?s session$/i.test(notes)) return "";
    return notes;
  }

  function renderFeatured(sessions) {
    const s = sessions.find(isFeatured);
    const el = $("featured");
    if (!s) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    $("featured-body").innerHTML = `
      <p class="featured-kicker">Featured session</p>
      <h2>${escapeHtml(s.title)}</h2>
      <p class="who">${escapeHtml(s.speakers)}${s.org ? " · " + escapeHtml(s.org) : ""}</p>
      <p>${escapeHtml(dayLabel(s.date, { long: true }))} · ${escapeHtml(s.start)}–${escapeHtml(s.end)} · Room ${escapeHtml(s.room)}</p>
      <p>${escapeHtml(s.type)} · Hotel Westin Camino Real, Ciudad de Guatemala</p>
      <a class="btn" href="#${encodeURIComponent(s.id)}" id="jump-featured">View in program</a>
    `;
    $("jump-featured")?.addEventListener("click", (e) => {
      e.preventDefault();
      jumpTo(s.id);
    });
  }

  function renderDays(sessions) {
    const days = [...new Set(sessions.map((s) => s.date))].sort();
    const today = nowParts().date;
    const nav = $("days");
    nav.innerHTML = "";
    for (const date of days) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-btn";
      btn.id = `day-${date}`;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", date === state.day ? "true" : "false");
      btn.setAttribute("aria-controls", "timeline");
      const [short, rest] = dayLabel(date).split("\n");
      const todayMark = date === today ? ` <span class="sub">Today</span>` : "";
      btn.innerHTML = `<span>${escapeHtml(short)} ${escapeHtml(rest)}</span>${todayMark}`;
      btn.addEventListener("click", () => {
        state.day = date;
        history.replaceState(null, "", `#day-${date}`);
        render();
      });
      nav.appendChild(btn);
    }
  }

  function fillSelect(el, values, allLabel) {
    const current = el.value;
    el.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>` +
      values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    if ([...el.options].some((o) => o.value === current)) el.value = current;
  }

  function renderFilters(sessions) {
    const types = [...new Set(sessions.map((s) => s.type).filter(Boolean))].sort();
    const rooms = [...new Set(sessions.map((s) => s.room).filter(Boolean))].sort();
    fillSelect($("filter-type"), types, "All types");
    fillSelect($("filter-room"), rooms, "All rooms");
  }

  function paperList(papers) {
    if (!papers || !papers.length) return "";
    const items = papers
      .map(
        (p) => `
        <article class="paper">
          ${p.time ? `<div class="paper-time">${escapeHtml(p.time)}</div>` : ""}
          <p class="paper-title">${escapeHtml(p.title)}</p>
          ${p.authors ? `<p class="paper-authors">${escapeHtml(p.authors)}</p>` : ""}
        </article>`
      )
      .join("");
    return `<details class="papers"><summary>${papers.length} paper${papers.length === 1 ? "" : "s"}</summary>${items}</details>`;
  }

  function sessionCard(session, now) {
    const featured = isFeatured(session);
    const live = isLive(session, now);
    const notes = publicNotes(session);
    const classes = ["session", featured ? "featured-session" : "", live ? "live" : ""]
      .filter(Boolean)
      .join(" ");
    const badges = [
      `<span class="badge">${escapeHtml(session.type)}</span>`,
      featured ? `<span class="badge badge-featured">Featured</span>` : "",
      live ? `<span class="badge badge-live">Now</span>` : "",
    ].join("");
    const facts = [
      `<li><strong>${escapeHtml(session.start)}–${escapeHtml(session.end)}</strong></li>`,
      session.room ? `<li>${escapeHtml(roomLabel(session.room))}</li>` : "",
      session.speakers ? `<li>${escapeHtml(session.speakers)}${session.org ? " · " + escapeHtml(session.org) : ""}</li>` : session.org ? `<li>${escapeHtml(session.org)}</li>` : "",
    ].join("");
    return `
      <article class="${classes}" id="${escapeHtml(session.id)}">
        <div class="session-top">${badges}</div>
        <h3>${escapeHtml(session.title)}</h3>
        <ul class="facts">${facts}</ul>
        ${notes ? `<p class="notes">${escapeHtml(notes)}</p>` : ""}
        ${paperList(session.papers)}
      </article>`;
  }

  function renderTimeline(sessions) {
    const now = nowParts();
    const visible = sessions.filter(matches);
    const status = $("status");
    const totalDay = sessions.filter((s) => s.date === state.day).length;
    const dayName = dayLabel(state.day, { long: true });
    if (!visible.length) {
      status.textContent = `No sessions match on ${dayName}.`;
      $("timeline").innerHTML = `<p class="empty">Try clearing the search or filters.</p>`;
      return;
    }
    const extra = visible.length === totalDay ? "" : ` (filtered from ${totalDay})`;
    status.textContent = `${visible.length} session${visible.length === 1 ? "" : "s"} · ${dayName}${extra}`;

    const groups = new Map();
    for (const s of visible) {
      const key = `${s.start}|${s.end}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }
    const html = [...groups.entries()]
      .map(([key, items]) => {
        const [start, end] = key.split("|");
        return `<section class="slot" aria-label="${escapeHtml(start)} to ${escapeHtml(end)}">
          <div class="slot-time">${escapeHtml(start)}–${escapeHtml(end)}</div>
          ${items.map((s) => sessionCard(s, now)).join("")}
        </section>`;
      })
      .join("");
    $("timeline").innerHTML = html;
  }

  function render() {
    const sessions = state.program.sessions;
    renderDays(sessions);
    renderFilters(sessions);
    renderTimeline(sessions);
    const jump = location.hash.replace(/^#/, "");
    if (jump && $(jump) && sessions.some((s) => s.id === jump && s.date === state.day)) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => {
        $(jump).scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      });
    }
  }

  function jumpTo(id) {
    const session = state.program.sessions.find((s) => s.id === id);
    if (!session) return;
    state.day = session.date;
    history.replaceState(null, "", `#${id}`);
    render();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scroll = () => {
      const el = $(id);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    };
    requestAnimationFrame(() => setTimeout(scroll, 50));
  }

  function pickInitialDay(sessions) {
    const hash = location.hash.replace(/^#/, "");
    if (hash.startsWith("day-") && sessions.some((s) => s.date === hash.slice(4))) {
      return hash.slice(4);
    }
    const byId = sessions.find((s) => s.id === hash);
    if (byId) return byId.date;
    const today = nowParts().date;
    const dates = [...new Set(sessions.map((s) => s.date))].sort();
    if (dates.includes(today)) return today;
    return dates[0];
  }

  async function loadProgram() {
    const url = asset("data/program.json");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load program data (${res.status})`);
    return res.json();
  }

  function wire() {
    $("search").addEventListener("input", (e) => {
      state.query = e.target.value;
      render();
    });
    $("filter-type").addEventListener("change", (e) => {
      state.type = e.target.value;
      render();
    });
    $("filter-room").addEventListener("change", (e) => {
      state.room = e.target.value;
      render();
    });
    window.addEventListener("hashchange", () => {
      const hash = location.hash.replace(/^#/, "");
      if (hash && state.program.sessions.some((s) => s.id === hash)) jumpTo(hash);
    });
    $("ics-link").href = asset("CONCAPAN-2026-program.ics");
  }

  async function init() {
    wire();
    try {
      const program = await loadProgram();
      state.program = program;
      $("session-count").textContent = `${program.sessions.length} sessions`;
      state.day = pickInitialDay(program.sessions);
      renderFeatured(program.sessions);
      render();
      const hash = location.hash.replace(/^#/, "");
      if (hash && program.sessions.some((s) => s.id === hash)) jumpTo(hash);
    } catch (err) {
      $("status").textContent = "The program could not be loaded. Please refresh the page.";
      console.error(err);
    }
  }

  init();
})();
