import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus";
import { BookOpen, Check, ChevronDown, Home } from "lucide-react";
import { Link } from "react-router-dom";

interface SubjectPageHeaderProps {
  action: "Create Subject" | "Edit Subject" | null;
  onBackToList: () => void;
}

export function SubjectPageHeader({ action, onBackToList }: SubjectPageHeaderProps) {
  const { data: groups = [] } = useActiveModuleGroups();
  const group = groups.find((item) => item.name === "Subjects & Scheduling")
    ?? groups.find((item) => item.modules.some((module) => module.url === "/subjects"));
  const modules = group?.modules.filter((module) => module.url?.startsWith("/")) ?? [];
  const linkClass = "rounded-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <section aria-labelledby="subjects-page-title" className="space-y-4 border-b pb-5">
      <Breadcrumb aria-label="Subjects navigation">
        <BreadcrumbList className="gap-x-2 gap-y-2 text-sm sm:gap-x-2">
          <BreadcrumbItem>
            <BreadcrumbLink asChild className={linkClass}>
              <Link to="/" className="inline-flex items-center gap-1.5">
                <Home className="size-3.5" aria-hidden="true" />
                FAMS &amp; LMS
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {modules.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={`inline-flex items-center gap-1 ${linkClass}`}>
                    Subjects &amp; Scheduling
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-3rem)]">
                  <DropdownMenuLabel>Subjects &amp; Scheduling</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {modules.map((module) => (
                    <DropdownMenuItem key={module.id ?? module.url} asChild>
                      <Link
                        to={module.url!}
                        onClick={onBackToList}
                        aria-current={module.url === "/subjects" && !action ? "page" : undefined}
                        className="flex items-center justify-between gap-3"
                      >
                        <span>{module.title || module.name}</span>
                        {module.url === "/subjects" && <Check className="size-4 text-primary" aria-hidden="true" />}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span>Subjects &amp; Scheduling</span>
            )}
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {action ? (
              <BreadcrumbLink asChild className={linkClass}>
                <Link to="/subjects" onClick={onBackToList}>Subjects</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage className="font-semibold text-primary">Subjects</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {action && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold text-primary">{action}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BookOpen className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 id="subjects-page-title" className="text-2xl font-semibold tracking-tight text-foreground">
            {action ?? "Subjects"}
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {action === "Create Subject"
              ? "Add a subject and set its technical group, hours and status."
              : action === "Edit Subject"
                ? "Update the subject details, technical group, hours and status."
                : "Manage subject details, technical groups, hours and status."}
          </p>
        </div>
      </div>
    </section>
  );
}
