// alerts.js
// Generates beeps (Web Audio API, no audio file needed) and vibration,
// so a step change is noticeable even without looking at the screen.

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

async function ensureAudioContextRunning() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
}

function beep(durationMs = 300, frequency = 880) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start();
  gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
  oscillator.stop(ctx.currentTime + durationMs / 1000);
}

export function vibrate(pattern = [200]) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

/**
 * Plays a short siren-style alarm: alternating-pitch beeps.
 * Used for both step changes (short) and routine finish (longer).
 * Returns the total duration in ms, so callers know how long to wait
 * before doing anything that would block audio (like alert()).
 */
async function playAlarm(beepCount, beepDuration = 250, gap = 200) {
  await ensureAudioContextRunning();

  for (let i = 0; i < beepCount; i++) {
    const frequency = i % 2 === 0 ? 880 : 660;
    setTimeout(() => {
      beep(beepDuration, frequency);
    }, i * (beepDuration + gap));
  }

  return beepCount * (beepDuration + gap);
}

// Shorter alarm burst, played at every step transition.
export async function alertStepChange() {
  vibrate([150, 100, 150]);
  return playAlarm(3, 220, 150);
}

// Longer alarm burst, played once the whole routine is done.
export async function alertFinished() {
  vibrate([300, 150, 300, 150, 300, 150, 300, 150, 300]);
  return playAlarm(6, 250, 200);
}