import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLearningRoadmap } from "@/api/features/learning-roadmap.api";
import { usePermissions } from "@/hooks/usePermissions";
import { LearningRecordsPanel } from "../../learning/components/LearningRecordsPanel";

export function LearningOverviewCard() {
  const { user, canLearn } = usePermissions();
  const canUseRoadmap = canLearn && user.permissions.includes("COURSE_READ");
  const roadmap = useLearningRoadmap(user.email, canUseRoadmap);

  return <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-3">
      <CardTitle>Learning Overview</CardTitle>
      <Link to="/my-learning" className="text-sm text-blue-600 hover:underline dark:text-blue-400">View My Learning</Link>
    </CardHeader>
    <CardContent><LearningRecordsPanel compact courseProgress={roadmap.data?.enrolledCourses} /></CardContent>
  </Card>;
}
