// wakelock.js
// Keeps the screen from sleeping while a timer session is running.
// Browsers automatically release the lock if the tab loses focus —
// that's expected; we just reacquire it if the tab becomes visible
// again mid-session.

let wakeLock = null;

export async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) {
    // Fails silently on unsupported browsers/devices — not critical.
    console.warn('Wake lock not available:', err);
  }
}

export function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    // Re-request since the browser cleared it when the tab was hidden.
    await acquireWakeLock();
  }
});