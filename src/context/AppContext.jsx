import { createContext, useContext, useReducer } from 'react';

export const AppContext = createContext(null);

const initialState = {
  prompts: [],
  catalog: { solutions: [], storyFlows: [], landscapes: [], mcpCredentials: [] },
  settings: { autoFilterEnabled: true, lang: 'en' },
  currentView: 'all',
  currentFilter: null,
  searchQuery: '',
  sortOrder: 'updated',
  sapContext: null,
  isModalOpen: false,
  editingPromptId: undefined,
  isConfirmOpen: false,
  pendingDeleteId: null,
  toastMsg: null,
  initialized: false,
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
      return { ...state, toastMsg: action.payload ?? action.msg };
    case 'CLEAR_TOAST':
      return { ...state, toastMsg: null };
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
