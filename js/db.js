// db.js
// -----------------------------------------------------------------------
// IndexedDB recap notes (read this before the code):
//
// - A "database" here is just a named IndexedDB database, versioned.
// - A "table" in SQL terms is called an "object store" here.
// - Every object store needs a key. We use `keyPath: 'id'` with
//   `autoIncrement: true`, which is the IndexedDB equivalent of
//   SQL's `PRIMARY KEY AUTOINCREMENT`.
// - IndexedDB has NO foreign keys and NO JOINs. We fake the relationship
//   ourselves: each `step` object just stores a `patternId` field
//   pointing at its parent pattern's id (exactly like a SQL foreign key
//   column, just not enforced by the engine).
// - To query steps "WHERE patternId = X" efficiently, we create an
//   INDEX on that field. Without an index you'd have to scan every
//   row by hand — the index lets the browser look it up directly,
//   same reason SQL databases use indexes.
// - Every read/write happens inside a TRANSACTION, scoped to
//   "readonly" or "readwrite". This is the same idea as SQL
//   transactions: a unit of work that either completes or doesn't.
// - The native IndexedDB API is callback/event based (onsuccess,
//   onerror). We wrap each call in a Promise below so the rest of
//   the app can use clean async/await instead.
// -----------------------------------------------------------------------

const DB_NAME = 'exercise-timer-db';
const DB_VERSION = 1;

let dbInstance = null;

/**
 * Opens (or creates) the database. Runs once; the schema-creation code
 * inside onupgradeneeded only runs the very first time, or when we bump
 * DB_VERSION later (e.g. if we add a new field or store).
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Runs only on first creation, or when DB_VERSION increases.
    // This is where you define the "schema" — the equivalent of
    // CREATE TABLE statements.
    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // "patterns" store: one row per named sequence.
      const patternsStore = db.createObjectStore('patterns', {
        keyPath: 'id',
        autoIncrement: true,
      });
      patternsStore.createIndex('by_name', 'name', { unique: false });

      // "steps" store: one row per step, belonging to a pattern.
      const stepsStore = db.createObjectStore('steps', {
        keyPath: 'id',
        autoIncrement: true,
      });
      // Index on patternId = our "WHERE patternId = ?" lookup path.
      stepsStore.createIndex('by_pattern', 'patternId', { unique: false });
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Small helper: wraps a single IndexedDB request in a Promise,
 * so callers can `await` it instead of juggling onsuccess/onerror.
 */
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------- PATTERNS ----------

/**
 * Insert a new pattern (just the name — steps are added separately).
 * Returns the new pattern's generated id.
 */
export async function addPattern(name) {
  const db = await openDatabase();
  const tx = db.transaction('patterns', 'readwrite');
  const store = tx.objectStore('patterns');
  const id = await promisifyRequest(store.add({ name }));
  return id;
}

/**
 * Get every pattern (equivalent of SELECT * FROM patterns).
 */
export async function getAllPatterns() {
  const db = await openDatabase();
  const tx = db.transaction('patterns', 'readonly');
  const store = tx.objectStore('patterns');
  return promisifyRequest(store.getAll());
}

/**
 * Delete a pattern AND all of its steps (manual cascade delete,
 * since IndexedDB won't do this for us automatically).
 */
export async function deletePattern(patternId) {
  const db = await openDatabase();

  // Both stores touched in one transaction, so either both succeed
  // or neither does — same safety guarantee as a SQL transaction.
  const tx = db.transaction(['patterns', 'steps'], 'readwrite');

  tx.objectStore('patterns').delete(patternId);

  const stepsIndex = tx.objectStore('steps').index('by_pattern');
  const cursorRequest = stepsIndex.openCursor(IDBKeyRange.only(patternId));

  cursorRequest.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Update just a pattern's name (rename).
 */

export async function updatePatternName(patternId, newName) {
  const db = await openDatabase();
  const tx = db.transaction('patterns', 'readwrite');
  const store = tx.objectStore('patterns');

  const pattern = await promisifyRequest(store.get(patternId));
  pattern.name = newName;
  store.put(pattern);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Delete all steps belonging to a pattern, WITHOUT deleting the
 * pattern itself. Used when editing: we clear the old steps, then
 * re-add the new ones the user just edited.
 */
export async function deleteStepsForPattern(patternId) {
  const db = await openDatabase();
  const tx = db.transaction('steps', 'readwrite');
  const index = tx.objectStore('steps').index('by_pattern');
  const cursorRequest = index.openCursor(IDBKeyRange.only(patternId));

  cursorRequest.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Returns true if any pattern already has this name (case-insensitive).
 * `excludePatternId` lets editing skip comparing a pattern against itself.
 */
export async function patternNameExists(name, excludePatternId = null) {
  const patterns = await getAllPatterns();
  const normalized = name.trim().toLowerCase();

  return patterns.some(
    (p) => p.id !== excludePatternId && p.name.trim().toLowerCase() === normalized
  );
}


// ---------- STEPS ----------

/**
 * Insert one step belonging to a pattern.
 * `order` = position in the sequence (0, 1, 2, ...).
 * `isAutomatic` = true (auto-advance) or false (manual button press).
 * `transitionDelaySeconds` only matters when isAutomatic is true.
 */
export async function addStep(step) {
  const db = await openDatabase();
  const tx = db.transaction('steps', 'readwrite');
  const store = tx.objectStore('steps');
  const id = await promisifyRequest(
    store.add({
      patternId: step.patternId,
      order: step.order,
      durationSeconds: step.durationSeconds,
      isAutomatic: step.isAutomatic,
      transitionDelaySeconds: step.transitionDelaySeconds ?? 0,
    })
  );
  return id;
}

/**
 * Get all steps for one pattern, sorted by their `order` field.
 * Equivalent of: SELECT * FROM steps WHERE patternId = ? ORDER BY `order`
 */
export async function getStepsForPattern(patternId) {
  const db = await openDatabase();
  const tx = db.transaction('steps', 'readonly');
  const index = tx.objectStore('steps').index('by_pattern');
  const steps = await promisifyRequest(index.getAll(IDBKeyRange.only(patternId)));
  return steps.sort((a, b) => a.order - b.order);
}
