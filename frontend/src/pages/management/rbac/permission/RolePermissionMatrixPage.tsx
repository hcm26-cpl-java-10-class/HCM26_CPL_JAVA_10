import { permissionApi, roleApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import type { RoleDTO, RolePermissionMatrixItem } from "@/types/features/rbac/role";
import type { Pagination } from "@/types";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const pagination: Pagination = { page: 0, size: 500, sort: ["name,asc"] };
const actions = [
  { key: "READ", label: "View" },
  { key: "CREATE", label: "Create" },
  { key: "UPDATE", label: "Update" },
  { key: "DELETE", label: "Delete" },
  { key: "APPROVE", label: "Approve" },
];

export default function RolePermissionMatrixPage() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [roleId, setRoleId] = useState<string>("");
  const [permissions, setPermissions] = useState<RolePermissionMatrixItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      roleApi.getPage(pagination),
      permissionApi.getMatrix(),
    ]).then(([rolePage, matrix]) => {
      if (cancelled) return;
      const roleRows = rolePage.content ?? rolePage.items ?? [];
      setRoles(roleRows);
      setPermissions(matrix);
      if (roleRows.length) setRoleId(String(roleRows[0].id));
    }).catch((error) => {
      if (!cancelled) toast.error(error?.response?.data?.message ?? "Unable to load roles and permissions");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!roleId) {
      setSelected(new Set());
      return;
    }
    let cancelled = false;
    roleApi.getPermissionIds(roleId).then((ids) => {
      if (!cancelled) setSelected(new Set(ids.map(Number)));
    }).catch((error) => {
      if (!cancelled) toast.error(error?.response?.data?.message ?? "Unable to load role permissions");
    });
    return () => { cancelled = true; };
  }, [roleId]);

  const modules = useMemo(() => {
    const grouped = new Map<string, RolePermissionMatrixItem[]>();
    permissions.forEach((permission) => {
      const resource = permission.resource || "OTHER";
      grouped.set(resource, [...(grouped.get(resource) ?? []), permission]);
    });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const toggle = (permissionId: number, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(permissionId);
      else next.delete(permissionId);
      return next;
    });
  };

  const save = async () => {
    if (!roleId) return;
    setSaving(true);
    try {
      await roleApi.updatePermissions(roleId, [...selected]);
      toast.success("Permissions saved");
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Unable to save permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout pathName={{ "role-permissions": "Role Permission Matrix" }}>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Role Permission Matrix</h1>
            <p className="text-sm text-muted-foreground">Select a role, configure permissions by module, then save.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/permissions")}>Manage permissions</Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="matrix-role" className="text-sm font-medium">Role</label>
          <select id="matrix-role" className="h-10 min-w-56 rounded-md border bg-background px-3 text-sm"
            value={roleId} onChange={(event) => setRoleId(event.target.value)} disabled={loading}>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          <Button onClick={save} disabled={!roleId || loading || saving}>{saving ? "Saving..." : "Save permissions"}</Button>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/60">
                  <th className="p-3 text-left">Module</th>
                  {actions.map((action) => <th key={action.key} className="p-3 text-center">{action.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {modules.map(([resource, resourcePermissions]) => (
                  <tr key={resource} className="border-t">
                    <td className="p-3 font-medium">{resource}</td>
                    {actions.map((action) => {
                      const permission = resourcePermissions.find((item) => item.action.toUpperCase() === action.key);
                      return <td key={action.key} className="p-3 text-center">
                        {permission ? (
                          <input
                            aria-label={`${resource} ${action.label}`}
                            type="checkbox"
                            checked={selected.has(Number(permission.id))}
                            onChange={(event) => toggle(Number(permission.id), event.target.checked)}
                            className="size-4 accent-primary"
                          />
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>;
                    })}
                  </tr>
                ))}
                {!modules.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No permissions found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
