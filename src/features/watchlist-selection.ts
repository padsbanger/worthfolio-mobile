import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import type { Watchlists } from '../api/contracts';
import { server } from '../lib/config';

export function selectedWatchlist(data: Watchlists | undefined, selected: string | null) {
  return data?.watchlists.find(list => list.id === selected)
    ?? data?.watchlists.find(list => list.id === data.activeWatchlistId)
    ?? data?.watchlists[0];
}

export function useWatchlistSelection(data: Watchlists | undefined, owner: string | undefined, demo: boolean) {
  const key = owner && !demo ? `watchlist:${server.url}:${owner}` : null;
  const [selection, setSelection] = useState<{ key: string | null; id: string | null } | null>(null);
  const changes = useRef(0);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    if (!key) return;
    let active = true;
    const version = changes.current;
    void AsyncStorage.getItem(key).then(id => {
      if (active && changes.current === version) setSelection({ key, id });
    }).catch(() => {});
    return () => { active = false; };
  }, [key]);
  const current = selectedWatchlist(data, selection?.key === key ? selection.id : null);
  const select = (id: string) => {
    changes.current++;
    setSelection({ key, id });
    if (key) writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(key, id));
    // Preferences are optional; storage failures must not undo an in-memory choice.
    void writes.current.catch(() => {});
  };
  return { current, select };
}
