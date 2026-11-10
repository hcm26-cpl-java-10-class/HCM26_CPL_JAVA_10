import { MainLayout } from "@/components/layout/MainLayout";

export default function LogWorkPage() {
    return (
        <MainLayout pathName={{ training: "Training Management", "log-work": "Log Work" }}>
            <div className="min-h-full w-full" />
        </MainLayout>
    );
}
