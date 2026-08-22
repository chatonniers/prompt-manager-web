import { useEffect, useRef } from 'react';
import { StorageAPI } from '../lib/storage.js';
import { getDefaultPrompts } from '../lib/defaults.js';
import { useApp } from '../context/AppContext.jsx';

export function useStorage() {
  const { dispatch } = useApp();
  const channelsRef = useRef([]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      let [prompts, catalog, settings, publishRequests] = await Promise.all([
        StorageAPI.getAllPrompts(),
        StorageAPI.getCatalog(),
        StorageAPI.getSettings(),
        StorageAPI.getPublishRequests().catch(() => []),
      ]);
      if (cancelled) return;

      // Seed defaults only if this user has no prompts yet
      if (prompts.length === 0) {
        const defaults = getDefaultPrompts();
        await Promise.all(defaults.map(p => StorageAPI.upsertPrompt(p)));
        prompts = await StorageAPI.getAllPrompts();
      }

      if (!cancelled) {
        dispatch({ type: 'LOAD_INITIAL', payload: { prompts, catalog, settings, publishRequests } });
        document.documentElement.dataset.theme = settings.theme || 'dark';
      }

      // Real-time subscriptions
      const promptsCh = StorageAPI.subscribeToPrompts(async () => {
        const fresh = await StorageAPI.getAllPrompts();
        dispatch({ type: 'SET_PROMPTS', payload: fresh });
      });

      const catalogCh = StorageAPI.subscribeToCatalog(async () => {
        const fresh = await StorageAPI.getCatalog();
        dispatch({ type: 'SET_CATALOG', payload: fresh });
      });

      const requestsCh = StorageAPI.subscribeToPublishRequests(async () => {
        const fresh = await StorageAPI.getPublishRequests().catch(() => []);
        dispatch({ type: 'SET_PUBLISH_REQUESTS', payload: fresh });
      });

      channelsRef.current = [promptsCh, catalogCh, requestsCh];
    }

    init();

    return () => {
      cancelled = true;
      channelsRef.current.forEach(ch => StorageAPI.unsubscribe(ch));
      channelsRef.current = [];
    };
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps
}
