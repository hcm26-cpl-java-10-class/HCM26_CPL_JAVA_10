import { useState } from "react";
import { authApi } from "@/api/features/auth.api";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import type { RegisterRequest } from "@/types/features/auth";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const onRegister = async (data: RegisterRequest) => {
        setLoading(true);
        try {
            await authApi.register(data);
            toast.success("Registration successful! Please verify your email before logging in.");
            navigate("/login");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] p-6">
            <div className="w-full max-w-lg overflow-hidden bg-white shadow-2xl rounded-[32px] border border-gray-100 transition-all">
                <RegisterForm onSubmit={onRegister} loading={loading} />
                <div className="text-center mb-6">
                    Forgot Password?{" "}
                    <Link to="/forgot-password" className="text-blue-600 hover:underline">
                        Reset here
                    </Link>
                </div>
            </div>
        </div>
    );
}
