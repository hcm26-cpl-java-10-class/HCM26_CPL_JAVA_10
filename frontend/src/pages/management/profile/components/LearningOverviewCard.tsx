import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LearningRecordsPanel } from "../../learning/components/LearningRecordsPanel";

export function LearningOverviewCard() {
  return <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-3">
      <CardTitle>Learning Overview</CardTitle>
      <Link to="/my-learning" className="text-sm text-blue-600 hover:underline dark:text-blue-400">View My Learning</Link>
    </CardHeader>
    <CardContent><LearningRecordsPanel compact /></CardContent>
  </Card>;
}
