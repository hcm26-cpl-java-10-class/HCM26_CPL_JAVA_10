import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function StudentInvitationsPage() {
    // Giả sử lấy dữ liệu invitations từ API
    const invitations: any[] = [];

    return (
        <MainLayout pathName={{ invitations: "Exam Invitations" }}>
            <section className="flex flex-col gap-6">
                {/* Header Section */}
                <header className="border-b pb-4 border-border/40">
                    <div className="mb-2 flex items-center gap-2 text-cyan-500">
                        <Mail className="size-4" />
                        <span className="text-sm font-medium">Student Area</span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        Exam Invitations
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Accept invitations to enter exams. Once accepted, you can join immediately or return to this list anytime.
                    </p>
                </header>

                {/* Empty State Card */}
                {invitations.length === 0 && (
                    <Card className="border-dashed bg-card/50">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="mb-4 rounded-lg bg-muted/50 p-3 text-muted-foreground">
                                <Mail className="size-8" />
                            </div>
                            <h3 className="text-base font-semibold text-foreground">
                                No exam invitations yet
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                New invitations will appear here once created by your instructor.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </section>
        </MainLayout>
    );
}