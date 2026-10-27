import React from "react";
import { Award, Printer, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CertificateInfo } from "../learning.types";

interface CertificateViewerModalProps {
  certificate: CertificateInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CertificateViewerModal: React.FC<CertificateViewerModalProps> = ({
  certificate,
  isOpen,
  onClose,
}) => {
  if (!certificate) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-[#141414] border-[#2e2e2e] text-white p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Certificate of Achievement - {certificate.courseTitle}</DialogTitle>
          <DialogDescription>Verified Certificate of Completion for {certificate.recipientName}</DialogDescription>
        </DialogHeader>

        {/* Certificate Outer Container */}
        <div className="p-6 sm:p-8 relative">
          {/* Certificate Decorative Frame */}
          <div className="rounded-xl border-2 border-amber-500/40 p-6 sm:p-8 bg-gradient-to-b from-[#181d28] via-[#141720] to-[#10131a] relative overflow-hidden text-center shadow-2xl">
            {/* Corner ornaments */}
            <div className="absolute top-2 left-2 size-4 border-t-2 border-l-2 border-amber-400" />
            <div className="absolute top-2 right-2 size-4 border-t-2 border-r-2 border-amber-400" />
            <div className="absolute bottom-2 left-2 size-4 border-b-2 border-l-2 border-amber-400" />
            <div className="absolute bottom-2 right-2 size-4 border-b-2 border-r-2 border-amber-400" />

            {/* Header / Logo */}
            <div className="flex justify-center mb-4">
              <div className="size-16 rounded-full bg-amber-500/10 border-2 border-amber-400/50 flex items-center justify-center text-amber-400 shadow-md">
                <Award className="size-9" />
              </div>
            </div>

            <p className="text-xs uppercase tracking-widest text-amber-400 font-bold mb-1">
              FAMS & LMS Certificate of Completion
            </p>
            <p className="text-xs text-neutral-400 mb-6">
              This is to certify that
            </p>

            {/* Recipient Name */}
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-4">
              {certificate.recipientName || "Enterprise Learner"}
            </h2>

            <p className="text-xs text-neutral-400 mb-2">
              has successfully fulfilled all curriculum requirements and completed
            </p>

            {/* Course Title */}
            <h3 className="text-lg sm:text-xl font-bold text-blue-400 mb-4 max-w-lg mx-auto">
              {certificate.courseTitle}
            </h3>

            {/* Issuer & Grade */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-300 my-4 py-3 border-y border-[#2a3040]">
              <span>Issued by: <strong className="text-white">{certificate.issuer}</strong></span>
              <span>•</span>
              <span>Date: <strong className="text-white">{certificate.issuedDate}</strong></span>
              {certificate.grade && (
                <>
                  <span>•</span>
                  <span>Result: <strong className="text-emerald-400">{certificate.grade}</strong></span>
                </>
              )}
            </div>

            {/* Credential ID */}
            <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-500 mt-4">
              <ShieldCheck className="size-3.5 text-blue-400" />
              <span>Credential ID: <code className="text-neutral-400 font-mono">{certificate.id}</code></span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="bg-transparent border-neutral-700 text-neutral-200 hover:bg-neutral-800 hover:text-white"
            >
              <Printer className="size-4 mr-1.5" />
              Print / Save as PDF
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onClose}
              className="bg-[#2563eb] hover:bg-blue-600 text-white"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
