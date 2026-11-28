import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CourseRecommendations } from "@/pages/management/demo/course/components/CourseRecommendations";
import { recommendationFiltersFromParams } from "@/pages/management/demo/course/components/recommendation-filters";
import { Link, useSearchParams } from "react-router-dom";
import { useRef } from "react";
export default function RecommendedCoursesPage() {
  const [params, setParams] = useSearchParams();
  const latestParams = useRef(params);
  latestParams.current = params;
  const filters = recommendationFiltersFromParams(params);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const updateParams = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(latestParams.current);
    change(next);
    latestParams.current = next;
    setParams(next, { replace: true });
  };
  return <MainLayout pathName={{ recommendations: "For you" }}><div className="mx-auto max-w-7xl space-y-5">
    <header className="space-y-3"><h1 className="text-3xl font-bold">For you</h1>
    <p className="text-muted-foreground">Discover courses for your interests.</p>
    <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/courses">Browse all courses</Link></Button><Button asChild variant="outline"><Link to="/learning-paths">Learning paths</Link></Button></div></header>
    <label className="block space-y-2"><span>Search recommendations</span>
    <Input value={params.get("q") ?? ""} onChange={e => updateParams(next => { e.target.value ? next.set("q", e.target.value) : next.delete("q"); next.delete("page"); })} /></label>
    <CourseRecommendations
      search={params.get("q") ?? ""}
      filters={filters}
      page={page}
      onPageChange={nextPage => updateParams(next => nextPage > 1 ? next.set("page", String(nextPage)) : next.delete("page"))}
      onFiltersChange={nextFilters => updateParams(next => {
        const setList = (key: string, values: string[]) => values.length ? next.set(key, values.join(",")) : next.delete(key);
        setList("category", nextFilters.categories); setList("level", nextFilters.levels); setList("duration", nextFilters.durations); setList("rating", nextFilters.ratings);
        nextFilters.sort === "best" ? next.delete("sort") : next.set("sort", nextFilters.sort);
        next.delete("page");
      })}
    />
  </div></MainLayout>;
}
