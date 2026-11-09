import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TopicList } from "../content/components/TopicList";
import { TopicDetailView } from "../content/components/TopicDetailView";
import type { TopicItem } from "@/types/features/content";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TopicManagementPage() {
  const [selectedTopic, setSelectedTopic] = useState<TopicItem | null>(null);

  return (
    <MainLayout pathName={{ training: "Training Management", content: "Topics & Syllabus" }}>
      <div className="flex-1 flex flex-col space-y-4">
        {/* Page Title Header under Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-gray-200/80 gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
              <BookOpen className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  {selectedTopic ? selectedTopic.name : "Topics & Syllabus"}
                </h1>
                <Badge variant="outline" className="text-[11px] font-semibold bg-indigo-50/60 text-indigo-700 border-indigo-200">
                  {selectedTopic ? `Topic: ${selectedTopic.code}` : "Curriculum & Syllabus"}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedTopic
                  ? `Đề cương giáo trình FSOFT, kế hoạch giảng dạy chi tiết và tiêu chí đánh giá môn ${selectedTopic.code}`
                  : "Quản lý danh mục môn học, đề cương giáo trình chuẩn FSOFT, phân bổ thời gian và chi tiết lịch trình đào tạo"}
              </p>
            </div>
          </div>
        </div>

        {selectedTopic ? (
          <TopicDetailView
            topic={selectedTopic}
            onBack={() => setSelectedTopic(null)}
            onEdit={() => {
              toast.info("Please edit topic from the topic list");
            }}
          />
        ) : (
          <TopicList
            onViewDetail={(topic) => {
              setSelectedTopic(topic);
            }}
          />
        )}
      </div>
    </MainLayout>
  );
}

