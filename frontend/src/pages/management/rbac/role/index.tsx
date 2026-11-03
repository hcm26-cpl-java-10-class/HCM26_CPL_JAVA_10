import { roleApi } from "@/api";
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
import { Textarea } from "@/components/ui/textarea";
import type { EntityConfig, EntitySchema } from "@/types";
import { Download, Shield, Trash2, Upload, Users } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { toast } from "sonner";

interface RoleItem {
  id: string;
  name: string;
  userCount: number;
  isSystem: boolean;
  roleCode?: string;
  description?: string;
}

interface RoleFormData {
  roleCode: string;
  displayName: string;
  description: string;
  includeDefaultPermissions: boolean;
}

type PermissionKey = "view" | "create" | "update" | "delete" | "approve";

interface PermissionRow {
  module: string;
  permissions: Record<PermissionKey, boolean>;
}

interface PermissionMap {
  [roleId: string]: PermissionRow[];
}

interface RolePermissionExportRow {
  RoleCode: string;
  RoleName: string;
  Description: string;
  UserCount: number;
  IsSystem: boolean;
  Module: string;
  View: boolean;
  Create: boolean;
  Update: boolean;
  Delete: boolean;
  Approve: boolean;
}

interface ImportedRolePermissionRow {
  RoleCode: unknown;
  RoleName: unknown;
  Description: unknown;
  UserCount: unknown;
  IsSystem: unknown;
  Module: unknown;
  View: unknown;
  Create: unknown;
  Update: unknown;
  Delete: unknown;
  Approve: unknown;
}

const IMPORT_COLUMNS = [
  "RoleCode",
  "RoleName",
  "Description",
  "UserCount",
  "IsSystem",
  "Module",
  "View",
  "Create",
  "Update",
  "Delete",
  "Approve",
] as const;
const MAX_IMPORT_SIZE = 5 * 1024 * 1024;

function isSupportedImportFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension === "xlsx" || extension === "csv";
}

function parseImportBoolean(value: unknown, column: string): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === 0) return value === 1;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n", ""].includes(normalized)) return false;
  throw new Error(`Giá trị ${column} không hợp lệ: ${String(value)}`);
}

function parseImportRows(rows: ImportedRolePermissionRow[]): {
  roles: RoleItem[];
  permissionMatrix: PermissionMap;
} {
  const roleMap = new Map<string, RoleItem>();
  const permissionMap = new Map<string, Map<string, Record<PermissionKey, boolean>>>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const roleCode = String(row.RoleCode ?? "").trim();
    const roleName = String(row.RoleName ?? "").trim();
    const module = String(row.Module ?? "").trim();
    if (!roleCode || !roleName || !module) {
      throw new Error(`Dòng ${rowNumber}: RoleCode, RoleName và Module là bắt buộc.`);
    }

    const moduleName = moduleList.find(
      (item) => item.toLowerCase() === module.toLowerCase(),
    );
    if (!moduleName) {
      throw new Error(`Dòng ${rowNumber}: module "${module}" không được hỗ trợ.`);
    }

    const id = `import-${roleCode.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}`;
    const currentRole = roleMap.get(id);
    const userCount = Number(row.UserCount ?? currentRole?.userCount ?? 0);
    if (!Number.isInteger(userCount) || userCount < 0) {
      throw new Error(`Dòng ${rowNumber}: UserCount phải là số nguyên không âm.`);
    }

    if (
      currentRole &&
      (currentRole.name !== roleName || currentRole.roleCode !== roleCode)
    ) {
      throw new Error(`Dòng ${rowNumber}: thông tin role không nhất quán cho ${roleCode}.`);
    }

    roleMap.set(id, {
      id,
      roleCode,
      name: roleName,
      description: String(row.Description ?? currentRole?.description ?? ""),
      userCount,
      isSystem: parseImportBoolean(row.IsSystem, "IsSystem"),
    });

    const roleModules = permissionMap.get(id) ?? new Map();
    if (roleModules.has(moduleName)) {
      throw new Error(`Dòng ${rowNumber}: module ${moduleName} bị trùng cho ${roleCode}.`);
    }
    roleModules.set(moduleName, {
      view: parseImportBoolean(row.View, "View"),
      create: parseImportBoolean(row.Create, "Create"),
      update: parseImportBoolean(row.Update, "Update"),
      delete: parseImportBoolean(row.Delete, "Delete"),
      approve: parseImportBoolean(row.Approve, "Approve"),
    });
    permissionMap.set(id, roleModules);
  });

  if (roleMap.size === 0) {
    throw new Error("File không có dòng dữ liệu để nhập.");
  }

  const permissionMatrix: PermissionMap = {};
  for (const [roleId, roleModules] of permissionMap) {
    permissionMatrix[roleId] = moduleList.map((module) => ({
      module,
      permissions: roleModules.get(module) ?? {
        view: false,
        create: false,
        update: false,
        delete: false,
        approve: false,
      },
    }));
  }

  return { roles: [...roleMap.values()], permissionMatrix };
}

