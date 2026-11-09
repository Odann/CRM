# Afterlife CRM

A mock, proof-of-concept CRM with a neon dystopian theme. It runs entirely in the browser: there is no server, and all data is saved in the browser's local storage.

## Run it

Open `index.html` in a browser, or enable GitHub Pages for this repository (Settings → Pages → deploy from the `main` branch, root folder).

Log in with any callsign. The login is a mock screen, not real authentication.

## What's inside

- **Hub**: main menu with the logo at the centre
- **Dashboard**: pipeline value, follow-ups due, tasks due, recent activity
- **Contacts**: list with filters, detail page with an activity timeline and next action
- **Companies**: profiles with linked contacts, deals and projects
- **Pipeline**: drag-and-drop board, deal detail with stage history
- **Tasks**: open, overdue, due today and done views
- **Projects**: deliverable checklists and progress
- **Reports**: win rate, revenue by month, lead sources
- **Settings**: pipeline stages, services, sources, tags, logo upload, backup and demo reset
- Global search, CSV import and export, mobile layout

## Structure

```
index.html
assets/
  css/style.css   theme and layout
  js/store.js     local storage and sample data
  js/app.js       pages, routing and actions
  img/logo.svg    placeholder logo (replace it, or upload one in Settings)
```

All people and companies in the sample data are fictional.
