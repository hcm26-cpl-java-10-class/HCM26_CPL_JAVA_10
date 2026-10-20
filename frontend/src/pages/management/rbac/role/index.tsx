import { permissionApi, roleApi } from "@/api";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteModal } from "@/components/datatable/modal/ConfirmDeleteModal";
import { toast } from "sonner";
import { useState } from "react";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const roleSchema: EntitySchema = {
  entityName: "role",
  idField: "id",
  fields: [
    {
      name: "name",
      label: "Name",
      type: "text",
      maxLength: 100,
      sortable: true,
      bold: true,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      maxLength: 500,
      sortable: true,
    },
    {
      name: "permissionIds",
      label: "Permissions",
      type: "relation",
      editable: true,
      relation: {
        api: permissionApi,
        valueField: "id",
        labelField: "name",
        multiple: true,
        groupField: "resource",
      },
      filterable: true,
      filterType: "select",
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

const isSystemRole = (role: { name?: string }) =>
  role.name === "ADMIN" || role.name === "ROLE_SYSTEM_ADMIN";

function RoleSelectionActions({ table }: { table: any }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteSelectedRoles = async () => {
    if (!table.permission?.canDelete || table.selected.length === 0) return;

    setIsDeleting(true);
    try {
      const selectedRoles = await Promise.all(
        table.selected.map(async (id: string | number) => {
          const visibleRole = table.data.find(
            (role: { id?: string | number }) => role.id === id
          );
          return visibleRole ?? roleApi.getById(String(id));
        })
      );
      const deletableIds = table.selected.filter(
        (_id: string | number, index: number) =>
          !isSystemRole(selectedRoles[index])
      );

      if (deletableIds.length === 0) {
        table.setSelected([]);
        setConfirmOpen(false);
        toast.info("System roles cannot be deleted.");
        return;
      }

      await table.bulkDelete(deletableIds);
      setConfirmOpen(false);
    } catch {
      toast.error("Unable to verify selected roles. No roles were deleted.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
      <span className="whitespace-nowrap text-sm font-medium">
        {table.selected.length} selected
      </span>
      {table.permission?.canDelete && (
        <Button
          variant="destructive"
          onClick={() => setConfirmOpen(true)}
        >
          Delete Selected
        </Button>
      )}
      <Button variant="outline" onClick={() => table.setSelected([])}>
        Clear Selection
      </Button>
      <ConfirmDeleteModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={deleteSelectedRoles}
        loading={isDeleting}
        title="Delete Selected Roles"
        description="System roles will be skipped. Other selected roles will be deleted."
      />
    </div>
  );
}

export const entityConfig: EntityConfig = {
  name: "Role",
  path: "/roles",
  api: roleApi,
  schema: roleSchema,
  isRowProtected: isSystemRole,
  renderSelectionActions: (table) => <RoleSelectionActions table={table} />,
};
