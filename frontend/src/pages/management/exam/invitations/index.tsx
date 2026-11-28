import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Mail, RefreshCw, Users } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function InvitationsLandingPage() {
    const navigate = useNavigate();

    const overviewQuery = useQuery({
        queryKey: ["invitation-overviews"],
        queryFn: async () => {
            const { examApi } = await import("@/api");
            return examApi.listInvitationOverviews();
        },
        retry: false,
    });

    const rows = overviewQuery.data ?? [];

    return (
        <MainLayout pathName={{ invitations: "Exam Invitations" }}>
            <section className="flex flex-col gap-6">
                <header className="border-b border-border/40 pb-4">
                    <div className="mb-2 flex items-center gap-2 text-cyan-500">
                        <Mail className="size-4" />
                        <span className="text-sm font-medium">Teacher Area</span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        Exam Invitations
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Exams that currently have invitations. Open an exam to manage its
                        invitations, reminders and audit log.
                    </p>
                </header>

                {overviewQuery.isError && (
                    <Card className="border-destructive/50 bg-destructive/5">
                        <CardContent className="py-4 text-sm text-destructive">
                            Failed to load the invitation overview.
                        </CardContent>
                    </Card>
                )}

                {overviewQuery.isLoading ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        Loading invitations...
                    </p>
                ) : rows.length === 0 ? (
                    <Card className="border-dashed bg-card/50">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="mb-4 rounded-lg bg-muted/50 p-3 text-muted-foreground">
                                <Mail className="size-8" />
                            </div>
                            <h3 className="text-base font-semibold text-foreground">
                                No exam invitations yet
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Invitations will appear here once you create them for one of your
                                exams.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="overflow-hidden rounded-md border bg-background">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Exam</TableHead>
                                    <TableHead className="w-20 text-center">Total</TableHead>
                                    <TableHead className="w-24 text-center">Accepted</TableHead>
                                    <TableHead className="w-24 text-center">Anonymous</TableHead>
                                    <TableHead className="w-24 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.examId}>
                                        <TableCell>
                                            <p className="font-medium">{row.examTitle}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {row.completed ?? 0} completed ·{" "}
                                                {row.pending ?? 0} pending
                                            </p>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary">{row.total ?? 0}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="default">{row.accepted ?? 0}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="gap-1">
                                                <Users className="size-3" />
                                                {row.anonymous ?? 0}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                title="Open invitations"
                                                onClick={() =>
                                                    navigate(`/exams/${row.examId}/invitations`)
                                                }
                                            >
                                                <ChevronRight className="size-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {overviewQuery.isFetching && !overviewQuery.isLoading && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <RefreshCw className="size-3.5 animate-spin" />
                        Refreshing...
                    </span>
                )}
            </section>
        </MainLayout>
    );
}
