import { useState } from "react";
import { FolderTree, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProTable } from "@/components/datatable/ProTable";
import { MainLayout } from "@/components/layout/MainLayout";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { locationApi } from "@/api/features/rbac/location.api";
import { LocationTree } from "./LocationTree";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const locationSchema: EntitySchema = {
  entityName: "LOCATION",
  idField: "id",
  fields: [
    {
      name: "code",
      label: "Code",
      type: "text",
      sortable: true,
      bold: true,
      validation: {
        required: true,
        minLength: 2,
        maxLength: 30,
        pattern: {
          regex: /^[A-Za-z0-9._-]{2,30}$/,
          message: "2-30 characters: letters, digits, dot, underscore or hyphen.",
        },
      },
      hint: "Letters, digits, dot, underscore and hyphen only.",
    },
    {
      name: "name",
      label: "Name",
      type: "text",
      sortable: true,
      validation: { required: true, maxLength: 30 },
    },
    {
      name: "parentLocationId",
      label: "Parent Location",
      type: "relation",
      editable: true,
      relation: {
        api: locationApi,
        valueField: "id",
        labelField: "name",
        multiple: false,
      },
      filterable: true,
      filterType: "select",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: true,
      validation: { maxLength: 50 },
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Location",
  path: "/locations",
  api: locationApi,
  schema: locationSchema,
};

export function LocationPage() {
  const table = useProTable(entityConfig.api, entityConfig.schema);
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");

  return (
    <MainLayout pathName={{ locations: "Location" }}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Location Management</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage the location hierarchy, staff assignments and organizational coverage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === "tree" ? "table" : "tree")}
              className="flex items-center gap-1.5 text-xs font-medium"
            >
              {viewMode === "tree" ? (
                <>
                  <TableIcon className="size-4 text-primary" />
                  <span>Table View</span>
                </>
              ) : (
                <>
                  <FolderTree className="size-4 text-primary" />
                  <span>Tree View</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {viewMode === "tree" ? (
          <LocationTree />
        ) : (
          <ProTable table={table} />
        )}
      </div>
    </MainLayout>
  );
}

export default LocationPage;