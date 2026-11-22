import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { AuthRole } from './profile';
import { useAuth } from './useAuth';

/** The dashboard route for each role. */
export function dashboardPathFor(role: AuthRole): string {
  switch (role) {
    case 'donor':
      return '/donor';
    case 'receiver':
      return '/receiver';
    case 'admin':
      return '/admin';
  }
}

interface RequireAuthProps {
  roles?: AuthRole[];
  children: ReactNode;
}

export function RequireAuth({ roles, children }: RequireAuthProps) {
  const { status, role, signOut } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-forest-600" />
      </div>
    );
  }

  if (status === 'signed_out') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (status === 'profile_missing') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-lg font-semibold text-slate-900">Profile incomplete</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your account profile is incomplete. Please contact support or sign out and register again.
          </p>
          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-forest-600 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (roles && roles.length > 0) {
    if (role === null || !roles.includes(role)) {
      return <Navigate to={role ? dashboardPathFor(role) : '/login'} replace />;
    }
  }

  return <>{children}</>;
}
