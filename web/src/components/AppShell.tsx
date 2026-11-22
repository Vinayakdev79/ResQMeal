import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Inbox,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Package,
  PlusCircle,
  Settings,
  User,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import type { AuthRole } from '../auth/profile';
import { dashboardPathFor } from './RequireRole';

export const ROLE_LABELS: Record<AuthRole, string> = {
  donor: 'Donor',
  receiver: 'Receiver',
  admin: 'Admin',
};

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

function navItemsFor(role: AuthRole): NavItem[] {
  const dashboard: NavItem = { to: dashboardPathFor(role), label: 'Dashboard', icon: LayoutDashboard };
  const impact: NavItem = { to: '/impact', label: 'Impact', icon: BarChart3 };
  const reports: NavItem = { to: '/reports', label: 'Reports', icon: FileText };
  if (role === 'donor') {
    return [
      { to: '/donor', label: 'Overview', icon: LayoutDashboard },
      { to: '/donor/post', label: 'Post donation', icon: PlusCircle },
      { to: '/donor/donations', label: 'My donations', icon: Package },
      { to: '/donor/requests', label: 'Requests', icon: Inbox },
      { to: '/donor/notifications', label: 'Notifications', icon: Bell },
      { to: '/donor/profile', label: 'Profile', icon: User },
      impact,
      reports,
    ];
  }
  return [dashboard, impact, reports];
}

/** Two-letter avatar initials from a display name. */
function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return initials || '?';
}

interface NavListProps {
  items: NavItem[];
  collapsed: boolean;
  onNavigate?: () => void;
}

