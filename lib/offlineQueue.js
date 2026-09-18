const QUEUE_KEY = 'navy_pos_queue';
const ERRORS_KEY = 'navy_pos_queue_errors';

function readList(key) {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function writeList(key, list) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // storage full or unavailable — nothing more we can do client-side
  }
}

export function makeIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getQueue() {
  return readList(QUEUE_KEY);
}

export function getQueueErrors() {
  return readList(ERRORS_KEY);
}

export function enqueuePurchase(item) {
  const queue = readList(QUEUE_KEY);
  queue.push(item);
  writeList(QUEUE_KEY, queue);
}

export function dismissQueueError(idempotencyKey) {
  writeList(ERRORS_KEY, readList(ERRORS_KEY).filter((e) => e.idempotencyKey !== idempotencyKey));
}

/**
 * Retries every queued sale in order. Stops at the first network failure (still offline)
 * and leaves the rest queued untouched. A non-network failure (e.g. the card's balance no
 * longer covers it) is not retried forever — it's moved to an error list the shopkeeper has
 * to look at, since retrying that indefinitely would just fail the same way each time.
 */
export async function syncQueue(apiFetch) {
  const queue = readList(QUEUE_KEY);
  if (queue.length === 0) return { synced: 0, remaining: 0, failed: 0 };

  const errors = readList(ERRORS_KEY);
  const remaining = [];
  let synced = 0;
  let offlineAgain = false;

  for (const item of queue) {
    if (offlineAgain) {
      remaining.push(item);
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      await apiFetch('/purchase', { method: 'POST', body: item });
      synced += 1;
    } catch (err) {
      if (err.isNetworkError) {
        offlineAgain = true;
        remaining.push(item);
      } else {
        errors.push({ ...item, error: err.message, failedAt: new Date().toISOString() });
      }
    }
  }

  writeList(QUEUE_KEY, remaining);
  writeList(ERRORS_KEY, errors);
  return { synced, remaining: remaining.length, failed: queue.length - synced - remaining.length };
}