const roleSchema: EntitySchema = {
  entityName: "role",
  idField: "id",
  fields: [
    { name: "name", label: "Role Name", type: "text", sortable: true },
    { name: "description", label: "Description", type: "textarea", sortable: true },
    { name: "isActive", label: "Status", type: "boolean", sortable: true },
  ],
};

// This export is consumed by the dynamic entity-route registry.
// eslint-disable-next-line react-refresh/only-export-components
export const entityConfig: EntityConfig = {
  name: "Role",
  path: "/roles",
  api: roleApi,
  schema: roleSchema,
};

const initialRoles: RoleItem[] = [
  { id: "ADMIN", roleCode: "ADMIN", name: "ADMIN", userCount: 1, isSystem: true },
  { id: "TEACHER", roleCode: "TEACHER", name: "TEACHER", userCount: 1, isSystem: false },
  { id: "STUDENT", roleCode: "STUDENT", name: "STUDENT", userCount: 1, isSystem: false },
];

const moduleList = [
  "Users",
  "Roles",
  "Topics",
  "Courses",
  "Classes",
  "Assessments",
] as const;

const permissionKeyMap: PermissionKey[] = ["view", "create", "update", "delete", "approve"];

const basePermissionMatrix: PermissionMap = {
  ADMIN: moduleList.map((module) => ({
    module,
    permissions: {
      view: true,
      create: true,
      update: true,
      delete: true,
      approve: true,
    },
  })),
  TEACHER: [
    { module: "Users", permissions: { view: true, create: false, update: false, delete: false, approve: false } },
    { module: "Roles", permissions: { view: false, create: false, update: false, delete: false, approve: false } },
    { module: "Topics", permissions: { view: true, create: true, update: true, delete: false, approve: false } },
    { module: "Courses", permissions: { view: true, create: true, update: true, delete: false, approve: false } },
    { module: "Classes", permissions: { view: true, create: true, update: true, delete: false, approve: false } },
    { module: "Assessments", permissions: { view: true, create: true, update: true, delete: false, approve: true } },
  ],
  STUDENT: [
    { module: "Users", permissions: { view: true, create: false, update: false, delete: false, approve: false } },
    { module: "Roles", permissions: { view: false, create: false, update: false, delete: false, approve: false } },
    { module: "Topics", permissions: { view: true, create: false, update: false, delete: false, approve: false } },
    { module: "Courses", permissions: { view: true, create: false, update: false, delete: false, approve: false } },
    { module: "Classes", permissions: { view: true, create: false, update: false, delete: false, approve: false } },
    { module: "Assessments", permissions: { view: true, create: false, update: false, delete: false, approve: false } },
  ],
};

