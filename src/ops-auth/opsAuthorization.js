export const OPS_VIEW_PERMISSION = "ops.view";
export const OPS_SUPERVISE_PERMISSION = "ops.supervise";

const OPS_WORKSPACE_ROLES = new Set(["rtm.operator", "rtm.supervisor"]);

function hasPermission(operator, permission) {
  return (
    Array.isArray(operator?.permissions) &&
    operator.permissions.includes(permission)
  );
}

export function canAccessOpsWorkspace(operator) {
  return (
    OPS_WORKSPACE_ROLES.has(operator?.roleCode) &&
    hasPermission(operator, OPS_VIEW_PERMISSION)
  );
}

export function canSuperviseOpsWorkspace(operator) {
  return (
    operator?.roleCode === "rtm.supervisor" &&
    canAccessOpsWorkspace(operator) &&
    hasPermission(operator, OPS_SUPERVISE_PERMISSION)
  );
}
