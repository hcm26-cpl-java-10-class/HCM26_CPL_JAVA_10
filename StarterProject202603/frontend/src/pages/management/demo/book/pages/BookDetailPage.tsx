import { bookApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { PermissionGate } from "@/components/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, PenSquare } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

function getErrorMessage(error: any, fallback: string): string {
    return error?.response?.data?.message || fallback;
}

function formatDate(value?: string): string {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

export function BookDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    const bookQuery = useQuery({
        queryKey: ["book", "detail", id],
        queryFn: () => bookApi.getById(id as string),
        enabled: !!id,
    });

    if (!id) {
        return (
            <MainLayout pathName={{ books: "Book", detail: "Detail" }}>
                <Card className="max-w-3xl">
                    <CardHeader>
                        <CardTitle>Missing Book Id</CardTitle>
                        <CardDescription>The detail page could not determine which book to display.</CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button variant="outline" onClick={() => navigate("/books")}>
                            <ArrowLeft className="h-4 w-4" />
                            Back to list
                        </Button>
                    </CardFooter>
                </Card>
            </MainLayout>
        );
    }

    return (
        <MainLayout pathName={{ books: "Book", detail: "Detail" }}>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Book Detail</CardTitle>
                    <CardDescription>Detailed information for book #{id}.</CardDescription>
                </CardHeader>

                {bookQuery.isLoading ? (
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Loading book detail...</p>
                    </CardContent>
                ) : bookQuery.isError ? (
                    <CardContent>
                        <p className="text-sm text-destructive">
                            {getErrorMessage(bookQuery.error, "Unable to load book detail.")}
                        </p>
                    </CardContent>
                ) : (
                    <CardContent className="grid gap-4 text-sm">
                        <div className="grid gap-1">
                            <span className="font-medium text-muted-foreground">Name</span>
                            <span className="text-base font-semibold">{bookQuery.data?.name || "-"}</span>
                        </div>

                        <div className="grid gap-1">
                            <span className="font-medium text-muted-foreground">Description</span>
                            <p className="leading-6">{bookQuery.data?.description || "-"}</p>
                        </div>

                        <div className="grid gap-1">
                            <span className="font-medium text-muted-foreground">Status</span>
                            <div>
                                <Badge variant={bookQuery.data?.isActive ? "default" : "secondary"}>
                                    {bookQuery.data?.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="grid gap-1">
                                <span className="font-medium text-muted-foreground">Created At</span>
                                <span>{formatDate(bookQuery.data?.createdAt)}</span>
                            </div>
                            <div className="grid gap-1">
                                <span className="font-medium text-muted-foreground">Updated At</span>
                                <span>{formatDate(bookQuery.data?.updatedAt)}</span>
                            </div>
                        </div>
                    </CardContent>
                )}

                <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => navigate("/books")}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <PermissionGate permission="BOOK_UPDATE">
                        <Button asChild>
                            <Link to={`/books/${id}/edit`}>
                                <PenSquare className="h-4 w-4" />
                                Edit
                            </Link>
                        </Button>
                    </PermissionGate>
                </CardFooter>
            </Card>
        </MainLayout>
    );
}
