import { useSyncExternalStore } from 'react';

// 全站共用一个秒级时钟；服务端快照为 null，避免时间造成水合不一致
let now: number | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useNow(): Date | null {
  const value = useSyncExternalStore(subscribe, () => now, () => null);
  return value === null ? null : new Date(value);
}
