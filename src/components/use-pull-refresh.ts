import { useRef, useState } from 'react';

/** Only a pull gesture should activate the native refresh control. */
export function usePullRefresh(refresh: () => Promise<unknown>) {
  const pending = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    if (pending.current) return;
    pending.current = true;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      pending.current = false;
      setRefreshing(false);
    }
  };
  return { refreshing, onRefresh };
}
