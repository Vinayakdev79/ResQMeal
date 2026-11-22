import type { ReactNode } from 'react';
import { RequireAuth } from '../auth/RequireAuth';
import type { AuthRole } from '../auth/profile';

/** Kept for existing imports. Role checks now live in auth/RequireAuth. */
export { dashboardPathFor } from '../auth/RequireAuth';

interface RequireRoleProps {
  roles: AuthRole[];
  children: ReactNode;
}

export default function RequireRole({ roles, children }: RequireRoleProps) {
  return <RequireAuth roles={roles}>{children}</RequireAuth>;
}
