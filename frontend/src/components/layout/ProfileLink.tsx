import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProfileLink() {
  return (
    <Button asChild variant="ghost" size="icon" title="Profile" aria-label="Profile">
      <Link to="/profile">
        <UserRound size={18} />
      </Link>
    </Button>
  );
}
