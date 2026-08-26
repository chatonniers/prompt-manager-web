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
      let [prompts, catalog, settings, publishRequests, newUsers] = await Promise.all([
        StorageAPI.getAllPrompts(),
        StorageAPI.getCatalog(),
        StorageAPI.getSettings(),
        StorageAPI.getPublishRequests().catch(() => []),
        StorageAPI.getNewUsers().catch(() => []),
      ]);
      if (cancelled) return;

      // Seed defaults only if this user has no prompts yet
      if (prompts.length === 0) {
        const defaults = getDefaultPrompts();
        await Promise.all(defaults.map(p => StorageAPI.upsertPrompt(p)));
        prompts = await StorageAPI.getAllPrompts();
      }

      if (!cancelled) {
        dispatch({ type: 'LOAD_INITIAL', payload: { prompts, catalog, settings, publishRequests, newUsers } });
        document.documentElement.dataset.theme = settings.theme || 'dark';
      }

      // Real-time subscriptions
      const promptsCh = StorageAPI.subscribeToPrompts(async () => {
        try {
          const fresh = await StorageAPI.getAllPrompts();
          dispatch({ type: 'SET_PROMPTS', payload: fresh });
        } catch { /* retain stale prompts on network error */ }
      });

      const catalogCh = StorageAPI.subscribeToCatalog(async () => {
        try {
          const fresh = await StorageAPI.getCatalog();
          dispatch({ type: 'SET_CATALOG', payload: fresh });
        } catch { /* retain stale catalog on network error */ }
      });

      const requestsCh = StorageAPI.subscribeToPublishRequests(async () => {
        try {
          const fresh = await StorageAPI.getPublishRequests().catch(() => []);
          dispatch({ type: 'SET_PUBLISH_REQUESTS', payload: fresh });
        } catch { /* retain stale requests on network error */ }
      });

      const profilesCh = StorageAPI.subscribeToProfiles(async () => {
        try {
          const fresh = await StorageAPI.getNewUsers().catch(() => []);
          dispatch({ type: 'SET_NEW_USERS', payload: fresh });
        } catch { /* retain stale new users on network error */ }
      });

      channelsRef.current = [promptsCh, catalogCh, requestsCh, profilesCh];

      // Fallback poll every 60s for publish requests — realtime Postgres Changes
      // with RLS doesn't reliably broadcast cross-user inserts.
      const pollInterval = setInterval(async () => {
        try {
          const fresh = await StorageAPI.getPublishRequests().catch(() => null);
          if (fresh) dispatch({ type: 'SET_PUBLISH_REQUESTS', payload: fresh });
        } catch { /* ignore */ }
      }, 60_000);

      channelsRef.current.push({ _isInterval: true, _id: pollInterval });
    }

    init();

    return () => {
      cancelled = true;
      channelsRef.current.forEach(ch => {
        if (ch?._isInterval) clearInterval(ch._id);
        else StorageAPI.unsubscribe(ch);
      });
      channelsRef.current = [];
    };
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps
}
