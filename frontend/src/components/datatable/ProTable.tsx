import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAutoPageSize } from "@/components/datatable/hook/useAutoPageSize";
import type { EntityCardLayout, EntityCardRendererProps, FieldSchema } from "@/types";
import { ChevronRight } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Loading from "./common/Loading";
import NoResult from "./common/NoResult";
import { ConfirmDeleteModal } from "./modal/ConfirmDeleteModal";
import { DetailModal } from "./modal/DetailModal";
import { FormModal } from "./modal/form/FormModal";
import { CardView } from "./table/card/CardView";
import { CellRenderer, DATE_FORMAT_CYCLE, type DateFormatKey } from "./table/cell/CellRenderer";
import { Pagination } from "./table/Pagination";
import { RowActions } from "./table/RowActions";
import { RowSelection } from "./table/RowSelection";
import { SelectAllCheckbox } from "./table/SelectAllCheckbox";
import { SortableHeader } from "./table/SortableHeader";
import { ColumnToggle } from "./toolbar/ColumnToggle";
import { Toolbar } from "./toolbar/Toolbar";
import type { ViewMode } from "./toolbar/Toolbar";

/**
 * ProTable: Reusable data table component with sensible defaults
 *
 * Architecture: Default + Override Pattern
 *
 * Default behavior (zero config):
 * - Internal modal CRUD system (create/edit/delete)
 * - Default row actions (view, edit, delete)
 * - Default create button
 *
 * Optional overrides (for complex entities):
 * - headerActions: Override default create button
 * - renderRowActions: Complete override of row actions (full control)
 * - onView/onEdit/onDelete: Individual action overrides (keeps other defaults)
 * - renderFormModal: Override default form modal
 *
 * Benefits:
 * - Simple entities: zero config, just works
 * - Complex entities: full control via overrides
 * - Partial overrides: customize one action, keep others default
 * - No prop explosion
 * - Backward compatible
 * - Separation of concerns
 */
interface ProTableProps<TData = any> {
    /** Table instance from useTable hook */
    table: any;

    /** Optional: Override default create button. If not provided, shows default "Create" button */
    headerActions?: React.ReactNode;

    /** Optional: extra buttons rendered next to the header actions / Create button */
    extraHeaderActions?: React.ReactNode;

    /**
     * Optional: actions shown in browse mode, where the regular toolbar actions
     * are hidden (read-only card view). Used to expose a single "Create" button.
     */
    browseActions?: React.ReactNode;

    /** Optional: Complete override of row actions. If provided, you have full control */
    renderRowActions?: (row: TData) => React.ReactNode;

    renderCell?: (row: TData, field: FieldSchema) => React.ReactNode;

    compactToolbar?: boolean;

    responsiveCards?: boolean;

    /** Optional: Custom card renderer for card view */
    renderCard?: (props: EntityCardRendererProps) => React.ReactNode;

    /** Optional: Card view layout. "list" renders full-width stacked rows. */
    cardLayout?: EntityCardLayout;

    /** Optional: Override default view action. If not provided, uses internal modal view */
    onView?: (row: TData) => void;

    /** Optional: Override default edit action. If not provided, uses internal modal edit */
    onEdit?: (row: TData) => void;

    /** Optional: Override default delete action. If not provided, uses internal modal delete */
    onDelete?: (row: TData) => void;

    /** Optional: Override default form modal. If not provided, uses internal FormModal */
    renderFormModal?: (props: {
        open: boolean;
        onClose: (open: boolean) => void;
        schema: any;
        initial: TData | null;
        onSubmit: (data: any) => void;
    }) => React.ReactNode;

    /** Optional: Handle row click */
    onRowClick?: (row: TData) => void;

    /** Enable/disable auto page size calculation */
    autoPageSize?: boolean;

    /** Row height for auto page size calculation */
    rowHeight?: number;

    /** Hide default actions completely (for display-only tables) */
    hideActions?: boolean;

    /** Hide only the default Create action while retaining import/export actions */
    hideCreate?: boolean;

    /** UI mode for datatable. browse mode is card-first with simplified controls. */
    mode?: "default" | "browse";

    /**
     * Optional: keep row actions (view / edit / delete) and the boolean toggle
     * enabled in browse mode. Only takes effect together with `mode="browse"`.
     */
    browseRowActions?: boolean;

