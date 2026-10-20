import { departmentApi } from "@/api/features/demo/department.api";
import { PermissionGate } from "@/components/PermissionGate";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { auditableFieldsSchema, type DepartmentDTO, type EntityConfig, type EntitySchema, type FieldSchema } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LoaderCircle, Pencil, Plus, Power, Search, Trash2, Users } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { DepartmentEnrollmentDialog } from "./DepartmentEnrollmentDialog";
import { DepartmentMembersDialog } from "./DepartmentMembersDialog";

const departmentSchema: EntitySchema = {
    entityName: "department",
    idField: "id",
    fields: [
        { name: "name", label: "Department Name", type: "text", sortable: true, bold: true },
        { name: "code", label: "Department Code", type: "text", sortable: true },
        { name: "description", label: "Description", type: "textarea", sortable: false },
        ...(auditableFieldsSchema as FieldSchema[]),
    ],
};

export const entityConfig: EntityConfig = {
    name: "Department",
    path: "/departments",
    api: departmentApi,
    schema: departmentSchema,
};

export default function DepartmentManagementPage() {
    const queryClient = useQueryClient();
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<DepartmentDTO | null>(null);
    const [membersDepartment, setMembersDepartment] = useState<DepartmentDTO | null>(null);
    const [enrollDepartment, setEnrollDepartment] = useState<DepartmentDTO | null>(null);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [description, setDescription] = useState("");
    const [departmentPage, setDepartmentPage] = useState(0);
    const [departmentSearch, setDepartmentSearch] = useState("");

    const departmentsQuery = useQuery({
        queryKey: ["department-overview", departmentPage, departmentSearch],
        queryFn: async () => {
            const response = await departmentApi.getPage({
                page: departmentPage,
                size: 12,
                sort: "name,asc",
            }, departmentSearch.trim() || undefined);
            const departments = await Promise.all(
                response.content.map(async (department) => ({
                    ...department,
                    stats: department.id
                        ? await departmentApi.getStats(department.id)
                        : { members: 0, enrolledCourses: 0 },
                })),
            );
            return { departments, totalPages: response.totalPages };
        },
    });

    const saveMutation = useMutation({
        mutationFn: async (form: DepartmentDTO) => {
            if (editingDepartment?.id !== undefined) {
                return departmentApi.update(String(editingDepartment.id), form);
            }
            return departmentApi.create(form);
        },
        onSuccess: async () => {
            toast.success(editingDepartment ? "Department updated." : "Department created.");
            await queryClient.invalidateQueries({ queryKey: ["department-overview"] });
            setEditorOpen(false);
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Could not save department.");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (departmentId: number) => departmentApi.delete(String(departmentId)),
        onSuccess: async () => {
            toast.success("Department deleted.");
            await queryClient.invalidateQueries({ queryKey: ["department-overview"] });
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Could not delete department.");
        },
    });

    const activeMutation = useMutation({
        mutationFn: (department: DepartmentDTO) => {
            if (department.id === undefined) {
                throw new Error("Cannot update a department without an ID.");
            }
            return departmentApi.update(String(department.id), {
                isActive: department.isActive === false,
            });
        },
        onSuccess: async (_, department) => {
            toast.success(
                department.isActive === false ? "Department activated." : "Department deactivated.",
            );
            await queryClient.invalidateQueries({ queryKey: ["department-overview"] });
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Could not update department status.");
        },
    });

    useEffect(() => {
        if (!editorOpen) return;
        setName(editingDepartment?.name ?? "");
        setCode(editingDepartment?.code ?? "");
        setDescription(editingDepartment?.description ?? "");
    }, [editorOpen, editingDepartment]);

    const openCreateDialog = () => {
        setEditingDepartment(null);
        setEditorOpen(true);
    };

    const openEditDialog = (department: DepartmentDTO) => {
        setEditingDepartment(department);
        setEditorOpen(true);
    };

    const submitDepartment = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        saveMutation.mutate({
            name: name.trim(),
            code: code.trim(),
            description: description.trim(),
        });
    };

    const confirmDelete = (department: DepartmentDTO) => {
        if (department.id === undefined) return;
        if (window.confirm(`Delete department "${department.name}"?`)) {
            deleteMutation.mutate(department.id);
        }
    };

    return (
        <MainLayout pathName={{ departments: "Departments" }}>
            <section className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">ORGANIZATION</p>
                        <h1 className="mt-1 text-3xl font-bold tracking-tight">Department Management</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Manage department members and enroll all students in a course at once.
                        </p>
                    </div>
                    <PermissionGate permission="DEPARTMENT_CREATE">
                        <Button onClick={openCreateDialog}>
                            <Plus className="size-4" /> Create Department
                        </Button>
                    </PermissionGate>
                </div>

                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Search departments"
                        className="pl-9"
                        placeholder="Search department name, code, or description"
                        value={departmentSearch}
                        onChange={(event) => {
                            setDepartmentSearch(event.target.value);
                            setDepartmentPage(0);
                        }}
                    />
                </div>

                {departmentsQuery.isLoading ? (
                    <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" /> Loading departments...
                    </div>
                ) : departmentsQuery.isError ? (
                    <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-5">
                        <p className="text-sm text-destructive">
                            {departmentsQuery.error instanceof Error
                                ? departmentsQuery.error.message
                                : "Could not load departments."}
                        </p>
                        <Button variant="outline" onClick={() => void departmentsQuery.refetch()}>
                            Try again
                        </Button>
                    </div>
                ) : departmentsQuery.data?.departments.length ? (
                    <div className="grid gap-5 xl:grid-cols-2">
                        {departmentsQuery.data.departments.map((department) => (
                            <article key={department.id} className="rounded-2xl border bg-card p-5 shadow-sm">
                                <div className="flex items-start gap-4">
                                    <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                        <Building2 className="size-8" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-xl font-semibold">{department.name}</h2>
                                            <Badge className={department.isActive === false
                                                ? "border-0 bg-muted text-muted-foreground"
                                                : "border-0 bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-300"}>
                                                {department.isActive === false ? "Inactive" : "Active"}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {department.description || department.code}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">Code: {department.code}</p>
                                    </div>
                                    <PermissionGate permission="DEPARTMENT_UPDATE">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Edit ${department.name}`}
                                            onClick={() => openEditDialog(department)}
                                        >
                                            <Pencil className="size-4" />
                                        </Button>
                                    </PermissionGate>
                                    <PermissionGate permission="DEPARTMENT_UPDATE">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={department.isActive === false ? `Activate ${department.name}` : `Deactivate ${department.name}`}
                                            disabled={activeMutation.isPending}
                                            onClick={() => activeMutation.mutate(department)}
                                        >
                                            <Power className={`size-4 ${department.isActive === false ? "text-green-700" : "text-muted-foreground"}`} />
                                        </Button>
                                    </PermissionGate>
                                    <PermissionGate permission="DEPARTMENT_DELETE">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Delete ${department.name}`}
                                            disabled={deleteMutation.isPending}
                                            onClick={() => confirmDelete(department)}
                                        >
                                            <Trash2 className="size-4 text-destructive" />
                                        </Button>
                                    </PermissionGate>
                                </div>

                                <div className="mt-5 grid grid-cols-2 gap-4 border-t pt-5">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Members</p>
                                        <p className="mt-2 text-2xl font-bold">{department.stats.members}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Enrolled courses</p>
                                        <p className="mt-2 text-2xl font-bold">{department.stats.enrolledCourses}</p>
                                    </div>
                                </div>

                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                    <PermissionGate permission="USER_UPDATE">
                                        <Button
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => setMembersDepartment(department)}
                                        >
                                            <Users className="size-4" /> Manage Members
                                        </Button>
                                    </PermissionGate>
                                    <PermissionGate permission="ENROLLMENT_CREATE">
                                        <Button
                                            className="w-full"
                                            disabled={department.stats.members === 0 || department.isActive === false}
                                            onClick={() => setEnrollDepartment(department)}
                                        >
                                            Enroll Course
                                        </Button>
                                    </PermissionGate>
                                </div>
                            </article>
                        ))}
                        {departmentsQuery.data.totalPages > 1 && (
                            <div className="col-span-full flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    Page {departmentPage + 1} of {departmentsQuery.data.totalPages}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        disabled={departmentPage === 0}
                                        onClick={() => setDepartmentPage((page) => page - 1)}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        disabled={departmentPage >= departmentsQuery.data.totalPages - 1}
                                        onClick={() => setDepartmentPage((page) => page + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : departmentSearch.trim() ? (
                    <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
                        <h2 className="text-lg font-semibold">No matching departments</h2>
                        <p className="mt-2 text-sm text-muted-foreground">Try another name, code, or description.</p>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
                        <Building2 className="mx-auto size-12 text-muted-foreground" />
                        <h2 className="mt-4 text-lg font-semibold">No departments yet</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Create a department to organize students and enroll them in courses in bulk.
                        </p>
                    </div>
                )}
            </section>

            <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingDepartment ? "Edit Department" : "Create Department"}</DialogTitle>
                        <DialogDescription>
                            Add the department name, unique code, and an optional description.
                        </DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={submitDepartment}>
                        <div className="space-y-2">
                            <label htmlFor="department-name" className="text-sm font-medium">Name</label>
                            <Input
                                id="department-name"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                maxLength={150}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="department-code" className="text-sm font-medium">Code</label>
                            <Input
                                id="department-code"
                                value={code}
                                onChange={(event) => setCode(event.target.value)}
                                maxLength={50}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="department-description" className="text-sm font-medium">Description</label>
                            <Textarea
                                id="department-description"
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                maxLength={500}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={saveMutation.isPending}>
                                {saveMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
                                {editingDepartment ? "Save changes" : "Create Department"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {membersDepartment && (
                <DepartmentMembersDialog
                    department={membersDepartment}
                    open={membersDepartment !== null}
                    onOpenChange={(open) => {
                        if (!open) setMembersDepartment(null);
                    }}
                />
            )}
            {enrollDepartment && (
                <DepartmentEnrollmentDialog
                    department={enrollDepartment}
                    open={enrollDepartment !== null}
                    onOpenChange={(open) => {
                        if (!open) setEnrollDepartment(null);
                    }}
                />
            )}
        </MainLayout>
    );
}
