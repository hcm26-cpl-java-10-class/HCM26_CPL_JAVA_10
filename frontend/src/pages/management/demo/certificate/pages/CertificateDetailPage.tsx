import { certificateApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { CertificateVerificationDTO } from "@/types";
import {
  Award,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  Download,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

export default function CertificateDetailPage() {
  const { verificationToken } = useParams<{
    verificationToken: string;
  }>();

  const [copied, setCopied] = useState(false);

    const certificateQuery = useQuery<CertificateVerificationDTO>({
        queryKey: ["certificate-verification", verificationToken],
        queryFn: () => certificateApi.verify(verificationToken!),
        enabled: Boolean(verificationToken),
        retry: false,
    });



  const certificate = certificateQuery.data;

  const verificationUrl = certificate?.verificationToken
    ? `${window.location.origin}/verify-certificate/${encodeURIComponent(
        certificate.verificationToken,
      )}`
    : "";

  const formatDate = (date?: string) => {
    if (!date) return "N/A";

    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) return date;

    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(parsedDate);
  };

  const handleShare = async () => {
    if (!verificationUrl) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "My Course Certificate",
          text: `View my certificate for ${certificate?.courseName ?? "this course"}.`,
          url: verificationUrl,
        });
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
        window.prompt("Copy certificate link:", verificationUrl);
      }
    }
  };

  if (certificateQuery.isLoading) {
    return (
      <MainLayout pathName={{ certificates: "My Certificates" }}>
        <div className="mx-auto max-w-7xl space-y-5 p-6">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="h-96 animate-pulse rounded-2xl bg-muted" />
            <div className="h-130 animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (certificateQuery.isError || !certificate) {
    return (
      <MainLayout pathName={{ certificates: "My Certificates" }}>
        <div className="mx-auto max-w-3xl p-8 text-center">
          <ShieldCheck className="mx-auto size-12 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">
            Certificate Not Found
          </h1>
          <p className="mt-2 text-muted-foreground">
            This certificate could not be found. Please check the link and try again.
          </p>
        </div>
      </MainLayout>
    );
  }

  if (!certificate.valid) {
    return (
      <MainLayout pathName={{ certificates: "My Certificates" }}>
        <div className="mx-auto max-w-3xl p-8 text-center">
          <ShieldCheck className="mx-auto size-12 text-destructive" />
          <h1 className="mt-4 text-2xl font-bold">
            Certificate Could Not Be Verified
          </h1>
          <p className="mt-2 text-muted-foreground">
            The certificate could not be verified.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout pathName={{ certificates: "My Certificates" }}>
      <div className="mx-auto max-w-350 space-y-6 p-4 pb-10 sm:p-6 lg:p-8">
        {/* Page heading */}
        <header className="mb-6">
            <h1 className="text-4xl font-medium text-slate-900">
                {certificate?.courseName ?? "Certificate"}
            </h1>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.3fr]">
          {/* Left: certificate information */}
          <section className="space-y-5">
            <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex items-start gap-4">
                <div className="relative flex size-16 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  <span className="text-xl font-semibold">
                    {(certificate.studentName || "S")
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                  <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full border-2 border-card bg-white text-emerald-600 dark:bg-card">
                    <Check className="size-3.5" />
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Completed by
                  </p>
                  <h2 className="mt-1 break-words text-lg font-bold">
                    {certificate.studentName || "Student"}
                  </h2>
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="size-4 shrink-0" />
                    <span>{formatDate(certificate.issuedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-7 border-t pt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Course Completed
                </p>

                <div className="mt-3 flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    <GraduationCap className="size-5" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="break-words font-semibold leading-6">
                      {certificate.courseName || "Course"}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Certificate of Completion
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-semibold">Certificate Verified</p>
                  <p className="mt-1 text-xs leading-5">
                    This certificate has been verified by RBAC System.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Button
                className="gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={() => void handleShare()}
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copied ? "Link Copied!" : "Share Certificate"}
              </Button>

              <Button
                variant="outline"
                className="gap-2"
                
              >
                <Download className="size-4" />
                Download as PDF
              </Button>
            </div>
          </section>

          {/* Right: certificate preview */}
          <section className="min-w-0 space-y-4">
            <div className="certificate-print-area relative overflow-hidden border border-blue-200 bg-white text-slate-900 shadow-lg">
              <div className="relative aspect-[1.414/1] min-h-[360px] overflow-hidden p-5 sm:p-8 lg:p-10">
                {/* Decorative background */}
                <div className="pointer-events-none absolute left-0 top-0 size-24 bg-gradient-to-br from-blue-100 to-transparent" />
                <div className="pointer-events-none absolute bottom-0 right-0 size-40 bg-gradient-to-tl from-blue-100 to-transparent" />
                <div className="pointer-events-none absolute bottom-8 right-8 size-44 rounded-full border border-blue-100/80" />
                <div className="pointer-events-none absolute bottom-12 right-12 size-36 rounded-full border border-blue-100/80" />

                <div className="relative flex h-full flex-col">
                  {/* Brand */}
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

                  {/* Ribbon */}
                  <div className="absolute right-0 top-14 hidden w-20 flex-col items-center bg-blue-700 px-2 py-5 text-center text-white sm:flex lg:right-3 lg:top-16 lg:w-24">
                    <GraduationCap className="size-7" />
                    <span className="mt-2 text-[9px] font-semibold leading-3 tracking-wide">
                      COURSE
                      <br />
                      COMPLETION
                    </span>
                    <Award className="mt-2 size-5 text-blue-200" />
                    <div className="absolute -bottom-3 left-0 size-0 w-0 border-x-40 border-t-12 border-x-transparent border-t-blue-700 lg:border-x-[48px]" />
                  </div>

                  {/* Main certificate text */}
                  <div className="mt-8 max-w-[88%] sm:mt-10 sm:max-w-[78%]">
                    <p className="text-xl font-medium leading-tight tracking-wide text-indigo-800 sm:text-3xl lg:text-4xl">
                      Certificate of Completion
                    </p>

                    <p className="mt-4 text-xs text-slate-500 sm:text-sm">
                      This certifies that
                    </p>

                    <h3 className="mt-2 wrap-break-word text-lg font-bold leading-tight text-slate-900 sm:text-2xl lg:text-3xl">
                      {certificate.studentName || "Student"}
                    </h3>

                    <p className="mt-3 text-xs leading-5 text-slate-600 sm:text-sm">
                      has successfully completed the course
                    </p>

                    <h4 className="mt-2 break-words text-sm font-bold leading-snug text-blue-700 sm:text-lg lg:text-xl">
                      {certificate.courseName || "Course"}
                    </h4>
                  </div>

                  {/* Issue date and verification link */}
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

            <p className="text-xs leading-5 text-muted-foreground">
              This certificate confirms the completion of the course listed
              above. Use the verification link to check its authenticity.
            </p>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
