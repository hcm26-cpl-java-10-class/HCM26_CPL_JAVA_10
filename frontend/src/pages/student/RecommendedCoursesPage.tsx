import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CourseRecommendations } from "@/pages/management/demo/course/components/CourseRecommendations";
import { Link, useSearchParams } from "react-router-dom";
export default function RecommendedCoursesPage() {
  const [params, setParams] = useSearchParams();
  return <MainLayout pathName={{ recommendations: "For you" }}><div className="mx-auto max-w-7xl space-y-5">
    <header className="space-y-3"><h1 className="text-3xl font-bold">For you</h1>
    <p className="text-muted-foreground">Discover courses for your interests.</p>
    <Button asChild variant="outline"><Link to="/courses">Browse all courses</Link></Button></header>
    <label className="block space-y-2"><span>Search recommendations</span>
    <Input value={params.get("q") ?? ""} onChange={e => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} /></label>
    <CourseRecommendations search={params.get("q") ?? ""} />
  </div></MainLayout>;
}
