import { permissionApi, roleApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Shield, Users } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { PermissionDTO, RoleDTO } from "@/types";

interface RoleItem {
  id: string;
  name: string;
  roleCode?: string;
  userCount: number;
  isSystem: boolean;
}

interface MatrixPermission {
  module: string;
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  approve: boolean;
}

type PermissionAction = "view" | "create" | "update" | "delete" | "approve";
type MatrixState = Record<string, MatrixPermission[]>;
const EMPTY_ROLES: RoleDTO[] = [];
const EMPTY_PERMISSIONS: PermissionDTO[] = [];

const ACTIONS: Array<{ key: PermissionAction; label: string; backendNames: string[] }> = [
  { key: "view", label: "View", backendNames: ["READ", "VIEW"] },
  { key: "create", label: "Create", backendNames: ["CREATE"] },
  { key: "update", label: "Update", backendNames: ["UPDATE", "EDIT"] },
  { key: "delete", label: "Delete", backendNames: ["DELETE", "REMOVE"] },
  { key: "approve", label: "Approve", backendNames: ["APPROVE"] },
];

const MATRIX_MODULES = ["USER", "ROLE", "TOPIC", "COURSE", "CLASS", "ASSESSMENT"];
const MODULE_LABELS: Record<string, string> = {
  USER: "Users",
  ROLE: "Roles",
  TOPIC: "Topics",
  COURSE: "Courses",
  CLASS: "Classes",
  ASSESSMENT: "Assessments",
};

const ORIGINAL_ROLES: RoleItem[] = [
  { id: "ADMIN", roleCode: "ADMIN", name: "ADMIN", userCount: 1, isSystem: true },
  { id: "TEACHER", roleCode: "TEACHER", name: "TEACHER", userCount: 1, isSystem: true },
  { id: "STUDENT", roleCode: "STUDENT", name: "STUDENT", userCount: 1, isSystem: true },
];

const normalize = (value?: string) => value?.trim().toUpperCase().replace(/^ROLE_/, "") ?? "";

const MATRIX_STATE_STORAGE_KEY = "FAMS_ROLE_MATRIX_STATE";
const CREATED_ROLES_STORAGE_KEY = "FAMS_CREATED_ROLES";

function getPermissionResource(permission: PermissionDTO) {
  if (permission.resource?.trim()) return normalize(permission.resource);
  const name = normalize(permission.name);
  const separator = name.lastIndexOf("_");
  return separator > 0 ? name.slice(0, separator) : name;
}

function getPermissionAction(permission: PermissionDTO): string {
  if (permission.action?.trim()) return normalize(permission.action);
  const name = normalize(permission.name);
  return name.slice(name.lastIndexOf("_") + 1);
}

