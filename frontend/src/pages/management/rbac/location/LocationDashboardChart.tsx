import React, { useMemo } from "react";
import { BarChart3, PieChart, Users, Building2, Layers } from "lucide-react";

interface LocationUser {
  id: number | string;
  fullName?: string;
  roleName?: string;
  email?: string;
}

interface LocationNode {
  id: number | string;
  name: string;
  code: string;
  totalUsers?: number;
  users?: LocationUser[];
  children?: LocationNode[];
}

interface LocationDashboardChartProps {
  treeData: LocationNode[];
  activeNode: LocationNode | null;
}

const ROLE_COLORS: Record<string, string> = {
  STUDENT: "#3b82f6",
  TEACHER: "#f59e0b",
  MENTOR: "#a855f7",
  ADMIN: "#10b981",
};

const collectUsersRecursive = (nodes: LocationNode[]): LocationUser[] => {
  const users: LocationUser[] = [];
  const traverse = (list: LocationNode[]) => {
    list.forEach((n) => {
      if (n.users?.length) users.push(...n.users);
      if (n.children?.length) traverse(n.children);
    });
  };
  traverse(nodes);
  return users;
};

const countLocationsRecursive = (nodes: LocationNode[]): number =>
  nodes.reduce(
    (acc, n) => acc + 1 + (n.children?.length ? countLocationsRecursive(n.children) : 0),
    0
  );

export const LocationDashboardChart: React.FC<LocationDashboardChartProps> = ({
  treeData,
  activeNode,
}) => {
  const chartBranches = useMemo(() => {
    const targetList =
      activeNode?.children && activeNode.children.length > 0
        ? activeNode.children
        : treeData.length === 1 && treeData[0].children?.length
        ? treeData[0].children
        : treeData;

    return targetList
      .map((node) => ({
        id: node.id,
        name: node.name,
        code: node.code,
        count: node.totalUsers ?? collectUsersRecursive([node]).length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [treeData, activeNode]);

  const maxBranchCount = useMemo(
    () => Math.max(...chartBranches.map((b) => b.count), 1),
    [chartBranches]
  );

  const roleStats = useMemo(() => {
    const sourceNodes = activeNode ? [activeNode] : treeData;
    const allUsers = collectUsersRecursive(sourceNodes);
    const map: Record<string, number> = {};

    allUsers.forEach((u) => {
      const r = (u.roleName || "OTHER").toUpperCase();
      map[r] = (map[r] || 0) + 1;
    });

    const total = allUsers.length || 1;
    return Object.entries(map)
      .map(([role, count]) => ({
        role,
        count,
        percent: Math.round((count / total) * 1000) / 10,
        hex: ROLE_COLORS[role] || "#0ea5e9",
      }))
      .sort((a, b) => b.count - a.count);
  }, [treeData, activeNode]);

  const totalStaff = useMemo(
    () => roleStats.reduce((sum, r) => sum + r.count, 0),
    [roleStats]
  );

  const totalLocations = useMemo(() => countLocationsRecursive(treeData), [treeData]);

  const donutSegments = useMemo(() => {
    let offset = 0;
    const r = 34;
    const c = 2 * Math.PI * r;
    return roleStats.map((item) => {
      const fraction = totalStaff > 0 ? item.count / totalStaff : 0;
      const dashArray = `${fraction * c} ${c}`;
      const dashOffset = -offset * c;
      offset += fraction;
      return { ...item, dashArray, dashOffset };
    });
  }, [roleStats, totalStaff]);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 lg:col-span-7 bg-card border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="size-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Phân bổ nhân sự theo đơn vị
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Phạm vi thống kê:{" "}
                <span className="text-foreground font-medium">
                  {activeNode?.name || "Toàn hệ thống"}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Layers className="size-3.5 text-amber-500" />
              <b>{totalLocations}</b> vị trí
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Users className="size-3.5 text-primary" />
              <b>{totalStaff}</b> nhân sự
            </span>
          </div>
        </div>

        <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
          {chartBranches.map((branch) => {
            const pct = Math.max((branch.count / maxBranchCount) * 100, 3);
            return (
              <div key={branch.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 className="size-3 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{branch.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      ({branch.code})
                    </span>
                  </div>
                  <span className="font-bold text-primary shrink-0 ml-2">
                    {branch.count} người
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="col-span-12 lg:col-span-5 bg-card border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <PieChart className="size-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Cơ cấu chức danh (Role)
              </h3>
              <p className="text-[11px] text-muted-foreground">Tỷ lệ nhân sự theo vai trò</p>
            </div>
          </div>
        </div>

        {totalStaff > 0 ? (
          <div className="flex items-center gap-5 my-auto py-1">
            <div className="relative size-24 shrink-0 flex items-center justify-center">
              <svg className="size-24 -rotate-90" viewBox="0 0 88 88">
                <circle
                  cx="44"
                  cy="44"
                  r="34"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="9"
                  className="text-muted/50"
                />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.role}
                    cx="44"
                    cy="44"
                    r="34"
                    fill="transparent"
                    stroke={seg.hex}
                    strokeWidth="9"
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold leading-none">{totalStaff}</span>
                <span className="text-[9px] text-muted-foreground mt-0.5">người</span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              {roleStats.map((item) => (
                <div key={item.role} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.hex }}
                    />
                    <span className="font-medium truncate">{item.role}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold">{item.count}</span>
                    <span className="text-[11px] text-muted-foreground">({item.percent}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            Chưa có dữ liệu chức danh
          </div>
        )}
      </div>
    </div>
  );
};