// app.js

import {
  showScreen,
  renderStepList,
  updateTimerDisplay,
  showManualNextButton,
  initProgressRing,
  setProgressRing,
  showTransition,
  showFinishedOverlay,
} from './ui.js';

import {
  addPattern,
  addStep,
  getAllPatterns,
  getStepsForPattern,
  deletePattern,
  updatePatternName,
  deleteStepsForPattern,
  patternNameExists,
} from './db.js';
import { TimerEngine } from './timer.js';
import { alertStepChange, alertFinished } from './alerts.js';
import { acquireWakeLock, releaseWakeLock } from './wakelock.js';

let currentSteps = [];            // steps being built in the editor
let selectedPatternId = null;     // pattern chosen to run
let selectedPatternSteps = [];    // its steps, loaded when chosen
let engine = null;                // active TimerEngine instance
let editingPatternId = null;      // null = creating new, otherwise = editing this pattern's id
let currentStepTotalSeconds = 0;  // total duration of the step currently running, for the ring's fraction

// Elements on the timer screen get touched a lot below — grab them
// once here instead of calling getElementById repeatedly everywhere.
const countdownLabel = document.getElementById('countdown-label');
const pauseBtn = document.getElementById('pause-btn');

// ---------- Navigation ----------

document.getElementById('pattern-select-btn').addEventListener('click', async () => {
  await renderPatternList();
  showScreen('pattern-list-screen');
});

document.getElementById('add-pattern-btn').addEventListener('click', () => {
  editingPatternId = null;
  currentSteps = [];
  document.getElementById('pattern-name-input').value = '';
  renderStepList(currentSteps, removeStep);
  showScreen('pattern-editor-screen');
});

document.querySelectorAll('.back-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.backTo || 'home-screen';
    showScreen(target);
  });
});

// ---------- Editor logic ----------

document.getElementById('add-step-btn').addEventListener('click', () => {
  currentSteps.push({ durationSeconds: 60, isAutomatic: true, transitionDelaySeconds: 5 });
  renderStepList(currentSteps, removeStep);
});

function removeStep(index) {
  currentSteps.splice(index, 1);
  renderStepList(currentSteps, removeStep);
}

document.getElementById('save-pattern-btn').addEventListener('click', async () => {
  const nameInput = document.getElementById('pattern-name-input');
  const name = nameInput.value.trim() || 'Untitled pattern';

  if (currentSteps.length === 0) {
    alert('Add at least one step first.');
    return;
  }

  const duplicate = await patternNameExists(name, editingPatternId);
  if (duplicate) {
    alert(`A pattern named "${name}" already exists. Choose a different name.`);
    return;
  }

  if (editingPatternId) {
    // Update existing pattern: rename, wipe old steps, add new ones.
    await updatePatternName(editingPatternId, name);
    await deleteStepsForPattern(editingPatternId);

    for (let i = 0; i < currentSteps.length; i++) {
      const step = currentSteps[i];
      await addStep({ patternId: editingPatternId, order: i, ...step });
    }
  } else {
    // Create a brand new pattern.
    const patternId = await addPattern(name);
    for (let i = 0; i < currentSteps.length; i++) {
      const step = currentSteps[i];
      await addStep({ patternId, order: i, ...step });
    }
  }

  editingPatternId = null;
  currentSteps = [];
  showScreen('home-screen');
});
// ---------- Pattern list (choose or delete) ----------

