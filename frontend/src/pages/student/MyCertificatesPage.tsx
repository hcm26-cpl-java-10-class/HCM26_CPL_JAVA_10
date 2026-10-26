import { useEffect, useState } from "react";
import { certificateApi } from "@/api";
import type { CertificateDTO } from "@/types";

export default function MyCertificatesPage() {
  const [certificates, setCertificates] = useState<CertificateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadCertificates = async () => {
      try {
        const data = await certificateApi.getMyCertificates();

        if (active) {
          setCertificates(data);
        }
      } catch {
        if (active) {
          setError("Không thể tải danh sách chứng chỉ. Vui lòng thử lại.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadCertificates();

    return () => {
      active = false;
    };
  }, []);

  const copyVerificationLink = async (token: string) => {
    const url =
      `${window.location.origin}/verify-certificate/${encodeURIComponent(token)}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
    } catch {
      setError("Không thể sao chép liên kết. Vui lòng thử lại.");
    }
  };

  if (loading) {
    return <div className="p-6">Đang tải chứng chỉ...</div>;
  }

  if (error && certificates.length === 0) {
    return (
      <div className="p-6" role="alert">
        {error}
        <button
          className="ml-3 underline"
          onClick={() => window.location.reload()}
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">My Certificates</h1>
        <p className="mt-2 text-gray-600">
          Xem và chia sẻ các chứng chỉ bạn đã đạt được.
        </p>
      </header>

      {error && (
        <p className="mb-4 text-red-600" role="alert">
          {error}
        </p>
      )}

      {certificates.length === 0 ? (
        <section className="rounded-xl border p-8 text-center">
          <h2 className="text-xl font-semibold">
            Bạn chưa có chứng chỉ nào
          </h2>
          <p className="mt-2 text-gray-600">
            Hoàn thành tất cả bài học trong một khóa học để nhận chứng chỉ.
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {certificates.map((certificate) => {
            const token = certificate.verificationToken;

            return (
              <article
                key={certificate.id ?? token}
                className="rounded-xl border bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-lg bg-blue-50 p-3 text-blue-700">
                    <span aria-hidden="true">🏆</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-500">
                      CERTIFICATE OF COMPLETION
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      {certificate.courseName || "Khóa học"}
                    </h2>
                  </div>
                </div>

                <p className="text-sm text-gray-600">
                  Học viên: {certificate.userFullName || "—"}
                </p>

                <p className="mt-1 text-sm text-gray-600">
                  Ngày cấp:{" "}
                  {certificate.issuedAt
                    ? new Date(
                        `${certificate.issuedAt}T00:00:00`,
                      ).toLocaleDateString("vi-VN")
                    : "—"}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  {token && (
                    <>
                      <button
                        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                        onClick={() =>
                          window.open(
                            `/verify-certificate/${encodeURIComponent(token)}`,
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                      >
                        Xem chứng chỉ
                      </button>

                      <button
                        className="rounded-lg border px-4 py-2 hover:bg-gray-50"
                        onClick={() => void copyVerificationLink(token)}
                      >
                        {copiedToken === token
                          ? "Đã sao chép!"
                          : "Sao chép liên kết"}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}