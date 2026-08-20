import { useEffect, useRef } from 'react';
import { StorageAPI } from '../lib/storage.js';
import { getDefaultPrompts } from '../lib/defaults.js';
import { useApp } from '../context/AppContext.jsx';

export function useStorage() {
  const { state, dispatch } = useApp();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || state.initialized) return;
    ranRef.current = true;

    async function init() {
      let [prompts, catalog, settings] = await Promise.all([
        StorageAPI.getAllPrompts(),
        StorageAPI.getCatalog(),
        StorageAPI.getSettings(),
      ]);
      if (prompts.length === 0) {
        const defaults = getDefaultPrompts();
        await Promise.all(defaults.map(p => StorageAPI.upsertPrompt(p)));
        prompts = defaults;
      }
      dispatch({ type: 'LOAD_INITIAL', payload: { prompts, catalog, settings } });
    }
    init();
  }, []); // empty deps — run once only
}
