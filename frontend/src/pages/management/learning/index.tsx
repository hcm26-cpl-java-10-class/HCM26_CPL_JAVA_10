import { Link } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { MainLayout } from "@/components/layout/MainLayout";
import { LearningRecordsPanel } from "./components/LearningRecordsPanel";

export function MyLearningPage() {
  const { activeRole } = usePermissions();
  return <MainLayout pathName={{ "my-learning": "My Learning", learning: "My Learning", enrollments: "My Learning", fams: "FAMS & LMS" }}>
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold">My Learning</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your enrolled courses and learning records.</p>
      </div>
      {activeRole === "STUDENT" && <Link className="inline-block text-sm text-blue-600 hover:underline dark:text-blue-400" to="/courses">Explore Catalog</Link>}
      <LearningRecordsPanel />
    </div>
  </MainLayout>;
}
export default MyLearningPage;
