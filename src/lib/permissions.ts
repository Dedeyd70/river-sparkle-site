// Role-based + permission-aware navigation configuration
// admin = Super Admin, manager = Manager, staff = Staff

/** Base path for the admin area. Use this everywhere (including email links)
 *  so notification emails route to the real admin URL instead of a broken /admin/*. */
export const ADMIN_BASE = "/onpass-useradmin-blueriveracess052026";

export type AppRole = "admin" | "manager" | "staff" | "user";
export type PermissionsMap = Record<string, boolean>;

interface NavPermission {
  label: string;
  path: string;
  roles: AppRole[];
  group: string;
  /** Optional permission key. When set, an explicit `false` in the user's
   *  permissions JSONB hides the item even if their role would normally allow it.
   *  Admin always bypasses this check. */
  permission?: string;
}

export const NAV_GROUPS = [
  { key: "main", label: "" },
  { key: "operations", label: "Operations" },
  { key: "finance", label: "Finance" },
  { key: "website", label: "Website" },
  { key: "system", label: "System" },
];

export const NAV_PERMISSIONS: NavPermission[] = [
  // Main
  { label: "Dashboard", path: "/onpass-useradmin-blueriveracess052026", roles: ["admin", "manager"], group: "main", permission: "__dashboard__" },

  // Operations
  { label: "Bookings", path: "/onpass-useradmin-blueriveracess052026/bookings", roles: ["admin", "manager", "staff"], group: "operations", permission: "can_manage_bookings" },
  { label: "Quotes", path: "/onpass-useradmin-blueriveracess052026/quotes", roles: ["admin", "manager", "staff"], group: "operations", permission: "can_manage_quotes" },
  { label: "Messages", path: "/onpass-useradmin-blueriveracess052026/messages", roles: ["admin", "manager", "staff"], group: "operations", permission: "can_manage_messages" },
  { label: "Submissions", path: "/onpass-useradmin-blueriveracess052026/submissions", roles: ["admin", "manager", "staff"], group: "operations", permission: "can_manage_messages" },
  { label: "Cleaner Applications", path: "/onpass-useradmin-blueriveracess052026/cleaner-applications", roles: ["admin", "manager", "staff"], group: "operations", permission: "can_manage_applications" },

  // Finance
  { label: "Invoices", path: "/onpass-useradmin-blueriveracess052026/invoices", roles: ["admin", "manager"], group: "finance", permission: "can_manage_invoices" },

  // Website
  { label: "Services", path: "/onpass-useradmin-blueriveracess052026/services", roles: ["admin", "manager"], group: "website" },
  { label: "Gallery", path: "/onpass-useradmin-blueriveracess052026/gallery", roles: ["admin", "manager"], group: "website", permission: "can_manage_gallery" },
  { label: "Testimonials", path: "/onpass-useradmin-blueriveracess052026/testimonials", roles: ["admin", "manager"], group: "website", permission: "can_manage_testimonials" },
  { label: "Homepage Images", path: "/onpass-useradmin-blueriveracess052026/homepage-images", roles: ["admin"], group: "website" },
  { label: "Branding", path: "/onpass-useradmin-blueriveracess052026/branding", roles: ["admin"], group: "website" },
  { label: "Site Content", path: "/onpass-useradmin-blueriveracess052026/site-content", roles: ["admin"], group: "website", permission: "can_manage_site_content" },
  { label: "Privacy Policy", path: "/onpass-useradmin-blueriveracess052026/privacy-policy", roles: ["admin"], group: "website" },
  { label: "Terms of Service", path: "/onpass-useradmin-blueriveracess052026/terms", roles: ["admin"], group: "website" },
  { label: "Legal Pages", path: "/onpass-useradmin-blueriveracess052026/legal", roles: ["admin"], group: "website" },

  // System
  { label: "Settings", path: "/onpass-useradmin-blueriveracess052026/settings", roles: ["admin"], group: "system", permission: "__settings__" },
  { label: "Users", path: "/onpass-useradmin-blueriveracess052026/users", roles: ["admin"], group: "system" },
  { label: "Permissions", path: "/onpass-useradmin-blueriveracess052026/permissions", roles: ["admin"], group: "system" },
  { label: "Account", path: "/onpass-useradmin-blueriveracess052026/account", roles: ["admin", "manager", "staff"], group: "system" },
  { label: "Maintenance", path: "/onpass-useradmin-blueriveracess052026/maintenance", roles: ["admin"], group: "system" },
];

/** Visibility precedence:
 *  1. admin → always allowed
 *  2. Dashboard sentinel → role OR any granular permission
 *  3. item has a `permission` key → that key is authoritative (explicit false hides)
 *  4. otherwise → role-based fallback
 */
const hasAnyManagementPermission = (permissions: PermissionsMap): boolean =>
  Object.values(permissions || {}).some((v) => v === true);

const SETTINGS_FAMILY_KEYS = [
  "can_manage_settings",
  "can_manage_business_rules",
  "can_edit_availability",
  "can_manage_payment",
  "can_edit_pricing",
  "can_manage_socials",
];

const isVisible = (item: NavPermission, role: AppRole, permissions: PermissionsMap): boolean => {
  if (role === "admin") return true;
  if (item.permission === "__dashboard__") {
    return item.roles.includes(role) || hasAnyManagementPermission(permissions);
  }
  if (item.permission === "__settings__") {
    return SETTINGS_FAMILY_KEYS.some((k) => permissions?.[k] === true);
  }
  if (item.permission) return permissions?.[item.permission] === true;
  return item.roles.includes(role);
};

export const canAccessPath = (role: AppRole, path: string, permissions: PermissionsMap = {}): boolean => {
  const item = NAV_PERMISSIONS.find((p) => p.path === path);
  if (!item) return role === "admin";
  return isVisible(item, role, permissions);
};

export const getFilteredNavItems = (role: AppRole, permissions: PermissionsMap = {}) => {
  return NAV_PERMISSIONS.filter((item) => isVisible(item, role, permissions));
};

export const getGroupedNavItems = (role: AppRole, permissions: PermissionsMap = {}) => {
  const items = getFilteredNavItems(role, permissions);
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: items.filter((i) => i.group === g.key),
  })).filter((g) => g.items.length > 0);
};

export const getRoleLabel = (role: AppRole): string => {
  switch (role) {
    case "admin": return "Super Admin";
    case "manager": return "Manager";
    case "staff": return "Staff";
    default: return "User";
  }
};
