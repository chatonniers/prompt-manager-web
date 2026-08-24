import { createContext, useContext, useReducer } from 'react';

export const AppContext = createContext(null);

const initialState = {
  prompts: [],
  catalog: { solutions: [], storyFlows: [], categories: [], systems: [], personas: [], tags: [] },
  settings: { autoFilterEnabled: true, lang: 'en', theme: localStorage.getItem('pm-theme') || 'dark' },
  currentView: 'all',
  currentFilter: null,
  searchQuery: '',
  statusFilter: null,
  sapContext: null,
  isModalOpen: false,
  editingPromptId: undefined,
  isConfirmOpen: false,
  pendingDeleteId: null,
  pendingDeleteIds: new Set(),
  toastMsg: null,
  toastUndo: null,   // { label, onUndo } — if set, Toast shows an Undo button
  initialized: false,
  selectedIds: new Set(),
  draggingId: null,
  workspace: (() => { const v = localStorage.getItem('pm-workspace'); return v === 'mine' || v === 'library' ? v : 'library'; })(),
  publishRequests: [],
  newUsers: [],
  zoom: (() => { const v = parseFloat(localStorage.getItem('pm-zoom')); return v >= 0.5 && v <= 2 ? v : 1; })(),
  displayMode: (() => { const v = localStorage.getItem('pm-display'); return v === 'table' || v === 'cards' ? v : 'cards'; })(),
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_INITIAL':
      if (state.initialized) return state;
      return { ...state, ...action.payload, initialized: true };
    // Accept both .payload and legacy field names for SET_PROMPTS
    case 'SET_PROMPTS': {
      const incoming = action.payload ?? action.prompts;
      const filtered = state.pendingDeleteIds.size
        ? incoming.filter(p => !state.pendingDeleteIds.has(p.id))
        : incoming;
      return { ...state, prompts: filtered };
    }
    case 'MARK_DELETING': {
      const next = new Set(state.pendingDeleteIds);
      const ids = Array.isArray(action.payload) ? action.payload : [action.payload];
      ids.forEach(id => next.add(id));
      return { ...state, pendingDeleteIds: next };
    }
    case 'UNMARK_DELETING': {
      const next = new Set(state.pendingDeleteIds);
      const ids = Array.isArray(action.payload) ? action.payload : [action.payload];
      ids.forEach(id => next.delete(id));
      return { ...state, pendingDeleteIds: next };
    }
    case 'SET_CATALOG':
      return { ...state, catalog: action.payload ?? action.catalog };
    case 'SET_SETTINGS':
    case 'SAVE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...(action.payload ?? action.settings) } };
    case 'SET_VIEW':
      return {
        ...state,
        currentView: action.payload?.view ?? action.view,
        currentFilter: (action.payload?.filter ?? action.filter) ?? { storyFlow: null, solution: null, category: null },
        searchQuery: '',
        statusFilter: action.payload?.statusFilter ?? null,
      };
    case 'SET_STATUS_FILTER':
      return { ...state, statusFilter: action.payload, searchQuery: '' };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload ?? action.query, statusFilter: null };
    case 'SET_SAP_CONTEXT':
      return { ...state, sapContext: action.payload ?? action.context };
    case 'OPEN_MODAL':
    case 'OPEN_EDIT':
      return { ...state, isModalOpen: true, editingPromptId: action.payload ?? action.id };
    case 'CLOSE_MODAL':
      return { ...state, isModalOpen: false, editingPromptId: undefined };
    case 'OPEN_CONFIRM':
    case 'SET_CONFIRM_DELETE':
      return { ...state, isConfirmOpen: true, pendingDeleteId: action.payload ?? action.id };
    case 'CLOSE_CONFIRM':
      return { ...state, isConfirmOpen: false, pendingDeleteId: null };
    case 'SHOW_TOAST':
      return { ...state, toastMsg: action.payload ?? action.msg, toastUndo: action.undo ?? null };
    case 'CLEAR_TOAST':
      return { ...state, toastMsg: null, toastUndo: null };
    case 'SET_ZOOM': {
      const v = Math.min(2, Math.max(0.5, Math.round(action.payload * 10) / 10));
      localStorage.setItem('pm-zoom', v);
      return { ...state, zoom: v };
    }
    case 'TOGGLE_SELECT': {
      const next = new Set(state.selectedIds);
      if (next.has(action.payload)) next.delete(action.payload);
      else next.add(action.payload);
      return { ...state, selectedIds: next };
    }
    case 'CLEAR_SELECT':
      return { ...state, selectedIds: new Set() };
    case 'SELECT_ALL': {
      const all = new Set([...state.selectedIds, ...(action.payload || [])]);
      return { ...state, selectedIds: all };
    }
    case 'SET_DRAGGING':
      return { ...state, draggingId: action.payload ?? null };
    case 'SET_DISPLAY_MODE': {
      const mode = action.payload === 'table' ? 'table' : 'cards';
      localStorage.setItem('pm-display', mode);
      return { ...state, displayMode: mode };
    }
    case 'SET_WORKSPACE': {
      const ws = action.payload === 'mine' ? 'mine' : 'library';
      localStorage.setItem('pm-workspace', ws);
      return { ...state, workspace: ws };
    }
    case 'SET_PUBLISH_REQUESTS':
      return { ...state, publishRequests: action.payload };
    case 'SET_NEW_USERS':
      return { ...state, newUsers: action.payload };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
