import { MainLayout } from "@/components/layout/MainLayout";

export default function ReportsPage() {
    return (
        <MainLayout pathName={{ training: "Training Management", "reports": "Reports" }}>
            <div className="min-h-full w-full" />
        </MainLayout>
    );
}
