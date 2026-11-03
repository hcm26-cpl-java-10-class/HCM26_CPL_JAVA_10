import { MainLayout } from "@/components/layout/MainLayout";

export default function AuditPage() {
    return (
        <MainLayout pathName={{ training: "Training Operations", "audit": "Audit" }}>
            <div className="min-h-full w-full" />
        </MainLayout>
    );
}
