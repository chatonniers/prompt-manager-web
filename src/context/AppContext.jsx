import { createContext, useContext, useReducer } from 'react';

export const AppContext = createContext(null);

const initialState = {
  prompts: [],
  catalog: { solutions: [], storyFlows: [], categories: [], systems: [] },
  settings: { autoFilterEnabled: true, lang: 'en' },
  currentView: 'all',
  currentFilter: null,
  searchQuery: '',
  sortOrder: 'title',
  sapContext: null,
  isModalOpen: false,
  editingPromptId: undefined,
  isConfirmOpen: false,
  pendingDeleteId: null,
  toastMsg: null,
  toastUndo: null,   // { label, onUndo } — if set, Toast shows an Undo button
  initialized: false,
  selectedIds: new Set(),
  zoom: (() => { const v = parseFloat(localStorage.getItem('pm-zoom')); return v >= 0.5 && v <= 2 ? v : 1; })(),
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_INITIAL':
      if (state.initialized) return state;
      return { ...state, ...action.payload, initialized: true };
    // Accept both .payload and legacy field names for SET_PROMPTS
    case 'SET_PROMPTS':
      return { ...state, prompts: action.payload ?? action.prompts };
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
      };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload ?? action.query };
    case 'SET_SORT':
      return { ...state, sortOrder: action.payload ?? action.order };
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