export default function RolePermissionMatrixPage() {
  const [selectedRoleId, setSelectedRoleId] = useState("ADMIN");
  const [roles, setRoles] = useState<RoleItem[]>(initialRoles);
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMap>(basePermissionMatrix);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState<RoleFormData>({
    roleCode: "",
    displayName: "",
    description: "",
    includeDefaultPermissions: false,
  });
  const [formError, setFormError] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];

  const selectedRoleRows = permissionMatrix[selectedRole.id] ?? [];

  const setPermission = (moduleName: string, permissionKey: PermissionKey, checked: boolean) => {
    setPermissionMatrix((current) => {
      const currentRows = current[selectedRole.id] ?? [];
      const nextRows = currentRows.map((row) => {
        if (row.module !== moduleName) return row;
        return {
          ...row,
          permissions: {
            ...row.permissions,
            [permissionKey]: checked,
          },
        };
      });

      return {
        ...current,
        [selectedRole.id]: nextRows,
      };
    });
  };

  const getPermissionIds = () => {
    const activePermissionIds = selectedRoleRows.flatMap((row) =>
      permissionKeyMap.filter((key) => row.permissions[key]).map((key) => `${row.module}_${key}`),
    );

    return activePermissionIds;
  };

  const handleSave = () => {
    const permissionIds = getPermissionIds();
    console.info("Saved permission IDs:", permissionIds);
  };

  const resetCreateForm = () => {
    setFormData({
      roleCode: "",
      displayName: "",
      description: "",
      includeDefaultPermissions: false,
    });
    setFormError("");
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    resetCreateForm();
  };

  const handleCreateRole = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const roleCode = formData.roleCode.trim();
    const displayName = formData.displayName.trim();
    if (!roleCode || !displayName) {
      setFormError("Vui lòng nhập Mã vai trò và Tên vai trò.");
      return;
    }
    if (
      roles.some(
        (role) => role.roleCode?.toLowerCase() === roleCode.toLowerCase(),
      )
    ) {
      setFormError("Mã vai trò này đã tồn tại.");
      return;
    }

    const newRoleId = `role-${crypto.randomUUID()}`;
    const newRole: RoleItem = {
      id: newRoleId,
      roleCode,
      name: displayName,
      description: formData.description.trim(),
      userCount: 0,
      isSystem: false,
    };

    setRoles((current) => [...current, newRole]);
    setPermissionMatrix((current) => ({
      ...current,
      [newRoleId]: moduleList.map((module) => ({
        module,
        permissions: {
          view: formData.includeDefaultPermissions,
          create: false,
          update: false,
          delete: false,
          approve: false,
        },
      })),
    }));
    setSelectedRoleId(newRoleId);
    closeCreateModal();
    toast.success("Tạo vai trò thành công!");
  };

  const getExportRows = (): RolePermissionExportRow[] =>
    roles.flatMap((role) => {
      const permissionsByModule = new Map(
        (permissionMatrix[role.id] ?? []).map((row) => [row.module, row.permissions]),
      );
      return moduleList.map((module) => {
        const permissions = permissionsByModule.get(module);
        return {
          RoleCode: role.roleCode ?? role.id,
          RoleName: role.name,
          Description: role.description ?? "",
          UserCount: role.userCount,
          IsSystem: role.isSystem,
          Module: module,
          View: permissions?.view ?? false,
          Create: permissions?.create ?? false,
          Update: permissions?.update ?? false,
          Delete: permissions?.delete ?? false,
          Approve: permissions?.approve ?? false,
        };
      });
    });

  const handleExportRoles = async () => {
    try {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(getExportRows(), {
        header: [...IMPORT_COLUMNS],
      });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Role Permissions");
      const date = new Date();
      const dateStamp = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("");
      XLSX.writeFile(workbook, `FAMS_Role_Permissions_Matrix_${dateStamp}.xlsx`);
      toast.success("Xuất dữ liệu ma trận phân quyền thành công!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xuất dữ liệu.");
    }
  };

  const downloadImportTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.aoa_to_sheet([[...IMPORT_COLUMNS]]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Role Permissions");
      XLSX.writeFile(workbook, "FAMS_Role_Permissions_Template.xlsx");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải file mẫu.");
    }
  };

  const updateImportFile = (file: File | undefined) => {
    setImportError("");
    if (!file) {
      setImportFile(null);
      return;
    }
    if (!isSupportedImportFile(file)) {
      setImportFile(null);
      setImportError("Chỉ hỗ trợ file .xlsx hoặc .csv.");
      return;
    }
    if (file.size > MAX_IMPORT_SIZE) {
      setImportFile(null);
      setImportError("Dung lượng file tối đa là 5MB.");
      return;
    }
    setImportFile(file);
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateImportFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateImportFile(event.dataTransfer.files[0]);
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportFile(null);
    setImportError("");
    setIsImporting(false);
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      setImportError("Vui lòng chọn file cần nhập.");
      return;
    }
    if (!isSupportedImportFile(importFile) || importFile.size > MAX_IMPORT_SIZE) {
      setImportError("File không hợp lệ. Chỉ nhận .xlsx hoặc .csv tối đa 5MB.");
      return;
    }

    setIsImporting(true);
    setImportError("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await importFile.arrayBuffer(), { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("File không có worksheet dữ liệu.");
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<ImportedRolePermissionRow>(worksheet, {
        defval: "",
      });
      const headerRow = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        blankrows: false,
      })[0];
      const normalizedHeaders = (headerRow ?? []).map((header) => String(header).trim());
      const missingHeaders = IMPORT_COLUMNS.filter(
        (header) => !normalizedHeaders.includes(header),
      );
      if (missingHeaders.length > 0) {
        throw new Error(`Thiếu cột bắt buộc: ${missingHeaders.join(", ")}.`);
      }

      const imported = parseImportRows(rows);
      setRoles(imported.roles);
      setPermissionMatrix(imported.permissionMatrix);
      setSelectedRoleId(imported.roles[0].id);
      closeImportModal();
      toast.success("Nhập ma trận phân quyền thành công!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể đọc file nhập.";
      setImportError(message);
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

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

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              onClick={() => void handleExportRoles()}
            >
              <Download className="size-4" aria-hidden="true" />
              Xuất file
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-orange-600 bg-white text-orange-600 hover:bg-orange-50"
              onClick={() => setIsImportModalOpen(true)}
            >
              <Upload className="size-4" aria-hidden="true" />
              Nhập file
            </Button>
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
              onClick={handleSave}
            >
              Lưu quyền
            </Button>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-12">
          <Card className="border-slate-200 shadow-sm lg:col-span-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-900">Roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {roles.map((role) => {
                const isSelected = role.id === selectedRole.id;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-orange-200 bg-orange-50/10 text-orange-600"
                        : "border-transparent text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Shield className={`size-4 shrink-0 ${isSelected ? "text-orange-600" : "text-slate-400"}`} />
                      <span className={`truncate text-sm font-medium ${isSelected ? "font-semibold text-orange-600" : "text-slate-700"}`}>
                        {role.name}
                      </span>
                    </span>

                    <span className={`flex shrink-0 items-center gap-1 text-xs ${isSelected ? "text-orange-600" : "text-slate-500"}`}>
                      <Users className="size-3.5" />
                      {role.userCount} {role.userCount === 1 ? "user" : "users"}
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden border-slate-200 shadow-sm lg:col-span-8">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-slate-100">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  {selectedRole.name} permissions
                </CardTitle>
              </div>
              <Badge className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 hover:bg-slate-100">
                System role
              </Badge>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Module</th>
                      <th className="px-3 py-3 text-center">View</th>
                      <th className="px-3 py-3 text-center">Create</th>
                      <th className="px-3 py-3 text-center">Update</th>
                      <th className="px-3 py-3 text-center">Delete</th>
                      <th className="px-3 py-3 text-center">Approve</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {selectedRoleRows.map((row) => (
                      <tr key={row.module} className="hover:bg-slate-50/70">
                        <th scope="row" className="px-5 py-3.5 font-medium text-slate-800">
                          {row.module}
                        </th>
                        {permissionKeyMap.map((permissionKey) => (
                          <td key={`${row.module}-${permissionKey}`} className="px-3 py-3.5 text-center">
                            <Checkbox
                              checked={row.permissions[permissionKey]}
                              onCheckedChange={(checked) =>
                                setPermission(row.module, permissionKey, checked === true)
                              }
                              className="border-slate-300 data-[state=checked]:border-orange-600 data-[state=checked]:bg-orange-600 data-[state=checked]:text-white"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          if (open) setIsCreateModalOpen(true);
          else closeCreateModal();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo vai trò mới</DialogTitle>
            <DialogDescription>
              Nhập mã, tên hiển thị và mô tả cho vai trò mới.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRole} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-code">Mã vai trò / Role Code *</Label>
              <Input
                id="role-code"
                value={formData.roleCode}
                onChange={(event) => {
                  setFormData((current) => ({ ...current, roleCode: event.target.value }));
                  setFormError("");
                }}
                placeholder="ACADEMIC_OFFICER"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-display-name">Tên vai trò / Display Name *</Label>
              <Input
                id="role-display-name"
                value={formData.displayName}
                onChange={(event) => {
                  setFormData((current) => ({ ...current, displayName: event.target.value }));
                  setFormError("");
                }}
                placeholder="Cán bộ Đào tạo"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Mô tả / Description</Label>
              <Textarea
                id="role-description"
                value={formData.description}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Mô tả nhiệm vụ của vai trò"
                rows={4}
              />
            </div>
            <label
              htmlFor="default-permission-group"
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3"
            >
              <Checkbox
                id="default-permission-group"
                checked={formData.includeDefaultPermissions}
                onCheckedChange={(checked) =>
                  setFormData((current) => ({
                    ...current,
                    includeDefaultPermissions: checked === true,
                  }))
                }
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-slate-800">
                  Cấp nhanh nhóm quyền mặc định
                </span>
                <span className="block text-xs text-slate-500">
                  Cho phép xem tất cả module; các quyền khác vẫn để tắt.
                </span>
              </span>
            </label>
            {formError && (
              <p role="alert" className="text-sm text-red-600">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeCreateModal}>
                Hủy
              </Button>
              <Button
                type="submit"
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                Tạo mới
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isImportModalOpen}
        onOpenChange={(open) => {
          if (open) setIsImportModalOpen(true);
          else closeImportModal();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="flex flex-wrap items-start justify-between gap-3 pr-7">
              <div className="space-y-2">
                <DialogTitle>Nhập ma trận phân quyền từ File</DialogTitle>
                <DialogDescription>
                  Tải lên file CSV hoặc Excel có cấu trúc Role–Module–Permission.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => void downloadImportTemplate()}
              >
                Tải file mẫu (.xlsx)
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="sr-only"
              onChange={handleFileInputChange}
              aria-label="Chọn file ma trận phân quyền"
            />
            <div
              role="button"
              tabIndex={0}
              aria-label="Kéo thả hoặc chọn file .xlsx hoặc .csv, tối đa 5MB"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleFileDrop}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-orange-400 hover:bg-orange-50/40"
            >
              <Upload className="mb-3 size-8 text-orange-600" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-800">
                Kéo thả file vào đây hoặc nhấn để chọn
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Hỗ trợ .xlsx, .csv · Tối đa 5MB
              </p>
            </div>
            {importFile && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Upload className="size-4 shrink-0 text-orange-600" aria-hidden="true" />
                  <span className="truncate text-sm font-medium text-slate-700">
                    {importFile.name}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {(importFile.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Xóa file đã chọn"
                  onClick={() => updateImportFile(undefined)}
                >
                  <Trash2 className="size-4 text-slate-500" aria-hidden="true" />
                </Button>
              </div>
            )}
            {importError && (
              <p role="alert" className="text-sm text-red-600">
                {importError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeImportModal}
              disabled={isImporting}
            >
              Hủy
            </Button>
            <Button
              type="button"
              className="bg-orange-600 text-white hover:bg-orange-700"
              onClick={() => void handleImportSubmit()}
              disabled={isImporting}
            >
              {isImporting ? "Đang tải lên..." : "Tải lên & Cập nhật"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
