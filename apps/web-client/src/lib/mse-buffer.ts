export interface AppendQueue {
  readonly queue: readonly Uint8Array[];
  readonly appending: boolean;
}

export interface QueueStep {
  readonly state: AppendQueue;
  readonly append: Uint8Array | null;
}

export const emptyQueue = (): AppendQueue => ({ queue: [], appending: false });

// Append now if idle; otherwise hold the chunk until the current append ends.
export const enqueue = (state: AppendQueue, chunk: Uint8Array): QueueStep => {
  if (state.appending) {
    return { state: { queue: [...state.queue, chunk], appending: true }, append: null };
  }
  return { state: { queue: state.queue, appending: true }, append: chunk };
};

// On updateend, append the next queued chunk or return to idle.
export const onUpdateEnd = (state: AppendQueue): QueueStep => {
  const [next, ...rest] = state.queue;
  if (next === undefined) {
    return { state: { queue: [], appending: false }, append: null };
  }
  return { state: { queue: rest, appending: true }, append: next };
};
