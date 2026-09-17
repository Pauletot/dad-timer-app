// ui.js

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Renders the list of steps currently being built in the editor.
// `onRemove(index)` is called when the user taps "Remove" on a row.
export function renderStepList(steps, onRemove) {
  const listEl = document.getElementById('step-list');
  listEl.innerHTML = '';

  steps.forEach((step, index) => {
    const li = document.createElement('li');

    const label = document.createElement('span');
    label.textContent = `Step ${index + 1}: `;
    li.appendChild(label);

    const durationInput = document.createElement('input');
    durationInput.type = 'number';
    durationInput.min = '1';
    durationInput.value = step.durationSeconds;
    durationInput.style.width = '60px';
    durationInput.addEventListener('input', () => {
      step.durationSeconds = parseInt(durationInput.value, 10) || 1;
    });
    li.appendChild(durationInput);
    li.appendChild(document.createTextNode(' sec  '));

    const autoLabel = document.createElement('label');
    const autoCheckbox = document.createElement('input');
    autoCheckbox.type = 'checkbox';
    autoCheckbox.checked = step.isAutomatic;
    autoLabel.appendChild(autoCheckbox);
    autoLabel.appendChild(document.createTextNode(' Auto-advance'));
    li.appendChild(autoLabel);

    const delayInput = document.createElement('input');
    delayInput.type = 'number';
    delayInput.min = '0';
    delayInput.value = step.transitionDelaySeconds ?? 0;
    delayInput.style.width = '50px';
    delayInput.style.display = step.isAutomatic ? 'inline-block' : 'none';
    delayInput.addEventListener('input', () => {
      step.transitionDelaySeconds = parseInt(delayInput.value, 5) || 0;
    });

    autoCheckbox.addEventListener('change', () => {
      step.isAutomatic = autoCheckbox.checked;
      delayInput.style.display = step.isAutomatic ? 'inline-block' : 'none';
    });

    li.appendChild(delayInput);
    li.appendChild(document.createTextNode(' sec delay  '));

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => onRemove(index));
    li.appendChild(removeBtn);

    listEl.appendChild(li);
  });
}


// --- Timer screen rendering ---

function formatSeconds(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function updateTimerDisplay({ index, total, secondsLeft, mode }) {
  document.getElementById('step-index-label').textContent = `Step ${index + 1} of ${total}`;
  document.getElementById('countdown-label').textContent = formatSeconds(secondsLeft);
  document.getElementById('mode-label').textContent = mode === 'auto' ? 'Automatic' : 'Manual';
}

export function showManualNextButton(show) {
  document.getElementById('manual-next-btn').style.display = show ? 'block' : 'none';
}

const RING_RADIUS = 100;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Call once when a step starts, to reset the ring to "full."
export function initProgressRing() {
  const circle = document.getElementById('progress-ring-fg');
  circle.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
  circle.style.strokeDashoffset = '0';
}

// fraction: 1 = full circle (just started), 0 = empty (time's up)
export function setProgressRing(fraction) {
  const circle = document.getElementById('progress-ring-fg');
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  circle.style.strokeDashoffset = offset;
}

export function showTransition(secondsLeft) {
  document.getElementById('step-index-label').textContent = `Next step starts in...`;
  document.getElementById('countdown-label').textContent = secondsLeft;
  document.getElementById('mode-label').textContent = '';
  showManualNextButton(false);
}
// Shows the "Routine complete!" message on its own, with no button
// to press. Fades itself out and calls onHidden after `durationMs`.
export function showFinishedOverlay(durationMs, onHidden) {
  const overlay = document.getElementById('finished-overlay');
  overlay.classList.add('visible');

  setTimeout(() => {
    overlay.classList.remove('visible');
    onHidden();
  }, durationMs);
}
