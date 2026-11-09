/* Afterlife CRM — views, routing and actions. Mock proof of concept: no server, no real accounts. */
(function () {
  const S = window.Store;
  let db = S.load();
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const SESSION = 'afterlife_session';
  const DEFAULT_LOGO = 'assets/img/logo.svg';

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-CA');
  const today = () => S.day(0);
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

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
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

  /* ---------- modal + forms ---------- */
  function modal(html) {
    modalRoot.innerHTML = `<div class="overlay" data-action="overlay"><div class="modal panel" role="dialog" aria-modal="true">${html}</div></div>`;
    const f = $('input,select,textarea,button', modalRoot);
    if (f) f.focus();
  }
  function closeModal() { modalRoot.innerHTML = ''; }

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
    $('#cyes').addEventListener('click', () => { closeModal(); onYes(); save(); render(); });
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
      { name: 'contactId', label: 'Contact', type: 'select', options: contactOpts() }, { name: 'dealId', label: 'Deal', type: 'select', options: dealOpts() }
    ],
    project: () => [
      { name: 'name', label: 'Project name', required: true, wide: true },
      { name: 'companyId', label: 'Client', type: 'select', options: companyOpts() }, { name: 'status', label: 'Status', type: 'select', blank: false, options: ['Planned', 'Active', 'On hold', 'Complete'] },
      { name: 'start', label: 'Start date', type: 'date' }, { name: 'due', label: 'Due date', type: 'date' },
      { name: 'deliverables', label: 'Deliverables (one per line)', type: 'lines', wide: true }
    ],
    activity: () => [
      { name: 'type', label: 'Type', type: 'select', blank: false, options: ['Call', 'Email', 'Meeting', 'Note'] }, { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'note', label: 'Details', type: 'textarea', wide: true }
    ]
  };

  function setStage(deal, stage) {
    if (deal.stage === stage) return;
    deal.stage = stage;
    (deal.history = deal.history || []).push({ stage, date: today() });
    if (stage === 'Won' || stage === 'Lost') deal.closeDate = today();
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

  /* ---------- layout ---------- */
  function shell(active, content) {
    return `<header class="topbar">
      <a class="brand" href="#/hub" title="Main menu"><img src="${esc(logoSrc())}" alt=""><span>AFTERLIFE</span><b>CRM</b></a>
      <nav class="tabs" aria-label="Sections"><a href="#/hub" class="${active === 'hub' ? 'on' : ''}">Hub</a>${NAV.map((n) => `<a href="#/${n.id}" class="${active === n.id ? 'on' : ''}">${n.label}</a>`).join('')}</nav>
      <form class="search" data-form="search" role="search"><input name="q" type="search" placeholder="Search everything…" aria-label="Search"></form>
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
    const overdue = openTasks.filter((t) => t.due && t.due < today()).length;
    const won = db.deals.filter((d) => d.stage === 'Won').length, lost = db.deals.filter((d) => d.stage === 'Lost').length;
    const info = {
      dashboard: [`${followUps().length} follow-ups due`, 'Daily overview'],
      contacts: [`${db.contacts.length} records`, `${followUps().length} need a follow-up`],
      companies: [`${db.companies.length} organizations`, 'Profiles and linked work'],
      pipeline: [`${open.length} open deals`, `${money(open.reduce((s, d) => s + d.value, 0))} in play`],
      tasks: [`${openTasks.length} open`, overdue ? `${overdue} overdue` : 'Nothing overdue'],
      projects: [`${db.projects.filter((p) => p.status === 'Active').length} active`, `${db.projects.length} total`],
      reports: [`${won + lost ? Math.round(won / (won + lost) * 100) : 0}% win rate`, 'Revenue and sources'],
      settings: ['Stages, services, tags', 'Logo and demo data']
    };
    const slot = (n, i) => `<a class="slot" href="#/${n.id}" style="--i:${i}">
      <span class="slot-ic">${icon(n.id)}</span>
      <span class="slot-body"><span class="slot-title">${n.label}</span><span class="slot-stat">${esc(info[n.id][0])}</span><span class="slot-sub">${esc(info[n.id][1])}</span></span>
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
    const fu = followUps();
    const dueTasks = db.tasks.filter((t) => !t.done && t.due && t.due <= today()).sort((a, b) => a.due.localeCompare(b.due));
    const recent = db.activities.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    const stages = db.settings.stages.map((s) => ({ s, v: open.filter((d) => d.stage === s).reduce((t, d) => t + d.value, 0), n: open.filter((d) => d.stage === s).length }));
    const max = Math.max(1, ...stages.map((x) => x.v));
    return shell('dashboard', head('Dashboard', fmtDate(today())) + `
      <div class="kpis">
        <div class="kpi panel"><span>Open pipeline</span><b>${money(open.reduce((s, d) => s + d.value, 0))}</b><i>${open.length} deals</i></div>
        <div class="kpi panel"><span>Won this month</span><b>${money(wonMonth)}</b><i>${fmtDate(month + '-01').replace(/ \d+,/, '')}</i></div>
        <div class="kpi panel warn"><span>Follow-ups due</span><b>${fu.length}</b><i>${dueTasks.length} tasks due</i></div>
        <div class="kpi panel"><span>Win rate</span><b>${wonAll.length + lost ? Math.round(wonAll.length / (wonAll.length + lost) * 100) : 0}%</b><i>${wonAll.length} won / ${lost} lost</i></div>
      </div>
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
    const rows = db.contacts.slice().sort((a, b) => fullName(a).localeCompare(fullName(b)));
    const tags = Array.from(new Set(db.settings.tags.concat(...db.contacts.map((c) => c.tags || []))));
    return shell('contacts', head('Contacts', `${rows.length} records`, `<button class="btn ghost" data-action="import" data-kind="contacts">Import CSV</button><button class="btn ghost" data-action="export" data-kind="contacts">Export CSV</button><button class="btn primary" data-action="new-contact">+ New contact</button>`) +
      filterBar(selFilter('source', 'Source', db.settings.sources) + selFilter('tags', 'Tag', tags)) +
      (rows.length ? `<div class="table-wrap panel"><table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Source</th><th>Tags</th><th>Next action</th></tr></thead><tbody>
      ${rows.map((c) => `<tr data-row data-href="#/contacts/${c.id}" data-text="${esc((fullName(c) + ' ' + companyName(c.companyId) + ' ' + c.email + ' ' + c.title).toLowerCase())}" data-source="${esc(c.source)}" data-tags="${esc((c.tags || []).join('|'))}">
        <td data-l="Name"><a href="#/contacts/${c.id}"><b>${esc(fullName(c))}</b></a><small>${esc(c.title)}</small></td><td data-l="Company">${esc(companyName(c.companyId)) || '—'}</td><td data-l="Email">${esc(c.email) || '—'}</td>
        <td data-l="Source">${esc(c.source) || '—'}</td><td data-l="Tags">${tagsHtml(c.tags) || '—'}</td><td data-l="Next action"><span class="date ${dueClass(c.nextAction)}">${fmtDate(c.nextAction)}</span></td></tr>`).join('')}
      </tbody></table></div>` : empty('No contacts yet. Add one or import a CSV.')));
  }

  function dealRow(d) {
    return `<li><a href="#/deals/${d.id}"><b>${esc(d.title)}</b><span class="muted">${esc(companyName(d.companyId))}</span></a><span class="stage s-${esc(d.stage.toLowerCase())}">${esc(d.stage)}</span><span class="mono">${money(d.value)}</span></li>`;
  }
  function taskRow(t) {
    const c = byId('contacts', t.contactId), d = byId('deals', t.dealId);
    return `<li class="${t.done ? 'done' : ''}"><label class="check"><input type="checkbox" data-action="toggle-task" data-id="${t.id}"${t.done ? ' checked' : ''}> <span>${esc(t.title)}</span></label>
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
          <h3>${esc(c.name)}</h3><p class="mono muted">${esc(c.industry) || 'No industry'} · ${esc(c.city) || 'No city'}</p>
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
      <div class="grid side">
        <div class="stack">
          <section class="panel"><h2>Profile</h2><dl class="dl"><dt>Website</dt><dd>${site ? `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(c.website)}</a>` : '—'}</dd><dt>Phone</dt><dd>${esc(c.phone) || '—'}</dd><dt>Tags</dt><dd>${tagsHtml(c.tags) || '—'}</dd></dl></section>
          <section class="panel"><h2>Notes</h2><p class="${c.notes ? '' : 'muted'}">${esc(c.notes) || 'No notes yet.'}</p></section>
        </div>
        <div class="stack">
          <section class="panel"><div class="panel-head"><h2>Contacts</h2><button class="btn ghost sm" data-action="new-contact" data-company="${id}">+ Contact</button></div>${people.length ? `<ul class="list">${people.map((p) => `<li><a href="#/contacts/${p.id}"><b>${esc(fullName(p))}</b><span class="muted">${esc(p.title)}</span></a><span class="mono">${esc(p.email)}</span></li>`).join('')}</ul>` : empty('No contacts linked.')}</section>
          <section class="panel"><div class="panel-head"><h2>Deals</h2><button class="btn ghost sm" data-action="new-deal" data-company="${id}">+ Deal</button></div>${deals.length ? `<ul class="list">${deals.map(dealRow).join('')}</ul>` : empty('No deals linked.')}</section>
          <section class="panel"><h2>Projects</h2>${projects.length ? `<ul class="list">${projects.map((p) => `<li><a href="#/projects"><b>${esc(p.name)}</b></a><span class="stage">${esc(p.status)}</span></li>`).join('')}</ul>` : empty('No projects yet.')}</section>
        </div>
      </div>`);
  }

  function viewPipeline() {
    const cols = allStages();
    return shell('pipeline', head('Pipeline', 'Drag a card to move it between stages.', `<button class="btn ghost" data-action="export" data-kind="deals">Export CSV</button><button class="btn primary" data-action="new-deal">+ New deal</button>`) +
      `<div class="board">${cols.map((s) => {
        const deals = db.deals.filter((d) => d.stage === s);
        return `<section class="col s-${esc(s.toLowerCase())}" data-stage="${esc(s)}"><header><h2>${esc(s)}</h2><span class="mono">${deals.length} · ${money(deals.reduce((t, d) => t + d.value, 0))}</span></header>
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
            <dl class="dl"><dt>Close date</dt><dd>${fmtDate(d.closeDate)}</dd><dt>Created</dt><dd>${fmtDate(d.created)}</dd><dt>Services</dt><dd>${tagsHtml(d.services) || '—'}</dd></dl>
            ${d.notes ? `<p>${esc(d.notes)}</p>` : ''}
            ${d.stage === 'Won' ? (project ? `<a class="btn ghost" href="#/projects">View project</a>` : `<button class="btn primary" data-action="deal-project" data-id="${id}">Create project from deal</button>`) : ''}</section>
          <section class="panel"><h2>Stage history</h2><ul class="history">${(d.history || []).map((h) => `<li><span class="stage s-${esc(h.stage.toLowerCase())}">${esc(h.stage)}</span><span class="date">${fmtDate(h.date)}</span></li>`).join('')}</ul></section>
        </div>
        <div class="stack">
          <section class="panel"><div class="panel-head"><h2>Activity</h2>${c ? `<button class="btn primary sm" data-action="new-activity" data-contact="${c.id}" data-deal="${id}">+ Log activity</button>` : ''}</div>${acts.length ? `<ul class="timeline">${acts.map(actItem).join('')}</ul>` : empty(c ? 'No activity logged on this deal.' : 'Link a contact to log activity.')}</section>
          <section class="panel"><div class="panel-head"><h2>Tasks</h2><button class="btn ghost sm" data-action="new-task" data-deal="${id}" data-contact="${d.contactId || ''}">+ Task</button></div>${tasks.length ? `<ul class="list tasks">${tasks.map(taskRow).join('')}</ul>` : empty('No tasks linked.')}</section>
        </div>
      </div>`);
  }

  function viewTasks(q) {
    const f = q.f || 'open';
    const sets = {
      open: (t) => !t.done, overdue: (t) => !t.done && t.due && t.due < today(),
      today: (t) => !t.done && t.due === today(), done: (t) => t.done
    };
    const rows = db.tasks.filter(sets[f] || sets.open).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const tab = (k, l) => `<a href="#/tasks?f=${k}" class="${f === k ? 'on' : ''}">${l} <span>${db.tasks.filter(sets[k]).length}</span></a>`;
    return shell('tasks', head('Tasks & follow-ups', '', `<button class="btn primary" data-action="new-task">+ New task</button>`) +
      `<div class="subtabs">${tab('open', 'Open')}${tab('overdue', 'Overdue')}${tab('today', 'Due today')}${tab('done', 'Done')}</div>
      <section class="panel">${rows.length ? `<ul class="list tasks">${rows.map(taskRow).join('')}</ul>` : empty('Nothing in this view.')}</section>
      <section class="panel"><h2>Contact follow-ups</h2>${(() => {
        const fu = db.contacts.filter((c) => c.nextAction).sort((a, b) => a.nextAction.localeCompare(b.nextAction));
        return fu.length ? `<ul class="list">${fu.map((c) => `<li><a href="#/contacts/${c.id}"><b>${esc(fullName(c))}</b><span class="muted">${esc(c.nextActionNote || 'Follow up')}</span></a><span class="date ${dueClass(c.nextAction)}">${fmtDate(c.nextAction)}</span></li>`).join('')}</ul>` : empty('No follow-ups scheduled.');
      })()}</section>`);
  }

  function viewProjects() {
    const rows = db.projects.slice().sort((a, b) => (a.due || '').localeCompare(b.due || ''));
    return shell('projects', head('Projects', 'Client work after a deal is won.', `<button class="btn primary" data-action="new-project">+ New project</button>`) +
      (rows.length ? `<div class="cards wide">${rows.map((p) => {
        const dl = p.deliverables || [], done = dl.filter((x) => x.done).length, pct = dl.length ? Math.round(done / dl.length * 100) : 0;
        return `<section class="card panel"><div class="panel-head"><h3>${esc(p.name)}</h3><span class="stage st-${esc(p.status.toLowerCase().replace(/\s/g, '-'))}">${esc(p.status)}</span></div>
          <p class="mono muted">${p.companyId ? `<a href="#/companies/${p.companyId}">${esc(companyName(p.companyId))}</a> · ` : ''}${fmtDate(p.start)} → <span class="${p.status === 'Complete' ? '' : dueClass(p.due)}">${fmtDate(p.due)}</span></p>
          <div class="progress"><i style="width:${pct}%"></i></div><p class="mono muted">${done}/${dl.length} deliverables · ${pct}%</p>
          <ul class="deliv">${dl.map((x, i) => `<li><label class="check"><input type="checkbox" data-action="toggle-deliv" data-id="${p.id}" data-i="${i}"${x.done ? ' checked' : ''}> <span>${esc(x.text)}</span></label></li>`).join('')}</ul>
          <div class="actions"><button class="btn ghost sm" data-action="edit-project" data-id="${p.id}">Edit</button><button class="btn danger sm" data-action="del-project" data-id="${p.id}">Delete</button></div></section>`;
      }).join('')}</div>` : empty('No projects yet. Win a deal, then create a project from it.')));
  }

  function viewReports() {
    const won = db.deals.filter((d) => d.stage === 'Won'), lost = db.deals.filter((d) => d.stage === 'Lost'), open = db.deals.filter(isOpen);
    const wonVal = won.reduce((s, d) => s + d.value, 0);
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      months.push({ key, label: d.toLocaleDateString('en-CA', { month: 'short' }), v: won.filter((x) => (x.closeDate || '').slice(0, 7) === key).reduce((s, x) => s + x.value, 0) });
    }
    const mMax = Math.max(1, ...months.map((m) => m.v));
    const src = {};
    db.contacts.forEach((c) => { const k = c.source || 'Unknown'; (src[k] = src[k] || { n: 0, v: 0 }).n++; });
    won.forEach((d) => { const c = byId('contacts', d.contactId); const k = (c && c.source) || 'Unknown'; (src[k] = src[k] || { n: 0, v: 0 }).v += d.value; });
    const srcRows = Object.entries(src).sort((a, b) => b[1].n - a[1].n);
    const sMax = Math.max(1, ...srcRows.map((r) => r[1].n));
    const stages = db.settings.stages.map((s) => ({ s, v: open.filter((d) => d.stage === s).reduce((t, d) => t + d.value, 0) }));
    const stMax = Math.max(1, ...stages.map((x) => x.v));
    return shell('reports', head('Reports', 'Calculated from the deals and contacts in this browser.') + `
      <div class="kpis">
        <div class="kpi panel"><span>Win rate</span><b>${won.length + lost.length ? Math.round(won.length / (won.length + lost.length) * 100) : 0}%</b><i>${won.length} won / ${lost.length} lost</i></div>
        <div class="kpi panel"><span>Total won</span><b>${money(wonVal)}</b><i>all time</i></div>
        <div class="kpi panel"><span>Average won deal</span><b>${money(won.length ? wonVal / won.length : 0)}</b><i>${won.length} deals</i></div>
        <div class="kpi panel"><span>Open pipeline</span><b>${money(open.reduce((s, d) => s + d.value, 0))}</b><i>${open.length} deals</i></div>
      </div>
      <div class="grid two">
        <section class="panel"><h2>Won revenue by month</h2><div class="columns">${months.map((m) => `<div class="colbar"><b>${m.v ? money(m.v) : ''}</b><div class="colbar-track"><i style="height:${m.v / mMax * 100}%"></i></div><span>${m.label}</span></div>`).join('')}</div></section>
        <section class="panel"><h2>Lead sources</h2><div class="bars">${srcRows.map(([k, r]) => `<div class="bar-row"><span>${esc(k)}</span><div class="bar"><i style="width:${r.n / sMax * 100}%"></i></div><b>${r.n} <small>(${money(r.v)} won)</small></b></div>`).join('') || empty('No contacts yet.')}</div></section>
        <section class="panel"><h2>Open pipeline by stage</h2><div class="bars">${stages.map((x) => `<div class="bar-row"><span>${esc(x.s)}</span><div class="bar"><i style="width:${x.v / stMax * 100}%"></i></div><b>${money(x.v)}</b></div>`).join('')}</div></section>
        <section class="panel"><h2>Top clients by won revenue</h2>${(() => {
          const m = {}; won.forEach((d) => { const k = companyName(d.companyId) || 'No company'; m[k] = (m[k] || 0) + d.value; });
          const r = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
          return r.length ? `<ul class="list">${r.map(([k, v]) => `<li><b>${esc(k)}</b><span class="mono">${money(v)}</span></li>`).join('')}</ul>` : empty('No won deals yet.');
        })()}</section>
      </div>`);
  }

  function viewSettings() {
    const s = db.settings;
    const ta = (name, label, arr, hint) => `<div class="field"><label for="s_${name}">${label}</label><textarea id="s_${name}" name="${name}" rows="6">${esc(arr.join('\n'))}</textarea><small class="muted">${hint}</small></div>`;
    return shell('settings', head('Settings') + `
      <form class="panel" data-form="settings"><h2>Profile & lists</h2>
        <div class="form-grid">
          <div class="field"><label for="s_name">Your name</label><input id="s_name" name="name" value="${esc(s.profile.name)}"></div>
          <div class="field"><label for="s_biz">Business name</label><input id="s_biz" name="business" value="${esc(s.profile.business)}"></div>
          ${ta('stages', 'Pipeline stages', s.stages, 'One per line. Won and Lost are always added at the end.')}
          ${ta('services', 'Services', s.services, 'One per line.')}
          ${ta('sources', 'Lead sources', s.sources, 'One per line.')}
          ${ta('tags', 'Tags', s.tags, 'One per line.')}
        </div><div class="modal-actions"><button class="btn primary" type="submit">Save settings</button></div></form>
      <div class="grid two">
        <section class="panel"><h2>Logo</h2><p class="muted">Shown in the header and behind the main menu.</p><div class="logo-prev"><img src="${esc(logoSrc())}" alt="Current logo"></div>
          <div class="actions"><button class="btn ghost" data-action="upload-logo">Upload logo</button>${s.logo ? `<button class="btn ghost" data-action="reset-logo">Use default</button>` : ''}</div></section>
        <section class="panel"><h2>Data</h2><p class="muted">Everything is stored in this browser only. Clearing site data erases it.</p>
          <div class="actions"><button class="btn ghost" data-action="backup">Download backup</button><button class="btn danger" data-action="reset-data">Reset demo data</button></div></section>
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
      ['Projects', db.projects.filter((p) => hit(p.name) || (p.deliverables || []).some((x) => hit(x.text))).map((p) => `<li><a href="#/projects"><b>${esc(p.name)}</b><span class="muted">${esc(p.status)}</span></a></li>`)]
    ] : [];
    const total = groups.reduce((s, g) => s + g[1].length, 0);
    return shell('', head('Search', term ? `${total} result${total === 1 ? '' : 's'} for “${esc(q.q)}”` : 'Type in the search box above.') +
      (total ? groups.filter((g) => g[1].length).map((g) => `<section class="panel"><h2>${g[0]}</h2><ul class="list">${g[1].join('')}</ul></section>`).join('') : (term ? empty('Nothing matched. Try a name, company, tag or deal title.') : '')));
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
      case 'projects': html = viewProjects(); break;
      case 'reports': html = viewReports(); break;
      case 'settings': html = viewSettings(); break;
      case 'search': html = viewSearch(q); break;
      default: html = viewHub();
    }
    app.innerHTML = html;
    const nav = NAV.find((n) => n.id === page);
    document.title = (nav ? nav.label + ' · ' : '') + 'Afterlife CRM';
    if (page === 'search') { const i = $('.search input'); if (i) i.value = q.q || ''; }
  }

  /* ---------- actions ---------- */
  const blank = {
    contact: (o) => Object.assign({ first: '', last: '', email: '', phone: '', title: '', companyId: '', source: '', tags: [], nextAction: '', nextActionNote: '' }, o),
    deal: (o) => Object.assign({ title: '', companyId: '', contactId: '', value: 0, stage: db.settings.stages[0] || 'Won', services: [], closeDate: '', notes: '' }, o)
  };
  const A = {
    'close-modal': closeModal,
    logout: () => { try { localStorage.removeItem(SESSION); } catch (e) { /* ignore */ } go('#/login'); },

    'new-contact': (d) => openForm('New contact', F.contact(), blank.contact({ companyId: d.company || '' }), (v) => { db.contacts.push(Object.assign({ id: S.uid(), created: today() }, v)); toast('Contact added'); }),
    'edit-contact': (d) => { const c = byId('contacts', d.id); openForm('Edit contact', F.contact(), c, (v) => Object.assign(c, v)); },
    'del-contact': (d) => confirmBox('Delete this contact and its activity history?', () => {
      db.contacts = db.contacts.filter((c) => c.id !== d.id);
      db.activities = db.activities.filter((a) => a.contactId !== d.id);
      db.deals.forEach((x) => { if (x.contactId === d.id) x.contactId = ''; });
      db.tasks.forEach((x) => { if (x.contactId === d.id) x.contactId = ''; });
      location.hash = '#/contacts';
    }),
    'clear-next': (d) => { const c = byId('contacts', d.id); c.nextAction = ''; c.nextActionNote = ''; save(); render(); toast('Follow-up cleared'); },

    'new-company': () => openForm('New company', F.company(), { tags: [] }, (v) => { db.companies.push(Object.assign({ id: S.uid() }, v)); toast('Company added'); }),
    'edit-company': (d) => { const c = byId('companies', d.id); openForm('Edit company', F.company(), c, (v) => Object.assign(c, v)); },
    'del-company': (d) => confirmBox('Delete this company? Its contacts and deals are kept but unlinked.', () => {
      db.companies = db.companies.filter((c) => c.id !== d.id);
      ['contacts', 'deals', 'projects'].forEach((k) => db[k].forEach((x) => { if (x.companyId === d.id) x.companyId = ''; }));
      location.hash = '#/companies';
    }),

    'new-deal': (d) => openForm('New deal', F.deal(), blank.deal({ companyId: d.company || '' }), (v) => {
      db.deals.push(Object.assign({ id: S.uid(), created: today(), history: [{ stage: v.stage, date: today() }] }, v)); toast('Deal added');
    }),
    'edit-deal': (d) => { const x = byId('deals', d.id); openForm('Edit deal', F.deal(), x, (v) => { const st = v.stage; delete v.stage; const cd = v.closeDate; Object.assign(x, v); setStage(x, st); x.closeDate = cd || x.closeDate; }); },
    'del-deal': (d) => confirmBox('Delete this deal?', () => {
      db.deals = db.deals.filter((x) => x.id !== d.id);
      db.tasks.forEach((t) => { if (t.dealId === d.id) t.dealId = ''; });
      db.activities.forEach((a) => { if (a.dealId === d.id) a.dealId = ''; });
      location.hash = '#/pipeline';
    }),
    'deal-project': (d) => {
      const x = byId('deals', d.id);
      db.projects.push({ id: S.uid(), name: x.title, companyId: x.companyId, dealId: x.id, status: 'Planned', start: today(), due: S.day(30), deliverables: (x.services || []).map((s) => ({ text: s, done: false })) });
      save(); toast('Project created'); go('#/projects');
    },

    'new-activity': (d) => openForm('Log activity', F.activity(), { type: 'Call', date: today(), note: '' }, (v) => { db.activities.push(Object.assign({ id: S.uid(), contactId: d.contact, dealId: d.deal || '' }, v)); }),
    'del-activity': (d) => confirmBox('Delete this timeline entry?', () => { db.activities = db.activities.filter((a) => a.id !== d.id); }),

    'new-task': (d) => openForm('New task', F.task(), { title: '', due: today(), priority: 'Medium', contactId: d.contact || '', dealId: d.deal || '' }, (v) => { db.tasks.push(Object.assign({ id: S.uid(), done: false }, v)); toast('Task added'); }),
    'edit-task': (d) => { const t = byId('tasks', d.id); openForm('Edit task', F.task(), t, (v) => Object.assign(t, v)); },
    'del-task': (d) => confirmBox('Delete this task?', () => { db.tasks = db.tasks.filter((t) => t.id !== d.id); }),
    'toggle-task': (d) => { const t = byId('tasks', d.id); t.done = !t.done; save(); render(); },

    'new-project': () => openForm('New project', F.project(), { status: 'Planned', start: today(), deliverables: [] }, (v) => { v.deliverables = v.deliverables.map((t) => ({ text: t, done: false })); db.projects.push(Object.assign({ id: S.uid(), dealId: '' }, v)); }),
    'edit-project': (d) => {
      const p = byId('projects', d.id);
      openForm('Edit project', F.project(), Object.assign({}, p, { deliverables: (p.deliverables || []).map((x) => x.text) }), (v) => {
        v.deliverables = v.deliverables.map((t) => ({ text: t, done: ((p.deliverables || []).find((x) => x.text === t) || {}).done || false }));
        Object.assign(p, v);
      });
    },
    'del-project': (d) => confirmBox('Delete this project?', () => { db.projects = db.projects.filter((p) => p.id !== d.id); }),
    'toggle-deliv': (d) => { const p = byId('projects', d.id); const x = p.deliverables[Number(d.i)]; x.done = !x.done; save(); render(); },

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
    backup: () => download('afterlife-crm-backup.json', JSON.stringify(db, null, 2), 'application/json'),
    'reset-data': () => {
      modal(`<h2>Reset demo data</h2><p class="muted">This replaces everything in this browser with the original sample data.</p><div class="modal-actions"><button class="btn ghost" data-action="close-modal">Cancel</button><button class="btn danger" id="cyes">Reset</button></div>`);
      $('#cyes').addEventListener('click', () => { db = S.reset(); closeModal(); render(); toast('Demo data restored'); });
    }
  };

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && el.dataset.action === 'overlay') { if (e.target === el) closeModal(); return; }
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
    } else if (kind === 'search') {
      go('#/search?q=' + encodeURIComponent(f.q.value.trim()));
    } else if (kind === 'settings') {
      const lines = (n) => Array.from(new Set(f[n].value.split('\n').map((s) => s.trim()).filter(Boolean)));
      const s = db.settings;
      s.profile.name = f.name.value.trim(); s.profile.business = f.business.value.trim();
      const stages = lines('stages').filter((x) => !/^(won|lost)$/i.test(x));
      if (!stages.length) return toast('Keep at least one pipeline stage.');
      db.deals.forEach((d) => { if (isOpen(d) && !stages.includes(d.stage)) setStage(d, stages[0]); });
      s.stages = stages; s.services = lines('services'); s.sources = lines('sources'); s.tags = lines('tags');
      save(); render(); toast('Settings saved');
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.change === 'deal-stage') { setStage(byId('deals', el.dataset.id), el.value); save(); render(); toast('Stage updated'); }
    if (el.dataset && el.dataset.filter) applyFilters();
  });
  document.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.filter === 'text') applyFilters(); });

  function applyFilters() {
    const get = (k) => { const el = $(`[data-filter="${k}"]`); return el ? el.value : ''; };
    const text = get('text').toLowerCase().trim(), source = get('source'), tag = get('tags');
    $$('[data-row]').forEach((r) => {
      const ok = (!text || r.dataset.text.includes(text)) && (!source || r.dataset.source === source) && (!tag || (r.dataset.tags || '').split('|').includes(tag));
      r.hidden = !ok;
    });
  }

  /* pipeline drag and drop */
  let dragId = null;
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest && e.target.closest('[data-deal]');
    if (!card) return;
    dragId = card.dataset.deal; card.classList.add('dragging');
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); }
  });
  document.addEventListener('dragend', () => { dragId = null; $$('.dragging,.over').forEach((x) => x.classList.remove('dragging', 'over')); });
  document.addEventListener('dragover', (e) => {
    const col = e.target.closest && e.target.closest('.col[data-stage]');
    if (!col || !dragId) return;
    e.preventDefault();
    $$('.col.over').forEach((x) => { if (x !== col) x.classList.remove('over'); });
    col.classList.add('over');
  });
  document.addEventListener('drop', (e) => {
    const col = e.target.closest && e.target.closest('.col[data-stage]');
    if (!col || !dragId) return;
    e.preventDefault();
    const d = byId('deals', dragId);
    if (d && d.stage !== col.dataset.stage) { setStage(d, col.dataset.stage); save(); toast(`Moved to ${col.dataset.stage}`); }
    dragId = null; render();
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  window.addEventListener('hashchange', () => { closeModal(); render(); window.scrollTo(0, 0); });
  render();
})();
