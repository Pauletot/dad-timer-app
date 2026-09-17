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
    li.className = 'step-card';

    // Top row: "Step N" label + Remove button
    const headerRow = document.createElement('div');
    headerRow.className = 'step-card-header';

    const label = document.createElement('span');
    label.className = 'step-card-title';
    label.textContent = `Step ${index + 1}`;
    headerRow.appendChild(label);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'row-btn row-btn-danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => onRemove(index));
    headerRow.appendChild(removeBtn);

    li.appendChild(headerRow);

    // Duration field, own row
    const durationRow = document.createElement('div');
    durationRow.className = 'step-card-field';

    const durationLabel = document.createElement('label');
    durationLabel.textContent = 'Duration (sec)';
    durationRow.appendChild(durationLabel);

    const durationInput = document.createElement('input');
    durationInput.type = 'number';
    durationInput.min = '1';
    durationInput.className = 'step-input';
    durationInput.value = step.durationSeconds;
    durationInput.addEventListener('input', () => {
      step.durationSeconds = parseInt(durationInput.value, 10) || 1;
    });
    durationRow.appendChild(durationInput);
    li.appendChild(durationRow);

    // Auto-advance toggle, own row
    const autoRow = document.createElement('div');
    autoRow.className = 'step-card-field step-card-field-checkbox';

    const autoLabel = document.createElement('label');
    const autoCheckbox = document.createElement('input');
    autoCheckbox.type = 'checkbox';
    autoCheckbox.checked = step.isAutomatic;
    autoLabel.appendChild(autoCheckbox);
    autoLabel.appendChild(document.createTextNode(' Auto-advance to next step'));
    autoRow.appendChild(autoLabel);
    li.appendChild(autoRow);

    // Delay field, shown only when auto-advance is on
    const delayRow = document.createElement('div');
    delayRow.className = 'step-card-field';
    delayRow.style.display = step.isAutomatic ? 'flex' : 'none';

    const delayLabel = document.createElement('label');
    delayLabel.textContent = 'Delay before next (sec)';
    delayRow.appendChild(delayLabel);

    const delayInput = document.createElement('input');
    delayInput.type = 'number';
    delayInput.min = '0';
    delayInput.className = 'step-input';
    delayInput.value = step.transitionDelaySeconds ?? 0;
    delayInput.addEventListener('input', () => {
      step.transitionDelaySeconds = parseInt(delayInput.value, 10) || 0;
    });
    delayRow.appendChild(delayInput);
    li.appendChild(delayRow);

    autoCheckbox.addEventListener('change', () => {
      step.isAutomatic = autoCheckbox.checked;
      delayRow.style.display = step.isAutomatic ? 'flex' : 'none';
    });

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
