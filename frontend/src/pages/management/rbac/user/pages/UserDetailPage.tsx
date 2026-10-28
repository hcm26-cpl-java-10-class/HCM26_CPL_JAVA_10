import { LearningRecordsPanel } from "@/pages/management/learning/components/LearningRecordsPanel";
import { usePermissions } from "@/hooks/usePermissions";
import { departmentApi, roleApi, userApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { PermissionGate } from "@/components/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { USER_STATUS_HEADER_CLASS, type UserStatus } from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  AtSign,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  Hash,
  Mail,
  PenSquare,
  Phone,
  ShieldCheck,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { UserStatusBadge } from "../components/UserStatusBadge";
import { extractServerErrors } from "../user-form.utils";

function formatDate(value?: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("vi-VN");
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
];

/** Màu avatar cố định theo tên để mỗi người một màu. */
function avatarColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

type IconType = ComponentType<{ className?: string }>;

function InfoRow({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: IconType;
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  const empty = children === null || children === undefined || children === false || children === "";
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 break-words text-sm font-medium">
          {empty ? <span className="font-normal text-muted-foreground">Chưa cập nhật</span> : children}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="mb-5 text-sm font-semibold">{title}</h3>
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function BadgeGroup({ names, icon: Icon }: { names: string[]; icon?: IconType }) {
  if (names.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {names.map((n) => (
        <Badge key={n} variant="outline" className="gap-1.5 px-2.5 py-1 text-xs font-medium">
          {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
          {n}
        </Badge>
      ))}
    </div>
  );
}

function MetaItem({ icon: Icon, label, value }: { icon: IconType; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      {label}: <span className="font-medium text-foreground/80">{value}</span>
    </span>
  );
}

export function UserDetailPage() {
  const { hasAllPermissions, hasPermission, user: account } = usePermissions();
  const canInspectLearning = hasAllPermissions(["ADMIN_ACCESS", "USER_READ", "USER_LEARNING_READ"]);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const pathName = { users: "Người dùng", detail: "Chi tiết" };

  const userQuery = useQuery({
    queryKey: ["user", "detail", account.email, id],
    queryFn: () => userApi.getById(id as string),
    enabled: !!id,
  });
  const roleQuery = useQuery({
    queryKey: ["role", "options", account.email],
    queryFn: () => roleApi.getPage({ page: 0, size: 200 }),
    enabled: hasPermission("ROLE_READ"),
  });
  const deptQuery = useQuery({
    queryKey: ["department", "options", account.email],
    queryFn: () => departmentApi.getPage({ page: 0, size: 500 }),
    enabled: hasPermission("DEPARTMENT_READ"),
  });

  const user = userQuery.data;
  const nameOf = (list: any[] | undefined, ids?: Array<string | number>) =>
    (ids ?? []).map((i) => list?.find((x) => String(x.id) === String(i))?.name ?? `#${i}`);

  const roleNames = nameOf(roleQuery.data?.content ?? roleQuery.data?.items, user?.roleIds);
  const deptNames = nameOf(deptQuery.data?.content ?? deptQuery.data?.items, user?.departmentIds);
 feature/user-profile-update
  const fullName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  const fullName = [user?.lastName, user?.firstName].filter(Boolean).join(" ");
  const displayName = fullName || user?.email || "";
 dev
  const status: UserStatus = user?.status ?? (user?.isActive === false ? "INACTIVE" : "ACTIVE");
  const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  return (
    <MainLayout pathName={pathName}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Chi tiết người dùng</CardTitle>
          <CardDescription>Thông tin chi tiết người dùng #{id}.</CardDescription>
        </CardHeader>

        {!id ? (
          <CardContent>
            <p className="text-sm text-destructive">Không xác định được người dùng cần xem.</p>
          </CardContent>
        ) : userQuery.isLoading ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
          </CardContent>
        ) : userQuery.isError ? (
          <CardContent>
            <p role="alert" className="text-sm text-destructive">{extractServerErrors(userQuery.error).message}</p>
            <Button className="mt-3" variant="outline" onClick={() => void userQuery.refetch()}>Retry</Button>
          </CardContent>
        ) : (
          <CardContent>
 feature/user-profile-update
            <Tabs defaultValue="general" className="grid gap-5">
              <TabsList className="group-data-[orientation=horizontal]/tabs:h-auto flex-wrap justify-start">
                <TabsTrigger className="h-auto min-h-9" value="general">Thông tin chung</TabsTrigger>
                <TabsTrigger className="h-auto min-h-9" value="authorization">Phân quyền</TabsTrigger>
                {canInspectLearning && <TabsTrigger className="h-auto min-h-9" value="learning">Learning</TabsTrigger>}
              </TabsList>

              <TabsContent value="general" className="grid gap-4 text-sm md:grid-cols-2">
                <Item label="Họ tên">
                  <span className="text-base font-semibold">{fullName}</span>
                </Item>
                <Item label="Username">{user?.username}</Item>
                <Item label="Email">{user?.email}</Item>
                <Item label="Mã nhân viên">{user?.employeeCode}</Item>
                <Item label="Số điện thoại">{user?.phone}</Item>
                <Item label="Trạng thái">
                  <Badge variant={STATUS_VARIANT[status]}>{statusLabel}</Badge>
                </Item>
                <Item label="Phòng ban">
                  <BadgeGroup names={deptNames} />
                </Item>
                <Item label="Đăng nhập gần nhất">{formatDate(user?.lastLoginAt)}</Item>
                <div className="md:col-span-2">
                  <Item label="Mô tả">
                    <p className="leading-6">{user?.description}</p>
                  </Item>
                </div>
                <Item label="Ngày tạo">{formatDate(user?.createdAt)}</Item>
                <Item label="Cập nhật lần cuối">{formatDate(user?.updatedAt)}</Item>
              </TabsContent>

              <TabsContent value="authorization" className="grid gap-4 text-sm">
                <Item label="Roles">
                  <BadgeGroup names={roleNames} />
                </Item>
              </TabsContent>
              {canInspectLearning && id && <TabsContent value="learning"><LearningRecordsPanel userId={id} /></TabsContent>}
            </Tabs>

            <div className="mx-auto grid w-full max-w-5xl gap-5">
                <div className={cn("rounded-xl border p-6", USER_STATUS_HEADER_CLASS[status])}>
                  <div className="flex flex-wrap items-center gap-5">
                    <div
                      className={cn(
                        "flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-semibold ring-4 ring-background",
                        avatarColor(displayName),
                      )}
                    >
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-xl font-semibold">{displayName}</h2>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{user?.email}</p>
                      {status !== "ACTIVE" && (
                        <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-400">
                          {status === "LOCKED"
                            ? "Tài khoản đang bị khóa, không thể đăng nhập."
                            : "Tài khoản đã ngưng hoạt động, không thể đăng nhập."}
                        </p>
                      )}
                    </div>
                    <UserStatusBadge status={status} />
                  </div>
                </div>

                <Section title="Thông tin tài khoản">
                  <InfoRow icon={AtSign} label="Username">
                    {user?.username}
                  </InfoRow>
                  <InfoRow icon={Hash} label="Mã nhân viên">
                    {user?.employeeCode}
                  </InfoRow>
                  <InfoRow icon={Mail} label="Email">
                    {user?.email}
                  </InfoRow>
                  <InfoRow icon={Phone} label="Số điện thoại">
                    {user?.phone}
                  </InfoRow>
                  <InfoRow icon={Building2} label="Phòng ban" className="sm:col-span-2">
                    {deptNames.length > 0 ? <BadgeGroup names={deptNames} /> : null}
                  </InfoRow>
                  <InfoRow icon={ShieldCheck} label="Role" className="sm:col-span-2">
                    {roleNames.length > 0 ? <BadgeGroup names={roleNames} /> : null}
                  </InfoRow>
                  <InfoRow icon={FileText} label="Mô tả" className="sm:col-span-2">
                    {user?.description ? <p className="whitespace-pre-line font-normal leading-6">{user.description}</p> : null}
                  </InfoRow>
                </Section>

                <div className="flex flex-wrap gap-x-6 gap-y-2 px-1 text-xs text-muted-foreground">
                  <MetaItem icon={CalendarDays} label="Ngày tạo" value={formatDate(user?.createdAt) || "—"} />
                  <MetaItem icon={Clock} label="Cập nhật lần cuối" value={formatDate(user?.updatedAt) || "—"} />
                  {user?.lastLoginAt && (
                    <MetaItem icon={Clock} label="Đăng nhập gần nhất" value={formatDate(user.lastLoginAt)} />
                  )}
                </div>
              </div>
 dev
          </CardContent>
        )}

        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/users")}>
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
          {id && (
            <PermissionGate permission="USER_UPDATE">
              <Button asChild>
                <Link to={`/users/${id}/edit`}>
                  <PenSquare className="h-4 w-4" />
                  Chỉnh sửa
                </Link>
              </Button>
            </PermissionGate>
          )}
        </CardFooter>
      </Card>
    </MainLayout>
  );
}