function getModuleLabel(resource: string) {
  if (MODULE_LABELS[resource]) return MODULE_LABELS[resource];
  return resource
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function createDefaultMatrix(): MatrixPermission[] {
  return MATRIX_MODULES.map((module) => ({
    module,
    view: false,
    create: false,
    update: false,
    delete: false,
    approve: false,
  }));
}

function createRoleMatrix(
  role: RoleDTO | undefined,
  permissions: PermissionDTO[],
): MatrixPermission[] {
  const permissionIds = new Set((role?.permissionIds ?? []).map(String));
  return MATRIX_MODULES.map((module) => {
    const modulePermissions = permissions.filter(
      (permission) => getPermissionResource(permission) === module,
    );
    const values = Object.fromEntries(
      ACTIONS.map(({ key, backendNames }) => [
        key,
        modulePermissions.some(
          (permission) =>
            permission.id !== undefined &&
            permissionIds.has(String(permission.id)) &&
            backendNames.includes(getPermissionAction(permission)),
        ),
      ]),
    ) as Omit<MatrixPermission, "module">;
    return { module, ...values };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMatrixState(value: unknown): value is MatrixState {
  if (!isRecord(value)) return false;
  return Object.values(value).every(
    (rows) =>
      Array.isArray(rows) &&
      rows.every((row: unknown) =>
        isRecord(row) &&
        typeof row.module === "string" &&
        MATRIX_MODULES.includes(row.module) &&
        ACTIONS.every(({ key }) => typeof row[key] === "boolean"),
      ),
  );
}

function isRoleItem(value: unknown): value is RoleItem {
  if (!isRecord(value)) return false;
  const role = value;
  return (
    typeof role.id === "string" &&
    typeof role.name === "string" &&
    typeof role.userCount === "number" &&
    typeof role.isSystem === "boolean" &&
    (role.roleCode === undefined || typeof role.roleCode === "string")
  );
}

function readStoredValue<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return fallback;
    const parsed: unknown = JSON.parse(stored);
    if (isValid(parsed)) return parsed;
    console.error(`Invalid localStorage data for ${key}.`);
  } catch (error) {
    console.error(`Could not read localStorage data for ${key}.`, error);
  }
  return fallback;
}

async function fetchRoles(): Promise<RoleDTO[]> {
  const response = await roleApi.getPage({ page: 0, size: 200, sort: "name,asc" });
  return response.content ?? response.items ?? [];
}

async function fetchPermissions(): Promise<PermissionDTO[]> {
  const response = await permissionApi.getPage({ page: 0, size: 500, sort: "resource,asc" });
  return response.content ?? response.items ?? [];
}

const toRoleItem = (role: RoleDTO): RoleItem | null => {
  if (role.id === undefined) return null;
  return {
    id: String(role.id),
    name: role.name ?? `Role #${role.id}`,
    roleCode: role.name,
    userCount: role.userCount ?? 1,
    isSystem: role.isSystem ?? false,
  };
};

export default function RolePermissionMatrixPage() {
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [matrixState, setMatrixState] = useState<MatrixState>(() =>
    readStoredValue(MATRIX_STATE_STORAGE_KEY, {}, isMatrixState),
  );
  const [createdRoles, setCreatedRoles] = useState<RoleItem[]>(() =>
    readStoredValue(CREATED_ROLES_STORAGE_KEY, [], (value): value is RoleItem[] =>
      Array.isArray(value) && value.every(isRoleItem),
    ),
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleCode, setNewRoleCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const rolesQuery = useQuery({ queryKey: ["role", "matrix"], queryFn: fetchRoles });
  const permissionsQuery = useQuery({
    queryKey: ["permission", "matrix"],
    queryFn: fetchPermissions,
  });
  const roles = useMemo(() => {
    const fetchedRoles = (rolesQuery.data ?? EMPTY_ROLES)
      .map(toRoleItem)
      .filter((role): role is RoleItem => role !== null);
    const preservedRoles = ORIGINAL_ROLES.map((originalRole) => {
      const fetchedRole = fetchedRoles.find(
        (role) => normalize(role.name) === originalRole.roleCode,
      );
      return fetchedRole
        ? {
            ...originalRole,
            id: fetchedRole.id,
            userCount: fetchedRole.userCount,
            isSystem: true,
          }
        : originalRole;
    });
    const preservedRoleIds = new Set(preservedRoles.map((role) => role.id));
    const remainingRoles = fetchedRoles.filter((role) => !preservedRoleIds.has(role.id));
    return [...preservedRoles, ...remainingRoles, ...createdRoles];
  }, [createdRoles, rolesQuery.data]);
  const permissions = permissionsQuery.data ?? EMPTY_PERMISSIONS;
  const selectedRole =
    roles.find((role) => role.id === selectedRoleId) ??
    roles[0];
  const selectedRoleDTO = (rolesQuery.data ?? []).find(
    (role) => String(role.id) === selectedRole?.id,
  );
  useEffect(() => {
    try {
      window.localStorage.setItem(MATRIX_STATE_STORAGE_KEY, JSON.stringify(matrixState));
      window.localStorage.setItem(CREATED_ROLES_STORAGE_KEY, JSON.stringify(createdRoles));
    } catch (error) {
      console.error("Could not save role matrix data to localStorage.", error);
      toast.error("Không thể lưu dữ liệu ma trận vào bộ nhớ trình duyệt.");
    }
  }, [createdRoles, matrixState]);
  const selectedMatrix = useMemo(
    () =>
      selectedRole
        ? matrixState[selectedRole.id] ??
          (selectedRoleDTO
            ? createRoleMatrix(selectedRoleDTO, permissions)
            : createDefaultMatrix())
        : [],
    [matrixState, permissions, selectedRole, selectedRoleDTO],
  );

  const modules = useMemo(() => {
    const groups = new Map<string, PermissionDTO[]>();
    for (const permission of permissions) {
      const resource = getPermissionResource(permission);
      if (!resource) continue;
      const group = groups.get(resource) ?? [];
      group.push(permission);
      groups.set(resource, group);
    }

    return [...groups.entries()]
      .filter(([resource]) => MATRIX_MODULES.includes(resource))
      .map(([resource, modulePermissions]) => {
        return {
          resource,
          module: getModuleLabel(resource),
          permissions: modulePermissions,
        };
      })
      .sort(
        (a, b) =>
          MATRIX_MODULES.indexOf(a.resource) - MATRIX_MODULES.indexOf(b.resource),
      );
  }, [permissions]);

  const togglePermission = (
    module: string,
    action: PermissionAction,
    checked: boolean,
  ) => {
    if (!selectedRole) return;
    setMatrixState((current) => {
      const roleMatrix =
        current[selectedRole.id] ??
        (selectedRoleDTO
          ? createRoleMatrix(selectedRoleDTO, permissions)
          : createDefaultMatrix());
      return {
        ...current,
        [selectedRole.id]: roleMatrix.map((row) =>
          row.module === module ? { ...row, [action]: checked } : row,
        ),
      };
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    const configuration = matrixState[selectedRole.id] ?? selectedMatrix;
    setIsSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    setMatrixState((current) => ({ ...current, [selectedRole.id]: configuration }));
    setIsSaving(false);
    toast.success(
      `Đã lưu thay đổi ma trận phân quyền cho vai trò ${selectedRole.name}!`,
    );
  };

  const handleCreateRole = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const roleName = newRoleName.trim();
    const roleCode = newRoleCode.trim();
    if (!roleCode) {
      toast.error("Vui lòng nhập mã vai trò.");
      return;
    }

    const normalizedCode = normalize(roleCode);
    const codeAlreadyExists = roles.some(
      (role) => normalize(role.roleCode ?? role.name) === normalizedCode,
    );
    if (codeAlreadyExists) {
      toast.error("Mã vai trò đã tồn tại.");
      return;
    }

    const roleId = `local-${normalizedCode.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}-${Date.now()}`;
    const newRole: RoleItem = {
      id: roleId,
      roleCode,
      name: roleName || roleCode,
      userCount: 0,
      isSystem: false,
    };
    setCreatedRoles((current) => [...current, newRole]);
    setMatrixState((current) => ({
      ...current,
      [roleId]: createDefaultMatrix(),
    }));
    setSelectedRoleId(roleId);
    setNewRoleName("");
    setNewRoleCode("");
    setIsCreateModalOpen(false);
    toast.success("Tạo vai trò mới thành công!");
  };

  const handleDeleteRole = async (roleId: string) => {
    const role = roles.find((item) => item.id === roleId);
    if (!role) {
      toast.error("Không tìm thấy vai trò cần xóa.");
      return;
    }

    const roleCode = normalize(role.roleCode ?? role.name);
    const isOriginalRole =
      ["ADMIN", "TEACHER", "STUDENT"].includes(roleCode) ||
      ORIGINAL_ROLES.some((originalRole) => originalRole.id === roleId);
    if (role.isSystem || isOriginalRole) {
      toast.error("Không thể xóa vai trò hệ thống.");
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa vai trò ${role.name} không?`)) return;

    const isCreatedRole = createdRoles.some((createdRole) => createdRole.id === roleId);
    try {
      if (!isCreatedRole) {
        await roleApi.delete(roleId);
      }

      setCreatedRoles((current) =>
        current.filter((createdRole) => createdRole.id !== roleId),
      );
      setMatrixState((current) => {
        const next = { ...current };
        delete next[roleId];
        return next;
      });
      if (selectedRoleId === roleId) {
        const adminRole = roles.find((item) => normalize(item.roleCode ?? item.name) === "ADMIN");
        setSelectedRoleId(adminRole?.id ?? ORIGINAL_ROLES[0].id);
      }
      if (!isCreatedRole) {
        await queryClient.invalidateQueries({ queryKey: ["role"] });
      }
      toast.success("Đã xóa vai trò thành công!");
    } catch (error) {
      console.error("Could not delete role.", error);
      toast.error("Không thể xóa vai trò. Vui lòng thử lại.");
    }
  };

  const roleFetchError = rolesQuery.isError;
  const dataFetchError = permissionsQuery.isError;

  return (
    <MainLayout
      pathName={{
        fams: "FAMS & LMS",
        system: "System",
        "role-permission-matrix": "Role & Permission Matrix",
      }}
    >
      <section className="mx-auto w-full max-w-[1500px] space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <nav aria-label="Breadcrumb" className="mb-3 text-sm text-slate-500">
              <ol className="flex flex-wrap items-center gap-2">
                <li>FAMS &amp; LMS</li>
                <li aria-hidden="true">/</li>
                <li>System</li>
                <li aria-hidden="true">/</li>
                <li className="font-medium text-slate-700">Role &amp; Permission Matrix</li>
              </ol>
            </nav>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Role &amp; Permission Matrix
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý dữ liệu và quy trình theo quyền được cấp
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              onClick={() => setIsCreateModalOpen(true)}
            >
              + Tạo role
            </Button>
            <Button
              type="button"
              className="bg-orange-600 text-white hover:bg-orange-700"
              onClick={handleSavePermissions}
              disabled={!selectedRole || isSaving || rolesQuery.isLoading}
            >
              {isSaving && <LoaderCircle className="size-4 animate-spin" />}
              Lưu quyền
            </Button>
          </div>
        </header>

        {(roleFetchError || dataFetchError) && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Không thể tải đầy đủ roles hoặc permissions. Vui lòng thử tải lại trang.
            <Button
              variant="outline"
              className="ml-3 border-red-300 bg-white"
              onClick={() => {
                void rolesQuery.refetch();
                void permissionsQuery.refetch();
              }}
            >
              Tải lại
            </Button>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-12">
          <Card className="border-slate-200 shadow-sm lg:col-span-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-900">Roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rolesQuery.isLoading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
                  <LoaderCircle className="size-4 animate-spin" />
                  Đang tải danh sách role...
                </div>
              ) : roles.length === 0 ? (
                <p className="py-6 text-sm text-slate-500">Chưa có role trong hệ thống.</p>
              ) : (
                roles.map((role) => {
                  const isSelected = role.id === selectedRole?.id;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? "border-orange-200 bg-orange-50 font-semibold text-orange-600"
                          : "border-transparent text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Shield
                          className={`size-4 shrink-0 ${isSelected ? "text-orange-600" : "text-slate-400"}`}
                          aria-hidden="true"
                        />
                        <span className="truncate text-sm">{role.name}</span>
                      </span>
                      <span
                        className={`flex shrink-0 items-center gap-1 text-xs ${
                          isSelected ? "text-orange-600" : "text-slate-500"
                        }`}
                      >
                        <Users className="size-3.5" aria-hidden="true" />
                        {role.userCount} users
                      </span>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden border-slate-200 shadow-sm lg:col-span-8">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-slate-100">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  {selectedRole
                    ? `${selectedRole.name} permissions`
                    : "Permissions"}
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Chọn quyền cần cấp cho role này.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 hover:bg-slate-100">
                  {selectedRole?.isSystem ? "System role" : "Custom role"}
                </Badge>
                {selectedRole &&
                  !selectedRole.isSystem &&
                  !["ADMIN", "TEACHER", "STUDENT"].includes(
                    normalize(selectedRole.roleCode ?? selectedRole.name),
                  ) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => void handleDeleteRole(selectedRole.id)}
                    >
                      Xóa vai trò
                    </Button>
                  )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {permissionsQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <LoaderCircle className="size-4 animate-spin" />
                  Đang tải permissions...
                </div>
              ) : modules.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-slate-500">
                  Không tìm thấy permissions trong hệ thống.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[690px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Module</th>
                        {ACTIONS.map((action) => (
                          <th key={action.key} className="px-3 py-3 text-center">
                            {action.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modules.map((module) => (
                        <tr key={module.resource} className="hover:bg-slate-50/70">
                          <th scope="row" className="px-5 py-3.5 font-medium text-slate-800">
                            {module.module}
                          </th>
                          {ACTIONS.map((action) => {
                            const matrixPermission = selectedMatrix.find(
                              (row) => row.module === module.resource,
                            );
                            return (
                              <td key={action.key} className="px-3 py-3.5 text-center">
                                <Checkbox
                                  aria-label={`${module.module} ${action.label}`}
                                  checked={matrixPermission?.[action.key] ?? false}
                                  disabled={
                                    !module.permissions.some((candidate) =>
                                      action.backendNames.includes(getPermissionAction(candidate)),
                                    ) ||
                                    !selectedRole ||
                                    isSaving
                                  }
                                  onCheckedChange={(checked) =>
                                    togglePermission(module.resource, action.key, checked === true)
                                  }
                                  className="border-slate-300 data-[state=checked]:border-orange-600 data-[state=checked]:bg-orange-600 data-[state=checked]:text-white"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          setIsCreateModalOpen(open);
          if (!open) {
            setNewRoleName("");
            setNewRoleCode("");
          }
        }}
      >
        <DialogContent>
          <form onSubmit={handleCreateRole} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Tạo vai trò mới</DialogTitle>
              <DialogDescription>
                Nhập tên và mã để thêm vai trò vào ma trận phân quyền.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-role-name">Tên vai trò</Label>
                <Input
                  id="new-role-name"
                  value={newRoleName}
                  onChange={(event) => setNewRoleName(event.target.value)}
                  placeholder="QTV Phòng Đào tạo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role-code">Mã vai trò *</Label>
                <Input
                  id="new-role-code"
                  value={newRoleCode}
                  onChange={(event) => setNewRoleCode(event.target.value)}
                  placeholder="TRAINING_ADMIN"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Hủy
              </Button>
              <Button type="submit" className="bg-orange-600 text-white hover:bg-orange-700">
                Tạo vai trò
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
