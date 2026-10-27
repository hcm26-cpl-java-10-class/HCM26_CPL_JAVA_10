import { permissionApi, roleApi } from "@/api";
import { ProTable } from "@/components/datatable/ProTable";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { usePermissions } from "@/hooks/usePermissions";
import type { EntityConfig, EntitySchema } from "@/types";
import type { PermissionDTO } from "@/types/features/rbac/permission";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
import { useEffect, useMemo, useState } from "react";

const roleSchema: EntitySchema = {
  entityName: "role",
  idField: "id",
  fields: [
    {
      name: "name",
      label: "Name",
      type: "text",
      sortable: true,
      bold: true,
      width: "18%",
      minWidth: 140,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: true,
      width: "27%",
      minWidth: 180,
    },
    {
      name: "permissionIds",
      label: "Permissions",
      type: "relation",
      editable: true,
      width: "38%",
      minWidth: 220,
      relation: {
        api: permissionApi,
        valueField: "id",
        labelField: "name",
        multiple: true,
      },
      filterable: true,
      filterType: "select",
    },
    {
      name: "isActive",
      label: "Status",
      type: "boolean",
      width: 110,
      booleanLabels: {
        true: "Active",
        false: "Inactive",
      },
      filterable: true,
      filterType: "boolean",
    },
  ],
};

export const entityConfig: EntityConfig = {
  name: "Role",
  path: "/roles",
  api: roleApi,
  schema: roleSchema,
};

interface RoleFormModalProps {
  open: boolean;
  onClose: (open: boolean) => void;
  initial: Record<string, unknown> | null;
  onSubmit: (data: Record<string, unknown>) => void;
  isSubmitting: boolean;
  relationOptions: Record<string, PermissionDTO[]>;
  fieldErrors: Record<string, string[]>;
}

interface PermissionGroup {
  resource: string;
  label: string;
  permissions: PermissionDTO[];
}

function getGroupLabel(resource: string) {
  const words = resource
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase());
  const title = words.join(" ");
  return /management$/i.test(title) ? title : `${title} Management`;
}

function RoleFormModal({
  open,
  onClose,
  initial,
  onSubmit,
  isSubmitting,
  relationOptions,
  fieldErrors,
}: RoleFormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, PermissionGroup>();
    for (const permission of relationOptions.permissionIds ?? []) {
      const resource = permission.resource?.trim() || "OTHER";
      const group = groups.get(resource) ?? {
        resource,
        label: getGroupLabel(resource),
        permissions: [],
      };
      group.permissions.push(permission);
      groups.set(resource, group);
    }

    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [relationOptions.permissionIds]);

  useEffect(() => {
    if (!open) return;

    setName(typeof initial?.name === "string" ? initial.name : "");
    setDescription(typeof initial?.description === "string" ? initial.description : "");
    setIsActive(typeof initial?.isActive === "boolean" ? initial.isActive : true);
    setSelectedPermissionIds(
      Array.isArray(initial?.permissionIds)
        ? initial.permissionIds.map(String)
        : [],
    );
  }, [initial, open]);

  const togglePermission = (id: string, checked: boolean) => {
    setSelectedPermissionIds((current) =>
      checked
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((value) => value !== id),
    );
  };

  const toggleGroup = (group: PermissionGroup, checked: boolean) => {
    const groupIds = group.permissions
      .map((permission) => permission.id)
      .filter((id): id is number => id !== undefined && id !== null)
      .map(String);

    setSelectedPermissionIds((current) => {
      const next = new Set(current);
      groupIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return [...next];
    });
  };

  const submit = () => {
    onSubmit({
      name: name.trim(),
      description,
      permissionIds: selectedPermissionIds.map(Number),
      isActive,
    });
  };

  const nameErrors = fieldErrors.name ?? [];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{initial ? "Edit Role" : "Create New Role"}</SheetTitle>
          <SheetDescription>
            Set the role details, status, and permissions for each module.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="role-name"
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={nameErrors.length > 0}
              className={nameErrors.length > 0 ? "border-destructive" : ""}
              required
            />
            {nameErrors.map((error) => (
              <p key={error} className="text-sm text-destructive">
                {error}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="role-description">Description</Label>
              <span className="text-xs text-muted-foreground">
                {description.length}/1000
              </span>
            </div>
            <Textarea
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              className="h-32 resize-none overflow-y-auto"
            />
            {(fieldErrors.description ?? []).map((error) => (
              <p key={error} className="text-sm text-destructive">
                {error}
              </p>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor="role-status">Status</Label>
            <Switch
              id="role-status"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <span className="text-sm font-medium">
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Permissions</h3>
              <p className="text-xs text-muted-foreground">
                Choose permissions by module.
              </p>
            </div>

            {permissionGroups.length === 0 ? (
              <p className="rounded-md border p-4 text-sm text-muted-foreground">
                No permissions are available.
              </p>
            ) : (
              <div className="space-y-3">
                {permissionGroups.map((group) => {
                  const groupIds = group.permissions
                    .map((permission) => permission.id)
                    .filter((id): id is number => id !== undefined && id !== null)
                    .map(String);
                  const allSelected =
                    groupIds.length > 0 &&
                    groupIds.every((id) => selectedPermissionIds.includes(id));

                  return (
                    <fieldset
                      key={group.resource}
                      className="space-y-3 rounded-lg border p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <legend className="text-sm font-semibold">
                          {group.label}
                        </legend>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toggleGroup(group, !allSelected)}
                        >
                          {allSelected ? "Clear All" : "Select All"}
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {group.permissions.map((permission) => {
                          const id = String(permission.id);
                          return (
                            <label
                              key={id}
                              className="flex min-w-0 items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={selectedPermissionIds.includes(id)}
                                onCheckedChange={(checked) =>
                                  togglePermission(id, checked === true)
                                }
                              />
                              <span className="truncate font-mono">
                                {permission.name}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            )}
            {(fieldErrors.permissionIds ?? []).map((error) => (
              <p key={error} className="text-sm text-destructive">
                {error}
              </p>
            ))}
          </section>
        </div>

        <SheetFooter className="border-t sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onClose(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function RoleManagementPage() {
  const table = useProTable(entityConfig.api, entityConfig.schema);
  const { activeRole } = usePermissions();
  const normalizedRole = normalizeRole(activeRole);
  const isReadOnly = Boolean(table.permission?.canRead)
    && !table.permission?.canCreate
    && !table.permission?.canUpdate
    && !table.permission?.canDelete
    && !table.permission?.canImport
    && !table.permission?.canExport;
  const browseMode = normalizedRole === STUDENT_ROLE || isReadOnly;

  return (
    <MainLayout pathName={{ roles: "Role" }} plainBreadcrumb>
      <div className="flex h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden">
        <div className="mb-5">
          <h1 className="text-2xl font-bold">Role Management</h1>
        </div>
        <ProTable
          table={table}
          mode={browseMode ? "browse" : "default"}
          hideActions={browseMode}
          renderFormModal={(props) => (
            <RoleFormModal
              open={props.open}
              onClose={props.onClose}
              initial={props.initial as Record<string, unknown> | null}
              onSubmit={props.onSubmit}
              isSubmitting={props.isSubmitting}
              relationOptions={props.relationOptions}
              fieldErrors={props.fieldErrors}
            />
          )}
        />
      </div>
    </MainLayout>
  );
}
