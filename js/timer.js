// timer.js
// A small state machine that walks through an array of steps,
// counting down each one, and either auto-advancing or waiting
// for a manual "Next" tap depending on the step's isAutomatic flag.
// Supports pause/resume mid-step or mid-transition-delay, and a
// full reset back to before the first step.

export class TimerEngine {
  constructor({
    steps,
    onTick,
    onStepChange,
    onWaitingForManual,
    onFinish,
    onTransitionStart,
    onTransitionTick,
  }) {
    this.steps = steps;
    this.onTick = onTick;
    this.onStepChange = onStepChange;
    this.onWaitingForManual = onWaitingForManual;
    this.onFinish = onFinish;
    this.onTransitionStart = onTransitionStart;
    this.onTransitionTick = onTransitionTick;

    this.currentIndex = -1;
    this.secondsLeft = 0;
    this.transitionSecondsLeft = 0;

    this.intervalId = null;
    this.delayIntervalId = null;
    this.awaitingManualAdvance = false;

    this.isPaused = false;
    this.pausedPhase = null; // 'step' or 'transition'
  }

  start() {
    this.currentIndex = -1;
    this.isPaused = false;
    this._advanceToNextStep();
  }

  // Pauses whichever countdown is currently running.
  // Does nothing if already paused, or if we're just waiting on a
  // manual "Next" tap (there's nothing actively counting down then).
  pause() {
    if (this.isPaused || this.awaitingManualAdvance) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.pausedPhase = 'step';
      this.isPaused = true;
    } else if (this.delayIntervalId) {
      clearInterval(this.delayIntervalId);
      this.delayIntervalId = null;
      this.pausedPhase = 'transition';
      this.isPaused = true;
    }
  }

  // Resumes exactly where pause() left off.
  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;

    if (this.pausedPhase === 'step') {
      this._startStepInterval();
    } else if (this.pausedPhase === 'transition') {
      this._startTransitionInterval();
    }
    this.pausedPhase = null;
  }

  // Fully stops and rewinds back to before the first step.
  reset() {
    clearInterval(this.intervalId);
    clearInterval(this.delayIntervalId);
    this.intervalId = null;
    this.delayIntervalId = null;
    this.currentIndex = -1;
    this.secondsLeft = 0;
    this.awaitingManualAdvance = false;
    this.isPaused = false;
    this.pausedPhase = null;
  }

  // Called when the user taps the manual "Next" button.
  manualAdvance() {
    if (this.awaitingManualAdvance) {
      this._advanceToNextStep();
    }
  }

  _advanceToNextStep() {
    clearInterval(this.intervalId);
    this.currentIndex++;

    if (this.currentIndex >= this.steps.length) {
      this.onFinish();
      return;
    }

    const step = this.steps[this.currentIndex];
    this.secondsLeft = step.durationSeconds;
    this.awaitingManualAdvance = false;

    this.onStepChange(this.currentIndex, step);
    this._startStepInterval(); // also fires the first onTick, for the initial display
  }

  // Starts (or resumes) the countdown for the current step.
  // Fires onTick immediately with the current value first, so resuming
  // after a pause updates the display right away instead of waiting
  // a full second for the first interval tick.
  _startStepInterval() {
    const step = this.steps[this.currentIndex];
    const isLastStep = this.currentIndex === this.steps.length - 1;

    this.onTick(this.secondsLeft);

    this.intervalId = setInterval(() => {
      this.secondsLeft--;
      this.onTick(this.secondsLeft);

      if (this.secondsLeft <= 0) {
        clearInterval(this.intervalId);
        this.intervalId = null;

        if (isLastStep) {
          // Nothing to advance to — finish immediately, whether this step
          // was automatic (skip the transition delay) or manual (skip
          // waiting for a "Next" tap).
          this._advanceToNextStep();
        } else if (step.isAutomatic) {
          this._runTransitionDelay(step.transitionDelaySeconds || 0);
        } else {
          this.awaitingManualAdvance = true;
          this.onWaitingForManual();
        }
      }
    }, 1000);
  }

  _runTransitionDelay(delaySeconds) {
    if (delaySeconds <= 0) {
      this._advanceToNextStep();
      return;
    }

    this.transitionSecondsLeft = delaySeconds;
    // onTransitionStart fires once, here — this is the true "step just
    // ended" moment, so this is where the end-of-step alarm should play.
    this.onTransitionStart(this.transitionSecondsLeft);
    this._startTransitionInterval();
  }

  // Starts (or resumes) the countdown for the between-steps delay.
  // Same immediate-tick fix as _startStepInterval, for instant resume.
  _startTransitionInterval() {
    this.onTransitionTick(this.transitionSecondsLeft);

    this.delayIntervalId = setInterval(() => {
      this.transitionSecondsLeft--;
      if (this.transitionSecondsLeft > 0) {
        this.onTransitionTick(this.transitionSecondsLeft);
      } else {
        clearInterval(this.delayIntervalId);
        this.delayIntervalId = null;
        this._advanceToNextStep();
      }
    }, 1000);
  }
}