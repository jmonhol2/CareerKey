export const APP_ROLES = ["student", "company", "admin"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_PERMISSIONS = [
  "dashboard.view",
  "student.portal",
  "company.portal",
  "admin.portal",
  "companies.read",
  "companies.manage.own",
  "companies.manage.all",
  "events.read",
  "events.manage",
  "positions.manage.own",
  "positions.manage.all",
  "slots.manage.own",
  "slots.manage.all",
  "appointments.manage.own",
  "appointments.read.company",
  "appointments.manage.all",
  "roles.manage",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AppRole, readonly AppPermission[]> = {
  student: [
    "dashboard.view",
    "student.portal",
    "companies.read",
    "events.read",
    "appointments.manage.own",
  ],
  company: [
    "dashboard.view",
    "company.portal",
    "companies.read",
    "events.read",
    "companies.manage.own",
    "positions.manage.own",
    "slots.manage.own",
    "appointments.read.company",
  ],
  admin: APP_PERMISSIONS,
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

export function hasPermission(
  role: AppRole | null | undefined,
  permission: AppPermission
) {
  return role ? ROLE_PERMISSIONS[role].includes(permission) : false;
}

export function defaultRouteForRole(role: AppRole | null | undefined) {
  if (role === "admin") return "/admin";
  if (role === "company") return "/company";
  if (role === "student") return "/home";
  return "/auth";
}
