import { createContext, useContext } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import type { AuthRole, Profile } from './profile';

export type AuthStatus = 'loading' | 'signed_out' | 'authenticated' | 'profile_missing';

export interface SignUpInput {
  email: string;
  password: string;
  metadata: Record<string, string | number | null>;
}

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: SupabaseUser | null;
  profile: Profile | null;
  role: AuthRole | null;
  message: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (input: SignUpInput) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Access the auth state and actions. Must be used inside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
