import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import { profileToUser } from '../auth/profile';
import { loadState, resetDemo as resetDemoState, saveState } from './store';
import type { AppState, User } from './types';

interface AppStateContextValue {
  state: AppState;
  setState: (updater: (s: AppState) => AppState) => void;
  /** The signed-in user, derived from the Supabase profile. Null when signed out. */
  currentUser: User | null;
  resetDemo: () => void;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<AppState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const setState = useCallback((updater: (s: AppState) => AppState) => {
    setStateRaw(updater);
  }, []);

  const { profile, user } = useAuth();

  const currentUser = useMemo<User | null>(
    () => (profile && user ? profileToUser(profile, user.email ?? '') : null),
    [profile, user],
  );

  const resetDemo = useCallback(() => {
    setStateRaw(() => resetDemoState());
  }, []);

  const value = useMemo<AppStateContextValue>(
    () => ({ state, setState, currentUser, resetDemo }),
    [state, setState, currentUser, resetDemo],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }
  return ctx;
}
