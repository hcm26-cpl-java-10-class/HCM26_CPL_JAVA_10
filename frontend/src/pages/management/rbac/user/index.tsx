/* eslint-disable react-refresh/only-export-components */
import { departmentApi, roleApi, userApi } from "@/api";
import {
  auditableFieldsSchema,
  GENDER_OPTIONS,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
  type UserAccountStatus,
  type UserDTO,
  type UserRole,
} from "@/types";
import { validatePasswordStrength } from "@/utils/password.utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Eye, MoreVertical, Pencil, Search, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { downloadBlob } from "@/components/datatable/util/dataio.utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserCreatePage } from "./pages/UserCreatePage";
import { UserDetailPage } from "./pages/UserDetailPage";
import { UserEditPage } from "./pages/UserEditPage";
import { UserImportModal } from "./components/UserImportModal";
import {
  createBackendUserImportFile,
  exportToCSV,
  type UserImportRow,
} from "./user-dataio.utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_PATTERN = /^[\p{L}][\p{L}\s.'-]*$/u;
const PHONE_PATTERN = /^\+?\d{8,15}$/;

const userSchema: EntitySchema = {
  entityName: "user",
  idField: "id",
  fields: [
    {
      name: "username",
      label: "Username",
      type: "text",
      sortable: true,
    },
    {
      name: "employeeCode",
      label: "Mã nhân viên",
      type: "text",
      sortable: true,
    },
    {
      name: "userCode",
      label: "Mã sinh viên",
      type: "text",
      sortable: true,
    },
    {
      name: "email",
      label: "Email",
      type: "text",
      sortable: true,
      bold: true,
    },
    {
      name: "firstName",
      label: "First Name",
      type: "text",
      sortable: true,
    },
    {
      name: "lastName",
      label: "Last Name",
      type: "text",
      sortable: true,
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      visible: false,
      hideable: false,
    },
    {
      name: "roleIds",
      label: "Role",
      type: "relation",
      relation: {
        api: roleApi,
        valueField: "id",
        labelField: "name",
        multiple: true,
      },
      filterable: true,
      filterType: "select",
    },
    {
      name: "departmentIds",
      label: "Phòng ban",
      type: "relation",
      relation: {
        api: departmentApi,
        valueField: "id",
        labelField: "name",
        multiple: true,
      },
      filterable: true,
      filterType: "select",
    },
    {
      name: "dateOfBirth",
      label: "Date of Birth",
      type: "text",
      visible: false,
      validation: {
        requiredOnCreate: true,
        pattern: /^\d{4}-\d{1,2}-\d{1,2}$/,
        patternMessage: "Use the format yyyy-MM-dd, for example 2000-01-31.",
        placeholder: "2000-01-31",
        validate: (value) => {
          const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(value ?? "").trim());
          if (!m) return undefined; // an empty value or a wrong format is reported by the rules above
          const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
          const date = new Date(Date.UTC(y, mo - 1, d));
          if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d)
            return "This date does not exist.";
          const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
          if (iso > new Date().toISOString().slice(0, 10)) return "Date of birth cannot be in the future.";
          return undefined;
        },
      },
    },
    {
      name: "gender",
      label: "Gender",
      type: "select",
      options: GENDER_OPTIONS,
      visible: false,
      validation: { requiredOnCreate: true },
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      visible: false,
      validation: { maxLength: 500 },
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "User",
  path: "/users",
  api: userApi,
  schema: userSchema,
  actionPages: {
    create: {
      path: "create",
      component: UserCreatePage,
      requiredPermission: "USER_CREATE",
    },
    edit: {
      path: ":id/edit",
      component: UserEditPage,
      requiredPermission: "USER_UPDATE",
    },
    detail: {
      path: ":id",
      component: UserDetailPage,
      requiredPermission: "USER_READ",
    },
  },
};

const PAGE_SIZE = 10;

const getUserStatus = (user: UserDTO): UserAccountStatus =>
  user.status ?? (user.isActive === false ? "INACTIVE" : "ACTIVE");

const getFullName = (user: UserDTO) =>
  [user.lastName, user.firstName].filter((part): part is string => Boolean(part?.trim())).join(" ") || "—";

