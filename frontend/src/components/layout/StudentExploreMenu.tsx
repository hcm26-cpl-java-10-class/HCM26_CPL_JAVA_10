import { courseApi } from "@/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CategoryTreeDTO } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronDown, Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface StudentExploreMenuProps {
  canBrowse: boolean;
  canRecommend: boolean;
}

interface CategoryLink {
  id: number;
  name: string;
  depth: number;
}

function categoryLinks(nodes: CategoryTreeDTO[], depth = 0): CategoryLink[] {
  return nodes.flatMap((node) => [
    ...(node.totalCourseCount === 0 ? [] : [{ id: node.id, name: node.name, depth }]),
    ...categoryLinks(node.children ?? [], depth + 1),
  ]);
}

export function StudentExploreMenu({ canBrowse, canRecommend }: StudentExploreMenuProps) {
  const location = useLocation();
  const categories = useQuery({
    queryKey: ["course-catalog-categories"],
    queryFn: courseApi.getCatalogCategories,
    enabled: canBrowse,
    staleTime: 5 * 60 * 1000,
  });

  if (!canBrowse) return null;

  const links = categoryLinks(categories.data ?? []);
  const selectedCategory = location.pathname === "/courses"
    ? new URLSearchParams(location.search).get("category")
    : null;
  const active = location.pathname === "/courses" || location.pathname.startsWith("/courses/")
    || (canRecommend && location.pathname === "/student/recommendations");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Explore courses"
          className={cn(
            "h-9 shrink-0 rounded-[10px] border border-transparent px-3 text-sm shadow-none hover:bg-sidebar-accent",
            active && "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
          )}
        >
          Explore <ChevronDown className="size-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[calc(100vw-2rem)] max-w-2xl p-3 sm:w-[40rem]"
        aria-label="Explore courses menu"
      >
        <div className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
              Explore
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className={cn(location.pathname === "/courses" && !selectedCategory && "bg-accent")}>
              <Link to="/courses"><BookOpen /> Browse courses</Link>
            </DropdownMenuItem>
            {canRecommend && (
              <DropdownMenuItem asChild className={cn(location.pathname === "/student/recommendations" && "bg-accent")}>
                <Link to="/student/recommendations"><Sparkles /> For you</Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
              Categories
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {categories.isLoading && <DropdownMenuItem disabled>Loading categories…</DropdownMenuItem>}
            {categories.isError && <DropdownMenuItem disabled>Categories are unavailable</DropdownMenuItem>}
            {!categories.isLoading && !categories.isError && links.length === 0 && (
              <DropdownMenuItem disabled>No course categories available</DropdownMenuItem>
            )}
            <div className="grid max-h-72 gap-0.5 overflow-y-auto sm:grid-cols-2">
              {links.map((category) => (
                <DropdownMenuItem
                  key={category.id}
                  asChild
                  className={cn(selectedCategory === String(category.id) && "bg-accent text-accent-foreground")}
                >
                  <Link
                    to={`/courses?category=${category.id}`}
                    style={{ paddingLeft: `${0.5 + Math.min(category.depth, 2) * 0.75}rem` }}
                  >
                    <span className="min-w-0 truncate">{category.name}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuGroup>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
