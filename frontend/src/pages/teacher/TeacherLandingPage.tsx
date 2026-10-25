import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { formatRoleLabel } from "@/utils/rbac.utils";
import { motion } from "motion/react";
import { ArrowRight, BookOpen, ClipboardCheck, FileCheck2, Flag, GraduationCap, PenSquare } from "lucide-react";
import { Link } from "react-router-dom";

const teacherCapabilities = [
  {
    key: "COURSE_CREATE",
    label: "Create a course",
    description: "Publish a course for students to discover and enroll in.",
    icon: PenSquare,
  },
  {
    key: "COURSE_UPDATE",
    label: "Manage your catalog",
    description: "Update course details, descriptions, and thumbnails.",
    icon: ClipboardCheck,
  },
  {
    key: "COURSE_READ",
    label: "Preview courses",
    description: "Review the courses available in the learning catalog.",
    icon: GraduationCap,
  },
];

export default function TeacherLandingPage() {
  const { user, activeRole, hasPermission } = usePermissions();

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const mockProjectId = import.meta.env.VITE_MILESTONE_MOCK_PROJECT_ID || "11111111-1111-1111-1111-111111111111";

  return (
    <MainLayout>
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-amber-600 text-white hover:bg-amber-600">
            {formatRoleLabel(activeRole ?? "TEACHER")}
          </Badge>
          <Badge variant="secondary" className="bg-white/80 text-slate-700">
            Course management
          </Badge>
        </div>

        <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
          Xin chao {displayName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-700 sm:text-base">
          Create and manage courses for students. Published courses appear in the student course catalog.
        </p>

        <div className="mt-6">
          <Button asChild className="bg-slate-900 text-white hover:bg-slate-800">
            <Link to="/courses">
              Manage courses
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="ml-3 border-slate-300 bg-white/80">
            <Link to="/books">
              <BookOpen className="mr-2 size-4" /> Manage books
            </Link>
          </Button>
          <Button asChild variant="outline" className="mt-3 border-slate-300 bg-white/80 sm:ml-3 sm:mt-0">
            <Link to={`/projects/${mockProjectId}/milestones`}>
              <Flag className="mr-2 size-4" /> Manage milestones
            </Link>
          </Button>
          <Button asChild variant="outline" className="mt-3 border-slate-300 bg-white/80 sm:ml-3 sm:mt-0">
            <Link to="/rubrics"><FileCheck2 className="mr-2 size-4" /> Manage rubrics</Link>
          </Button>
        </div>
      </motion.section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {teacherCapabilities.map((item, index) => {
          const Icon = item.icon;
          const enabled = hasPermission(item.key);

          return (
            <motion.article
              key={item.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 + index * 0.08, ease: "easeOut" }}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="inline-flex rounded-xl bg-slate-100 p-2 text-slate-700">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{item.label}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                {enabled ? "Enabled" : "Missing permission"}
              </p>
            </motion.article>
          );
        })}
      </section>
    </MainLayout>
  );
}
