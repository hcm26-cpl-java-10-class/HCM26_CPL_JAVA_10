import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { clsApi, type ClassPage, type TrainingClass } from "@/api/features/cls.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/common/NativeSelect";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { usePermissions } from "@/hooks/usePermissions";
import { ClassSetupForm } from "./components/ClassSetupForm";

export default function ClassSetupPage() {
    const [params, setParams] = useSearchParams();
    const [search, setSearch] = useState("");
    const { hasPermission } = usePermissions();
    const canRead = ["CLASS_READ", "PROGRAM_READ", "ASSIGNMENT_READ"].every(hasPermission);
    const raw = params.get("classId") || "";
    const classId = /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : undefined;
    const list = useQuery({ queryKey: ["classes", "setup-picker", search], enabled: canRead,
        queryFn: async () => {
            const response = await clsApi.getClasses({ search, size: 100 });
            return Array.isArray(response.data) ? response.data as TrainingClass[] : (response.data as ClassPage).content;
        }, retry: false });
    return <MainLayout pathName={{ "class-setup": "Class Setup" }}>
        <section className="space-y-5 rounded-lg border bg-card p-5">
            <h1 className="text-xl font-semibold">Class Setup</h1>
            {!canRead ? <ApiErrorState error={undefined} kind="forbidden" resource="Class Setup" /> : <>
                <div className="space-y-2"><Label htmlFor="setup-class-search">Search internal classes by code or name</Label>
                    <Input id="setup-class-search" value={search} onChange={event => setSearch(event.target.value)} />
                    <Label htmlFor="setup-class-picker">Internal Class</Label>
                    <NativeSelect id="setup-class-picker" value={classId || ""} onChange={event => {
                        const next = new URLSearchParams(params);
                        if (event.target.value) next.set("classId", event.target.value); else next.delete("classId");
                        setParams(next);
                    }}>
                        <option value="">Select an internal class</option>
                        {classId && !list.data?.some(c => c.id === classId) && <option value={classId}>Internal Class ID {classId}</option>}
                        {list.data?.map(c => <option key={c.id} value={c.id}>{c.code} · Internal ID {c.id}</option>)}
                    </NativeSelect>
                    <p className="text-xs text-muted-foreground">Search narrows the first 100 matching internal classes. Shared classes are not used.</p>
                    {list.isError && <ApiErrorState error={list.error} resource="Internal classes" onRetry={() => void list.refetch()} />}
                </div>
                {classId ? <><Link className="text-sm underline" to={`/classes/${classId}?tab=info`}>Back to Class Details</Link><ClassSetupForm key={classId} classId={classId} /></>
                    : <p>Select an internal class to manage its program and teaching assignments.</p>}
            </>}
        </section>
    </MainLayout>;
}
