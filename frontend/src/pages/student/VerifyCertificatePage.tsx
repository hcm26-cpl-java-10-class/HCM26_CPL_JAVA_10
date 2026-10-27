import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { certificateApi } from "@/api";
import type { CertificateVerificationDTO } from "@/types";

export default function VerifyCertificatePage() {
  const { verificationToken } = useParams<{
    verificationToken: string;
  }>();

  const [certificate, setCertificate] =
    useState<CertificateVerificationDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const verify = async () => {
      if (!verificationToken) {
        setError("Liên kết xác minh không hợp lệ.");
        setLoading(false);
        return;
      }

      try {
        const result = await certificateApi.verify(verificationToken);

        if (active) {
          setCertificate(result);
        }
      } catch {
        if (active) {
          setError(
            "Không tìm thấy chứng chỉ hoặc liên kết xác minh không hợp lệ.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, [verificationToken]);

  if (loading) {
    return <main className="p-8">Đang xác minh chứng chỉ...</main>;
  }

  if (error || !certificate) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-bold">Xác minh chứng chỉ</h1>
        <p className="mt-4 text-red-600" role="alert">
          {error || "Không tìm thấy chứng chỉ."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <section className="rounded-2xl border p-8 text-center shadow-sm">
        <div className="text-4xl" aria-hidden="true">
          {certificate.valid ? "✓" : "!"}
        </div>

        <h1 className="mt-4 text-2xl font-bold">
          {certificate.valid
            ? "Chứng chỉ hợp lệ"
            : "Chứng chỉ không hợp lệ"}
        </h1>

        <p className="mt-6 text-gray-600">
          Chứng chỉ được cấp cho
        </p>

        <p className="mt-2 text-2xl font-semibold">
          {certificate.studentName}
        </p>

        <p className="mt-4 text-gray-600">
          Đã hoàn thành khóa học
        </p>

        <p className="mt-1 text-xl font-medium">
          {certificate.courseName}
        </p>

        <p className="mt-4 text-sm text-gray-600">
          Ngày cấp:{" "}
          {certificate.issuedAt
            ? new Date(
                `${certificate.issuedAt}T00:00:00`,
              ).toLocaleDateString("vi-VN")
            : "—"}
        </p>
      </section>
    </main>
  );
}