    /**
     * Optional: Expandable row configuration.
     * Expansion is auto-enabled when any field in the schema has `expandable: true`.
     * Use `renderExpandedRow` to customise the expanded content; if omitted,
     * the expandable field's value is rendered automatically via CellRenderer.
     */
    expandable?: {
        /** Custom renderer for the expanded content below a row */
        renderExpandedRow?: (row: TData) => React.ReactNode;
    };
}

export function ProTable<TData = any>({
    table,
    headerActions,
    extraHeaderActions,
    browseActions,
    renderRowActions,
    renderCell,
    compactToolbar = false,
    responsiveCards = false,
    renderCard,
    cardLayout = "grid",
    onView,
    onEdit,
    onDelete,
    renderFormModal,
    onRowClick,
    autoPageSize = true,
    rowHeight = 49,
    hideActions = false,
    hideCreate = false,
    mode = "default",
    browseRowActions = false,
    expandable,
}: ProTableProps<TData>) {
    const { schema } = table;
    const isBrowseMode = mode === "browse";
    /** Browse mode normally hides row actions; entities can opt back in. */
    const allowBrowseRowActions = isBrowseMode && browseRowActions;

    // Auto-detect expandable from schema — true when any field is marked expandable: true
    const isExpandable: boolean = schema.fields.some((f: any) => f.expandable === true);

    const [isAutoSize, setIsAutoSize] = useState(autoPageSize);

    const { containerRef, calculatedSize } = useAutoPageSize({
        rowHeight,
        onSizeChange: isAutoSize ? table.setSize : undefined,
    });

    // Expandable row state
    const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());
    const toggleExpand = useCallback((id: string | number, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    // Internal modal state (used when overrides are not provided)
    const [deleteItem, setDeleteItem] = useState<TData | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [detailRow, setDetailRow] = useState<TData | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>(() =>
        isBrowseMode || (responsiveCards && window.matchMedia("(max-width: 640px)").matches)
            ? "card"
            : "table",
    );

    useEffect(() => {
        if (!responsiveCards || isBrowseMode) return;
        const media = window.matchMedia("(max-width: 640px)");
        const changeView = (event: MediaQueryListEvent) => setViewMode(event.matches ? "card" : "table");
        media.addEventListener("change", changeView);
        return () => media.removeEventListener("change", changeView);
    }, [responsiveCards, isBrowseMode]);

    useEffect(() => {
        if (isBrowseMode) {
            setViewMode("card");
        }
    }, [isBrowseMode]);

    // Date format cycling per date-type column
    const [dateFormats, setDateFormats] = useState<Record<string, DateFormatKey>>({});
    const cycleDateFormat = useCallback((fieldName: string) => {
        setDateFormats((prev) => {
            const current = prev[fieldName] ?? "datetime";
            const idx = DATE_FORMAT_CYCLE.indexOf(current);
            const next = DATE_FORMAT_CYCLE[(idx + 1) % DATE_FORMAT_CYCLE.length];
            return { ...prev, [fieldName]: next };
        });
    }, []);

    // Column widths state for resizing
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const widths: Record<string, number> = {};
        schema.fields.forEach((f: any) => {
            widths[f.name] = f.width || 150;
        });
        return widths;
    });

    const resizingRef = useRef<{ field: string; startX: number; startWidth: number } | null>(null);

    const onResizeStart = useCallback(
        (fieldName: string, e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startWidth = columnWidths[fieldName] || 150;
            resizingRef.current = { field: fieldName, startX, startWidth };

            const onMouseMove = (ev: MouseEvent) => {
                if (!resizingRef.current) return;
                const { field, startX, startWidth } = resizingRef.current;
                const diff = ev.clientX - startX;
                const minW = schema.fields.find((f: any) => f.name === field)?.minWidth || 60;
                const newWidth = Math.max(minW, startWidth + diff);
                setColumnWidths((prev) => ({ ...prev, [field]: newWidth }));
            };

            const onMouseUp = () => {
                resizingRef.current = null;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        },
        [columnWidths, schema.fields],
    );

    const handleDeleteConfirm = async () => {
        if (!deleteItem) return;
        if (!table.permission?.canDelete) return;

        try {
            setDeleteLoading(true);
            await table.remove((deleteItem as any)[schema.idField]);
            setDeleteItem(null);
        } finally {
            setDeleteLoading(false);
        }
    };

    // Determine if we should show actions column
    const canViewRow = table.permission?.canRead ?? true;
    const canEditRow = table.permission?.canUpdate ?? true;
    const canDeleteRow = table.permission?.canDelete ?? true;
    const hasRowActions = canViewRow || canEditRow || canDeleteRow;

    const showActionsColumn = !hideActions && hasRowActions;
    const ACTION_COLUMN_WIDTH = 152;

    // Default row actions renderer (uses internal modal system or custom overrides)
    const defaultRenderRowActions = (row: TData) => (
        <RowActions
            row={row}
            onView={onView || setDetailRow}
            onEdit={onEdit || table.openEdit}
            onDelete={onDelete || setDeleteItem}
            viewPermission={table.permission?.keys?.read}
            editPermission={table.permission?.keys?.update}
            deletePermission={table.permission?.keys?.delete}
        />
    );

    // Use provided renderer or default (with individual overrides support)
    const finalRenderRowActions = renderRowActions || defaultRenderRowActions;
    const effectiveViewMode: ViewMode = isBrowseMode ? "card" : viewMode;
    const cardRowClickHandler =
        onRowClick || (isBrowseMode ? ((onView || setDetailRow) as (row: TData) => void) : undefined);

    return (
        <div className="grid gap-4 h-full font-inter grid-rows-[auto_1fr_auto]">
            <Toolbar
                table={table}
                headerActions={headerActions}
                extraHeaderActions={extraHeaderActions}
                browseActions={browseActions}
                viewMode={effectiveViewMode}
                onViewModeChange={setViewMode}
                showViewModeToggle={!isBrowseMode}
                showActions={!isBrowseMode}
                showCardColumnToggle={!isBrowseMode}
                compact={compactToolbar}
                hideCreate={hideCreate}
            />

            <div
                ref={containerRef}
                className={`h-full rounded-md bg-card text-foreground flex flex-col overflow-hidden w-full ${
                    effectiveViewMode === "card" ? "border-0" : "border"
                }`}
            >
                {effectiveViewMode === "table" ? (
                    <>
                        <Table className="table-fixed">
                            <colgroup>
                                {isExpandable && <col style={{ width: 40 }} />}
                                <col style={{ width: 20 }} />
                                <col style={{ width: 50 }} />
                                {table.visibleFields.map((f: any) => (
                                    <col key={f.name} style={{ width: columnWidths[f.name] || 150 }} />
                                ))}
                                {showActionsColumn && <col style={{ width: ACTION_COLUMN_WIDTH }} />}
                            </colgroup>
                            <TableHeader className="bg-background z-10 sticky top-0 shadow-xs">
                                <TableRow>
                                    {isExpandable && <TableHead style={{ width: 40 }} />}
                                    <TableHead style={{ width: 20 }}>
                                        <SelectAllCheckbox table={table} idField={schema.idField} />
                                    </TableHead>
                                    <TableHead style={{ width: 50 }} className="text-center">
                                        #
                                    </TableHead>
                                    {table.visibleFields.map((f: any) => (
                                        <SortableHeader
                                            key={f.name}
                                            field={f}
                                            sortState={table.sortState}
                                            onToggleSort={table.toggleSort}
                                            width={columnWidths[f.name] || 150}
                                            onResizeStart={(e) => onResizeStart(f.name, e)}
                                            dateFormat={dateFormats[f.name]}
                                            onDateFormatCycle={f.type === "date" ? cycleDateFormat : undefined}
                                        />
                                    ))}
                                    {showActionsColumn && (
                                        <TableHead
                                            style={{ width: ACTION_COLUMN_WIDTH }}
                                            className="sticky right-0 z-30 bg-background border-l border-border/70 shadow-[-8px_0_10px_-10px_rgba(0,0,0,0.45)]"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="whitespace-nowrap">Actions</span>
                                                <ColumnToggle
                                                    schema={schema}
                                                    columnVisibility={table.columnVisibility}
                                                    toggleFieldVisibility={table.toggleFieldVisibility}
                                                    compact
                                                    align="end"
                                                    tooltip="Column visibility"
                                                />
                                            </div>
                                        </TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>

                            {table.data?.length > 0 && (
                                <TableBody
                                    className={
                                        table.isFetching ? "opacity-50 transition-opacity" : "transition-opacity"
                                    }
                                >
                                    {table.data.map((row: any, index: number) => {
                                        const id = row[schema.idField];
                                        const isExpanded = isExpandable && expandedRows.has(id);
                                        const expandColSpan =
                                            (isExpandable ? 1 : 0) +
                                            1 +
                                            1 +
                                            table.visibleFields.length +
                                            (showActionsColumn ? 1 : 0);

                                        return (
                                            <Fragment key={id}>
                                                <TableRow
                                                    key={id}
                                                    className="group w-full odd:bg-accent even:bg-background [&>td]:h-[inherit] [&>td]:overflow-hidden"
                                                    style={{
                                                        height: rowHeight,
                                                        minHeight: rowHeight,
                                                        maxHeight: rowHeight,
                                                    }}
                                                    onClick={(e) => {
                                                        try {
                                                            const target = e.target as HTMLElement | null;
                                                            if (target && target.closest("button, a, input, label"))
                                                                return;
                                                        } catch (err) {
                                                            console.error("Error checking click target:", err);
                                                        }
                                                        if (onRowClick) onRowClick(row);
                                                    }}
                                                >
                                                    {isExpandable && (
                                                        <TableCell className="p-0 text-center">
                                                            <button
                                                                className="flex items-center justify-center w-full h-full p-2 text-muted-foreground hover:text-foreground transition-colors"
                                                                onClick={(e) => toggleExpand(id, e)}
                                                                aria-label={isExpanded ? "Collapse row" : "Expand row"}
                                                            >
                                                                <ChevronRight
                                                                    className="h-4 w-4 transition-transform duration-200"
                                                                    style={{
                                                                        transform: isExpanded
                                                                            ? "rotate(90deg)"
                                                                            : "rotate(0deg)",
                                                                    }}
                                                                />
                                                            </button>
                                                        </TableCell>
                                                    )}

                                                    <TableCell>
                                                        <RowSelection id={id} table={table} />
                                                    </TableCell>

                                                    <TableCell className="text-center text-muted-foreground">
                                                        {(table.page || 0) * (table.size || 10) + index + 1}
                                                    </TableCell>

                                                    {table.visibleFields.map((f: any) => {
                                                        const content = renderCell?.(row, f);
                                                        return content !== undefined ? (
                                                            <TableCell key={f.name}>{content}</TableCell>
                                                        ) : (
                                                            <CellRenderer
                                                                key={f.name}
                                                                field={f}
                                                                value={row[f.name]}
                                                                relationOptions={table.relationOptions}
                                                                disableBooleanToggle={!(table.permission?.canUpdate ?? true)}
                                                                onBooleanToggle={(fieldName, newValue) => {
                                                                    if (!(table.permission?.canUpdate ?? true)) return;
                                                                    table.patchField(id, fieldName, newValue);
                                                                }}
                                                                dateFormat={
                                                                    f.type === "date"
                                                                        ? (dateFormats[f.name] ?? "datetime")
                                                                        : undefined
                                                                }
                                                            />
                                                        );
                                                    })}

                                                    {showActionsColumn && (
                                                        <TableCell
                                                            style={{ width: ACTION_COLUMN_WIDTH }}
                                                            className={`sticky right-0 z-20 border-l border-border/70 ${
                                                                index % 2 === 0 ? "bg-accent" : "bg-background"
                                                            } group-hover:bg-muted/50 shadow-[-8px_0_10px_-10px_rgba(0,0,0,0.35)]`}
                                                        >
                                                            <div className="flex items-center gap-1 overflow-hidden">
                                                                {finalRenderRowActions(row)}
                                                            </div>
                                                        </TableCell>
                                                    )}
                                                </TableRow>

                                                {isExpanded && (
                                                    <TableRow
                                                        key={`${id}-expanded`}
                                                        className="bg-background hover:bg-background"
                                                    >
                                                        <TableCell colSpan={expandColSpan} className="p-0 border-b">
                                                            {expandable?.renderExpandedRow
                                                                ? expandable.renderExpandedRow(row)
                                                                : schema.fields
                                                                      .filter((f: any) => f.expandable)
                                                                      .map((f: any) =>
                                                                          f.renderExpanded ? (
                                                                              f.renderExpanded(row[f.name], row)
                                                                          ) : (
                                                                              <div key={f.name} className="p-3">
                                                                                  <CellRenderer
                                                                                      field={f}
                                                                                      value={row[f.name]}
                                                                                      relationOptions={
                                                                                          table.relationOptions
                                                                                      }
                                                                                      disableBooleanToggle={
                                                                                          !(table.permission?.canUpdate ??
                                                                                              true)
                                                                                      }
                                                                                      onBooleanToggle={(
                                                                                          fieldName,
                                                                                          newValue,
                                                                                      ) => {
                                                                                          if (
                                                                                              !(table.permission?.canUpdate ??
                                                                                                  true)
                                                                                          ) {
                                                                                              return;
                                                                                          }

                                                                                          table.patchField(
                                                                                              id,
                                                                                              fieldName,
                                                                                              newValue,
                                                                                          );
                                                                                      }
                                                                                      }
                                                                                      dateFormat={
                                                                                          f.type === "date"
                                                                                              ? (dateFormats[f.name] ??
                                                                                                "datetime")
                                                                                              : undefined
                                                                                      }
                                                                                  />
                                                                              </div>
                                                                          ),
                                                                      )}
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </TableBody>
                            )}
                        </Table>

                        {!table.data?.length && (
                            <div className="flex-1 flex items-center justify-center">
                                {table.loading ? <Loading /> : <NoResult />}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {table.data?.length > 0 ? (
                            <CardView
                                table={table}
                                onRowClick={cardRowClickHandler}
                                showActions={
                                    (!isBrowseMode || allowBrowseRowActions) && showActionsColumn
                                }
                                renderRowActions={
                                    (!isBrowseMode || allowBrowseRowActions) && showActionsColumn
                                        ? finalRenderRowActions
                                        : undefined
                                }
                                onView={onView || setDetailRow}
                                onEdit={onEdit || table.openEdit}
                                onDelete={onDelete || setDeleteItem}
                                disableBooleanToggle={
                                    (isBrowseMode && !allowBrowseRowActions) ||
                                    !(table.permission?.canUpdate ?? true)
                                }
                                selectable={!isBrowseMode}
                                showIndex={!isBrowseMode}
                                renderCard={renderCard}
                                layout={cardLayout}
                                onBooleanToggle={(id, fieldName, newValue) => {
                                    if (isBrowseMode && !allowBrowseRowActions) return;
                                    if (!(table.permission?.canUpdate ?? true)) return;
                                    table.patchField(id, fieldName, newValue);
                                }}
                            />
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                {table.loading ? <Loading /> : <NoResult />}
                            </div>
                        )}
                    </>
                )}
            </div>

            <Pagination
                table={table}
                isAutoSize={isAutoSize}
                autoSize={calculatedSize}
                showSelectionSummary={!isBrowseMode}
                onPageSizeChange={(value) => {
                    if (value === "auto") {
                        setIsAutoSize(true);
                        table.setSize(calculatedSize);
                    } else {
                        setIsAutoSize(false);
                        table.setSize(Number(value));
                    }
                    table.setPage(0);
                }}
            />

            {/* Form Modal: Use custom renderer if provided, otherwise use default */}
            {renderFormModal ? (
                renderFormModal({
                    open: table.isFormOpen,
                    onClose: (open) => {
                        if (!open) table.setFieldErrors({});
                        table.setFormOpen(open);
                    },
                    schema,
                    initial: table.editingRow,
                    onSubmit: (data) => {
                        if (table.editingRow) {
                            table.update({ id: table.editingRow[schema.idField], data });
                        } else {
                            table.create(data);
                        }
                    },
                })
            ) : (
                <FormModal
                    open={table.isFormOpen}
                    onClose={(open) => {
                        if (!open) table.setFieldErrors({});
                        table.setFormOpen(open);
                    }}
                    schema={schema}
                    initial={table.editingRow}
                    title={table.editingRow ? "Edit" : "Create"}
                    isSubmitting={table.isSubmitting}
                    relationOptions={table.relationOptions}
                    fieldErrors={table.fieldErrors}
                    onSubmit={(data) => {
                        if (table.editingRow) {
                            table.update({ id: table.editingRow[schema.idField], data });
                        } else {
                            table.create(data);
                        }
                    }}
                />
            )}

            {/* Delete Confirmation Modal: Always use internal system */}
            <ConfirmDeleteModal
                open={!!deleteItem}
                onOpenChange={(open) => !open && setDeleteItem(null)}
                onConfirm={handleDeleteConfirm}
                loading={deleteLoading}
            />

            {/* Detail View Modal: Always use internal system */}
            <DetailModal
                open={!!detailRow}
                onClose={(open) => !open && setDetailRow(null)}
                schema={schema}
                row={detailRow}
                relationOptions={table.relationOptions}
            />
        </div>
    );
}
