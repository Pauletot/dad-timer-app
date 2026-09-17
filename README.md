# Exercise Timer (PWA)

A simple installable web app for a customizable exercise timer sequence.

## Structure

- `index.html` — the four screens (home, pattern list, pattern editor, timer run)
- `css/style.css` — layout and styling
- `js/db.js` — IndexedDB logic (patterns + steps) — **not yet implemented**
- `js/timer.js` — countdown/sequence engine — **not yet implemented**
- `js/ui.js` — screen switching helper
- `js/app.js` — wires buttons to navigation (basic version, just for testing structure)
- `manifest.json` — PWA manifest (installable on Android home screen)
- `icons/` — app icons (need to add icon-192.png and icon-512.png)

## Status

Skeleton only — screens are navigable but no data/timer logic yet.

## Running locally

Open with a local server (not by double-clicking the HTML file, since ES modules
require `http://` not `file://`). See setup instructions for VS Code Live Server.


## Things to improve

- sound after each step
- no automatic transition after the last step
- when you press continue, it takes a second to restart again -> should be better to start suddenly
