import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { examApi } from "@/api";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Mail, Search } from "lucide-react";

/**
 * Landing page that lets trainers/admin pick which exam they want to manage invitations for.
 * This is mounted at /invitations (an admin-sidebar link added by useSidebarMenus).
 */
export default function InvitationsLandingPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");

    const examsQuery = useQuery({
        queryKey: ["invitations-landing-exams", search],
        queryFn: () =>
            examApi.getPage({ page: 0, size: 100, sort: "createdAt,desc" }, search),
    });

    const exams = examsQuery.data?.content ?? [];

    return (
        <MainLayout pathName={{ invitations: "Quản lý lời mời" }}>
            <section className="flex flex-col gap-5">
                <header className="border-b pb-4">
                    <div className="mb-2 flex items-center gap-2 text-cyan-700">
                        <Mail className="size-5" />
                        <span className="text-sm font-medium">Exam Management</span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Lời mời thi</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Chọn một đề thi để xem và quản lý danh sách lời mời.
                    </p>
                </header>

                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Tìm đề thi"
                        className="pl-9"
                        placeholder="Tìm theo tên đề thi"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Danh sách đề thi</CardTitle>
                        <CardDescription>
                            {exams.length} đề thi {search ? "khớp tìm kiếm" : "hoạt động"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {examsQuery.isLoading && (
                            <p className="p-6 text-center text-sm text-muted-foreground">
                                Đang tải danh sách đề thi...
                            </p>
                        )}
                        {examsQuery.isError && (
                            <div role="alert" className="m-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                                Không thể tải danh sách đề thi. Vui lòng thử lại.
                            </div>
                        )}
                        {!examsQuery.isLoading && !examsQuery.isError && exams.length === 0 && (
                            <p className="p-10 text-center text-sm text-muted-foreground">
                                {search
                                    ? `Không tìm thấy đề thi khớp với "${search}".`
                                    : "Chưa có đề thi nào để gửi lời mời."}
                            </p>
                        )}
                        {exams.length > 0 && (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tên đề thi</TableHead>
                                        <TableHead className="w-32">Thời lượng</TableHead>
                                        <TableHead className="w-32">Trạng thái</TableHead>
                                        <TableHead className="w-12" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {exams.map((exam) => (
                                        <TableRow
                                            key={exam.id}
                                            className="cursor-pointer"
                                            onClick={() => exam.id && navigate(`/exams/${exam.id}/invitations`)}
                                        >
                                            <TableCell className="font-medium">{exam.title}</TableCell>
                                            <TableCell>{exam.durationMinutes} phút</TableCell>
                                            <TableCell>
                                                <Badge variant={exam.isActive ? "default" : "outline"}>
                                                    {exam.isActive ? "Hoạt động" : "Ngưng"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label="Mở lời mời"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (exam.id) navigate(`/exams/${exam.id}/invitations`);
                                                    }}
                                                >
                                                    <ChevronRight />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </section>
        </MainLayout>
    );
}