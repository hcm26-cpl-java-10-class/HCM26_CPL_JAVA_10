import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { formatRoleLabel } from "@/utils/rbac.utils";
import { motion } from "motion/react";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

const checklistItems = [
  {
    title: "Mo danh sach books",
    text: "Xem nhanh cac dau sach dang co trong he thong.",
  },
  {
    title: "Chi che do xem",
    text: "Tai khoan STUDENT khong duoc tao, sua hoac xoa books.",
  },
];

export default function StudentLandingPage() {
  const { user, activeRole, hasPermission } = usePermissions();

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const canReadBooks = hasPermission("BOOK_READ");

  return (
    <MainLayout>
      <section className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-cyan-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-44 w-44 rounded-full bg-emerald-200/50 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
          style={{ fontFamily: '"Space Grotesk", "Segoe UI", sans-serif' }}
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge className="bg-sky-600 text-white hover:bg-sky-600">
              {formatRoleLabel(activeRole ?? "STUDENT")}
            </Badge>
            <Badge variant="secondary" className="bg-white/80 text-slate-700">
              Book list only
            </Badge>
          </div>

          <h1 className="max-w-3xl text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
            Chao mung tro lai, {displayName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-700 sm:text-base">
            Day la landing toi gian cho STUDENT. Ban chi duoc truy cap danh sach books de xem thong tin.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {canReadBooks ? (
              <Button asChild className="bg-slate-900 text-white hover:bg-slate-800">
                <Link to="/books">
                  Mo danh sach books
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            ) : (
              <Button disabled variant="outline" className="border-slate-300 bg-white/80">
                Khong co quyen BOOK_READ
              </Button>
            )}
          </div>
        </motion.div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {checklistItems.map((item, index) => {
          return (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 + index * 0.08, ease: "easeOut" }}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              style={{ fontFamily: '"DM Sans", "Segoe UI", sans-serif' }}
            >
              <div className="inline-flex rounded-xl bg-slate-100 p-2 text-slate-700">
                <CheckCircle2 className="size-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
            </motion.article>
          );
        })}
      </section>

      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.45 }}
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div className="flex items-center gap-3 text-slate-700">
          <BookOpen className="size-5" />
          <p className="text-sm">
            Neu can chinh sua noi dung sach, vui long lien he TEACHER hoac ADMIN.
          </p>
        </div>
      </motion.section>
    </MainLayout>
  );
}
