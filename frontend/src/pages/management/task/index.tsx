import { Navigate, useSearchParams } from "react-router-dom";

export default function TaskManagementPage() {
  const [params] = useSearchParams();
  const destination = params.get("overdue") === "true" || params.get("view") === "inactive"
    ? `/management/alerts?view=${params.get("view") === "inactive" ? "INACTIVE" : "BACKLOG"}`
    : "/backlogs";
  return <Navigate replace to={destination} />;
}
