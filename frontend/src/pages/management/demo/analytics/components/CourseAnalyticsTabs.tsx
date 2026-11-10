import { useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Building2,
  ClipboardList,
  Clock,
  GraduationCap,
  LineChart,
  MessageSquareWarning,
  Star,
  Trophy,
} from "lucide-react";
import { ActivityTab } from "@/pages/management/demo/analytics/tabs/ActivityTab";
import { ContentQualityQnATab } from "@/pages/management/demo/analytics/tabs/ContentQualityQnATab";
import { CourseRankingTab } from "@/pages/management/demo/analytics/tabs/CourseRankingTab";
import { DepartmentAnalyticsTab } from "@/pages/management/demo/analytics/tabs/DepartmentAnalyticsTab";
import { ExamAnalyticsTab } from "@/pages/management/demo/analytics/tabs/ExamAnalyticsTab";
import { LessonFunnelTab } from "@/pages/management/demo/analytics/tabs/LessonFunnelTab";
import { ReviewAnalyticsTab } from "@/pages/management/demo/analytics/tabs/ReviewAnalyticsTab";
import { StudyTimeTab } from "@/pages/management/demo/analytics/tabs/StudyTimeTab";
import { TrendTab } from "@/pages/management/demo/analytics/tabs/TrendTab";

type TabDef = {
  value: string;
  label: string;
  icon: typeof LineChart;
  render: (courseId: number) => JSX.Element;
};

const TABS: TabDef[] = [
  { value: "funnel", label: "Learning Funnel", icon: LineChart, render: (id) => <LessonFunnelTab courseId={id} /> },
  { value: "trend", label: "Trends", icon: BarChart3, render: (id) => <TrendTab courseId={id} /> },
  { value: "activity", label: "Activity", icon: ClipboardList, render: (id) => <ActivityTab courseId={id} /> },
  { value: "reviews", label: "Reviews", icon: Star, render: (id) => <ReviewAnalyticsTab courseId={id} /> },
  { value: "departments", label: "Departments", icon: Building2, render: (id) => <DepartmentAnalyticsTab courseId={id} /> },
  { value: "ranking", label: "Ranking", icon: Trophy, render: (id) => <CourseRankingTab courseId={id} /> },
  { value: "content", label: "Content & Q&A", icon: MessageSquareWarning, render: (id) => <ContentQualityQnATab courseId={id} /> },
  { value: "study-time", label: "Study Time", icon: Clock, render: (id) => <StudyTimeTab courseId={id} /> },
  { value: "exams", label: "Exams", icon: GraduationCap, render: (id) => <ExamAnalyticsTab courseId={id} /> },
];

type Props = {
  courseId: number;
};

/**
 * Mỗi lần người dùng chọn tab (kể cả bấm lại tab đang mở), nội dung được
 * remount để chạy lại entrance/count-up/chart animations. React Query vẫn
 * giữ cache nên việc remount không đồng nghĩa phải tải lại dữ liệu từ API.
 */
function CourseAnalyticsTabsImpl({ courseId }: Props) {
  const queryClient = useQueryClient();
  useState(() => {
    queryClient.setQueryDefaults(["course-analytics"], {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    });
    return null;
  });

  const [tab, setTab] = useState<string>(TABS[0].value);
  const [animationKey, setAnimationKey] = useState(0);

  const handleChange = useCallback((value: string) => {
    setTab(value);
  }, []);

  const activeTab = TABS.find((item) => item.value === tab) ?? TABS[0];

  return (
    <Tabs value={tab} onValueChange={handleChange} className="gap-3">
      <div className="overflow-x-auto">
        <TabsList>
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger
                key={item.value}
                value={item.value}
                onClick={() => setAnimationKey((current) => current + 1)}
              >
                <Icon />
                {item.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      <div key={`${activeTab.value}-${animationKey}`} className="min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab.render(courseId)}
      </div>
    </Tabs>
  );
}

export const CourseAnalyticsTabs = memo(CourseAnalyticsTabsImpl);
