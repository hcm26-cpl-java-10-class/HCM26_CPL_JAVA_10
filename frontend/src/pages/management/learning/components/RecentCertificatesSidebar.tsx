import React from "react";
import { Award } from "lucide-react";
import type { CertificateInfo } from "../learning.types";

interface RecentCertificatesSidebarProps {
  certificates: CertificateInfo[];
  onViewCertificate: (cert: CertificateInfo) => void;
}

export const RecentCertificatesSidebar: React.FC<RecentCertificatesSidebarProps> = ({
  certificates,
  onViewCertificate,
}) => {
  const displayCerts = certificates.slice(0, 3);

  const handleAddToLinkedIn = (cert: CertificateInfo) => {
    const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
      cert.courseTitle
    )}&organizationName=${encodeURIComponent(cert.issuer)}&issueYear=2026&issueMonth=10&certId=${encodeURIComponent(
      cert.id
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="bg-[#141414] dark:bg-[#141414] rounded-xl border border-[#262626] dark:border-[#262626] p-5 shadow-sm">
      <h4 className="text-sm font-bold text-white mb-4">
        Recent Certificates and Badges
      </h4>

      {displayCerts.length === 0 ? (
        <div className="text-center py-6 px-3 bg-[#1a1a1a] rounded-lg border border-dashed border-[#2e2e2e]">
          <Award className="size-8 text-neutral-500 mx-auto mb-2" />
          <p className="text-xs font-medium text-neutral-300">No certificates issued yet</p>
          <p className="text-[11px] text-neutral-500 mt-1">
            Complete enrolled courses with 80%+ passing score to earn verified certificates.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayCerts.map((cert) => (
            <div key={cert.id} className="flex items-start gap-3">
              {/* Badge Icon / Logo */}
              <div className="size-10 rounded-lg bg-[#1e293b] border border-[#334155] flex items-center justify-center text-blue-400 shrink-0">
                <Award className="size-5 text-amber-400" />
              </div>

              {/* Certificate Details & Actions */}
              <div className="min-w-0 flex-1">
                <h5 className="text-xs sm:text-sm font-semibold text-white leading-tight truncate">
                  {cert.courseTitle}
                </h5>
                <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                  {cert.issuer}
                </p>

                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleAddToLinkedIn(cert)}
                    className="text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer text-[11px] hover:underline"
                  >
                    Add to LinkedIn
                  </button>

                  <button
                    type="button"
                    onClick={() => onViewCertificate(cert)}
                    className="text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer text-[11px] hover:underline"
                  >
                    View certificate
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
