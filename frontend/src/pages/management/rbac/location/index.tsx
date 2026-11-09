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
        maxLength: 50,
        pattern: /^[A-Za-z0-9._-]{2,50}$/,
        patternMessage: "2-50 characters: letters, digits, dot, underscore or hyphen.",
        inputFilter: (v) => v.replace(/[^A-Za-z0-9._-]/g, ""),
        hint: "Letters, digits, dot, underscore and hyphen only.",
      },
    },
    {
      name: "name",
      label: "Name",
      type: "text",
      sortable: true,
      validation: { required: true, maxLength: 150 },
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
        queryParams: { page: 0, size: 100 },
      } as any,
      filterable: true,
      filterType: "select",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: true,
      validation: { maxLength: 500 },
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
  const [viewMode, setViewMode] = useState<"table" | "tree">("table");

  return (
    <MainLayout pathName={{ locations: "Location" }}>
      <div className="space-y-4">
        {/* Nút Toggle chuyển đổi giữa Table và Tree View */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === "table" ? "tree" : "table")}
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            {viewMode === "table" ? (
              <>
                <FolderTree className="size-4 text-primary" />
                <span>Tree View</span>
              </>
            ) : (
              <>
                <TableIcon className="size-4 text-primary" />
                <span>Table View</span>
              </>
            )}
          </Button>
        </div>

        {/* Render theo chế độ View được chọn */}
        {viewMode === "table" ? (
          <ProTable table={table} />
        ) : (
          <LocationTree />
        )}
      </div>
    </MainLayout>
  );
}

export default LocationPage;