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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const initialFormState: BookDTO = {
    name: "",
    description: "",
    isActive: true,
};

function getErrorMessage(error: any, fallback: string): string {
    return error?.response?.data?.message || fallback;
}

export function BookCreatePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [form, setForm] = useState<BookDTO>(initialFormState);

    const createMutation = useMutation({
        mutationFn: (payload: BookDTO) => bookApi.create(payload),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["book"] });
            toast.success("Book created successfully.");
            navigate("/books");
        },
        onError: (error: any) => {
            toast.error(getErrorMessage(error, "Create book failed."));
        },
    });

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const name = form.name?.trim();

        if (!name) {
            toast.error("Name is required.");
            return;
        }

        createMutation.mutate({
            ...form,
            name,
            description: form.description?.trim() || "",
            isActive: form.isActive ?? true,
        });
    };

    return (
        <MainLayout pathName={{ books: "Book", create: "Create" }}>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Create Book</CardTitle>
                    <CardDescription>Use this custom page to create a new book record.</CardDescription>
                </CardHeader>

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
                                disabled={createMutation.isPending}
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>
                            <Button type="submit" disabled={createMutation.isPending}>
                                <Save className="h-4 w-4" />
                                {createMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                        </CardFooter>
                    </form>
                </CardContent>
            </Card>
        </MainLayout>
    );
}
