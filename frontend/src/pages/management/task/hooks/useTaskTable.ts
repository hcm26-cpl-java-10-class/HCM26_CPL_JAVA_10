import { taskApi } from "@/api/features/task.api";
import { usePermissions } from "@/hooks/usePermissions";
import type { SortEntry } from "@/types";
import type { TaskFilter } from "@/types/features/task";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type SetStateAction } from "react";
import { taskTableSchema } from "../task-table.schema";

type TaskTableFilters = Pick<TaskFilter, "status" | "priority">;

export function useTaskTable(projectId: string) {
  const { user, activeRole, hasPermission } = usePermissions();
  const [page, setPageState] = useState(0);
  const [size, setSizeState] = useState(10);
  const [search, setSearchState] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filters, setFiltersState] = useState<TaskTableFilters>({});
  const [sortState, setSortState] = useState<SortEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      taskTableSchema.fields.map((field) => [field.name, field.visible !== false]),
    ),
  );

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useQuery({
    queryKey: [
      "tasks",
      user.email,
      activeRole,
      "list",
      projectId,
      page,
      size,
      appliedSearch,
      filters,
      sortState,
    ],
    queryFn: () =>
      taskApi.getPage(
        {
          page,
          size,
          sort: sortState.length
            ? sortState.map((entry) => `${entry.field},${entry.direction}`)
            : "createdAt,desc",
        },
        appliedSearch,
        { projectId, ...filters },
      ),
    enabled: hasPermission("TASK_READ"),
    retry: false,
  });

  const resetPage = () => {
    setPageState(0);
    setSelected([]);
  };
  const setPage = (value: number) => {
    setPageState(Math.max(0, value));
    setSelected([]);
  };
  const setSize = (value: number) => {
    setSizeState(value);
    resetPage();
  };
  const setSearch = (value: string) => {
    setSearchState(value);
    resetPage();
  };
  const setFilters = (value: SetStateAction<TaskTableFilters>) => {
    setFiltersState(value);
    resetPage();
  };
  const toggleSort = (field: string) => {
    setSortState((previous) => {
      const current = previous.find((entry) => entry.field === field);
      if (!current) return [...previous, { field, direction: "asc" }];
      if (current.direction === "asc") {
        return previous.map((entry) =>
          entry.field === field ? { ...entry, direction: "desc" as const } : entry,
        );
      }
      return previous.filter((entry) => entry.field !== field);
    });
    resetPage();
  };

  return {
    query,
    schema: taskTableSchema,
    data: query.isError ? [] : (query.data?.content ?? []),
    total: query.isError ? 0 : (query.data?.totalElements ?? 0),
    loading: query.isLoading,
    isFetching: query.isFetching,
    page,
    size,
    setPage,
    setSize,
    search,
    setSearch,
    filters,
    setFilters,
    clearFilters: () => setFilters({}),
    sortState,
    toggleSort,
    clearSort: () => {
      setSortState([]);
      resetPage();
    },
    selected,
    setSelected,
    columnVisibility,
    visibleFields: taskTableSchema.fields.filter((field) => columnVisibility[field.name] !== false),
    toggleFieldVisibility: (field: string, visible: boolean) =>
      setColumnVisibility((previous) => ({ ...previous, [field]: visible })),
    relationOptions: {},
    isFormOpen: false,
    permission: {
      canRead: hasPermission("TASK_READ"),
      canCreate: hasPermission("TASK_CREATE"),
      canUpdate: hasPermission("TASK_UPDATE"),
      canDelete: false,
      canImport: false,
      canExport: false,
    },
  };
}
