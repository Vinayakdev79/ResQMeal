import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { mapAuthError } from './errors';
import { PROFILE_COLUMNS, type Profile } from './profile';
import { AuthContext, type AuthContextValue, type AuthStatus, type SignUpInput } from './useAuth';

const SUSPENDED_MESSAGE = 'This account has been suspended. Contact support.';
const MISSING_PROFILE_MESSAGE =
  'Your account profile is incomplete. Please contact support or sign out and register again.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Incremented on every profile load and on sign-out so stale responses are ignored.
  const requestRef = useRef(0);

  /** Load the profile for a session and set the resulting status. */
  const applyProfile = useCallback(async (nextSession: Session) => {
    const requestId = ++requestRef.current;
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', nextSession.user.id)
      .maybeSingle();
    if (requestId !== requestRef.current) return;

    if (error) {
      setProfile(null);
      setMessage(`Could not load your profile: ${mapAuthError(error.message)}`);
      setStatus('profile_missing');
      return;
    }

    const row = (data as Profile | null) ?? null;

    if (row === null) {
      setProfile(null);
      setMessage(MISSING_PROFILE_MESSAGE);
      setStatus('profile_missing');
      return;
    }

    if (row.is_suspended) {
      setProfile(null);
      setMessage(SUSPENDED_MESSAGE);
      setStatus('signed_out');
      await supabase.auth.signOut();
      return;
    }

    setProfile(row);
    setMessage(null);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    let active = true;
    let deferred: ReturnType<typeof setTimeout> | undefined;

    const handleSession = (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      if (nextSession === null) {
        requestRef.current++;
        setProfile(null);
        setStatus('signed_out');
        return;
      }
      void applyProfile(nextSession);
    };

    void supabase.auth.getSession().then(({ data }) => {
      handleSession(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Defer so that Supabase calls made from the handler do not run inside the auth callback.
      deferred = setTimeout(() => handleSession(nextSession), 0);
    });

    return () => {
      active = false;
      if (deferred !== undefined) clearTimeout(deferred);
      subscription.subscription.unsubscribe();
    };
  }, [applyProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? mapAuthError(error.message) : null };
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: input.metadata,
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) {
      return { error: mapAuthError(error.message), needsEmailConfirmation: false };
    }
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities?.length === 0) {
      return {
        error: 'An account with this email already exists. Try logging in instead.',
        needsEmailConfirmation: false,
      };
    }
    return { error: null, needsEmailConfirmation: data.session === null };
  }, []);

  const signOut = useCallback(async () => {
    setMessage(null);
    requestRef.current++;
    setSession(null);
    setProfile(null);
    setStatus('signed_out');
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? mapAuthError(error.message) : null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? mapAuthError(error.message) : null };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      role: profile ? profile.role : null,
      message,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [status, session, profile, message, signIn, signUp, signOut, resetPassword, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
