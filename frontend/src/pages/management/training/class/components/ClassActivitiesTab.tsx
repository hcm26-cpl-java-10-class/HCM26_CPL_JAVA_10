import {
    MessageSquare,
    Send,
    } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAddClassActivity, useClassActivities } from "@/hooks/useExternalLookups";
import type { ClassActivity, ExternalClass } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function ClassActivitiesTab({ classItem }: { classItem: ExternalClass }) {
    const classId = String(classItem.id);
    const { data: serverActivities, isLoading, refetch } = useClassActivities(classId);
    const addActivityMutation = useAddClassActivity(classId);

    // Filter states: 3.2 Lọc nhật ký theo Comments và History
    const [showComments, setShowComments] = useState(true);
    const [showHistory, setShowHistory] = useState(true);

    // New comment input state
    const [newComment, setNewComment] = useState("");

    // Filtered list directly from H2 database
    const activities = useMemo(() => {
        const baseList: ClassActivity[] = Array.isArray(serverActivities) ? serverActivities : [];

        return baseList.filter((item) => {
            if (item.type === "comment" && !showComments) return false;
            if (item.type === "history" && !showHistory) return false;
            return true;
        });
    }, [serverActivities, showComments, showHistory]);

    const handlePostComment = () => {
        if (!newComment.trim()) return;

        addActivityMutation.mutate(
            {
                content: newComment.trim(),
                type: "comment",
            },
            {
                onSuccess: () => {
                    setNewComment("");
                    toast.success("Đã gửi bình luận vào H2 thành công!");
                    refetch();
                },
                onError: () => {
                    toast.error("Không thể lưu bình luận vào H2!");
                },
            }
        );
    };

    return (
        <div className="space-y-6">
            {/* Top filter: 3.2 Lọc nhật ký theo Comments và History */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-6 text-sm">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Show:</span>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 select-none">
                        <Checkbox
                            checked={showComments}
                            onCheckedChange={(checked) => setShowComments(Boolean(checked))}
                        />
                        <span>Comments</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 select-none">
                        <Checkbox
                            checked={showHistory}
                            onCheckedChange={(checked) => setShowHistory(Boolean(checked))}
                        />
                        <span>History</span>
                    </label>
                </div>
            </div>

            {/* Post a comment form */}
            <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MessageSquare className="size-3.5 text-blue-600" /> Thêm ghi chú / bình luận hoạt động
                </p>
                <Textarea
                    placeholder="Nhập nội dung bình luận hoặc trao đổi về lớp học..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="text-xs"
                />
                <div className="flex justify-end">
                    <Button
                        size="sm"
                        onClick={handlePostComment}
                        disabled={!newComment.trim() || addActivityMutation.isPending}
                        className="bg-[#5944d3] hover:bg-[#4b39b5] text-white text-xs gap-1.5 h-8 px-4"
                    >
                        <Send className="size-3" />
                        {addActivityMutation.isPending ? "Đang gửi..." : "Gửi bình luận"}
                    </Button>
                </div>
            </div>

            {/* Activities Timeline: 3.1 & 3.3 */}
            {isLoading ? (
                <div className="space-y-4 py-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                            <Skeleton className="size-10 rounded-full flex-shrink-0" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/4" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : activities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                    Không có hoạt động nào phù hợp với bộ lọc đã chọn.
                </div>
            ) : (
                <div className="relative pl-6 space-y-8 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                    {activities.map((act) => {
                        const isHistory = act.type === "history";
                        return (
                            <div key={act.id} className="relative flex items-start gap-4 text-xs">
                                {/* Initials Avatar Circle */}
                                <div className="size-10 rounded-full bg-[#8792a2] text-white font-bold flex items-center justify-center flex-shrink-0 z-10 shadow-xs border-2 border-background text-xs uppercase">
                                    {act.initials || "UH"}
                                </div>

                                <div className="space-y-1.5 pt-1 flex-1">
                                    <div className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                                        <span className="font-bold mr-1">{act.author}</span>
                                        <span className="whitespace-pre-line">{act.content}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 text-[11px] font-mono">{act.timestamp}</span>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-[10px] font-bold px-1.5 py-0 uppercase tracking-wider",
                                                isHistory
                                                    ? "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
                                                    : "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300"
                                            )}
                                        >
                                            {act.type}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Bottom Actions */}
            <div className="sticky bottom-0 z-20 flex items-center justify-between pt-4 pb-2 bg-card/95 backdrop-blur-xs border-t mt-4">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    className="text-xs"
                >
                    <Link to="/classes">Back to Class List</Link>
                </Button>

                <Button
                    type="button"
                    size="sm"
                    onClick={() => toast.success("Đã đồng bộ nhật ký hoạt động mới nhất.")}
                    className="bg-[#5944d3] hover:bg-[#4b39b5] text-white text-xs px-5 shadow-sm"
                >
                    Save changes
                </Button>
            </div>
        </div>
    );
}

