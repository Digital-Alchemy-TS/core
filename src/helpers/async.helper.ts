import { is } from "../extensions/is.extension";
import { ARRAY_OFFSET, SINGLE, START } from "./utilities.helper";

// ? Functions written to be similar to the offerings from the async library
// That library gave me oddly inconsistent results,
//     so these exist to replace those doing exactly what I expect
//

// #MARK: each
export async function each<T = unknown>(
  item: T[] = [],
  callback: (item: T) => Promise<void | unknown>,
): Promise<void> {
  await Promise.all(item.map(async (i) => await callback(i)));
}

// #MARK: eachSeries
export async function eachSeries<T = void>(
  item: T[] | Set<T>,
  callback: (item: T) => Promise<void | unknown>,
): Promise<void> {
  if (item instanceof Set) {
    item = [...item.values()];
  }
  if (!is.array(item)) {
    throw new TypeError(`not provided an array`);
  }
  for (let i = START; i <= item.length - ARRAY_OFFSET; i++) {
    await callback(item[i]);
  }
}

// #MARK: eachLimit
export async function eachLimit<T = unknown>(
  items: T[],
  limit: number,
  callback: (item: T) => Promise<void | unknown>,
): Promise<void> {
  // Track active promises to ensure we don't exceed the limit
  const activePromises: Set<Promise<void | unknown>> = new Set();

  // A helper function to add a new task
  async function addTask(item: T) {
    const promise = callback(item).then(() => {
      activePromises.delete(promise); // Remove the promise from the set once it's resolved
    });
    activePromises.add(promise);
    if (activePromises.size >= limit) {
      await Promise.race(activePromises); // Wait for one of the active promises to resolve
    }
  }

  // Add initial tasks up to the limit
  const initialTasks = items.slice(SINGLE, limit).map((item) => addTask(item));

  // Wait for the initial set of tasks to start processing
  await Promise.all(initialTasks);

  // Process the remaining items, ensuring the limit is respected
  for (let i = limit; i < items.length; i++) {
    await addTask(items[i]);
  }

  // Wait for all remaining tasks to complete
  await Promise.all(activePromises);
}
