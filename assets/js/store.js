/* Afterlife CRM — data layer. Everything lives in the browser's localStorage. */
(function () {
  const KEY = 'afterlife_crm_v1';

  const iso = (d) => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };
  const day = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return iso(d);
  };
  const uid = () => Math.random().toString(36).slice(2, 10);

  /* All names below are fictional demo data. */
  function seed() {
    const settings = {
      profile: { name: 'Demo Operator', business: 'Afterlife Marketing' },
      stages: ['Lead', 'Contacted', 'Proposal', 'Negotiation'],
      stageProbabilities: { Lead: 10, Contacted: 25, Proposal: 50, Negotiation: 75 },
      services: ['Social Media Management', 'Website Management', 'Content Marketing', 'Email Marketing', 'Analytics Reporting', 'Paid Ads'],
      sources: ['Referral', 'Cold Outreach', 'Social Media', 'Website', 'Event'],
      tags: ['Hot', 'Golf', 'Recreation', 'Retail', 'Local', 'Retainer'],
      logo: '',
      revenueGoal: 10000,
      theme: { accent: '#ff3b45', glow: true },
      tourSeen: false
    };

    const companies = [
      ['Ironwood Fairways', 'Golf & Recreation', 'ironwoodfairways.example', '519-555-0101', 'London, ON', ['Golf', 'Local']],
      ['Northgate Fitness Collective', 'Fitness', 'northgatefit.example', '519-555-0102', 'London, ON', ['Recreation']],
      ['Blue Heron Paddle Co.', 'Outdoor Recreation', 'blueheronpaddle.example', '519-555-0103', 'Port Stanley, ON', ['Recreation', 'Retail']],
      ['Kestrel Cycle Works', 'Retail', 'kestrelcycle.example', '519-555-0104', 'St. Thomas, ON', ['Retail', 'Local']],
      ['Summit Line Climbing', 'Recreation', 'summitline.example', '519-555-0105', 'London, ON', ['Recreation', 'Hot']],
      ['Harbourlight Dental', 'Healthcare', 'harbourlightdental.example', '519-555-0106', 'Strathroy, ON', ['Local']],
      ['Old Mill Roasters', 'Food & Beverage', 'oldmillroasters.example', '519-555-0107', 'London, ON', ['Retail', 'Retainer']],
      ['Pinecrest Mini Putt', 'Golf & Recreation', 'pinecrestputt.example', '519-555-0108', 'Komoka, ON', ['Golf']]
    ].map(([name, industry, website, phone, city, tags]) => ({ id: uid(), name, industry, website, phone, city, tags, notes: '' }));
    companies[0].notes = 'Wants a stronger social presence before the spring membership drive.';
    companies[6].notes = 'Monthly retainer client. Prefers email over calls.';

    const C = (i) => companies[i].id;
    const contacts = [
      ['Dana', 'Whitlock', 'General Manager', 0, 'Referral', ['Hot', 'Golf'], 1, 'Send revised proposal'],
      ['Marcus', 'Bell', 'Head Pro', 0, 'Event', ['Golf'], 9, 'Check in after board meeting'],
      ['Priya', 'Nair', 'Owner', 1, 'Social Media', ['Recreation'], 0, 'Call to book discovery meeting'],
      ['Tom', 'Okafor', 'Marketing Lead', 2, 'Cold Outreach', ['Retail'], -2, 'Follow up on intro email'],
      ['Elena', 'Rossi', 'Owner', 3, 'Website', ['Retail', 'Local'], 4, 'Share website audit'],
      ['Jordan', 'Fisk', 'Operations Manager', 4, 'Referral', ['Hot'], 0, 'Confirm contract start date'],
      ['Sam', 'Carver', 'Front Desk Lead', 4, 'Referral', [], '', ''],
      ['Hannah', 'Lowe', 'Practice Manager', 5, 'Cold Outreach', ['Local'], 12, 'Reconnect next quarter'],
      ['Luis', 'Mendez', 'Co-founder', 6, 'Referral', ['Retainer'], 6, 'Monthly report review'],
      ['Ava', 'Chen', 'Co-founder', 6, 'Referral', ['Retainer'], '', ''],
      ['Noah', 'Brandt', 'Owner', 7, 'Event', ['Golf'], -1, 'Send pricing sheet'],
      ['Riley', 'Stone', 'Events Coordinator', 1, 'Social Media', [], 3, 'Send content samples']
    ].map(([first, last, title, c, source, tags, next, note], i) => ({
      id: uid(), first, last, title, companyId: C(c), source, tags,
      email: (first + '.' + last).toLowerCase() + '@' + companies[c].website,
      phone: '519-555-02' + String(10 + i),
      nextAction: next === '' ? '' : day(next), nextActionNote: note, created: day(-90 + i * 6)
    }));
    const P = (i) => contacts[i].id;

    const deals = [
      ['Spring membership campaign', 0, 0, 4800, 'Proposal', [0, 5], 21, -30],
      ['Pro shop social refresh', 0, 1, 1800, 'Lead', [0], 40, -6],
      ['Studio launch package', 1, 2, 3200, 'Contacted', [0, 2], 30, -14],
      ['Summer rentals ads', 2, 3, 2500, 'Lead', [5], 45, -9],
      ['Website rebuild', 3, 4, 6500, 'Negotiation', [1, 4], 10, -45],
      ['Social + content retainer', 4, 5, 9600, 'Negotiation', [0, 2, 4], 5, -38],
      ['New patient email series', 5, 7, 1500, 'Lost', [3], -20, -70],
      ['Monthly marketing retainer', 6, 8, 12000, 'Won', [0, 1, 4], -50, -110],
      ['Holiday gift box campaign', 6, 9, 2200, 'Won', [3, 5], -12, -40],
      ['Season opener promo', 7, 10, 1400, 'Contacted', [0], 25, -11],
      ['Analytics setup', 3, 4, 900, 'Won', [4], -75, -100],
      ['Corporate events landing page', 1, 11, 2100, 'Lost', [1], -35, -60],
      ['Junior camp promotion', 0, 0, 2600, 'Won', [0, 2], -5, -33]
    ].map(([title, c, p, value, stage, sv, close, made]) => ({
      id: uid(), title, companyId: C(c), contactId: P(p), value, stage,
      services: sv.map((i) => settings.services[i]), closeDate: day(close), created: day(made),
      history: [{ stage: 'Lead', date: day(made) }].concat(stage === 'Lead' ? [] : [{ stage, date: day(Math.min(close, -1)) }]),
      notes: '', lostReason: stage === 'Lost' ? ['Budget', 'Went with another agency', 'No response', 'Timing'][made % 4] : '',
      attachments: []
    }));
    const D = (i) => deals[i].id;
    deals[7].attachments = [{ id: uid(), name: 'Retainer agreement (sample link)', url: 'https://example.com/old-mill-retainer.pdf' }];

    const activities = [
      [0, 0, 'Meeting', -8, 'Walked the course and reviewed last season\'s social numbers.'],
      [0, 0, 'Email', -5, 'Sent first proposal draft with two package options.'],
      [0, 0, 'Call', -2, 'Asked for a lower-cost option without paid ads.'],
      [2, 2, 'Email', -6, 'Intro email with studio launch ideas.'],
      [3, 3, 'Email', -9, 'Cold intro sent. No reply yet.'],
      [4, 4, 'Meeting', -12, 'Reviewed current site. Checkout flow is the main pain point.'],
      [4, 4, 'Call', -3, 'Negotiating timeline. Wants launch before the long weekend.'],
      [5, 5, 'Call', -4, 'Agreed on scope. Waiting on signed contract.'],
      [8, 7, 'Meeting', -15, 'Monthly review. Engagement up, asked for more video.'],
      [8, 8, 'Note', -13, 'Gift box campaign approved by both founders.'],
      [10, 9, 'Call', -7, 'Interested in a small promo for opening weekend.'],
      [7, 6, 'Email', -21, 'Decided to keep email in-house for now.'],
      [11, 2, 'Note', -1, 'Riley wants content samples before the next call.']
    ].map(([p, d, type, when, note]) => ({ id: uid(), contactId: P(p), dealId: D(d), type, date: day(when), note }));

    const tasks = [
      ['Send revised proposal to Dana', 1, 'High', 0, 0, false, 'none'],
      ['Book discovery meeting with Priya', 0, 'Medium', 2, 2, false, 'none'],
      ['Follow up on intro email', -2, 'Medium', 3, 3, false, 'none'],
      ['Prepare website audit', 4, 'Medium', 4, 4, false, 'none'],
      ['Draft contract for Summit Line', 0, 'High', 5, 5, false, 'none'],
      ['Build monthly report for Old Mill', 6, 'Low', 8, 7, false, 'monthly'],
      ['Send pricing sheet to Noah', -1, 'High', 10, 9, false, 'none'],
      ['Collect testimonials', 10, 'Low', 8, 7, false, 'none'],
      ['Schedule gift box posts', -6, 'Medium', 9, 8, true, 'none'],
      ['Install analytics tags', -70, 'Medium', 4, 10, true, 'none'],
      ['Weekly content check-in', 2, 'Low', 8, 7, false, 'weekly']
    ].map(([title, due, priority, p, d, done, recur]) => ({ id: uid(), title, due: day(due), priority, contactId: P(p), dealId: D(d), done, recur: recur || 'none' }));

    const projects = [
      ['Old Mill monthly retainer', 6, 7, 'Active', -50, 40, [['Content calendar', true, -45], ['Weekly posts', true, -10], ['Monthly report', false, 5], ['Quarterly strategy review', false, 40]], 'Billed monthly on the 1st. Check in with Luis before sending the report.'],
      ['Holiday gift box campaign', 6, 8, 'Active', -12, 20, [['Product photos', true, -10], ['Ad creative', true, -5], ['Email blast', false, 10], ['Results summary', false, 20]], ''],
      ['Kestrel analytics setup', 3, 10, 'Complete', -75, -55, [['Install tags', true, -70], ['Build dashboard', true, -60], ['Training call', true, -55]], 'Elena is happy with the dashboard. Revisit in Q2.'],
      ['Junior camp promotion', 0, 12, 'Planned', 3, 45, [['Landing page copy', false, 15], ['Social ad set', false, 30], ['Registration tracking', false, 40]], '']
    ].map(([name, c, d, status, start, due, dl, notes]) => ({
      id: uid(), name, companyId: C(c), dealId: D(d), status, start: day(start), due: day(due), notes: notes || '',
      deliverables: dl.map(([text, done, dd]) => ({ id: uid(), text, done, due: day(dd) }))
    }));

    return { settings, companies, contacts, deals, activities, tasks, projects };
  }

  const Store = {
    data: null,
    uid, iso, day,
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) this.data = JSON.parse(raw);
      } catch (e) { this.data = null; }
      if (!this.data || !this.data.settings) { this.data = seed(); this.save(); }
      /* migrate older saved data forward */
      const s = this.data.settings;
      if (!s.stageProbabilities) s.stageProbabilities = {};
      (this.data.settings.stages || []).forEach((st, i) => { if (s.stageProbabilities[st] == null) s.stageProbabilities[st] = Math.round(((i + 1) / (this.data.settings.stages.length + 1)) * 100); });
      if (!s.theme) s.theme = { accent: '#ff3b45', glow: true };
      if (s.revenueGoal == null) s.revenueGoal = 10000;
      if (s.tourSeen == null) s.tourSeen = false;
      (this.data.deals || []).forEach((d) => { if (d.attachments == null) d.attachments = []; if (d.lostReason == null) d.lostReason = ''; });
      (this.data.tasks || []).forEach((t) => { if (!t.recur) t.recur = 'none'; });
      (this.data.projects || []).forEach((p) => { if (p.notes == null) p.notes = ''; (p.deliverables || []).forEach((x) => { if (!x.id) x.id = uid(); if (x.due == null) x.due = ''; }); });
      return this.data;
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); return true; }
      catch (e) { return false; }
    },
    reset() { this.data = seed(); this.save(); return this.data; }
  };
  window.Store = Store;
})();
