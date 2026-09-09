// app.js
// Entry point: wires up button clicks to screen navigation.
// This is intentionally minimal for now — just enough to click through
// the screens and confirm the structure works. Logic comes next.

import { showScreen } from './ui.js';

document.getElementById('pattern-select-btn').addEventListener('click', () => {
  showScreen('pattern-list-screen');
});

document.getElementById('add-pattern-btn').addEventListener('click', () => {
  showScreen('pattern-editor-screen');
});

document.getElementById('start-btn').addEventListener('click', () => {
  showScreen('timer-screen');
});

document.querySelectorAll('.back-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.backTo || 'home-screen';
    showScreen(target);
  });
});
