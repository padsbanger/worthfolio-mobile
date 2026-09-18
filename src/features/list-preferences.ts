import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { server } from '../lib/config';
import { periods, sortOptions, type AssetSort, type ListPeriod } from '../lib/list-view';

type Preferences = { sort: AssetSort; period: ListPeriod };
const defaults: Preferences = { sort: 'default', period: '1D' };
export function useListPreferences(screen: 'portfolio' | 'watchlists', owner: string | undefined, demo: boolean) {
  const key = owner && !demo ? `list-view:${server.url}:${owner}:${screen}` : null;
  const [saved, setSaved] = useState<{ key: string | null; value: Preferences }>({ key: null, value: defaults });
  const generation = useRef(0);
  const writes = useRef(Promise.resolve());
  const value = saved.key === key ? saved.value : defaults;
  useEffect(() => {
    if (!key) return;
    let active = true;
    const version = generation.current;
    void AsyncStorage.getItem(key).then(raw => {
      if (!raw || !active || version !== generation.current) return;
      const next = JSON.parse(raw) as Preferences;
      if (next && sortOptions.some(s => s.id === next.sort) && periods.includes(next.period)) setSaved({ key, value: { sort: next.sort, period: next.period } });
    }).catch(() => {});
    return () => { active = false; };
  }, [key]);
  const update = (patch: Partial<Preferences>) => {
    generation.current++;
    const next = { ...value, ...patch };
    setSaved({ key, value: next });
    if (key) writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify(next)));
    void writes.current.catch(() => {});
  };
  return { ...value, update };
}
