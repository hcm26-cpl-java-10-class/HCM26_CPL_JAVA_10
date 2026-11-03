import { MainLayout } from "@/components/layout/MainLayout";

export default function ContentPage() {
    return (
        <MainLayout pathName={{ training: "Training Operations", "content": "Content" }}>
            <div className="min-h-full w-full" />
        </MainLayout>
    );
}
