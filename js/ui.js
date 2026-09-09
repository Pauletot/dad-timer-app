// ui.js
// This will hold screen-switching logic (home / list / editor / timer)
// and functions that render data (patterns, steps) into the DOM.

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
