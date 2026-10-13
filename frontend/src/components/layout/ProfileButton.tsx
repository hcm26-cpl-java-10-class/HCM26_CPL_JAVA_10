import { Button } from "@/components/ui/button";
import type { RootState } from "@/store/store";
import { UserRound } from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

export default function ProfileButton() {
    const navigate = useNavigate();
    const { firstName } = useSelector((state: RootState) => state.auth);

    return (
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/profile")}>
            <UserRound size={16} />
            <span className="hidden sm:inline max-w-[120px] truncate">{firstName || "Profile"}</span>
        </Button>
    );
}