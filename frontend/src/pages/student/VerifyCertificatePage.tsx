import {
  Award,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  Download,
  GraduationCap,
  Share2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { certificateApi } from "@/api";
import type { CertificateVerificationDTO } from "@/types";
import { downloadCertificate } from "../management/demo/certificate/utils/downloadCertificate";

function formatDate(date?: string): string {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
}

export default function VerifyCertificatePage() {
  const { verificationToken } = useParams<{
    verificationToken: string;
  }>();

  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState("");

  const certificateQuery = useQuery<CertificateVerificationDTO>({
    queryKey: ["verify-certificate", verificationToken],
    queryFn: () => certificateApi.verify(verificationToken!),
    enabled: Boolean(verificationToken),
    retry: false,
  });

  const certificate = certificateQuery.data;

  const verificationUrl =
    typeof window !== "undefined" && verificationToken
      ? `${window.location.origin}/verify-certificate/${encodeURIComponent(
          verificationToken,
        )}`
      : "";

  const isValid = certificate?.valid === true;

  const handleShare = async () => {
    if (!certificate || !verificationUrl) return;

    setShareError("");

    const shareData = {
      title: `Certificate - ${certificate.courseName || "Course"}`,
      text: `Verify the certificate of ${
        certificate.studentName || "the student"
      } for ${certificate.courseName || "this course"}.`,
      url: verificationUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(verificationUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      try {
        await navigator.clipboard.writeText(verificationUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        setShareError("Unable to share the link. Please copy the URL manually.");
      }
    }
  };

  const handleCopyLink = async () => {
    if (!verificationUrl) return;

    setShareError("");

    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareError("Unable to copy the link. Please copy the URL manually.");
    }
  };

  const handleDownload = () => {
    if (!certificate || !isValid) return;

    downloadCertificate({
      studentName: certificate.studentName || "Student",
      courseName: certificate.courseName || "Course",
      issuedAt: certificate.issuedAt || "",
      verificationUrl,
    });
  };

  if (!verificationToken) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <XCircle className="mx-auto size-12 text-red-500" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">
              Invalid verification link
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              The verification token is missing from this URL.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (certificateQuery.isPending) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex min-h-72 flex-col items-center justify-center gap-3">
            <div className="size-9 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
            <p className="text-sm text-slate-500">
              Verifying certificate...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (certificateQuery.isError || !certificate) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <XCircle className="mx-auto size-12 text-red-500" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">
              Certificate not found
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              We could not find a certificate matching this verification link.
              Please check the link and try again.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Brand header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a
            href="/"
            className="flex min-w-0 items-center gap-3"
            aria-label="RBAC System home"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-700 text-sm font-bold text-white shadow-sm">
              RB
            </div>

            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-900 sm:text-lg">
                RBAC System
              </p>
            </div>
          </a>

          <div className="hidden items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 sm:flex">
            <ShieldCheck className="size-4" />
            Certificate Verification
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Page title */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <ShieldCheck className="size-4 text-blue-700" />
            <span>RBAC System</span>
            <span>/</span>
            <span>Certificate Verification</span>
          </div>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Certificate Verification
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Verify the authenticity of this certificate and review the
            certificate details.
          </p>
        </div>

        {/* Verification info left, certificate right */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* LEFT: Verification information */}
          <aside className="order-2 min-w-0 space-y-4 lg:order-1">
            {/* Verification status */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                {isValid ? (
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="size-6 text-emerald-600" />
                  </div>
                ) : (
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-red-100">
                    <XCircle className="size-6 text-red-600" />
                  </div>
                )}

                <div className="min-w-0">
                  <h2
                    className={`font-semibold ${
                      isValid ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {isValid
                      ? "Certificate is valid"
                      : "Certificate is invalid"}
                  </h2>

                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {isValid
                      ? "This certificate has been successfully verified."
                      : "The authenticity of this certificate could not be confirmed."}
                  </p>
                </div>
              </div>

              <div className="my-5 border-t border-slate-100" />

              {/* Student */}
              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <GraduationCap className="size-5 text-blue-700" />
                  </div>

                  <div className="min-w-0 pt-0.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Student name
                    </p>
                    <p className="mt-1 wrap-break-word font-semibold text-slate-900">
                      {certificate.studentName || "—"}
                    </p>
                  </div>
                </div>

                {/* Course */}
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <Award className="size-5 text-blue-700" />
                  </div>

                  <div className="min-w-0 pt-0.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Course name
                    </p>
                    <p className="mt-1 wrap-break-word font-semibold text-slate-900">
                      {certificate.courseName || "—"}
                    </p>
                  </div>
                </div>

                {/* Issue date */}
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <CalendarDays className="size-5 text-blue-700" />
                  </div>

                  <div className="min-w-0 pt-0.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Issued on
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {formatDate(certificate.issuedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Share and download actions */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">
                Certificate actions
              </h2>

              <p className="mt-1 text-sm leading-5 text-slate-500">
                Share this verification link or download a PDF copy of the
                certificate.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <Share2 className="size-4" />
                  Share certificate
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!isValid}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="size-4" />
                  Download PDF
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {copied ? (
                    <Check className="size-4 text-emerald-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? "Link copied" : "Copy verification link"}
                </button>
              </div>

              {shareError && (
                <p role="alert" className="mt-3 text-xs leading-5 text-red-600">
                  {shareError}
                </p>
              )}

              {!isValid && (
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  PDF download is unavailable because this certificate has not
                  been verified as valid.
                </p>
              )}
            </section>
          </aside>

          {/* RIGHT: Full certificate preview */}
          <section className="order-1 min-w-0 space-y-4 lg:order-2">
            <div className="certificate-print-area relative overflow-hidden border border-blue-200 bg-white text-slate-900 shadow-lg">
              <div className="relative aspect-[1.414/1] min-h-90 overflow-hidden p-5 sm:p-8 lg:p-10">
                {/* Decorative background */}
                <div className="pointer-events-none absolute left-0 top-0 size-24 bg-linear-to-br from-blue-100 to-transparent" />
                <div className="pointer-events-none absolute bottom-0 right-0 size-40 bg-linear-to-tl from-blue-100 to-transparent" />
                <div className="pointer-events-none absolute bottom-8 right-8 size-44 rounded-full border border-blue-100/80" />
                <div className="pointer-events-none absolute bottom-12 right-12 size-36 rounded-full border border-blue-100/80" />

                <div className="relative flex h-full flex-col">
                  {/* Certificate brand */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-700 text-xs font-bold text-white sm:size-11 sm:text-sm">
                        RB
                      </div>

                      <div>
                        <p className="text-sm font-bold sm:text-base">
                          RBAC System
                        </p>
                        <p className="text-[9px] text-slate-500 sm:text-xs">
                          Online Learning Platform
                        </p>
                      </div>
                    </div>

                    <span className="text-right text-[8px] font-medium uppercase tracking-widest text-blue-700 sm:text-[10px]">
                      Learning Achievement
                    </span>
                  </div>

                  {/* Certificate ribbon */}
                  <div className="absolute right-0 top-14 hidden w-20 flex-col items-center bg-blue-700 px-2 py-5 text-center text-white sm:flex lg:right-3 lg:top-16 lg:w-24">
                    <GraduationCap className="size-7" />

                    <span className="mt-2 text-[9px] font-semibold leading-3 tracking-wide">
                      COURSE
                      <br />
                      COMPLETION
                    </span>

                    <Award className="mt-2 size-5 text-blue-200" />

                    <div className="absolute -bottom-3 left-0 size-0 w-0 border-x-40 border-t-12 border-x-transparent border-t-blue-700 lg:border-x-48" />
                  </div>

                  {/* Main certificate text */}
                  <div className="mt-8 max-w-[88%] sm:mt-10 sm:max-w-[78%]">
                    <p className="text-xl font-medium leading-tight tracking-wide text-indigo-800 sm:text-3xl lg:text-4xl">
                      Certificate of Completion
                    </p>

                    <p className="mt-4 text-xs text-slate-500 sm:text-sm">
                      This certifies that
                    </p>

                    <h2 className="mt-2 wrap-break-word text-lg font-bold leading-tight text-slate-900 sm:text-2xl lg:text-3xl">
                      {certificate.studentName || "Student"}
                    </h2>

                    <p className="mt-3 text-xs leading-5 text-slate-600 sm:text-sm">
                      has successfully completed the course
                    </p>

                    <h3 className="mt-2 wrap-break-word text-sm font-bold leading-snug text-blue-700 sm:text-lg lg:text-xl">
                      {certificate.courseName || "Course"}
                    </h3>
                  </div>

                  {/* Issue date and verification URL */}
                  <div className="relative mt-auto grid gap-4 border-t border-blue-100 pt-4 sm:mt-8 sm:grid-cols-2 sm:gap-5 sm:pt-5">
                    <div className="flex items-start gap-2">
                      <CalendarDays className="mt-0.5 size-4 shrink-0 text-blue-700 sm:size-5" />

                      <div>
                        <p className="text-[9px] text-slate-500 sm:text-xs">
                          Issued on
                        </p>
                        <p className="mt-1 text-[10px] font-semibold sm:text-xs">
                          {formatDate(certificate.issuedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 items-start gap-2">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-700 sm:size-5" />

                      <div className="min-w-0">
                        <p className="text-[9px] text-slate-500 sm:text-xs">
                          Verify this certificate
                        </p>
                        <a
                          href={verificationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block break-all text-[9px] leading-4 text-blue-700 underline decoration-blue-300 underline-offset-2 sm:text-[10px]"
                        >
                          {verificationUrl}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/70 p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-700" />
              <p className="text-xs leading-5 text-slate-600">
                This certificate can be verified publicly through RBAC System
                using its unique verification link.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
