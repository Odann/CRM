/* Afterlife CRM — views, routing and actions. Mock proof of concept: no server, no real accounts. */
(function () {
  const S = window.Store;
  let db = S.load();
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const paletteRoot = document.getElementById('palette-root');
  const SESSION = 'afterlife_session';
  const FILTERS_KEY = 'afterlife_filters_v1';
  const DEFAULT_LOGO = 'assets/img/logo.svg';

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-CA');
  const today = () => S.day(0);
  const addMonths = (dstr, n) => { const [y, m, d] = dstr.split('-').map(Number); const dt = new Date(y, m - 1 + n, d); const z = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
  const fmtDate = (d) => {
    if (!d) return '—';
    const [y, m, dd] = d.split('-').map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const byId = (list, id) => db[list].find((x) => x.id === id);
  const fullName = (c) => c ? (c.first + ' ' + c.last).trim() : '';
  const companyName = (id) => { const c = byId('companies', id); return c ? c.name : ''; };
  const allStages = () => db.settings.stages.concat(['Won', 'Lost']);
  const isOpen = (d) => d.stage !== 'Won' && d.stage !== 'Lost';
  const logoSrc = () => db.settings.logo || DEFAULT_LOGO;
  const user = () => { try { return localStorage.getItem(SESSION) || ''; } catch (e) { return ''; } };
  const save = () => { if (!S.save()) toast('Could not save: browser storage is full or blocked.'); };
  const dueClass = (d, done) => done ? '' : (d && d < today() ? 'overdue' : (d === today() ? 'due-today' : ''));
  const tagsHtml = (tags) => (tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
  const go = (h) => { if (location.hash === h) render(); else location.hash = h; };
  const initials = (name) => (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const hue = (str) => { let h = 0; for (const c of String(str || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
  const avatar = (name, square) => `<span class="avatar${square ? ' sq' : ''}" style="--h:${hue(name)}">${esc(initials(name))}</span>`;
  const forecastOf = (deals) => deals.reduce((s, d) => s + d.value * ((db.settings.stageProbabilities[d.stage] || 0) / 100), 0);

  /* ---------- toast (supports an action button, e.g. Undo) ---------- */
  let toastTimer;
  function toast(msg, action) {
    const t = $('#toast');
    t.innerHTML = esc(msg) + (action ? ` <button type="button" class="toast-btn" id="toast-act">${esc(action.label)}</button>` : '');
    t.classList.add('show');
    clearTimeout(toastTimer);
    if (action) $('#toast-act').addEventListener('click', () => { action.fn(); t.classList.remove('show'); });
    toastTimer = setTimeout(() => t.classList.remove('show'), action ? 7000 : 2600);
  }

  /* ---------- undo: whole-store snapshot taken before a destructive action ---------- */
  function snapshot() { return JSON.stringify(db); }
  function restoreSnapshot(json) {
    try { db = JSON.parse(json); S.data = db; save(); render(); toast('Restored'); }
    catch (e) { toast('Could not restore that change.'); }
  }

  /* ---------- icons (simple original line icons) ---------- */
  const I = {
    dashboard: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
    contacts: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    companies: '<path d="M4 21V5l8-2v18M12 9l8 2v10M2 21h20M7 8h2M7 12h2M7 16h2M15 14h2M15 17h2"/>',
    pipeline: '<path d="M3 4h5v16H3zM10 4h5v10h-5zM17 4h4v6h-4z"/>',
    tasks: '<path d="M4 6l2 2 3-4M4 13l2 2 3-4M4 20l2 1 3-4M12 6h8M12 13h8M12 20h8"/>',
    projects: '<path d="M3 7h7l2 2h9v11H3zM3 7V4h6l2 3"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-8M21 20H2M20 20v-5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'
  };
  const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${I[n] || ''}</svg>`;

  const NAV = [
    { id: 'dashboard', label: 'Dashboard' }, { id: 'contacts', label: 'Contacts' },
    { id: 'companies', label: 'Companies' }, { id: 'pipeline', label: 'Pipeline' },
    { id: 'tasks', label: 'Tasks' }, { id: 'projects', label: 'Projects' },
    { id: 'reports', label: 'Reports' }, { id: 'settings', label: 'Settings' }
  ];

  /* ---------- theme ---------- */
  function applyTheme() {
    const th = db.settings.theme || { accent: '#ff3b45', glow: true };
    document.documentElement.style.setProperty('--red', th.accent);
    document.body.classList.toggle('no-glow', !th.glow);
  }

  /* ---------- modal + forms ---------- */
  function modal(html) {
    modalRoot.innerHTML = `<div class="overlay"><div class="modal panel" role="dialog" aria-modal="true">${html}</div></div>`;
    const f = $('input,select,textarea,button', modalRoot);
    if (f) f.focus();
  }
  function closeModal() { modalRoot.innerHTML = ''; }
  function closePalette() { paletteRoot.innerHTML = ''; }

  function fieldHtml(f, v) {
    const id = 'f_' + f.name;
    const req = f.required ? ' required' : '';
    let input;
    if (f.type === 'select') {
      const opts = (f.blank === false ? [] : [{ value: '', label: '—' }]).concat(f.options.map((o) => typeof o === 'string' ? { value: o, label: o } : o));
      input = `<select id="${id}" name="${f.name}"${req}>${opts.map((o) => `<option value="${esc(o.value)}"${o.value === (v || '') ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    } else if (f.type === 'textarea' || f.type === 'lines') {
      const val = f.type === 'lines' ? (v || []).join('\n') : (v || '');
      input = `<textarea id="${id}" name="${f.name}" rows="4" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
    } else if (f.type === 'checks') {
      input = `<div class="checks">${f.options.map((o) => `<label><input type="checkbox" name="${f.name}" value="${esc(o)}"${(v || []).includes(o) ? ' checked' : ''}> ${esc(o)}</label>`).join('')}</div>`;
    } else if (f.type === 'tags') {
      input = `<input id="${id}" name="${f.name}" value="${esc((v || []).join(', '))}" placeholder="Comma separated">`;
    } else {
      input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v == null ? '' : v)}"${req}${f.type === 'number' ? ' min="0" step="1"' : ''}>`;
    }
    return `<div class="field${f.wide ? ' wide' : ''}"><label for="${id}">${esc(f.label)}</label>${input}</div>`;
  }

  function openForm(title, fields, values, onSave) {
    modal(`<form id="mform"><h2>${esc(title)}</h2><div class="form-grid">${fields.map((f) => fieldHtml(f, values[f.name])).join('')}</div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
    $('#mform').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target, out = {};
      fields.forEach((f) => {
        if (f.type === 'checks') out[f.name] = $$(`input[name="${f.name}"]:checked`, form).map((x) => x.value);
        else {
          const raw = form.elements[f.name].value;
          if (f.type === 'tags') out[f.name] = raw.split(',').map((s) => s.trim()).filter(Boolean);
          else if (f.type === 'lines') out[f.name] = raw.split('\n').map((s) => s.trim()).filter(Boolean);
          else if (f.type === 'number') out[f.name] = Number(raw) || 0;
          else out[f.name] = raw.trim();
        }
      });
      onSave(out);
      save(); closeModal(); render();
    });
  }

  function confirmBox(msg, onYes) {
    modal(`<h2>Confirm</h2><p class="muted">${esc(msg)}</p><div class="modal-actions"><button class="btn ghost" data-action="close-modal">Cancel</button><button class="btn danger" id="cyes">Delete</button></div>`);
    $('#cyes').addEventListener('click', () => { closeModal(); onYes(); });
  }

  /* ---------- field definitions ---------- */
  const companyOpts = () => db.companies.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name }));
  const contactOpts = () => db.contacts.slice().sort((a, b) => fullName(a).localeCompare(fullName(b))).map((c) => ({ value: c.id, label: fullName(c) }));
  const dealOpts = () => db.deals.map((d) => ({ value: d.id, label: d.title }));

  const F = {
    contact: () => [
      { name: 'first', label: 'First name', required: true }, { name: 'last', label: 'Last name' },
      { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone' },
      { name: 'title', label: 'Job title' }, { name: 'companyId', label: 'Company', type: 'select', options: companyOpts() },
      { name: 'source', label: 'Lead source', type: 'select', options: db.settings.sources }, { name: 'tags', label: 'Tags', type: 'tags' },
      { name: 'nextAction', label: 'Next action date', type: 'date' }, { name: 'nextActionNote', label: 'Next action' }
    ],
    company: () => [
      { name: 'name', label: 'Company name', required: true }, { name: 'industry', label: 'Industry' },
      { name: 'website', label: 'Website' }, { name: 'phone', label: 'Phone' },
      { name: 'city', label: 'City' }, { name: 'tags', label: 'Tags', type: 'tags' },
      { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
    ],
    deal: () => [
      { name: 'title', label: 'Deal title', required: true, wide: true },
      { name: 'companyId', label: 'Company', type: 'select', options: companyOpts() }, { name: 'contactId', label: 'Contact', type: 'select', options: contactOpts() },
      { name: 'value', label: 'Value ($)', type: 'number' }, { name: 'stage', label: 'Stage', type: 'select', blank: false, options: allStages() },
      { name: 'closeDate', label: 'Close date', type: 'date' },
      { name: 'services', label: 'Services', type: 'checks', options: db.settings.services, wide: true },
      { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
    ],
    task: () => [
      { name: 'title', label: 'Task', required: true, wide: true },
      { name: 'due', label: 'Due date', type: 'date' }, { name: 'priority', label: 'Priority', type: 'select', blank: false, options: ['Low', 'Medium', 'High'] },
      { name: 'recur', label: 'Repeats', type: 'select', blank: false, options: [{ value: 'none', label: 'Does not repeat' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }] },
      { name: 'contactId', label: 'Contact', type: 'select', options: contactOpts() }, { name: 'dealId', label: 'Deal', type: 'select', options: dealOpts() }
    ],
    project: () => [
      { name: 'name', label: 'Project name', required: true, wide: true },
      { name: 'companyId', label: 'Client', type: 'select', options: companyOpts() }, { name: 'status', label: 'Status', type: 'select', blank: false, options: ['Planned', 'Active', 'On hold', 'Complete'] },
      { name: 'start', label: 'Start date', type: 'date' }, { name: 'due', label: 'Due date', type: 'date' },
      { name: 'deliverables', label: 'Deliverables (one per line)', type: 'lines', wide: true },
      { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
    ],
    activity: () => [
      { name: 'type', label: 'Type', type: 'select', blank: false, options: ['Call', 'Email', 'Meeting', 'Note'] }, { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'note', label: 'Details', type: 'textarea', wide: true }
    ],
    attachment: () => [
      { name: 'name', label: 'Name', required: true, wide: true },
      { name: 'url', label: 'Link (https://…)', wide: true }
    ]
  };

  /* ---------- stage change: history, reason-lost prompt, won-deal project prompt ---------- */
  function setStage(deal, stage) {
    if (deal.stage === stage) return;
    deal.stage = stage;
    (deal.history = deal.history || []).push({ stage, date: today() });
    if (stage === 'Won' || stage === 'Lost') deal.closeDate = today();
  }
  function changeDealStage(deal, stage) {
    if (deal.stage === stage) return;
    const prev = deal.stage;
    setStage(deal, stage);
    save(); render();
    toast(`Moved to ${stage}`);
    if (stage === 'Lost' && prev !== 'Lost') setTimeout(() => promptLostReason(deal.id), 0);
    if (stage === 'Won' && prev !== 'Won') setTimeout(() => promptProject(deal.id), 0);
  }
  function promptLostReason(dealId) {
    const d = byId('deals', dealId); if (!d || d.stage !== 'Lost') return;
    const reasons = ['Budget', 'Went with another agency', 'No response', 'Timing', 'Not a fit', 'Other'];
    modal(`<h2>Reason lost</h2><p class="muted">${esc(d.title)}</p><form id="lform"><div class="field"><label for="lr">Reason</label><select id="lr" name="reason">${reasons.map((r) => `<option${r === d.lostReason ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-action="close-modal">Skip</button><button class="btn primary" type="submit">Save reason</button></div></form>`);
    $('#lform').addEventListener('submit', (e) => { e.preventDefault(); d.lostReason = e.target.elements.reason.value; save(); closeModal(); render(); toast('Reason saved'); });
  }
  function promptProject(dealId) {
    const d = byId('deals', dealId); if (!d || d.stage !== 'Won') return;
    if (db.projects.some((p) => p.dealId === dealId)) return;
    modal(`<h2>Create a project?</h2><p class="muted">“${esc(d.title)}” was marked Won.</p><div class="modal-actions"><button type="button" class="btn ghost" data-action="close-modal">Not now</button><button class="btn primary" id="cproj">Create project</button></div>`);
    $('#cproj').addEventListener('click', () => { closeModal(); A['deal-project']({ id: dealId }); });
  }

  /* ---------- CSV ---------- */
  function toCSV(rows, cols) {
    const q = (v) => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [cols.join(',')].concat(rows.map((r) => cols.map((c) => q(r[c])).join(','))).join('\r\n');
  }
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', inQ = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some((c) => c.trim() !== '')) rows.push(row);
        row = [];
      } else cur += ch;
    }
    row.push(cur);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    if (!rows.length) return [];
    const head = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
    return rows.slice(1).map((r) => { const o = {}; head.forEach((h, i) => { o[h] = (r[i] || '').trim(); }); return o; });
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function pickFile(accept, cb, asDataUrl) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    inp.addEventListener('change', () => {
      const file = inp.files[0]; if (!file) return;
      const r = new FileReader();
      r.onload = () => cb(r.result, file);
      if (asDataUrl) r.readAsDataURL(file); else r.readAsText(file);
    });
    inp.click();
  }
  const splitTags = (s) => (s || '').split(/[;|]/).map((t) => t.trim()).filter(Boolean);
  function findOrCreateCompany(name) {
    if (!name) return '';
    let c = db.companies.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!c) { c = { id: S.uid(), name, industry: '', website: '', phone: '', city: '', tags: [], notes: '' }; db.companies.push(c); }
    return c.id;
  }
  function importContacts(text) {
    let n = 0;
    parseCSV(text).forEach((r) => {
      let first = r.first || r.firstname || '', last = r.last || r.lastname || '';
      if (!first && r.name) { const p = r.name.split(' '); first = p.shift(); last = p.join(' '); }
      if (!first && !r.email) return;
      db.contacts.push({
        id: S.uid(), first: first || r.email, last, email: r.email || '', phone: r.phone || '', title: r.title || r.jobtitle || '',
        companyId: findOrCreateCompany(r.company), source: r.source || r.leadsource || '', tags: splitTags(r.tags),
        nextAction: /^\d{4}-\d{2}-\d{2}$/.test(r.nextaction || '') ? r.nextaction : '', nextActionNote: r.nextactionnote || '', created: today()
      });
      n++;
    });
    return n;
  }
  function importCompanies(text) {
    let n = 0;
    parseCSV(text).forEach((r) => {
      const name = r.name || r.company; if (!name) return;
      if (db.companies.some((x) => x.name.toLowerCase() === name.toLowerCase())) return;
      db.companies.push({ id: S.uid(), name, industry: r.industry || '', website: r.website || '', phone: r.phone || '', city: r.city || '', tags: splitTags(r.tags), notes: r.notes || '' });
      n++;
    });
    return n;
  }

  /* ---------- remembered filters ---------- */
  function allFilters() { try { return JSON.parse(localStorage.getItem(FILTERS_KEY) || '{}'); } catch (e) { return {}; } }
  function persistFilters(page) {
    if (!['contacts', 'companies'].includes(page)) return;
    const all = allFilters();
    all[page] = {
      text: ($('[data-filter="text"]') || {}).value || '',
      source: ($('[data-filter="source"]') || {}).value || '',
      tags: ($('[data-filter="tags"]') || {}).value || ''
    };
    try { localStorage.setItem(FILTERS_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
  }
  function restoreFilters(page) {
    if (!['contacts', 'companies'].includes(page)) return;
    const f = allFilters()[page]; if (!f) return;
    const text = $('[data-filter="text"]'); if (text && f.text) text.value = f.text;
    const src = $('[data-filter="source"]'); if (src && f.source) src.value = f.source;
    const tg = $('[data-filter="tags"]'); if (tg && f.tags) tg.value = f.tags;
    applyFilters();
  }
  function applyFilters() {
    const get = (k) => { const el = $(`[data-filter="${k}"]`); return el ? el.value : ''; };
    const text = get('text').toLowerCase().trim(), source = get('source'), tag = get('tags');
    $$('[data-row]').forEach((r) => {
      const ok = (!text || r.dataset.text.includes(text)) && (!source || r.dataset.source === source) && (!tag || (r.dataset.tags || '').split('|').includes(tag));
      r.hidden = !ok;
    });
    syncSelectAll();
  }

  /* ---------- bulk selection (contacts) ---------- */
  let selectedContacts = new Set();
  function syncSelectAll() {
    const all = $('#selAll'); if (!all) return;
    const visible = $$('[data-row]').filter((r) => !r.hidden);
    all.checked = visible.length > 0 && visible.every((r) => selectedContacts.has(r.dataset.id));
  }
  function bulkBar() {
    const n = selectedContacts.size;
    if (!n) return '';
    return `<div class="bulkbar panel"><span class="mono">${n} selected</span><span class="actions">
      <button class="btn ghost sm" data-action="bulk-tag">Tag</button>
      <button class="btn ghost sm" data-action="bulk-export">Export</button>
      <button class="btn danger sm" data-action="bulk-delete">Delete</button>
      <button class="btn ghost sm" data-action="bulk-clear">Clear</button></span></div>`;
  }

  /* ---------- sorting (contacts table) ---------- */
  let contactSort = { key: 'name', dir: 1 };
  const SORTERS = {
    name: (c) => fullName(c).toLowerCase(),
    company: (c) => companyName(c.companyId).toLowerCase(),
    source: (c) => (c.source || '').toLowerCase(),
    next: (c) => c.nextAction || '9999'
  };
  function sortHeader(key, label) {
    const on = contactSort.key === key;
    return `<th data-sort="${key}" tabindex="0">${esc(label)}${on ? (contactSort.dir === 1 ? ' ▲' : ' ▼') : ''}</th>`;
  }

  /* ---------- layout ---------- */
  function shell(active, content) {
    return `<header class="topbar">
      <a class="brand" href="#/hub" title="Main menu"><img src="${esc(logoSrc())}" alt=""><span>AFTERLIFE</span><b>CRM</b></a>
      <button type="button" class="hamburger" data-action="toggle-nav" aria-label="Menu">☰</button>
      <nav class="tabs" aria-label="Sections"><a href="#/hub" class="${active === 'hub' ? 'on' : ''}">Hub</a>${NAV.map((n) => `<a href="#/${n.id}" class="${active === n.id ? 'on' : ''}">${n.label}</a>`).join('')}</nav>
      <form class="search" data-form="search" role="search"><input name="q" type="search" placeholder="Search everything…  (press /)" aria-label="Search"></form>
      <button class="chip" data-action="logout" title="Log out">${esc(user())} <span>// exit</span></button>
    </header><main class="page">${content}</main>`;
  }
  const head = (title, sub, actions) => `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="actions">${actions || ''}</div></div>`;
  const empty = (msg) => `<div class="empty">${esc(msg)}</div>`;
  const crumb = (href, label) => `<a class="crumb" href="${href}">&lt; ${esc(label)}</a>`;

  /* ---------- views ---------- */
  function viewLogin() {
    return `<div class="login-wrap"><form class="login panel" data-form="login">
      <img class="login-logo" src="${esc(logoSrc())}" alt="">
      <h1>AFTERLIFE <b>CRM</b></h1>
      <p class="mono muted">// client relationship terminal</p>
      <div class="field"><label for="lu">Callsign</label><input id="lu" name="u" value="demo" required autocomplete="username"></div>
      <div class="field"><label for="lp">Passcode</label><input id="lp" name="p" type="password" value="demo" autocomplete="current-password"></div>
      <button class="btn primary block" type="submit">Connect</button>
      <p class="fine">Demo build. There are no real accounts: any callsign works, and all data stays in this browser.</p>
    </form></div>`;
  }

  function followUps() {
    return db.contacts.filter((c) => c.nextAction && c.nextAction <= today()).sort((a, b) => a.nextAction.localeCompare(b.nextAction));
  }

  function viewHub() {
    const open = db.deals.filter(isOpen);
    const openTasks = db.tasks.filter((t) => !t.done);
    const overdueTasks = openTasks.filter((t) => t.due && t.due < today());
    const fu = followUps();
    const won = db.deals.filter((d) => d.stage === 'Won').length, lost = db.deals.filter((d) => d.stage === 'Lost').length;
    const topCompanies = db.companies.slice().sort((a, b) => db.deals.filter((d) => d.companyId === b.id && d.stage === 'Won').reduce((s, d) => s + d.value, 0) - db.deals.filter((d) => d.companyId === a.id && d.stage === 'Won').reduce((s, d) => s + d.value, 0)).slice(0, 3);
    const topDeals = open.slice().sort((a, b) => b.value - a.value).slice(0, 3);
    const topTasks = openTasks.slice().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 3);
    const activeProjects = db.projects.filter((p) => p.status === 'Active').slice(0, 3);

    const info = {
      dashboard: [`${fu.length} follow-ups due`, 'Daily overview'],
      contacts: [`${db.contacts.length} records`, `${fu.length} need a follow-up`],
      companies: [`${db.companies.length} organizations`, 'Profiles and linked work'],
      pipeline: [`${open.length} open deals`, `${money(open.reduce((s, d) => s + d.value, 0))} in play`],
      tasks: [`${openTasks.length} open`, overdueTasks.length ? `${overdueTasks.length} overdue` : 'Nothing overdue'],
      projects: [`${activeProjects.length} active`, `${db.projects.length} total`],
      reports: [`${won + lost ? Math.round(won / (won + lost) * 100) : 0}% win rate`, 'Revenue and sources'],
      settings: ['Stages, services, tags', 'Logo and demo data']
    };
    const preview = {
      dashboard: fu.slice(0, 3).map((c) => `${fullName(c)} — ${c.nextActionNote || 'Follow up'}`),
      contacts: fu.slice(0, 3).map((c) => `${fullName(c)} — ${fmtDate(c.nextAction)}`),
      companies: topCompanies.map((c) => c.name),
      pipeline: topDeals.map((d) => `${d.title} · ${money(d.value)}`),
      tasks: topTasks.map((t) => `${t.title} — ${fmtDate(t.due)}`),
      projects: activeProjects.map((p) => `${p.name} (${p.status})`),
      reports: [`Win rate ${won + lost ? Math.round(won / (won + lost) * 100) : 0}%`, `Open pipeline ${money(open.reduce((s, d) => s + d.value, 0))}`],
      settings: [`${db.settings.stages.length} stages`, `${db.settings.services.length} services`, `${db.settings.tags.length} tags`]
    };
    const badge = {
      dashboard: fu.length, contacts: fu.length, tasks: overdueTasks.length
    };
    const slot = (n, i) => `<a class="slot" href="#/${n.id}" style="--i:${i}" tabindex="0">
      ${badge[n.id] ? `<span class="slot-badge">${badge[n.id]}</span>` : ''}
      <span class="slot-ic">${icon(n.id)}</span>
      <span class="slot-body"><span class="slot-title">${n.label}</span><span class="slot-stat">${esc(info[n.id][0])}</span><span class="slot-sub">${esc(info[n.id][1])}</span></span>
      ${(preview[n.id] || []).length ? `<span class="slot-flyout"><b>${esc(n.label)}</b><ul>${preview[n.id].map((t) => `<li>${esc(t)}</li>`).join('')}</ul></span>` : ''}
    </a>`;
    return shell('hub', `<section class="hub">
      <div class="hub-logo" aria-hidden="true"><img src="${esc(logoSrc())}" alt=""></div>
      <div class="hub-col left">${NAV.slice(0, 4).map(slot).join('')}</div>
      <div class="hub-core"><p class="mono">// ${esc(db.settings.profile.business || 'Afterlife')}</p><h1>AFTERLIFE <b>CRM</b></h1><p class="mono muted">Select a system</p></div>
      <div class="hub-col right">${NAV.slice(4).map((n, i) => slot(n, i + 4)).join('')}</div>
    </section>`);
  }

  function viewDashboard() {
    const open = db.deals.filter(isOpen);
    const month = today().slice(0, 7);
    const wonAll = db.deals.filter((d) => d.stage === 'Won');
    const lost = db.deals.filter((d) => d.stage === 'Lost').length;
    const wonMonth = wonAll.filter((d) => (d.closeDate || '').slice(0, 7) === month).reduce((s, d) => s + d.value, 0);
    const goal = Number(db.settings.revenueGoal) || 0;
    const goalPct = goal ? Math.min(100, Math.round(wonMonth / goal * 100)) : 0;
    const fu = followUps();
    const dueTasks = db.tasks.filter((t) => !t.done && t.due && t.due <= today()).sort((a, b) => a.due.localeCompare(b.due));
    const recent = db.activities.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    const stages = db.settings.stages.map((s) => ({ s, v: open.filter((d) => d.stage === s).reduce((t, d) => t + d.value, 0), n: open.filter((d) => d.stage === s).length }));
    const max = Math.max(1, ...stages.map((x) => x.v));
    return shell('dashboard', head('Dashboard', fmtDate(today())) + `
      <div class="kpis">
        <a class="kpi panel" href="#/pipeline"><span>Open pipeline</span><b>${money(open.reduce((s, d) => s + d.value, 0))}</b><i>${open.length} deals</i></a>
        <a class="kpi panel" href="#/reports"><span>Weighted forecast</span><b>${money(forecastOf(open))}</b><i>by stage probability</i></a>
        <a class="kpi panel warn" href="#/tasks?f=today"><span>Follow-ups due</span><b>${fu.length}</b><i>${dueTasks.length} tasks due</i></a>
        <a class="kpi panel" href="#/reports"><span>Win rate</span><b>${wonAll.length + lost ? Math.round(wonAll.length / (wonAll.length + lost) * 100) : 0}%</b><i>${wonAll.length} won / ${lost} lost</i></a>
      </div>
      <section class="panel"><h2>Monthly revenue goal</h2><p class="mono muted">${money(wonMonth)} of ${money(goal)} won this month</p><div class="progress big"><i style="width:${goalPct}%"></i></div></section>
      <div class="grid two">
        <section class="panel"><h2>Follow-ups due</h2>${fu.length ? `<ul class="list">${fu.map((c) => `<li><a href="#/contacts/${c.id}"><b>${esc(fullName(c))}</b><span class="muted">${esc(c.nextActionNote || 'Follow up')}</span></a><span class="date ${dueClass(c.nextAction)}">${fmtDate(c.nextAction)}</span></li>`).join('')}</ul>` : empty('No follow-ups due. You are caught up.')}</section>
        <section class="panel"><h2>Tasks due</h2>${dueTasks.length ? `<ul class="list">${dueTasks.map((t) => `<li><label class="check"><input type="checkbox" data-action="toggle-task" data-id="${t.id}"> <span>${esc(t.title)}</span></label><span class="date ${dueClass(t.due)}">${fmtDate(t.due)}</span></li>`).join('')}</ul>` : empty('No tasks due today.')}</section>
        <section class="panel"><h2>Pipeline by stage</h2><div class="bars">${stages.map((x) => `<div class="bar-row"><span>${esc(x.s)}</span><div class="bar"><i style="width:${x.v / max * 100}%"></i></div><b>${money(x.v)} <small>(${x.n})</small></b></div>`).join('')}</div></section>
        <section class="panel"><h2>Recent activity</h2>${recent.length ? `<ul class="timeline">${recent.map(actItem).join('')}</ul>` : empty('No activity logged yet.')}</section>
      </div>`);
  }

  function actItem(a) {
    const c = byId('contacts', a.contactId);
    return `<li><span class="dot t-${esc(a.type.toLowerCase())}"></span><div><span class="mono">${esc(a.type)} · ${fmtDate(a.date)}${c ? ` · <a href="#/contacts/${c.id}">${esc(fullName(c))}</a>` : ''}</span><p>${esc(a.note)}</p></div>
      <button class="x" data-action="del-activity" data-id="${a.id}" title="Delete entry" aria-label="Delete entry">×</button></li>`;
  }

  function filterBar(extra) {
    return `<div class="filters"><input type="search" data-filter="text" placeholder="Filter this list…" aria-label="Filter">${extra || ''}</div>`;
  }
  const selFilter = (key, label, opts) => `<select data-filter="${key}" aria-label="${label}"><option value="">${label}: all</option>${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select>`;

  function viewContacts() {
    let rows = db.contacts.slice();
    const sorter = SORTERS[contactSort.key] || SORTERS.name;
    rows.sort((a, b) => sorter(a) < sorter(b) ? -1 * contactSort.dir : sorter(a) > sorter(b) ? contactSort.dir : 0);
    const tags = Array.from(new Set(db.settings.tags.concat(...db.contacts.map((c) => c.tags || []))));
    return shell('contacts', head('Contacts', `${rows.length} records`, `<button class="btn ghost" data-action="import" data-kind="contacts">Import CSV</button><button class="btn ghost" data-action="export" data-kind="contacts">Export CSV</button><button class="btn primary" data-action="new-contact">+ New contact</button>`) +
      filterBar(selFilter('source', 'Source', db.settings.sources) + selFilter('tags', 'Tag', tags)) + bulkBar() +
      (rows.length ? `<div class="table-wrap panel"><table><thead><tr><th class="selcol"><input type="checkbox" id="selAll" data-action="select-all" aria-label="Select all"></th>${sortHeader('name', 'Name')}${sortHeader('company', 'Company')}<th>Email</th>${sortHeader('source', 'Source')}<th>Tags</th>${sortHeader('next', 'Next action')}</tr></thead><tbody>
      ${rows.map((c) => `<tr data-row data-id="${c.id}" data-href="#/contacts/${c.id}" data-text="${esc((fullName(c) + ' ' + companyName(c.companyId) + ' ' + c.email + ' ' + c.title).toLowerCase())}" data-source="${esc(c.source)}" data-tags="${esc((c.tags || []).join('|'))}">
        <td class="selcol" data-l=""><input type="checkbox" data-action="select-row" data-id="${c.id}" aria-label="Select ${esc(fullName(c))}"${selectedContacts.has(c.id) ? ' checked' : ''}></td>
        <td data-l="Name"><a href="#/contacts/${c.id}" class="namecell">${avatar(fullName(c))}<span><b>${esc(fullName(c))}</b><small>${esc(c.title)}</small></span></a></td><td data-l="Company">${esc(companyName(c.companyId)) || '—'}</td><td data-l="Email">${esc(c.email) || '—'}</td>
        <td data-l="Source">${esc(c.source) || '—'}</td><td data-l="Tags">${tagsHtml(c.tags) || '—'}</td><td data-l="Next action"><span class="date ${dueClass(c.nextAction)}">${fmtDate(c.nextAction)}</span></td></tr>`).join('')}
      </tbody></table></div>` : empty('No contacts yet. Add one or import a CSV.')));
  }

  function dealRow(d) {
    return `<li><a href="#/deals/${d.id}"><b>${esc(d.title)}</b><span class="muted">${esc(companyName(d.companyId))}</span></a><span class="stage s-${esc(d.stage.toLowerCase())}">${esc(d.stage)}</span><span class="mono">${money(d.value)}</span></li>`;
  }
  function taskRow(t) {
    const c = byId('contacts', t.contactId), d = byId('deals', t.dealId);
    return `<li class="${t.done ? 'done' : ''}"><label class="check"><input type="checkbox" data-action="toggle-task" data-id="${t.id}"${t.done ? ' checked' : ''}> <span>${esc(t.title)}${t.recur !== 'none' ? `<span class="tag">${esc(t.recur)}</span>` : ''}</span></label>
      <span class="links">${c ? `<a href="#/contacts/${c.id}">${esc(fullName(c))}</a>` : ''}${d ? `<a href="#/deals/${d.id}">${esc(d.title)}</a>` : ''}</span>
      <span class="pri p-${esc(t.priority.toLowerCase())}">${esc(t.priority)}</span><span class="date ${dueClass(t.due, t.done)}">${fmtDate(t.due)}</span>
      <span class="row-actions"><button class="x" data-action="edit-task" data-id="${t.id}" title="Edit" aria-label="Edit task">✎</button><button class="x" data-action="del-task" data-id="${t.id}" title="Delete" aria-label="Delete task">×</button></span></li>`;
  }

  function viewContact(id) {
    const c = byId('contacts', id);
    if (!c) return shell('contacts', empty('That contact no longer exists.'));
    const acts = db.activities.filter((a) => a.contactId === id).sort((a, b) => b.date.localeCompare(a.date));
    const deals = db.deals.filter((d) => d.contactId === id);
    const tasks = db.tasks.filter((t) => t.contactId === id);
    return shell('contacts', crumb('#/contacts', 'Contacts') + head(fullName(c), `${esc(c.title)}${c.companyId ? ` at <a href="#/companies/${c.companyId}">${esc(companyName(c.companyId))}</a>` : ''}`,
      `<button class="btn ghost" data-action="edit-contact" data-id="${id}">Edit</button><button class="btn danger" data-action="del-contact" data-id="${id}">Delete</button>`) + `
      <div class="detail-head">${avatar(fullName(c))}<div><h2 class="noline">${esc(fullName(c))}</h2><p class="muted">${esc(c.title) || '—'}</p></div></div>
      <div class="grid side">
        <div class="stack">
          <section class="panel"><h2>Details</h2><dl class="dl"><dt>Email</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</dd><dt>Phone</dt><dd>${esc(c.phone) || '—'}</dd><dt>Source</dt><dd>${esc(c.source) || '—'}</dd><dt>Tags</dt><dd>${tagsHtml(c.tags) || '—'}</dd><dt>Added</dt><dd>${fmtDate(c.created)}</dd></dl></section>
          <section class="panel next ${dueClass(c.nextAction)}"><h2>Next action</h2>${c.nextAction ? `<p><b>${esc(c.nextActionNote || 'Follow up')}</b></p><p class="date ${dueClass(c.nextAction)}">${fmtDate(c.nextAction)}</p><button class="btn ghost" data-action="clear-next" data-id="${id}">Mark done</button>` : `<p class="muted">Nothing scheduled.</p><button class="btn ghost" data-action="edit-contact" data-id="${id}">Set a follow-up</button>`}</section>
          <section class="panel"><h2>Deals</h2>${deals.length ? `<ul class="list">${deals.map(dealRow).join('')}</ul>` : empty('No deals linked.')}</section>
        </div>
        <div class="stack">
          <section class="panel"><div class="panel-head"><h2>Activity timeline</h2><button class="btn primary sm" data-action="new-activity" data-contact="${id}">+ Log activity</button></div>${acts.length ? `<ul class="timeline">${acts.map(actItem).join('')}</ul>` : empty('No calls, emails, meetings or notes logged yet.')}</section>
          <section class="panel"><div class="panel-head"><h2>Tasks</h2><button class="btn ghost sm" data-action="new-task" data-contact="${id}">+ Task</button></div>${tasks.length ? `<ul class="list tasks">${tasks.map(taskRow).join('')}</ul>` : empty('No tasks linked.')}</section>
        </div>
      </div>`);
  }

  function viewCompanies() {
    const rows = db.companies.slice().sort((a, b) => a.name.localeCompare(b.name));
    return shell('companies', head('Companies', `${rows.length} organizations`, `<button class="btn ghost" data-action="import" data-kind="companies">Import CSV</button><button class="btn ghost" data-action="export" data-kind="companies">Export CSV</button><button class="btn primary" data-action="new-company">+ New company</button>`) + filterBar() +
      (rows.length ? `<div class="cards">${rows.map((c) => {
        const deals = db.deals.filter((d) => d.companyId === c.id);
        return `<a class="card panel" data-row data-text="${esc((c.name + ' ' + c.industry + ' ' + c.city + ' ' + (c.tags || []).join(' ')).toLowerCase())}" href="#/companies/${c.id}">
          <div class="card-top">${avatar(c.name, true)}<div><h3>${esc(c.name)}</h3><p class="mono muted">${esc(c.industry) || 'No industry'} · ${esc(c.city) || 'No city'}</p></div></div>
          <div class="card-stats"><span><b>${db.contacts.filter((p) => p.companyId === c.id).length}</b> contacts</span><span><b>${deals.filter(isOpen).length}</b> open deals</span><span><b>${money(deals.filter((d) => d.stage === 'Won').reduce((s, d) => s + d.value, 0))}</b> won</span></div>
          <div>${tagsHtml(c.tags)}</div></a>`;
      }).join('')}</div>` : empty('No companies yet.')));
  }

  function viewCompany(id) {
    const c = byId('companies', id);
    if (!c) return shell('companies', empty('That company no longer exists.'));
    const people = db.contacts.filter((p) => p.companyId === id);
    const deals = db.deals.filter((d) => d.companyId === id);
    const projects = db.projects.filter((p) => p.companyId === id);
    const site = c.website ? (/^https?:/i.test(c.website) ? c.website : 'https://' + c.website) : '';
    return shell('companies', crumb('#/companies', 'Companies') + head(c.name, `${esc(c.industry) || ''}${c.city ? ' · ' + esc(c.city) : ''}`,
      `<button class="btn ghost" data-action="edit-company" data-id="${id}">Edit</button><button class="btn danger" data-action="del-company" data-id="${id}">Delete</button>`) + `
      <div class="detail-head">${avatar(c.name, true)}<div><h2 class="noline">${esc(c.name)}</h2><p class="muted">${esc(c.industry) || '—'}</p></div></div>
      <div class="grid side">
        <div class="stack">
          <section class="panel"><h2>Profile</h2><dl class="dl"><dt>Website</dt><dd>${site ? `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(c.website)}</a>` : '—'}</dd><dt>Phone</dt><dd>${esc(c.phone) || '—'}</dd><dt>Tags</dt><dd>${tagsHtml(c.tags) || '—'}</dd></dl></section>
          <section class="panel"><h2>Notes</h2><p class="${c.notes ? '' : 'muted'}">${esc(c.notes) || 'No notes yet.'}</p></section>
        </div>
        <div class="stack">
          <section class="panel"><div class="panel-head"><h2>Contacts</h2><button class="btn ghost sm" data-action="new-contact" data-company="${id}">+ Contact</button></div>${people.length ? `<ul class="list">${people.map((p) => `<li><a href="#/contacts/${p.id}">${avatar(fullName(p))}<span><b>${esc(fullName(p))}</b><span class="muted">${esc(p.title)}</span></span></a><span class="mono">${esc(p.email)}</span></li>`).join('')}</ul>` : empty('No contacts linked.')}</section>
          <section class="panel"><div class="panel-head"><h2>Deals</h2><button class="btn ghost sm" data-action="new-deal" data-company="${id}">+ Deal</button></div>${deals.length ? `<ul class="list">${deals.map(dealRow).join('')}</ul>` : empty('No deals linked.')}</section>
          <section class="panel"><h2>Projects</h2>${projects.length ? `<ul class="list">${projects.map((p) => `<li><a href="#/projects/${p.id}"><b>${esc(p.name)}</b></a><span class="stage">${esc(p.status)}</span></li>`).join('')}</ul>` : empty('No projects yet.')}</section>
        </div>
      </div>`);
  }

  function viewPipeline() {
    const cols = allStages();
    const open = db.deals.filter(isOpen);
    return shell('pipeline', head('Pipeline', `Drag a card to move it. Weighted forecast: ${money(forecastOf(open))}`, `<button class="btn ghost" data-action="export" data-kind="deals">Export CSV</button><button class="btn primary" data-action="new-deal">+ New deal</button>`) +
      `<div class="board">${cols.map((s) => {
        const deals = db.deals.filter((d) => d.stage === s);
        const prob = db.settings.stageProbabilities[s];
        return `<section class="col s-${esc(s.toLowerCase())}" data-stage="${esc(s)}"><header>
          <div class="col-title-row"><h2>${esc(s)}</h2>${prob != null && isOpen({ stage: s }) ? `<span class="mono prob">${prob}%</span>` : ''}</div>
          <div class="col-stats-row"><span class="mono">${deals.length} · ${money(deals.reduce((t, d) => t + d.value, 0))}</span>${isOpen({ stage: s }) ? `<button type="button" class="btn ghost sm colAdd" data-action="new-deal" data-stage="${esc(s)}">+ Add</button>` : ''}</div>
        </header>
          <div class="col-body">${deals.map((d) => `<a class="deal panel" draggable="true" data-deal="${d.id}" href="#/deals/${d.id}"><b>${esc(d.title)}</b><span class="muted">${esc(companyName(d.companyId)) || 'No company'}</span><span class="deal-foot"><span class="mono val">${money(d.value)}</span><span class="date">${fmtDate(d.closeDate)}</span></span></a>`).join('') || '<p class="drop-hint">Drop here</p>'}</div></section>`;
      }).join('')}</div>`);
  }

  function viewDeal(id) {
    const d = byId('deals', id);
    if (!d) return shell('pipeline', empty('That deal no longer exists.'));
    const c = byId('contacts', d.contactId);
    const acts = db.activities.filter((a) => a.dealId === id).sort((a, b) => b.date.localeCompare(a.date));
    const tasks = db.tasks.filter((t) => t.dealId === id);
    const project = db.projects.find((p) => p.dealId === id);
    return shell('pipeline', crumb('#/pipeline', 'Pipeline') + head(d.title, `${d.companyId ? `<a href="#/companies/${d.companyId}">${esc(companyName(d.companyId))}</a>` : 'No company'}${c ? ` · <a href="#/contacts/${c.id}">${esc(fullName(c))}</a>` : ''}`,
      `<button class="btn ghost" data-action="edit-deal" data-id="${id}">Edit</button><button class="btn danger" data-action="del-deal" data-id="${id}">Delete</button>`) + `
      <div class="grid side">
        <div class="stack">
          <section class="panel"><h2>Deal</h2><p class="big">${money(d.value)}</p>
            <div class="field"><label for="stageSel">Stage</label><select id="stageSel" data-change="deal-stage" data-id="${id}">${allStages().map((s) => `<option${s === d.stage ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
            <dl class="dl"><dt>Close date</dt><dd>${fmtDate(d.closeDate)}</dd><dt>Created</dt><dd>${fmtDate(d.created)}</dd><dt>Services</dt><dd>${tagsHtml(d.services) || '—'}</dd>${d.stage === 'Lost' && d.lostReason ? `<dt>Reason lost</dt><dd>${esc(d.lostReason)}</dd>` : ''}</dl>
            ${d.notes ? `<p>${esc(d.notes)}</p>` : ''}
            ${d.stage === 'Won' ? (project ? `<a class="btn ghost" href="#/projects/${project.id}">View project</a>` : `<button class="btn primary" data-action="deal-project" data-id="${id}">Create project from deal</button>`) : ''}</section>
          <section class="panel"><div class="panel-head"><h2>Attachments</h2><span class="actions"><button class="btn ghost sm" data-action="new-attachment-link" data-id="${id}">+ Link</button><button class="btn ghost sm" data-action="upload-attachment" data-id="${id}">+ File</button></span></div>
            ${(d.attachments || []).length ? `<ul class="list">${d.attachments.map((a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener">📎 ${esc(a.name)}</a><button class="x" data-action="del-attachment" data-id="${id}" data-aid="${a.id}" title="Remove" aria-label="Remove attachment">×</button></li>`).join('')}</ul>` : empty('No files or links attached.')}</section>
          <section class="panel"><h2>Stage history</h2><ul class="history">${(d.history || []).map((h) => `<li><span class="stage s-${esc(h.stage.toLowerCase())}">${esc(h.stage)}</span><span class="date">${fmtDate(h.date)}</span></li>`).join('')}</ul></section>
        </div>
        <div class="stack">
          <section class="panel"><div class="panel-head"><h2>Activity</h2>${c ? `<button class="btn primary sm" data-action="new-activity" data-contact="${c.id}" data-deal="${id}">+ Log activity</button>` : ''}</div>${acts.length ? `<ul class="timeline">${acts.map(actItem).join('')}</ul>` : empty(c ? 'No activity logged on this deal.' : 'Link a contact to log activity.')}</section>
          <section class="panel"><div class="panel-head"><h2>Tasks</h2><button class="btn ghost sm" data-action="new-task" data-deal="${id}" data-contact="${d.contactId || ''}">+ Task</button></div>${tasks.length ? `<ul class="list tasks">${tasks.map(taskRow).join('')}</ul>` : empty('No tasks linked.')}</section>
        </div>
      </div>`);
  }

  function monthGrid(monthKey, dayItems) {
    const [y, m] = monthKey.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push('');
    for (let d = 1; d <= daysInMonth; d++) cells.push(String(y) + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'));
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `<div class="cal"><div class="cal-dow">${dow.map((d) => `<span>${d}</span>`).join('')}</div><div class="cal-grid">
      ${cells.map((ds) => {
        if (!ds) return '<span class="cal-cell empty"></span>';
        const items = dayItems[ds] || [];
        const cls = ds === today() ? ' today' : '';
        return `<a class="cal-cell${cls}" href="#/tasks?f=calendar&amp;m=${monthKey}&amp;d=${ds}"><span class="cal-num">${Number(ds.slice(-2))}</span>${items.length ? `<span class="cal-dot">${items.length}</span>` : ''}</a>`;
      }).join('')}</div></div>`;
  }

  function viewTasks(q) {
    const f = q.f || 'open';
    const sets = {
      open: (t) => !t.done, overdue: (t) => !t.done && t.due && t.due < today(),
      today: (t) => !t.done && t.due === today(), done: (t) => t.done
    };
    const tab = (k, l) => `<a href="#/tasks?f=${k}" class="${f === k ? 'on' : ''}">${l}${sets[k] ? ` <span>${db.tasks.filter(sets[k]).length}</span>` : ''}</a>`;
    const subtabs = `<div class="subtabs">${tab('open', 'Open')}${tab('overdue', 'Overdue')}${tab('today', 'Due today')}${tab('done', 'Done')}${tab('calendar', 'Calendar')}</div>`;

    if (f === 'calendar') {
      const monthKey = /^\d{4}-\d{2}$/.test(q.m || '') ? q.m : today().slice(0, 7);
      const selDay = q.d || '';
      const dayItems = {};
      db.tasks.forEach((t) => { if (t.due) (dayItems[t.due] = dayItems[t.due] || []).push({ kind: 'task', t }); });
      db.contacts.forEach((c) => { if (c.nextAction) (dayItems[c.nextAction] = dayItems[c.nextAction] || []).push({ kind: 'follow', c }); });
      const [y, m] = monthKey.split('-').map(Number);
      const prevKey = (m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0'));
      const nextKey = (m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0'));
      const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
      const agendaItems = selDay ? (dayItems[selDay] || []) : [];
      return shell('tasks', head('Tasks & follow-ups', '', `<button class="btn primary" data-action="new-task">+ New task</button>`) + subtabs +
        `<section class="panel"><div class="cal-nav"><a class="btn ghost sm" href="#/tasks?f=calendar&amp;m=${prevKey}">‹ Prev</a><b class="mono">${esc(monthLabel)}</b><a class="btn ghost sm" href="#/tasks?f=calendar&amp;m=${nextKey}">Next ›</a></div>${monthGrid(monthKey, dayItems)}</section>
        <section class="panel"><h2>${selDay ? fmtDate(selDay) : 'Pick a day'}</h2>${selDay ? (agendaItems.length ? `<ul class="list">${agendaItems.map((it) => it.kind === 'task' ? taskRow(it.t) : `<li><a href="#/contacts/${it.c.id}"><b>${esc(fullName(it.c))}</b><span class="muted">${esc(it.c.nextActionNote || 'Follow up')}</span></a></li>`).join('')}</ul>` : empty('Nothing scheduled this day.')) : empty('Click a day on the calendar to see what is due.')}</section>`);
    }

    const rows = db.tasks.filter(sets[f] || sets.open).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    return shell('tasks', head('Tasks & follow-ups', '', `<button class="btn primary" data-action="new-task">+ New task</button>`) + subtabs +
      `<section class="panel">${rows.length ? `<ul class="list tasks">${rows.map(taskRow).join('')}</ul>` : empty('Nothing in this view.')}</section>
      <section class="panel"><h2>Contact follow-ups</h2>${(() => {
        const fu = db.contacts.filter((c) => c.nextAction).sort((a, b) => a.nextAction.localeCompare(b.nextAction));
        return fu.length ? `<ul class="list">${fu.map((c) => `<li><a href="#/contacts/${c.id}"><b>${esc(fullName(c))}</b><span class="muted">${esc(c.nextActionNote || 'Follow up')}</span></a><span class="date ${dueClass(c.nextAction)}">${fmtDate(c.nextAction)}</span></li>`).join('')}</ul>` : empty('No follow-ups scheduled.');
      })()}</section>`);
  }

  function projectCard(p) {
    const dl = p.deliverables || [], done = dl.filter((x) => x.done).length, pct = dl.length ? Math.round(done / dl.length * 100) : 0;
    return `<section class="card panel"><div class="panel-head"><h3><a href="#/projects/${p.id}">${esc(p.name)}</a></h3><span class="stage st-${esc(p.status.toLowerCase().replace(/\s/g, '-'))}">${esc(p.status)}</span></div>
      <p class="mono muted">${p.companyId ? `<a href="#/companies/${p.companyId}">${esc(companyName(p.companyId))}</a> · ` : ''}${fmtDate(p.start)} → <span class="${p.status === 'Complete' ? '' : dueClass(p.due)}">${fmtDate(p.due)}</span></p>
      <div class="progress"><i style="width:${pct}%"></i></div><p class="mono muted">${done}/${dl.length} deliverables · ${pct}%</p>
      <div class="actions"><a class="btn ghost sm" href="#/projects/${p.id}">Open</a><button class="btn ghost sm" data-action="edit-project" data-id="${p.id}">Edit</button><button class="btn danger sm" data-action="del-project" data-id="${p.id}">Delete</button></div></section>`;
  }

  function viewProjects() {
    const rows = db.projects.slice().sort((a, b) => (a.due || '').localeCompare(b.due || ''));
    return shell('projects', head('Projects', 'Client work after a deal is won.', `<button class="btn primary" data-action="new-project">+ New project</button>`) +
      (rows.length ? `<div class="cards wide">${rows.map(projectCard).join('')}</div>` : empty('No projects yet. Win a deal, then create a project from it.')));
  }

  function viewProject(id) {
    const p = byId('projects', id);
    if (!p) return shell('projects', empty('That project no longer exists.'));
    const dl = p.deliverables || [], done = dl.filter((x) => x.done).length, pct = dl.length ? Math.round(done / dl.length * 100) : 0;
    return shell('projects', crumb('#/projects', 'Projects') + head(p.name, `${p.companyId ? `<a href="#/companies/${p.companyId}">${esc(companyName(p.companyId))}</a>` : 'No client'} · <span class="stage st-${esc(p.status.toLowerCase().replace(/\s/g, '-'))}">${esc(p.status)}</span>`,
      `<button class="btn ghost" data-action="edit-project" data-id="${id}">Edit</button><button class="btn danger" data-action="del-project" data-id="${id}">Delete</button>`) + `
      <div class="grid side">
        <div class="stack">
          <section class="panel"><h2>Timeline</h2><dl class="dl"><dt>Start</dt><dd>${fmtDate(p.start)}</dd><dt>Due</dt><dd><span class="${dueClass(p.due)}">${fmtDate(p.due)}</span></dd><dt>Progress</dt><dd>${done}/${dl.length} · ${pct}%</dd></dl><div class="progress"><i style="width:${pct}%"></i></div></section>
          <section class="panel"><div class="panel-head"><h2>Notes</h2></div><form data-form="project-notes" data-id="${id}"><textarea name="notes" rows="6" placeholder="Notes about this project…">${esc(p.notes)}</textarea><div class="modal-actions"><button class="btn ghost sm" type="submit">Save notes</button></div></form></section>
        </div>
        <div class="stack">
          <section class="panel"><div class="panel-head"><h2>Deliverables</h2><button class="btn ghost sm" data-action="add-deliverable" data-id="${id}">+ Add</button></div>
            ${dl.length ? `<ul class="list deliv-list">${dl.map((x) => `<li><label class="check"><input type="checkbox" data-action="toggle-deliv2" data-id="${id}" data-did="${x.id}"${x.done ? ' checked' : ''}> <span>${esc(x.text)}</span></label><input type="date" class="deliv-due" data-action="deliv-due" data-id="${id}" data-did="${x.id}" value="${esc(x.due || '')}"><button class="x" data-action="del-deliverable" data-id="${id}" data-did="${x.id}" title="Remove" aria-label="Remove deliverable">×</button></li>`).join('')}</ul>` : empty('No deliverables yet.')}</section>
        </div>
      </div>`);
  }

  function viewReports(q) {
    const range = q.range || 'all';
    const inRange = (dateStr) => {
      if (!dateStr || range === 'all') return true;
      const t = today();
      if (range === 'month') return dateStr.slice(0, 7) === t.slice(0, 7);
      if (range === 'quarter') { const qn = (d) => Math.floor((Number(d.slice(5, 7)) - 1) / 3); return dateStr.slice(0, 4) === t.slice(0, 4) && qn(dateStr) === qn(t); }
      if (range === 'year') return dateStr.slice(0, 4) === t.slice(0, 4);
      return true;
    };
    const wonAll = db.deals.filter((d) => d.stage === 'Won'), lostAll = db.deals.filter((d) => d.stage === 'Lost'), open = db.deals.filter(isOpen);
    const won = wonAll.filter((d) => inRange(d.closeDate)), lost = lostAll.filter((d) => inRange(d.closeDate));
    const wonVal = won.reduce((s, d) => s + d.value, 0);
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      months.push({ key, label: d.toLocaleDateString('en-CA', { month: 'short' }), v: wonAll.filter((x) => (x.closeDate || '').slice(0, 7) === key).reduce((s, x) => s + x.value, 0) });
    }
    const mMax = Math.max(1, ...months.map((m) => m.v));
    const src = {};
    db.contacts.forEach((c) => { const k = c.source || 'Unknown'; (src[k] = src[k] || { n: 0, v: 0 }).n++; });
    won.forEach((d) => { const c = byId('contacts', d.contactId); const k = (c && c.source) || 'Unknown'; (src[k] = src[k] || { n: 0, v: 0 }).v += d.value; });
    const srcRows = Object.entries(src).sort((a, b) => b[1].n - a[1].n);
    const sMax = Math.max(1, ...srcRows.map((r) => r[1].n));
    const stages = db.settings.stages.map((s) => ({ s, v: open.filter((d) => d.stage === s).reduce((t, d) => t + d.value, 0) }));
    const stMax = Math.max(1, ...stages.map((x) => x.v));
    const reasons = {};
    lost.forEach((d) => { const k = d.lostReason || 'No reason given'; reasons[k] = (reasons[k] || 0) + 1; });
    const reasonRows = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
    const rangeOpts = [['all', 'All time'], ['month', 'This month'], ['quarter', 'This quarter'], ['year', 'This year']];
    return shell('reports', head('Reports', 'Calculated from the deals and contacts in this browser.', `<button class="btn ghost" data-action="print-report">Export (PDF)</button>`) +
      `<div class="filters"><select data-nav="range">${rangeOpts.map(([v, l]) => `<option value="${v}"${v === range ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="kpis">
        <div class="kpi panel"><span>Win rate</span><b>${won.length + lost.length ? Math.round(won.length / (won.length + lost.length) * 100) : 0}%</b><i>${won.length} won / ${lost.length} lost</i></div>
        <div class="kpi panel"><span>Total won</span><b>${money(wonVal)}</b><i>selected range</i></div>
        <div class="kpi panel"><span>Average won deal</span><b>${money(won.length ? wonVal / won.length : 0)}</b><i>${won.length} deals</i></div>
        <div class="kpi panel"><span>Weighted forecast</span><b>${money(forecastOf(open))}</b><i>${open.length} open deals</i></div>
      </div>
      <div class="grid two">
        <section class="panel"><h2>Won revenue by month</h2><div class="columns">${months.map((m) => `<div class="colbar"><b>${m.v ? money(m.v) : ''}</b><div class="colbar-track"><i style="height:${m.v / mMax * 100}%"></i></div><span>${m.label}</span></div>`).join('')}</div></section>
        <section class="panel"><h2>Lead sources</h2><div class="bars">${srcRows.map(([k, r]) => `<div class="bar-row"><span>${esc(k)}</span><div class="bar"><i style="width:${r.n / sMax * 100}%"></i></div><b>${r.n} <small>(${money(r.v)} won)</small></b></div>`).join('') || empty('No contacts yet.')}</div></section>
        <section class="panel"><h2>Open pipeline by stage</h2><div class="bars">${stages.map((x) => `<div class="bar-row"><span>${esc(x.s)}</span><div class="bar"><i style="width:${x.v / stMax * 100}%"></i></div><b>${money(x.v)}</b></div>`).join('')}</div></section>
        <section class="panel"><h2>Top clients by won revenue</h2>${(() => {
          const m = {}; won.forEach((d) => { const k = companyName(d.companyId) || 'No company'; m[k] = (m[k] || 0) + d.value; });
          const r = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
          return r.length ? `<ul class="list">${r.map(([k, v]) => `<li><b>${esc(k)}</b><span class="mono">${money(v)}</span></li>`).join('')}</ul>` : empty('No won deals in this range.');
        })()}</section>
        <section class="panel"><h2>Reasons lost</h2>${reasonRows.length ? `<ul class="list">${reasonRows.map(([k, n]) => `<li><b>${esc(k)}</b><span class="mono">${n}</span></li>`).join('')}</ul>` : empty('No lost deals in this range.')}</section>
      </div>`);
  }

  function viewSettings() {
    const s = db.settings;
    const ta = (name, label, arr, hint) => `<div class="field"><label for="s_${name}">${label}</label><textarea id="s_${name}" name="${name}" rows="6">${esc(arr.join('\n'))}</textarea><small class="muted">${hint}</small></div>`;
    const stageEditor = `<div class="field wide"><label>Pipeline stages &amp; win probability</label>
      <ul id="stageEditor" class="stage-editor">${s.stages.map((st, i) => `<li draggable="true" data-stage-row="${i}"><span class="drag-handle" aria-hidden="true">⠿</span><input class="se-name" value="${esc(st)}" aria-label="Stage name"><input class="se-prob" type="number" min="0" max="100" value="${s.stageProbabilities[st] != null ? s.stageProbabilities[st] : 50}" aria-label="Win probability"><span class="mono">%</span><button type="button" class="x" data-action="remove-stage-row" title="Remove" aria-label="Remove stage">×</button></li>`).join('')}</ul>
      <button type="button" class="btn ghost sm" data-action="add-stage-row">+ Add stage</button><small class="muted">Drag ⠿ to reorder. Won and Lost are always added at the end.</small></div>`;
    return shell('settings', head('Settings') + `
      <form class="panel" data-form="settings"><h2>Profile &amp; lists</h2>
        <div class="form-grid">
          <div class="field"><label for="s_name">Your name</label><input id="s_name" name="name" value="${esc(s.profile.name)}"></div>
          <div class="field"><label for="s_biz">Business name</label><input id="s_biz" name="business" value="${esc(s.profile.business)}"></div>
          <div class="field"><label for="s_goal">Monthly revenue goal ($)</label><input id="s_goal" name="revenueGoal" type="number" min="0" step="100" value="${esc(s.revenueGoal)}"></div>
          ${stageEditor}
          ${ta('services', 'Services', s.services, 'One per line.')}
          ${ta('sources', 'Lead sources', s.sources, 'One per line.')}
          ${ta('tags', 'Tags', s.tags, 'One per line.')}
        </div><div class="modal-actions"><button class="btn primary" type="submit">Save settings</button></div></form>
      <div class="grid two">
        <section class="panel"><h2>Appearance</h2>
          <div class="field"><label for="s_accent">Accent colour</label><input id="s_accent" type="color" value="${esc(s.theme.accent)}" data-action="set-accent"></div>
          <label class="check" style="margin:6px 0 2px"><input type="checkbox" id="s_glow" ${s.theme.glow ? 'checked' : ''} data-action="toggle-glow"> <span>Glow effects</span></label>
          <div class="actions" style="margin-top:10px"><button class="btn ghost" data-action="replay-tour">Replay guided tour</button></div>
        </section>
        <section class="panel"><h2>Logo</h2><p class="muted">Shown in the header and behind the main menu.</p><div class="logo-prev"><img src="${esc(logoSrc())}" alt="Current logo"></div>
          <div class="actions"><button class="btn ghost" data-action="upload-logo">Upload logo</button>${s.logo ? `<button class="btn ghost" data-action="reset-logo">Use default</button>` : ''}</div></section>
        <section class="panel"><h2>Data</h2><p class="muted">Everything is stored in this browser only. Clearing site data erases it.</p>
          <div class="actions"><button class="btn ghost" data-action="backup">Download backup</button><button class="btn ghost" data-action="restore-backup">Restore backup</button><button class="btn danger" data-action="reset-data">Reset demo data</button></div></section>
      </div>`);
  }

  function viewSearch(q) {
    const term = (q.q || '').toLowerCase().trim();
    const hit = (s) => String(s || '').toLowerCase().includes(term);
    const groups = term ? [
      ['Contacts', db.contacts.filter((c) => hit(fullName(c)) || hit(c.email) || hit(c.title) || (c.tags || []).some(hit)).map((c) => `<li><a href="#/contacts/${c.id}"><b>${esc(fullName(c))}</b><span class="muted">${esc(companyName(c.companyId))}</span></a></li>`)],
      ['Companies', db.companies.filter((c) => hit(c.name) || hit(c.industry) || hit(c.city) || (c.tags || []).some(hit)).map((c) => `<li><a href="#/companies/${c.id}"><b>${esc(c.name)}</b><span class="muted">${esc(c.industry)}</span></a></li>`)],
      ['Deals', db.deals.filter((d) => hit(d.title) || hit(d.stage) || (d.services || []).some(hit)).map(dealRow)],
      ['Tasks', db.tasks.filter((t) => hit(t.title)).map((t) => `<li><a href="#/tasks?f=${t.done ? 'done' : 'open'}"><b>${esc(t.title)}</b><span class="muted">${fmtDate(t.due)}</span></a></li>`)],
      ['Projects', db.projects.filter((p) => hit(p.name) || (p.deliverables || []).some((x) => hit(x.text))).map((p) => `<li><a href="#/projects/${p.id}"><b>${esc(p.name)}</b><span class="muted">${esc(p.status)}</span></a></li>`)]
    ] : [];
    const total = groups.reduce((s, g) => s + g[1].length, 0);
    return shell('', head('Search', term ? `${total} result${total === 1 ? '' : 's'} for “${esc(q.q)}”` : 'Type in the search box above, or press / anywhere.') +
      (total ? groups.filter((g) => g[1].length).map((g) => `<section class="panel"><h2>${g[0]}</h2><ul class="list">${g[1].join('')}</ul></section>`).join('') : (term ? empty('Nothing matched. Try a name, company, tag or deal title.') : '')));
  }

  /* ---------- live search palette ---------- */
  function openPalette() {
    paletteRoot.innerHTML = `<div class="overlay" id="pal-overlay"><div class="palette panel">
      <input id="pal-input" type="search" placeholder="Jump to a contact, company, deal, task…" autocomplete="off" aria-label="Quick search">
      <div id="pal-results" class="pal-results"></div>
      <p class="mono muted">Esc to close · Enter opens the top result</p></div></div>`;
    const inp = $('#pal-input'); inp.focus();
    inp.addEventListener('input', renderPalette);
    $('#pal-overlay').addEventListener('click', (e) => { if (e.target.id === 'pal-overlay') closePalette(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = $('#pal-results a'); if (first) first.click(); } });
    renderPalette();
  }
  function renderPalette() {
    const term = ($('#pal-input') ? $('#pal-input').value : '').toLowerCase().trim();
    const box = $('#pal-results');
    if (!term) { box.innerHTML = '<p class="muted pal-hint">Start typing to search contacts, companies, deals, tasks and projects.</p>'; return; }
    const hit = (s) => String(s || '').toLowerCase().includes(term);
    const results = [];
    db.contacts.filter((c) => hit(fullName(c)) || hit(c.email) || hit(c.title)).slice(0, 4).forEach((c) => results.push({ href: `#/contacts/${c.id}`, label: fullName(c), sub: 'Contact · ' + (companyName(c.companyId) || c.title || '') }));
    db.companies.filter((c) => hit(c.name) || hit(c.industry)).slice(0, 3).forEach((c) => results.push({ href: `#/companies/${c.id}`, label: c.name, sub: 'Company · ' + (c.industry || '') }));
    db.deals.filter((d) => hit(d.title)).slice(0, 3).forEach((d) => results.push({ href: `#/deals/${d.id}`, label: d.title, sub: 'Deal · ' + d.stage }));
    db.tasks.filter((t) => hit(t.title)).slice(0, 2).forEach((t) => results.push({ href: `#/tasks?f=${t.done ? 'done' : 'open'}`, label: t.title, sub: 'Task · ' + fmtDate(t.due) }));
    db.projects.filter((p) => hit(p.name)).slice(0, 2).forEach((p) => results.push({ href: `#/projects/${p.id}`, label: p.name, sub: 'Project · ' + p.status }));
    box.innerHTML = results.length ? results.slice(0, 10).map((r) => `<a href="${r.href}" data-pal-link>${esc(r.label)}<span class="muted">${esc(r.sub)}</span></a>`).join('') : '<p class="muted pal-hint">No matches.</p>';
  }

  /* ---------- router ---------- */
  function render() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const q = {}; new URLSearchParams(qs || '').forEach((v, k) => { q[k] = v; });
    const [page, id] = path.split('/');
    if (!user()) { app.innerHTML = viewLogin(); document.title = 'Afterlife CRM'; return; }
    let html;
    switch (page) {
      case 'dashboard': html = viewDashboard(); break;
      case 'contacts': html = id ? viewContact(id) : viewContacts(); break;
      case 'companies': html = id ? viewCompany(id) : viewCompanies(); break;
      case 'pipeline': html = viewPipeline(); break;
      case 'deals': html = id ? viewDeal(id) : viewPipeline(); break;
      case 'tasks': html = viewTasks(q); break;
      case 'projects': html = id ? viewProject(id) : viewProjects(); break;
      case 'reports': html = viewReports(q); break;
      case 'settings': html = viewSettings(); break;
      case 'search': html = viewSearch(q); break;
      default: html = viewHub();
    }
    app.innerHTML = html;
    const nav = NAV.find((n) => n.id === page);
    document.title = (nav ? nav.label + ' · ' : '') + 'Afterlife CRM';
    if (page === 'search') { const i = $('.search input'); if (i) i.value = q.q || ''; }
    if (page === 'contacts' || page === 'companies') restoreFilters(page);
  }

  /* ---------- actions ---------- */
  const blank = {
    contact: (o) => Object.assign({ first: '', last: '', email: '', phone: '', title: '', companyId: '', source: '', tags: [], nextAction: '', nextActionNote: '' }, o),
    deal: (o) => Object.assign({ title: '', companyId: '', contactId: '', value: 0, stage: db.settings.stages[0] || 'Won', services: [], closeDate: '', notes: '' }, o)
  };
  const A = {
    'close-modal': closeModal,
    logout: () => { try { localStorage.removeItem(SESSION); } catch (e) { /* ignore */ } go('#/login'); },
    'toggle-nav': () => { document.body.classList.toggle('nav-open'); },

    'new-contact': (d) => openForm('New contact', F.contact(), blank.contact({ companyId: d.company || '' }), (v) => { db.contacts.push(Object.assign({ id: S.uid(), created: today() }, v)); toast('Contact added'); }),
    'edit-contact': (d) => { const c = byId('contacts', d.id); openForm('Edit contact', F.contact(), c, (v) => Object.assign(c, v)); },
    'del-contact': (d) => confirmBox('Delete this contact and its activity history?', () => {
      const snap = snapshot();
      db.contacts = db.contacts.filter((c) => c.id !== d.id);
      db.activities = db.activities.filter((a) => a.contactId !== d.id);
      db.deals.forEach((x) => { if (x.contactId === d.id) x.contactId = ''; });
      db.tasks.forEach((x) => { if (x.contactId === d.id) x.contactId = ''; });
      save(); location.hash = '#/contacts';
      toast('Contact deleted', { label: 'Undo', fn: () => restoreSnapshot(snap) });
    }),
    'clear-next': (d) => { const c = byId('contacts', d.id); c.nextAction = ''; c.nextActionNote = ''; save(); render(); toast('Follow-up cleared'); },

    'select-row': (d, el) => { el.checked ? selectedContacts.add(d.id) : selectedContacts.delete(d.id); render(); },
    'select-all': (d, el) => { $$('[data-row]').filter((r) => !r.hidden).forEach((r) => { el.checked ? selectedContacts.add(r.dataset.id) : selectedContacts.delete(r.dataset.id); }); render(); },
    'bulk-clear': () => { selectedContacts.clear(); render(); },
    'bulk-delete': () => confirmBox(`Delete ${selectedContacts.size} selected contact(s)?`, () => {
      const snap = snapshot();
      const ids = new Set(selectedContacts);
      db.contacts = db.contacts.filter((c) => !ids.has(c.id));
      db.activities = db.activities.filter((a) => !ids.has(a.contactId));
      db.deals.forEach((x) => { if (ids.has(x.contactId)) x.contactId = ''; });
      db.tasks.forEach((x) => { if (ids.has(x.contactId)) x.contactId = ''; });
      selectedContacts.clear(); save(); render();
      toast('Contacts deleted', { label: 'Undo', fn: () => restoreSnapshot(snap) });
    }),
    'bulk-export': () => {
      const ids = selectedContacts;
      const rows = db.contacts.filter((c) => ids.has(c.id)).map((c) => ({ first: c.first, last: c.last, email: c.email, phone: c.phone, title: c.title, company: companyName(c.companyId), source: c.source, tags: (c.tags || []).join(';'), nextAction: c.nextAction, nextActionNote: c.nextActionNote }));
      download('afterlife-contacts-selected.csv', toCSV(rows, ['first', 'last', 'email', 'phone', 'title', 'company', 'source', 'tags', 'nextAction', 'nextActionNote']));
      toast('CSV downloaded');
    },
    'bulk-tag': () => {
      modal(`<h2>Tag ${selectedContacts.size} contact(s)</h2><form id="tform"><div class="field"><label for="btag">Tag</label><input id="btag" name="tag" list="tagopts" required><datalist id="tagopts">${db.settings.tags.map((t) => `<option value="${esc(t)}">`).join('')}</datalist></div><div class="modal-actions"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Add tag</button></div></form>`);
      $('#tform').addEventListener('submit', (e) => {
        e.preventDefault();
        const tag = e.target.elements.tag.value.trim(); if (!tag) return;
        db.contacts.filter((c) => selectedContacts.has(c.id)).forEach((c) => { c.tags = Array.from(new Set((c.tags || []).concat(tag))); });
        save(); closeModal(); render(); toast('Tag added');
      });
    },
    'sort-contacts': (d) => { /* handled by delegated click on [data-sort] */ },

    'new-company': () => openForm('New company', F.company(), { tags: [] }, (v) => { db.companies.push(Object.assign({ id: S.uid() }, v)); toast('Company added'); }),
    'edit-company': (d) => { const c = byId('companies', d.id); openForm('Edit company', F.company(), c, (v) => Object.assign(c, v)); },
    'del-company': (d) => confirmBox('Delete this company? Its contacts and deals are kept but unlinked.', () => {
      const snap = snapshot();
      db.companies = db.companies.filter((c) => c.id !== d.id);
      ['contacts', 'deals', 'projects'].forEach((k) => db[k].forEach((x) => { if (x.companyId === d.id) x.companyId = ''; }));
      save(); location.hash = '#/companies';
      toast('Company deleted', { label: 'Undo', fn: () => restoreSnapshot(snap) });
    }),

    'new-deal': (d) => openForm('New deal', F.deal(), blank.deal({ companyId: d.company || '', stage: d.stage || db.settings.stages[0] || 'Won' }), (v) => {
      db.deals.push(Object.assign({ id: S.uid(), created: today(), history: [{ stage: v.stage, date: today() }], lostReason: '', attachments: [] }, v)); toast('Deal added');
    }),
    'edit-deal': (d) => {
      const x = byId('deals', d.id);
      openForm('Edit deal', F.deal(), x, (v) => {
        const st = v.stage; const prev = x.stage; delete v.stage; const cd = v.closeDate;
        Object.assign(x, v); setStage(x, st); x.closeDate = cd || x.closeDate;
        if (st === 'Lost' && prev !== 'Lost') setTimeout(() => promptLostReason(x.id), 0);
        if (st === 'Won' && prev !== 'Won') setTimeout(() => promptProject(x.id), 0);
      });
    },
    'del-deal': (d) => confirmBox('Delete this deal?', () => {
      const snap = snapshot();
      db.deals = db.deals.filter((x) => x.id !== d.id);
      db.tasks.forEach((t) => { if (t.dealId === d.id) t.dealId = ''; });
      db.activities.forEach((a) => { if (a.dealId === d.id) a.dealId = ''; });
      save(); location.hash = '#/pipeline';
      toast('Deal deleted', { label: 'Undo', fn: () => restoreSnapshot(snap) });
    }),
    'deal-project': (d) => {
      const x = byId('deals', d.id);
      db.projects.push({ id: S.uid(), name: x.title, companyId: x.companyId, dealId: x.id, status: 'Planned', start: today(), due: S.day(30), notes: '', deliverables: (x.services || []).map((s) => ({ id: S.uid(), text: s, done: false, due: '' })) });
      save(); toast('Project created'); go('#/projects');
    },
    'new-attachment-link': (d) => openForm('Add attachment link', F.attachment(), { name: '', url: '' }, (v) => { const x = byId('deals', d.id); (x.attachments = x.attachments || []).push({ id: S.uid(), name: v.name, url: v.url }); }),
    'upload-attachment': (d) => pickFile('*/*', (url, file) => {
      if (file.size > 700 * 1024) return toast('That file is too large for this demo. Use one under 700 KB, or add a link instead.');
      const x = byId('deals', d.id); (x.attachments = x.attachments || []).push({ id: S.uid(), name: file.name, url });
      save(); render(); toast('Attached');
    }, true),
    'del-attachment': (d) => { const x = byId('deals', d.id); x.attachments = (x.attachments || []).filter((a) => a.id !== d.aid); save(); render(); },

    'new-activity': (d) => openForm('Log activity', F.activity(), { type: 'Call', date: today(), note: '' }, (v) => { db.activities.push(Object.assign({ id: S.uid(), contactId: d.contact, dealId: d.deal || '' }, v)); }),
    'del-activity': (d) => confirmBox('Delete this timeline entry?', () => { db.activities = db.activities.filter((a) => a.id !== d.id); save(); render(); }),

    'new-task': (d) => openForm('New task', F.task(), { title: '', due: today(), priority: 'Medium', recur: 'none', contactId: d.contact || '', dealId: d.deal || '' }, (v) => { db.tasks.push(Object.assign({ id: S.uid(), done: false }, v)); toast('Task added'); }),
    'edit-task': (d) => { const t = byId('tasks', d.id); openForm('Edit task', F.task(), t, (v) => Object.assign(t, v)); },
    'del-task': (d) => confirmBox('Delete this task?', () => { const snap = snapshot(); db.tasks = db.tasks.filter((t) => t.id !== d.id); save(); render(); toast('Task deleted', { label: 'Undo', fn: () => restoreSnapshot(snap) }); }),
    'toggle-task': (d) => {
      const t = byId('tasks', d.id); t.done = !t.done;
      if (t.done && t.recur && t.recur !== 'none' && t.due) {
        const nextDue = t.recur === 'weekly' ? S.day(Math.round((new Date(t.due) - new Date(today())) / 86400000) + 7) : addMonths(t.due, 1);
        db.tasks.push({ id: S.uid(), title: t.title, due: nextDue, priority: t.priority, contactId: t.contactId, dealId: t.dealId, done: false, recur: t.recur });
        toast('Done — next occurrence scheduled for ' + fmtDate(nextDue));
      }
      save(); render();
    },

    'new-project': () => openForm('New project', F.project(), { status: 'Planned', start: today(), deliverables: [], notes: '' }, (v) => { v.deliverables = v.deliverables.map((t) => ({ id: S.uid(), text: t, done: false, due: '' })); db.projects.push(Object.assign({ id: S.uid(), dealId: '' }, v)); }),
    'edit-project': (d) => {
      const p = byId('projects', d.id);
      openForm('Edit project', F.project(), Object.assign({}, p, { deliverables: (p.deliverables || []).map((x) => x.text) }), (v) => {
        v.deliverables = v.deliverables.map((t) => { const ex = (p.deliverables || []).find((x) => x.text === t); return { id: ex ? ex.id : S.uid(), text: t, done: ex ? ex.done : false, due: ex ? ex.due : '' }; });
        Object.assign(p, v);
      });
    },
    'del-project': (d) => confirmBox('Delete this project?', () => { const snap = snapshot(); db.projects = db.projects.filter((p) => p.id !== d.id); save(); location.hash = '#/projects'; toast('Project deleted', { label: 'Undo', fn: () => restoreSnapshot(snap) }); }),
    'toggle-deliv2': (d) => { const p = byId('projects', d.id); const x = (p.deliverables || []).find((i) => i.id === d.did); if (x) x.done = !x.done; save(); render(); },
    'add-deliverable': (d) => {
      modal(`<h2>Add deliverable</h2><form id="dform"><div class="field"><label for="dtext">Description</label><input id="dtext" name="text" required></div><div class="field"><label for="ddue">Due date</label><input id="ddue" name="due" type="date"></div><div class="modal-actions"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Add</button></div></form>`);
      $('#dform').addEventListener('submit', (e) => { e.preventDefault(); const p = byId('projects', d.id); (p.deliverables = p.deliverables || []).push({ id: S.uid(), text: e.target.elements.text.value.trim(), done: false, due: e.target.elements.due.value }); save(); closeModal(); render(); });
    },
    'del-deliverable': (d) => { const p = byId('projects', d.id); p.deliverables = (p.deliverables || []).filter((x) => x.id !== d.did); save(); render(); },

    'print-report': () => { window.print(); },

    export: (d) => {
      if (d.kind === 'contacts') download('afterlife-contacts.csv', toCSV(db.contacts.map((c) => ({ first: c.first, last: c.last, email: c.email, phone: c.phone, title: c.title, company: companyName(c.companyId), source: c.source, tags: (c.tags || []).join(';'), nextAction: c.nextAction, nextActionNote: c.nextActionNote })), ['first', 'last', 'email', 'phone', 'title', 'company', 'source', 'tags', 'nextAction', 'nextActionNote']));
      else if (d.kind === 'companies') download('afterlife-companies.csv', toCSV(db.companies.map((c) => Object.assign({}, c, { tags: (c.tags || []).join(';') })), ['name', 'industry', 'website', 'phone', 'city', 'tags', 'notes']));
      else download('afterlife-deals.csv', toCSV(db.deals.map((x) => ({ title: x.title, company: companyName(x.companyId), contact: fullName(byId('contacts', x.contactId)), value: x.value, stage: x.stage, closeDate: x.closeDate, services: (x.services || []).join(';') })), ['title', 'company', 'contact', 'value', 'stage', 'closeDate', 'services']));
      toast('CSV downloaded');
    },
    import: (d) => pickFile('.csv,text/csv', (text) => {
      const n = d.kind === 'contacts' ? importContacts(text) : importCompanies(text);
      save(); render();
      toast(n ? `Imported ${n} ${d.kind}` : 'No rows imported. Check the column headers.');
    }),
    'upload-logo': () => pickFile('image/*', (url, file) => {
      if (file.size > 700 * 1024) return toast('That image is too large. Use one under 700 KB.');
      db.settings.logo = url; save(); render(); toast('Logo updated');
    }, true),
    'reset-logo': () => { db.settings.logo = ''; save(); render(); },
    'set-accent': (d, el) => { db.settings.theme.accent = el.value; applyTheme(); },
    'toggle-glow': (d, el) => { db.settings.theme.glow = el.checked; applyTheme(); },
    'replay-tour': () => { db.settings.tourSeen = false; save(); startTour(0); },
    backup: () => download('afterlife-crm-backup.json', JSON.stringify(db, null, 2), 'application/json'),
    'restore-backup': () => pickFile('application/json,.json', (text) => {
      let parsed;
      try { parsed = JSON.parse(text); if (!parsed || !parsed.settings || !parsed.contacts) throw new Error('shape'); }
      catch (e) { toast('That file is not a valid Afterlife CRM backup.'); return; }
      modal(`<h2>Restore backup</h2><p class="muted">This replaces everything currently in this browser.</p><div class="modal-actions"><button class="btn ghost" data-action="close-modal">Cancel</button><button class="btn danger" id="cyes">Restore</button></div>`);
      $('#cyes').addEventListener('click', () => { db = parsed; S.data = db; save(); closeModal(); applyTheme(); render(); toast('Backup restored'); });
    }),
    'reset-data': () => {
      modal(`<h2>Reset demo data</h2><p class="muted">This replaces everything in this browser with the original sample data.</p><div class="modal-actions"><button class="btn ghost" data-action="close-modal">Cancel</button><button class="btn danger" id="cyes">Reset</button></div>`);
      $('#cyes').addEventListener('click', () => { db = S.reset(); closeModal(); applyTheme(); render(); toast('Demo data restored'); });
    },

    'add-stage-row': () => {
      const ul = $('#stageEditor'); if (!ul) return;
      const li = document.createElement('li');
      li.draggable = true; li.dataset.stageRow = String(ul.children.length);
      li.innerHTML = `<span class="drag-handle" aria-hidden="true">⠿</span><input class="se-name" value="" placeholder="New stage" aria-label="Stage name"><input class="se-prob" type="number" min="0" max="100" value="50" aria-label="Win probability"><span class="mono">%</span><button type="button" class="x" data-action="remove-stage-row" title="Remove" aria-label="Remove stage">×</button>`;
      ul.appendChild(li); li.querySelector('.se-name').focus();
    },
    'remove-stage-row': (d, el) => {
      const ul = $('#stageEditor'); if (!ul || ul.children.length <= 1) { toast('Keep at least one stage.'); return; }
      el.closest('li').remove();
    }
  };

  /* ---------- guided tour ---------- */
  const TOUR = [
    { t: 'Welcome to Afterlife CRM', d: 'A quick tour of the main systems. You can skip this at any time.' },
    { t: 'The Hub', d: 'Your main menu. Each panel shows a live stat, and hovering shows a preview of what is inside.' },
    { t: 'Dashboard', d: 'Follow-ups, tasks due, your pipeline and your monthly revenue goal at a glance.' },
    { t: 'Pipeline', d: 'Drag a deal between stages, or use the stage menu on its own page. Moving a deal to Lost or Won will ask a quick follow-up question.' },
    { t: 'Quick search', d: 'Press / anywhere to search contacts, companies, deals, tasks and projects instantly.' }
  ];
  function startTour(step) {
    if (step >= TOUR.length) { db.settings.tourSeen = true; save(); closeModal(); return; }
    const s = TOUR[step];
    modal(`<h2>${esc(s.t)}</h2><p class="muted">${esc(s.d)}</p><div class="modal-actions"><button type="button" class="btn ghost" id="tourSkip">Skip tour</button><button class="btn primary" id="tourNext">${step === TOUR.length - 1 ? 'Finish' : 'Next'}</button></div><p class="mono muted tour-step">${step + 1} / ${TOUR.length}</p>`);
    $('#tourSkip').addEventListener('click', () => { db.settings.tourSeen = true; save(); closeModal(); });
    $('#tourNext').addEventListener('click', () => startTour(step + 1));
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const sortTh = e.target.closest && e.target.closest('[data-sort]');
    if (sortTh) {
      const key = sortTh.dataset.sort;
      if (contactSort.key === key) contactSort.dir *= -1; else { contactSort.key = key; contactSort.dir = 1; }
      render(); return;
    }
    const palLink = e.target.closest && e.target.closest('[data-pal-link]');
    if (palLink) { closePalette(); return; }
    const overlayEl = e.target.closest && e.target.closest('.overlay');
    if (overlayEl && e.target === overlayEl) { closeModal(); closePalette(); return; }
    const el = e.target.closest('[data-action]');
    if (el && A[el.dataset.action]) {
      if (el.tagName !== 'INPUT') e.preventDefault();
      A[el.dataset.action](el.dataset, el, e);
      return;
    }
    const row = e.target.closest('tr[data-href]');
    if (row && !e.target.closest('a,button,input')) location.hash = row.dataset.href;
  });

  document.addEventListener('submit', (e) => {
    const kind = e.target.dataset.form;
    if (!kind) return;
    e.preventDefault();
    const f = e.target.elements;
    if (kind === 'login') {
      try { localStorage.setItem(SESSION, f.u.value.trim() || 'demo'); } catch (err) { /* ignore */ }
      go('#/hub');
      setTimeout(() => { if (!db.settings.tourSeen) startTour(0); }, 450);
    } else if (kind === 'search') {
      go('#/search?q=' + encodeURIComponent(f.q.value.trim()));
    } else if (kind === 'project-notes') {
      const p = byId('projects', e.target.dataset.id); if (p) { p.notes = f.notes.value; save(); toast('Notes saved'); }
    } else if (kind === 'settings') {
      const lines = (n) => Array.from(new Set(f[n].value.split('\n').map((s) => s.trim()).filter(Boolean)));
      const s = db.settings;
      s.profile.name = f.name.value.trim(); s.profile.business = f.business.value.trim();
      s.revenueGoal = Math.max(0, Number(f.revenueGoal.value) || 0);
      const rows = $$('#stageEditor li');
      const stages = rows.map((li) => li.querySelector('.se-name').value.trim()).filter(Boolean);
      if (!stages.length) { toast('Keep at least one pipeline stage.'); return; }
      const probs = {};
      rows.forEach((li) => { const name = li.querySelector('.se-name').value.trim(); if (name) probs[name] = Math.max(0, Math.min(100, Number(li.querySelector('.se-prob').value) || 0)); });
      db.deals.forEach((d) => { if (isOpen(d) && !stages.includes(d.stage)) setStage(d, stages[0]); });
      s.stages = stages; s.stageProbabilities = probs; s.services = lines('services'); s.sources = lines('sources'); s.tags = lines('tags');
      save(); render(); toast('Settings saved');
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.change === 'deal-stage') { changeDealStage(byId('deals', el.dataset.id), el.value); }
    if (el.dataset && el.dataset.nav === 'range') { go('#/reports?range=' + encodeURIComponent(el.value)); }
    if (el.dataset && el.dataset.action === 'deliv-due') { const p = byId('projects', el.dataset.id); const x = (p.deliverables || []).find((i) => i.id === el.dataset.did); if (x) { x.due = el.value; save(); render(); } }
    if (el.dataset && el.dataset.action === 'set-accent') { db.settings.theme.accent = el.value; save(); applyTheme(); }
    if (el.dataset && el.dataset.action === 'toggle-glow') { db.settings.theme.glow = el.checked; save(); applyTheme(); }
    if (el.dataset && el.dataset.filter) { applyFilters(); persistFilters(location.hash.replace(/^#\/?/, '').split('/')[0].split('?')[0]); }
  });
  document.addEventListener('input', (e) => {
    if (e.target.dataset && e.target.dataset.filter === 'text') { applyFilters(); persistFilters(location.hash.replace(/^#\/?/, '').split('/')[0].split('?')[0]); }
  });

  /* ---------- pipeline drag and drop (mouse) ---------- */
  let dragId = null, stageDragEl = null;
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest && e.target.closest('[data-deal]');
    if (card) {
      dragId = card.dataset.deal; card.classList.add('dragging');
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); }
      return;
    }
    const row = e.target.closest && e.target.closest('[data-stage-row]');
    if (row) { stageDragEl = row; row.classList.add('dragging'); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; }
  });
  document.addEventListener('dragend', () => {
    dragId = null; stageDragEl = null;
    $$('.dragging,.over').forEach((x) => x.classList.remove('dragging', 'over'));
  });
  document.addEventListener('dragover', (e) => {
    const col = e.target.closest && e.target.closest('.col[data-stage]');
    if (col && dragId) {
      e.preventDefault();
      $$('.col.over').forEach((x) => { if (x !== col) x.classList.remove('over'); });
      col.classList.add('over');
      return;
    }
    const row = e.target.closest && e.target.closest('[data-stage-row]');
    if (row && stageDragEl && row !== stageDragEl) {
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      row.parentNode.insertBefore(stageDragEl, before ? row : row.nextSibling);
    }
  });
  document.addEventListener('drop', (e) => {
    const col = e.target.closest && e.target.closest('.col[data-stage]');
    if (!col || !dragId) return;
    e.preventDefault();
    const d = byId('deals', dragId);
    const target = col.dataset.stage;
    dragId = null;
    if (d) changeDealStage(d, target); else render();
  });

  /* ---------- pipeline drag and drop (touch) ---------- */
  let touchStart = null, touchMoved = false;
  document.addEventListener('touchstart', (e) => {
    const card = e.target.closest && e.target.closest('[data-deal]');
    if (!card) return;
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY, id: card.dataset.deal, card };
    touchMoved = false;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!touchStart) return;
    const t = e.touches[0];
    if (!touchMoved && (Math.abs(t.clientX - touchStart.x) > 12 || Math.abs(t.clientY - touchStart.y) > 12)) {
      touchMoved = true; touchStart.card.classList.add('dragging');
    }
    if (touchMoved) {
      e.preventDefault();
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const col = el && el.closest && el.closest('.col[data-stage]');
      $$('.col.over').forEach((c) => { if (c !== col) c.classList.remove('over'); });
      if (col) col.classList.add('over');
    }
  }, { passive: false });
  document.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    if (touchMoved) {
      const t = e.changedTouches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const col = el && el.closest && el.closest('.col[data-stage]');
      touchStart.card.classList.remove('dragging');
      $$('.col.over').forEach((c) => c.classList.remove('over'));
      const d = byId('deals', touchStart.id);
      const target = col && col.dataset.stage;
      touchStart = null; touchMoved = false;
      if (d && target) changeDealStage(d, target); else render();
      return;
    }
    touchStart = null; touchMoved = false;
  });

  /* ---------- keyboard shortcuts ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePalette(); closeModal(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if (!modalRoot.innerHTML && !paletteRoot.innerHTML && !typing && user()) {
      if (e.key === '/') { e.preventDefault(); openPalette(); return; }
      if (/^[1-8]$/.test(e.key)) { const item = NAV[Number(e.key) - 1]; if (item) go('#/' + item.id); }
    }
  });

  window.addEventListener('hashchange', () => { closeModal(); closePalette(); document.body.classList.remove('nav-open'); render(); window.scrollTo(0, 0); });
  applyTheme();
  render();
})();