const getRoleBadgeClass = (roleName: string) => {
  const normalizedRole = roleName.toUpperCase().replace(/^ROLE_/, "");
  const role: UserRole | string =
    normalizedRole === "TEACHER"
      ? "TRAINER"
      : normalizedRole === "STUDENT"
        ? "TRAINEE"
        : normalizedRole;
  switch (role) {
    case "ADMIN":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "TRAINER":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "TRAINEE":
      return "border-slate-200 bg-slate-50 text-slate-600";
    default:
      return "border-slate-200 bg-white text-slate-600";
  }
};

function UserListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["user", "list", page, search, roleId, departmentId],
    queryFn: () =>
      userApi.getPage(
        { page, size: PAGE_SIZE, sort: "id,desc" },
        search.trim() || undefined,
        {
          ids: [],
          roleIds: roleId ? [roleId] : undefined,
          departmentIds: departmentId ? [departmentId] : undefined,
        },
      ),
    placeholderData: (previousData) => previousData,
  });
  const rolesQuery = useQuery({
    queryKey: ["role", "options"],
    queryFn: () => roleApi.getPage({ page: 0, size: 200 }),
  });
  const departmentsQuery = useQuery({
    queryKey: ["department", "options"],
    queryFn: () => departmentApi.getPage({ page: 0, size: 500 }),
  });

  const users = usersQuery.data?.content ?? usersQuery.data?.items ?? [];
  const roles = useMemo(
    () => rolesQuery.data?.content ?? rolesQuery.data?.items ?? [],
    [rolesQuery.data],
  );
  const departments = useMemo(
    () => departmentsQuery.data?.content ?? departmentsQuery.data?.items ?? [],
    [departmentsQuery.data],
  );
  const roleById = useMemo(
    () => new Map(roles.map((role) => [String(role.id), role.name || `Role #${role.id}`])),
    [roles],
  );
  const departmentById = useMemo(
    () => new Map(departments.map((department) => [String(department.id), department.name || `#${department.id}`])),
    [departments],
  );
  const totalPages = usersQuery.data?.totalPages ?? 0;
  const pageUserIds = users.flatMap((user) => (typeof user.id === "number" ? [user.id] : []));
  const allPageSelected = pageUserIds.length > 0 && pageUserIds.every((id) => selectedIds.includes(id));

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ["user"] });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => userApi.delete(String(id)),
    onSuccess: async () => {
      toast.success("Đã xóa người dùng.");
      setSelectedIds([]);
      await invalidateUsers();
    },
    onError: () => toast.error("Không thể xóa người dùng. Vui lòng thử lại."),
  });
  const statusMutation = useMutation({
    mutationFn: async ({ user, active }: { user: UserDTO; active: boolean }) => {
      if (user.id === undefined) throw new Error("Không xác định được người dùng cần cập nhật.");
      if (active && getUserStatus(user) === "LOCKED") {
        await userApi.unlock(user.id);
        return;
      }
      await userApi.update(String(user.id), { ...user, isActive: active });
    },
    onSuccess: async () => {
      toast.success("Đã cập nhật trạng thái người dùng.");
      await invalidateUsers();
    },
    onError: () => toast.error("Không thể cập nhật trạng thái. Vui lòng thử lại."),
  });

  const handleViewDetail = (user: UserDTO) => {
    if (user.id === undefined) {
      toast.error("Không xác định được người dùng cần xem.");
      return;
    }
    navigate(`/users/${user.id}`);
  };

  const handleEditUser = (user: UserDTO) => {
    if (user.id === undefined) {
      toast.error("Không xác định được người dùng cần chỉnh sửa.");
      return;
    }
    navigate(`/users/${user.id}/edit`);
  };

  const handleDeleteUser = (user: UserDTO) => {
    if (typeof user.id !== "number") {
      toast.error("Không xác định được người dùng cần xóa.");
      return;
    }
    if (window.confirm(`Bạn có chắc muốn xóa ${getFullName(user)}?`)) {
      deleteMutation.mutate(user.id);
    }
  };

  const resetFilters = (update: () => void) => {
    update();
    setPage(0);
    setSelectedIds([]);
  };

  const togglePageSelection = (checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) return [...new Set([...current, ...pageUserIds])];
      return current.filter((id) => !pageUserIds.includes(id));
    });
  };

  const toggleUserSelection = (id: number, checked: boolean) => {
    setSelectedIds((current) => (checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filter = {
        ids: [],
        roleIds: roleId ? [roleId] : undefined,
        departmentIds: departmentId ? [departmentId] : undefined,
      };
      const firstPage = await userApi.getPage(
        { page: 0, size: 500, sort: "id,desc" },
        search.trim() || undefined,
        filter,
      );
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
          userApi.getPage(
            { page: index + 1, size: 500, sort: "id,desc" },
            search.trim() || undefined,
            filter,
          ),
        ),
      );
      const filteredUsers = [firstPage, ...remainingPages].flatMap(
        (response) => response.content ?? response.items ?? [],
      );
      if (filteredUsers.length === 0) {
        toast.info("Không có người dùng phù hợp để xuất.");
        return;
      }
      downloadBlob(exportToCSV(filteredUsers, roleById, departmentById), "users.csv");
      toast.success(`Đã xuất ${filteredUsers.length} người dùng.`);
    } catch {
      toast.error("Không thể xuất dữ liệu người dùng. Vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (rows: UserImportRow[]) => {
    setIsImporting(true);
    try {
      const result = await userApi.import(createBackendUserImportFile(rows));
      await invalidateUsers();
      setIsImportOpen(false);
      if (result.failureCount > 0) {
        toast.warning(
          `Đã nhập ${result.successCount} người dùng; ${result.failureCount} dòng bị lỗi.`,
        );
      } else {
        toast.success(`Đã nhập thành công ${result.successCount} người dùng.`);
      }
    } catch {
      toast.error("Không thể nhập danh sách người dùng. Vui lòng thử lại.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <MainLayout pathName={{ users: "Người dùng" }}>
      <section className="space-y-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Danh sách người dùng</h1>
            <p className="mt-1 text-sm text-slate-500">Tìm kiếm, lọc và quản lý tài khoản người dùng.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => resetFilters(() => setSearch(event.target.value))}
              placeholder="Tìm tên hoặc email..."
              aria-label="Tìm kiếm theo tên hoặc email"
              className="pl-9 focus-visible:border-orange-600 focus-visible:ring-orange-500"
            />
          </div>
          <select
            value={roleId}
            onChange={(event) => resetFilters(() => setRoleId(event.target.value))}
            aria-label="Lọc theo vai trò"
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="">Tất cả vai trò</option>
            {roles.map((role) => (
              <option key={role.id} value={String(role.id)}>
                {role.name || `Role #${role.id}`}
              </option>
            ))}
          </select>
          <select
            value={departmentId}
            onChange={(event) => resetFilters(() => setDepartmentId(event.target.value))}
            aria-label="Lọc theo phòng ban"
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="">Tất cả phòng ban</option>
            {departments.map((department) => (
              <option key={department.id} value={String(department.id)}>
                {department.name || `Phòng ban #${department.id}`}
              </option>
            ))}
          </select>
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-100"
              onClick={() => void handleExport()}
              disabled={isExporting || usersQuery.isLoading}
            >
              <Download className="size-4" aria-hidden="true" />
              {isExporting ? "Đang xuất..." : "Xuất dữ liệu"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
              onClick={() => setIsImportOpen(true)}
            >
              <Upload className="size-4" aria-hidden="true" />
              Nhập danh sách
            </Button>
            <Button asChild className="bg-orange-600 text-white hover:bg-orange-700">
              <Link to="/users/create">+ Thêm người dùng</Link>
            </Button>
          </div>
        </div>

        {usersQuery.isError ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-700">
            Không thể tải danh sách người dùng. Vui lòng thử lại.
            <Button variant="outline" className="ml-3" onClick={() => void usersQuery.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <Checkbox
                        aria-label="Chọn tất cả người dùng trong trang"
                        checked={allPageSelected}
                        onCheckedChange={(checked) => togglePageSelection(checked === true)}
                      />
                    </th>
                    <th className="px-4 py-3">Mã NV/HV</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Họ và tên</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Phòng ban</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersQuery.isLoading ? (
                    Array.from({ length: PAGE_SIZE }, (_, index) => (
                      <tr key={index}>
                        {Array.from({ length: 8 }, (_, cell) => (
                          <td key={cell} className="px-4 py-4">
                            <Skeleton className="h-4 w-full max-w-28" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center">
                        <p className="font-medium text-slate-800">Không tìm thấy người dùng phù hợp</p>
                        <p className="mt-1 text-sm text-slate-500">Thử thay đổi từ khóa hoặc bộ lọc.</p>
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const status = getUserStatus(user);
                      const userRoles = (user.roleIds ?? []).map((id) => roleById.get(String(id)) || `Role #${id}`);
                      const userDepartments = (user.departmentIds ?? []).map(
                        (id) => departmentById.get(String(id)) || `#${id}`,
                      );
                      const userId = user.id;

                      return (
                        <tr key={userId} className="transition-colors hover:bg-slate-50/80">
                          <td className="px-4 py-3.5">
                            {typeof userId === "number" && (
                              <Checkbox
                                aria-label={`Chọn ${getFullName(user)}`}
                                checked={selectedIds.includes(userId)}
                                onCheckedChange={(checked) => toggleUserSelection(userId, checked === true)}
                              />
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-700">
                            {user.employeeCode || (userId === undefined ? "—" : `#${userId}`)}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">{user.email || "—"}</td>
                          <td className="px-4 py-3.5 font-medium text-slate-900">{getFullName(user)}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1.5">
                              {userRoles.length > 0 ? (
                                userRoles.map((name) => (
                                  <Badge key={name} variant="outline" className={getRoleBadgeClass(name)}>
                                    {name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">
                            {userDepartments.length > 0 ? userDepartments.join(", ") : "—"}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={status !== "INACTIVE"}
                                disabled={userId === undefined || statusMutation.isPending}
                                onCheckedChange={(active) => statusMutation.mutate({ user, active })}
                                aria-label={`Trạng thái hoạt động của ${getFullName(user)}`}
                                className="data-[state=checked]:bg-orange-600"
                              />
                              <span className="whitespace-nowrap text-xs text-slate-600">
                                {status === "LOCKED" ? "Bị khóa" : status === "INACTIVE" ? "Ngưng hoạt động" : "Hoạt động"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Thao tác với ${getFullName(user)}`}
                                    className="size-8 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                  >
                                    <MoreVertical className="size-4" aria-hidden="true" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" sideOffset={6} className="z-[100] min-w-44">
                                  <DropdownMenuItem
                                    disabled={userId === undefined}
                                    onSelect={() => handleViewDetail(user)}
                                  >
                                    <Eye className="size-4" aria-hidden="true" />
                                    Xem chi tiết
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={userId === undefined}
                                    onSelect={() => handleEditUser(user)}
                                  >
                                    <Pencil className="size-4" aria-hidden="true" />
                                    Chỉnh sửa
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    disabled={userId === undefined || deleteMutation.isPending}
                                    onSelect={() => handleDeleteUser(user)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="size-4" aria-hidden="true" />
                                    Xóa
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                {usersQuery.data?.totalElements ?? 0} người dùng
                {selectedIds.length > 0 && ` · Đã chọn ${selectedIds.length}`}
              </p>
              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Trang trước"
                  disabled={page <= 0 || usersQuery.isFetching}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  <ChevronLeft className="size-4" />
                  Trước
                </Button>
                {Array.from({ length: totalPages }, (_, index) => index).map((pageNumber) => (
                  <Button
                    key={pageNumber}
                    type="button"
                    variant={pageNumber === page ? "default" : "ghost"}
                    size="sm"
                    aria-current={pageNumber === page ? "page" : undefined}
                    className={pageNumber === page ? "bg-orange-600 text-white hover:bg-orange-700" : ""}
                    disabled={usersQuery.isFetching}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber + 1}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Trang sau"
                  disabled={totalPages === 0 || page + 1 >= totalPages || usersQuery.isFetching}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Sau
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        {isImportOpen && (
          <UserImportModal
            open={isImportOpen}
            isImporting={isImporting}
            onOpenChange={setIsImportOpen}
            onImport={handleImport}
          />
        )}
      </section>
    </MainLayout>
  );
}

export default UserListPage;
