import { MainLayout } from "@/components/layout/MainLayout";

export default function TraineePage() {
    return (
        <MainLayout pathName={{ training: "Training Operations", "trainee": "Trainee" }}>
            <div className="min-h-full w-full" />
        </MainLayout>
    );
}
