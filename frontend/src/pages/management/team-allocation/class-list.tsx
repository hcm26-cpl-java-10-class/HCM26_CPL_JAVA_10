import { trainingClassApi } from "@/api";
import { ProTable } from "@/components/datatable/ProTable";
import { MainLayout } from "@/components/layout/MainLayout";
import { useProTable } from "@/components/datatable/hook/useProTable";
import type { EntitySchema, TrainingClassDTO } from "@/types";
import { useNavigate } from "react-router-dom";

const classSchema: EntitySchema = {
  entityName: "training-class",
  idField: "id",
  fields: [
    {
      name: "code",
      label: "Mã lớp",
      type: "text",
      bold: true,
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    {
      name: "name",
      label: "Tên lớp",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    {
      name: "programName",
      label: "Chương trình đào tạo",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    {
      name: "cohortName",
      label: "Khóa / Cohort",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    {
      name: "status",
      label: "Trạng thái lớp",
      type: "select",
      sortable: true,
      filterable: true,
      filterType: "select",
      options: [
        { label: "Đang lên kế hoạch", value: "PLANNING" },
        { label: "Đang diễn ra", value: "ONGOING" },
        { label: "Đã hoàn thành", value: "COMPLETED" },
        { label: "Đã hủy", value: "CANCELLED" },
      ],
    },
    {
      name: "memberCount",
      label: "Sĩ số",
      type: "number",
      editable: false,
    },
  ],
};

export default function TeamAllocationClassListPage() {
  const navigate = useNavigate();
  const table = useProTable(trainingClassApi, classSchema);

  const openClass = (row: TrainingClassDTO) => {
    navigate(`/team-allocation/classes/${row.id}`, { state: { trainingClass: row } });
  };

  return (
    <MainLayout pathName={{ "team-allocation": "Phân nhóm dự án" }}>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lớp học</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chọn lớp để tạo phiên và phân học viên vào các nhóm dự án.
          </p>
        </div>
        <div className="min-h-[480px] flex-1">
          <ProTable
            table={table}
            hideCreate
            hideActions
            onRowClick={openClass}
          />
        </div>
      </div>
    </MainLayout>
  );
}