function NavList({ items, collapsed, onNavigate }: NavListProps) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `relative flex items-center rounded-full py-2.5 text-sm font-medium transition-colors duration-200 ${
                  collapsed ? 'justify-center px-0' : 'gap-3 px-4'
                } ${
                  isActive
                    ? 'bg-sage/25 text-cream'
                    : 'text-cream/75 hover:bg-white/5 hover:text-cream'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-sage"
                    />
                  )}
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {collapsed ? (
                    <span className="sr-only">{item.label}</span>
                  ) : (
                    <span className="truncate">{item.label}</span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

interface SidebarBodyProps {
  items: NavItem[];
  collapsed: boolean;
  homePath: string;
  displayName: string;
  roleLabel: string;
  initials: string;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}

function SidebarBody({
  items,
  collapsed,
  homePath,
  displayName,
  roleLabel,
  initials,
  onNavigate,
  onToggleCollapse,
}: SidebarBodyProps) {
  return (
    <>
      <div className={`flex items-center py-5 ${collapsed ? 'justify-center' : 'px-5'}`}>
        <Link
          to={homePath}
          onClick={onNavigate}
          className="flex items-center gap-2 font-display text-lg font-bold text-cream"
        >
          <Leaf className="h-5 w-5 shrink-0" aria-hidden="true" />
          {!collapsed && <span>ResQMeal</span>}
        </Link>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 pb-4">
        <NavList items={items} collapsed={collapsed} onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-white/10 p-3">
        <div
          className={`flex items-center gap-3 rounded-2xl p-2 ${collapsed ? 'justify-center' : ''}`}
        >
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage text-sm font-semibold text-forest-900"
          >
            {initials}
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-cream">{displayName}</p>
              <p className="truncate text-xs text-cream/65">{roleLabel}</p>
            </div>
          )}
        </div>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`mt-2 flex w-full items-center rounded-full py-2 text-sm font-medium text-cream/75 transition-colors duration-200 hover:bg-white/5 hover:text-cream ${
              collapsed ? 'justify-center' : 'gap-3 px-4'
            }`}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                <span>Collapse</span>
              </>
            )}
          </button>
        )}
      </div>
    </>
  );
}

const MENU_ITEM_CLASS =
  'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors';
const MENU_ITEM_ENABLED = 'text-charcoal hover:bg-mist';
const MENU_ITEM_DISABLED = 'cursor-not-allowed text-muted/60';

interface AccountLinks {
  profile: string | null;
  settings: string | null;
}

/** Profile and Settings targets per role; null means no route exists (rendered disabled). */
function accountLinksFor(role: AuthRole): AccountLinks {
  if (role === 'donor') return { profile: '/donor/profile', settings: '/donor/settings' };
  if (role === 'receiver') return { profile: '/receiver/profile', settings: '/receiver/settings' };
  return { profile: null, settings: null };
}

interface AccountMenuItemProps {
  to: string | null;
  label: string;
  icon: LucideIcon;
  onSelect?: () => void;
}

function AccountMenuItem({ to, label, icon: Icon, onSelect }: AccountMenuItemProps) {
  if (!to) {
    return (
      <span role="menuitem" aria-disabled="true" className={`${MENU_ITEM_CLASS} ${MENU_ITEM_DISABLED}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
    );
  }
  return (
    <Link role="menuitem" to={to} onClick={onSelect} className={`${MENU_ITEM_CLASS} ${MENU_ITEM_ENABLED}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

interface AppShellProps {
  title: string;
  children: ReactNode;
}

export default function AppShell({ title, children }: AppShellProps) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the profile dropdown on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // Close the mobile drawer on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  if (!profile || !role) {
    return <Navigate to="/login" replace />;
  }

  const displayName = profile.full_name || profile.organization_name || 'Account';
  const initials = initialsFor(displayName);
  const roleLabel = ROLE_LABELS[role];
  const items = navItemsFor(role);
  const homePath = dashboardPathFor(role);
  const accountLinks = accountLinksFor(role);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="flex min-h-screen bg-cream text-charcoal">
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-forest-700 text-cream transition-[width] duration-300 ease-out md:flex ${
          collapsed ? 'w-[76px]' : 'w-[264px]'
        }`}
      >
        <SidebarBody
          items={items}
          collapsed={collapsed}
          homePath={homePath}
          displayName={displayName}
          roleLabel={roleLabel}
          initials={initials}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </aside>

      {/* Mobile off-canvas drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            aria-hidden="true"
            onClick={closeDrawer}
            className="absolute inset-0 bg-charcoal-900/50 animate-fade-in"
          />
          <aside
            id="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="absolute inset-y-0 left-0 flex w-[264px] max-w-[85vw] flex-col bg-forest-700 text-cream shadow-xl animate-slide-in-left"
          >
            <div className="flex justify-end px-3 pt-3">
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close navigation"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-cream/80 transition-colors hover:bg-white/10 hover:text-cream"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <SidebarBody
              items={items}
              collapsed={false}
              homePath={homePath}
              displayName={displayName}
              roleLabel={roleLabel}
              initials={initials}
              onNavigate={closeDrawer}
            />
            <div className="border-t border-white/10 px-3 py-3">
              <ul className="flex flex-col gap-1">
                <li>
                  {accountLinks.profile ? (
                    <NavLink
                      to={accountLinks.profile}
                      onClick={closeDrawer}
                      className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-cream/75 transition-colors duration-200 hover:bg-white/5 hover:text-cream"
                    >
                      <User className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="truncate">Profile</span>
                    </NavLink>
                  ) : (
                    <span className="flex cursor-not-allowed items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-cream/40">
                      <User className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="truncate">Profile</span>
                    </span>
                  )}
                </li>
                <li>
                  {accountLinks.settings ? (
                    <NavLink
                      to={accountLinks.settings}
                      onClick={closeDrawer}
                      className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-cream/75 transition-colors duration-200 hover:bg-white/5 hover:text-cream"
                    >
                      <Settings className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="truncate">Settings</span>
                    </NavLink>
                  ) : (
                    <span className="flex cursor-not-allowed items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-cream/40">
                      <Settings className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="truncate">Settings</span>
                    </span>
                  )}
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      closeDrawer();
                      void handleSignOut();
                    }}
                    className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-medium text-cream/75 transition-colors duration-200 hover:bg-white/5 hover:text-cream"
                  >
                    <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="truncate">Sign out</span>
                  </button>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-controls="mobile-drawer"
              aria-expanded={drawerOpen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-mist md:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <Link
              to={homePath}
              className="flex items-center gap-2 font-display text-lg font-bold text-forest-700 md:hidden"
            >
              <Leaf className="h-5 w-5" aria-hidden="true" />
              ResQMeal
            </Link>

            <nav
              aria-label="Breadcrumb"
              className="hidden min-w-0 items-center gap-2 text-sm text-muted md:flex"
            >
              <span>{roleLabel}</span>
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate font-medium text-charcoal">{title}</span>
            </nav>

            <div ref={menuRef} className="relative ml-auto">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-3 rounded-full border border-line bg-surface py-1 pl-1 pr-3 transition-colors hover:border-sage"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-700 text-xs font-semibold text-cream"
                >
                  {initials}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-semibold leading-tight text-charcoal">
                    {displayName}
                  </span>
                  <span className="block text-xs leading-tight text-muted">{roleLabel}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-line bg-surface p-2 shadow-lg animate-fade-in"
                >
                  <AccountMenuItem
                    to={accountLinks.profile}
                    label="Profile"
                    icon={User}
                    onSelect={() => setMenuOpen(false)}
                  />
                  <AccountMenuItem
                    to={accountLinks.settings}
                    label="Settings"
                    icon={Settings}
                    onSelect={() => setMenuOpen(false)}
                  />
                  <div className="my-2 h-px bg-line" aria-hidden="true" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      void handleSignOut();
                    }}
                    className={`${MENU_ITEM_CLASS} text-charcoal hover:bg-mist`}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="reveal mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-10">
          <h1 className="font-display text-2xl font-bold text-forest-700 md:text-3xl">{title}</h1>
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
