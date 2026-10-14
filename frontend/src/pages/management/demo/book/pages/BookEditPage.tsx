import { bookApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BookDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

const initialFormState: BookDTO = {
    name: "",
    description: "",
    isActive: true,
};

function getErrorMessage(error: any, fallback: string): string {
    return error?.response?.data?.message || fallback;
}

export function BookEditPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { id } = useParams<{ id: string }>();

    const [form, setForm] = useState<BookDTO>(initialFormState);

    const bookQuery = useQuery({
        queryKey: ["book", "detail", id],
        queryFn: () => bookApi.getById(id as string),
        enabled: !!id,
    });

    useEffect(() => {
        if (!bookQuery.data) {
            return;
        }

        setForm({
            name: bookQuery.data.name || "",
            description: bookQuery.data.description || "",
            isActive: bookQuery.data.isActive ?? true,
        });
    }, [bookQuery.data]);

    const updateMutation = useMutation({
        mutationFn: (payload: BookDTO) => bookApi.update(id as string, payload),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["book"] }),
                queryClient.invalidateQueries({ queryKey: ["book", "detail", id] }),
            ]);
            toast.success("Book updated successfully.");
            navigate("/books");
        },
        onError: (error: any) => {
            toast.error(getErrorMessage(error, "Update book failed."));
        },
    });

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!id) {
            toast.error("Book id is missing.");
            return;
        }

        const name = form.name?.trim();

        if (!name) {
            toast.error("Name is required.");
            return;
        }

        updateMutation.mutate({
            ...bookQuery.data,
            ...form,
            name,
            description: form.description?.trim() || "",
            isActive: form.isActive ?? true,
        });
    };

    if (!id) {
        return (
            <MainLayout pathName={{ books: "Book", edit: "Edit" }}>
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>Missing Book Id</CardTitle>
                        <CardDescription>The edit page could not determine which book to update.</CardDescription>
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
        <MainLayout pathName={{ books: "Book", edit: "Edit" }}>
            <Card className="max-w-3xl">
                <CardHeader>
                    <CardTitle>Edit Book</CardTitle>
                    <CardDescription>Update information for book #{id}.</CardDescription>
                </CardHeader>

                {bookQuery.isLoading ? (
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Loading book data...</p>
                    </CardContent>
                ) : bookQuery.isError ? (
                    <CardContent>
                        <p className="text-sm text-destructive">
                            {getErrorMessage(bookQuery.error, "Unable to load book details.")}
                        </p>
                    </CardContent>
                ) : (
                    <CardContent>
                        <form className="grid gap-5" onSubmit={handleSubmit}>
                            <div className="grid gap-2">
                                <Label htmlFor="book-name">Name</Label>
                                <Input
                                    id="book-name"
                                    value={form.name ?? ""}
                                    onChange={(event) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            name: event.target.value,
                                        }))
                                    }
                                    placeholder="Enter book name"
                                    autoFocus
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="book-description">Description</Label>
                                <Textarea
                                    id="book-description"
                                    value={form.description ?? ""}
                                    onChange={(event) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            description: event.target.value,
                                        }))
                                    }
                                    rows={5}
                                    placeholder="Book description"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <Switch
                                    id="book-active"
                                    checked={form.isActive ?? true}
                                    onCheckedChange={(checked) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            isActive: checked,
                                        }))
                                    }
                                />
                                <Label htmlFor="book-active">Active</Label>
                            </div>

                            <CardFooter className="px-0 pt-2 flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => navigate("/books")}
                                    disabled={updateMutation.isPending}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </Button>
                                <Button type="submit" disabled={updateMutation.isPending}>
                                    <Save className="h-4 w-4" />
                                    {updateMutation.isPending ? "Saving..." : "Save changes"}
                                </Button>
                            </CardFooter>
                        </form>
                    </CardContent>
                )}
            </Card>
        </MainLayout>
    );
}
