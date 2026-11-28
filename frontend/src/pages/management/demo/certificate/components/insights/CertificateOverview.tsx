import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Users,
  BookOpen,
  Building2,
} from "lucide-react";

import { certificateInsightsApi } from "@/api";

function OverviewCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {title}
        </p>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="mt-3 text-2xl font-bold">
        {value}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export function CertificateOverview() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["certificate-insights", "overview"],
    queryFn: certificateInsightsApi.getOverview,
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-xl bg-muted"
          />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        Failed to load certificate statistics.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <OverviewCard
        title="Total Certificates"
        value={data.totalCertificates.toLocaleString()}
        icon={Award}
        description="Certificates issued"
      />

      <OverviewCard
        title="Certified Learners"
        value={data.uniqueLearners.toLocaleString()}
        icon={Users}
        description="Unique certificate holders"
      />

      <OverviewCard
        title="Courses"
        value={data.uniqueCourses.toLocaleString()}
        icon={BookOpen}
        description="Courses with certificates"
      />

      <OverviewCard
        title="Departments"
        value={data.departmentsWithCertificates.toLocaleString()}
        icon={Building2}
        description="Departments represented"
      />
    </div>
  );
}