async function renderPatternList() {
  const listEl = document.getElementById('pattern-list');
  listEl.innerHTML = '';

  const patterns = await getAllPatterns();

  for (const pattern of patterns) {
    const steps = await getStepsForPattern(pattern.id);

    const li = document.createElement('li');
    li.textContent = `${pattern.name} — ${steps.length} step(s)  `;

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      editingPatternId = pattern.id;
      document.getElementById('pattern-name-input').value = pattern.name;
      // Clone the steps array so editing doesn't mutate the loaded data directly.
      currentSteps = steps.map((s) => ({
        durationSeconds: s.durationSeconds,
        isAutomatic: s.isAutomatic,
        transitionDelaySeconds: s.transitionDelaySeconds,
      }));
      renderStepList(currentSteps, removeStep);
      showScreen('pattern-editor-screen');
    });

    const useBtn = document.createElement('button');
    useBtn.textContent = 'Use';
    useBtn.addEventListener('click', () => {
      selectedPatternId = pattern.id;
      selectedPatternSteps = steps;
      document.getElementById('pattern-select-label').textContent = pattern.name;
      showScreen('home-screen');
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      const confirmed = confirm(`Delete "${pattern.name}"? This can not be undone.`);
      if (!confirmed) return;
      
      await deletePattern(pattern.id);
      await renderPatternList();
    });

    li.appendChild(editBtn);
    li.appendChild(useBtn);
    li.appendChild(deleteBtn);
    listEl.appendChild(li);
  }

  if (patterns.length === 0) {
    listEl.innerHTML = '<li>No patterns yet — tap + on the home screen.</li>';
  }
}

// ---------- Running the timer ----------
document.getElementById('start-btn').addEventListener('click', () => {
  if (!selectedPatternId || selectedPatternSteps.length === 0) {
    alert('Choose a pattern first.');
    return;
  }

  showScreen('timer-screen');
  showManualNextButton(false);
  pauseBtn.textContent = 'Pause';
  acquireWakeLock();

  engine = new TimerEngine({
    steps: selectedPatternSteps,
    onStepChange: (index, step) => {
      // Fires at the START of a step — no alarm here; the alarm belongs
      // at the END of a step, in onTransitionStart / onWaitingForManual below.
      currentStepTotalSeconds = step.durationSeconds;
      updateTimerDisplay({
        index,
        total: selectedPatternSteps.length,
        secondsLeft: step.durationSeconds,
        mode: step.isAutomatic ? 'auto' : 'manual',
      });
      initProgressRing();
      setProgressRing(1);
      showManualNextButton(false);
    },
    onTick: (secondsLeft) => {
      countdownLabel.textContent =
        `${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, '0')}`;
      setProgressRing(secondsLeft / currentStepTotalSeconds);
    },
    onWaitingForManual: () => {
      // A manual step just hit 0 and is now waiting on a tap — this IS
      // the end of that step, so the alarm plays here.
      alertStepChange();
      showManualNextButton(true);
    },
    onFinish: async () => {
      const alarmDuration = await alertFinished();
      releaseWakeLock();

      // Overlay appears the moment the alarm starts, and covers the
      // screen for the alarm's duration plus a couple extra seconds
      // to actually read the message — then disappears on its own
      // and returns home, no tap required.
      showFinishedOverlay(alarmDuration + 2000, () => {
        showScreen('home-screen');
      });
    },
    onTransitionStart: (secondsLeft) => {
      // An automatic step just hit 0 and its transition delay is starting —
      // this is the actual end-of-step moment, so the alarm plays here.
      alertStepChange();
      showTransition(secondsLeft);
      setProgressRing(0); // ring stays empty during the pause, since the step itself is done
    },
    onTransitionTick: (secondsLeft) => {
      countdownLabel.textContent = secondsLeft;
    },
  });

  engine.start();
});

document.getElementById('manual-next-btn').addEventListener('click', () => {
  if (engine) {
    engine.manualAdvance();
    showManualNextButton(false);
  }
});

pauseBtn.addEventListener('click', () => {
  if (!engine) return;

  if (engine.isPaused) {
    engine.resume();
    pauseBtn.textContent = 'Pause';
  } else {
    engine.pause();
    pauseBtn.textContent = 'Continue';
  }
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (engine) engine.reset();
  releaseWakeLock();
  pauseBtn.textContent = 'Pause';
  showScreen('home-screen');
});