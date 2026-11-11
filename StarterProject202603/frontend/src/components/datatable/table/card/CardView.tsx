import type { FieldSchema } from "@/types/common/datatable";
import type { EntityCardRendererProps } from "@/types";
import { CardItem } from "./CardItem";
import { CardSelectAllBar } from "./CardSelectAllBar";

interface CardViewProps {
  table: any;
  onRowClick?: (row: any) => void;
  showActions?: boolean;
  renderRowActions?: (row: any) => React.ReactNode;
  onView: (row: any) => void;
  onEdit: (row: any) => void;
  onDelete: (row: any) => void;
  onBooleanToggle: (id: any, fieldName: string, newValue: boolean) => void;
  disableBooleanToggle?: boolean;
  selectable?: boolean;
  showIndex?: boolean;
  renderCard?: (props: EntityCardRendererProps) => React.ReactNode;
}

export function CardView({
  table,
  onRowClick,
  renderRowActions,
  onView,
  onEdit,
  onDelete,
  onBooleanToggle,
  showActions = true,
  disableBooleanToggle = false,
  selectable = true,
  showIndex = true,
  renderCard,
}: CardViewProps) {
  const { schema } = table;

  const allIds = (table.data ?? []).map((row: any) => row[schema.idField]);
  const selectedCount = table.selected?.length ?? 0;
  const allSelected =
    allIds.length > 0 &&
    allIds.every((id: any) => table.selected?.includes(id));
  const someSelected = selectedCount > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (!selectable) {
      return;
    }

    if (allSelected) {
      table.setSelected((prev: any[]) =>
        prev.filter((id: any) => !allIds.includes(id))
      );
    } else {
      table.setSelected((prev: any[]) => {
        const set = new Set([...prev, ...allIds]);
        return Array.from(set);
      });
    }
  };

  const toggleSelect = (id: any) => {
    if (!selectable) {
      return;
    }

    table.setSelected((prev: any[]) =>
      prev.includes(id) ? prev.filter((x: any) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col overflow-hidden h-full">
      {selectable && (
        <CardSelectAllBar
          totalCount={allIds.length}
          selectedCount={selectedCount}
          allSelected={allSelected}
          someSelected={someSelected}
          onToggleSelectAll={toggleSelectAll}
        />
      )}

      <div
        className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-3 overflow-y-auto flex-1 transition-opacity ${table.isFetching ? "opacity-50" : ""
          }`}
      >
        {table.data?.map((row: any, idx: number) => {
          const id = row[schema.idField];

          const cardProps: EntityCardRendererProps = {
            row,
            index: (table.page || 0) * (table.size || 10) + idx,
            idField: schema.idField,
            isSelected: selectable ? table.selected?.includes(id) || false : false,
            showActions,
            selectable,
            showIndex,
            visibleFields: table.visibleFields as FieldSchema[],
            relationOptions: table.relationOptions,
            onSelect: toggleSelect,
            onRowClick,
            renderRowActions,
            onView,
            onEdit,
            onDelete,
            disableBooleanToggle,
            onBooleanToggle,
          };

          if (renderCard) {
            return <div key={id}>{renderCard(cardProps)}</div>;
          }

          return (
            <CardItem
              key={id}
              {...cardProps}
            />
          );
        })}
      </div>
    </div>
  );
}
