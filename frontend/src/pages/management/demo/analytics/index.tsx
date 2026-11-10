import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Building2,
  ClipboardList,
  GraduationCap,
  LineChart,
  MessageSquareWarning,
  Star,
  Trophy,
} from "lucide-react";
import { AnalyticsCourseSelect } from "@/pages/management/demo/analytics/components/AnalyticsCourseSelect";
import { ExportExcelButton } from "@/pages/management/demo/analytics/components/ExportExcelButton";
import { ActivityTab } from "@/pages/management/demo/analytics/tabs/ActivityTab";
import { ContentQualityQnATab } from "@/pages/management/demo/analytics/tabs/ContentQualityQnATab";
import { CourseRankingTab } from "@/pages/management/demo/analytics/tabs/CourseRankingTab";
import { DepartmentAnalyticsTab } from "@/pages/management/demo/analytics/tabs/DepartmentAnalyticsTab";
import { ExamAnalyticsTab } from "@/pages/management/demo/analytics/tabs/ExamAnalyticsTab";
import { LessonFunnelTab } from "@/pages/management/demo/analytics/tabs/LessonFunnelTab";
import { ReviewAnalyticsTab } from "@/pages/management/demo/analytics/tabs/ReviewAnalyticsTab";
import { TrendTab } from "@/pages/management/demo/analytics/tabs/TrendTab";
import { courseAnalyticsApi } from "@/api/features/demo/course-analytics.api";

const TABS = [
  { value: "funnel", label: "Phễu học tập", icon: LineChart },
  { value: "trend", label: "Xu hướng", icon: BarChart3 },
  { value: "activity", label: "Hoạt động", icon: ClipboardList },
  { value: "reviews", label: "Đánh giá", icon: Star },
  { value: "departments", label: "Phòng ban", icon: Building2 },
  { value: "ranking", label: "Xếp hạng", icon: Trophy },
  { value: "content", label: "Chất lượng & Q&A", icon: MessageSquareWarning },
  { value: "exams", label: "Bài thi", icon: GraduationCap },
] as const;

export default function CourseAnalyticsPage() {
  const [courseId, setCourseId] = useState<number | null>(null);
  const [tab, setTab] = useState<string>("funnel");

  return (
    <MainLayout pathName={{ analytics: "Analytics", courses: "Course Analytics" }}>
      <div className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-blue-600">COURSE ANALYTICS</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Phân tích khóa học</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Phễu học tập, xu hướng theo thời gian, mức độ hoạt động, đánh giá, hiệu quả
              theo phòng ban, xếp hạng khóa học, chất lượng nội dung và kết quả bài thi.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <AnalyticsCourseSelect value={courseId} onChange={setCourseId} />
            {courseId ? (
              <ExportExcelButton
                label="Export tất cả (Excel)"
                successMessage="Đã export toàn bộ analytics ra file Excel nhiều sheet."
                size="default"
                onExport={() => courseAnalyticsApi.exportAll(courseId)}
              />
            ) : null}
          </div>
        </header>

        {!courseId ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card py-16 text-center">
            <BarChart3 className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Hãy chọn một khóa học ở góc trên bên phải để xem phân tích.
            </p>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="gap-4">
            <div className="overflow-x-auto">
              <TabsList>
                {TABS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TabsTrigger key={item.value} value={item.value}>
                      <Icon />
                      {item.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <TabsContent value="funnel">
              <LessonFunnelTab courseId={courseId} />
            </TabsContent>
            <TabsContent value="trend">
              <TrendTab courseId={courseId} />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityTab courseId={courseId} />
            </TabsContent>
            <TabsContent value="reviews">
              <ReviewAnalyticsTab courseId={courseId} />
            </TabsContent>
            <TabsContent value="departments">
              <DepartmentAnalyticsTab courseId={courseId} />
            </TabsContent>
            <TabsContent value="ranking">
              <CourseRankingTab courseId={courseId} />
            </TabsContent>
            <TabsContent value="content">
              <ContentQualityQnATab courseId={courseId} />
            </TabsContent>
            <TabsContent value="exams">
              <ExamAnalyticsTab courseId={courseId} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
