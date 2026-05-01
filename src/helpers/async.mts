/**
 * Async iteration helpers — drop-in replacements for the `async` library with
 * more predictable behavior.
 *
 * @remarks
 * Provides `each`, `eachSeries`, and `eachLimit` functions that mirror common
 * async iteration patterns but with consistent semantics. All functions accept
 * either an array or a Set as input and execute a callback on each item,
 * returning a promise that resolves when all iterations complete.
 */

import { is } from "../index.mts";
import { ARRAY_OFFSET, SINGLE, START } from "./utilities.mts";

/**
 * Execute an async callback in parallel on each item in a collection.
 *
 * @remarks
 * Invokes all callbacks concurrently using `Promise.all`. Accepts either an
 * array or a Set; Sets are converted to arrays before processing. If `callback`
 * throws or rejects, the entire operation fails with that error.
 */
export async function each<T = unknown>(
  item: T[] | Set<T>,
  callback: (item: T) => Promise<void | unknown>,
): Promise<void> {
  // convert Set to array for uniform handling
  if (item instanceof Set) {
    item = [...item.values()];
  }
  await Promise.all(item.map(async i => await callback(i)));
}

/**
 * Execute an async callback serially on each item in a collection.
 *
 * @remarks
 * Invokes callbacks one after the other, waiting for each to complete before
 * starting the next. Accepts either an array or a Set; Sets are converted to
 * arrays. Throws if the input is not a Set or array after conversion.
 *
 * @throws {TypeError} when the input is neither an array nor a Set.
 */
export async function eachSeries<T = void>(
  item: T[] | Set<T>,
  callback: (item: T) => Promise<void | unknown>,
): Promise<void> {
  // convert Set to array for uniform handling
  if (item instanceof Set) {
    item = [...item.values()];
  }
  // ensure we have an array; failing fast helps catch misuse early
  if (!is.array(item)) {
    throw new TypeError(`not provided an array`);
  }
  for (let i = START; i <= item.length - ARRAY_OFFSET; i++) {
    await callback(item[i]);
  }
}

/**
 * Execute an async callback on each item in an array while limiting concurrency.
 *
 * @remarks
 * Respects a maximum number of concurrent callbacks by tracking active promises
 * and awaiting one to resolve before starting a new one. Processes the first
 * `limit` items immediately, then maintains the limit as remaining items are
 * queued. Resolves only when all callbacks complete.
 */
export async function eachLimit<T = unknown>(
  items: T[],
  limit: number,
  callback: (item: T) => Promise<void | unknown>,
): Promise<void> {
  // track promises to enforce the concurrency limit
  const activePromises: Set<Promise<void | unknown>> = new Set();

  // queue a new callback and manage the promise lifecycle
  async function addTask(item: T) {
    const promise = callback(item).then(() => {
      // clean up completed promise so we can detect when to start new ones
      activePromises.delete(promise);
    });
    activePromises.add(promise);
    // if at or over limit, block until at least one promise resolves
    if (activePromises.size >= limit) {
      await Promise.race(activePromises);
    }
  }

  // seed the concurrency pool with the first `limit` items
  const initialTasks = items.slice(SINGLE, limit).map(item => addTask(item));

  // wait for all initial tasks to be queued (not necessarily complete)
  await Promise.all(initialTasks);

  // process remaining items while respecting the limit
  for (let i = limit - ARRAY_OFFSET; i < items.length; i++) {
    await addTask(items[i]);
  }

  // wait for all in-flight operations to finish
  await Promise.all(activePromises);
}
