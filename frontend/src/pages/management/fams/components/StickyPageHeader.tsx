import React, { useEffect, useRef, useState, type ReactNode } from "react";

export interface StickyPageHeaderProps {
  breadcrumbs?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Primary action button shown in compact sticky mode if different or filtered */
  compactActions?: ReactNode;
  className?: string;
}

export const StickyPageHeader: React.FC<StickyPageHeaderProps> = ({
  breadcrumbs,
  title,
  description,
  actions,
  compactActions,
  className = "",
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Use IntersectionObserver on the sentinel placed right before the header.
    // When the sentinel scrolls out of view, the header has become sticky!
    const observer = new IntersectionObserver(
      ([entry]) => {
        // If sentinel is not intersecting, user has scrolled past it
        setIsScrolled(!entry.isIntersecting);
      },
      {
        threshold: 0,
        // Root is the scrolling main container or viewport
        rootMargin: "-1px 0px 0px 0px",
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* 0-height sentinel to detect scroll position accurately without scroll event throttling */}
      <div ref={sentinelRef} className="h-0 w-full pointer-events-none -mt-6" aria-hidden="true" />

      <div
        className={`sticky -top-6 z-20 -mx-6 px-6 transition-all duration-200 ${
          isScrolled
            ? "bg-white/95 dark:bg-background/95 backdrop-blur-md border-b border-gray-200/80 dark:border-border py-2.5 shadow-xs"
            : "bg-transparent pb-3 pt-1"
        } ${className}`}
      >
        <div className="flex flex-col gap-1.5">
          {/* Breadcrumbs: Hide smoothly when scrolled */}
          {breadcrumbs && !isScrolled && (
            <div className="transition-all duration-200">{breadcrumbs}</div>
          )}

          {/* Title and Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <h1
                className={`font-bold tracking-tight text-gray-900 dark:text-gray-100 transition-all duration-200 ${
                  isScrolled ? "text-lg sm:text-xl" : "text-2xl"
                }`}
              >
                {title}
              </h1>

              {/* Description: Collapsed/Hidden in compact sticky mode */}
              {description && !isScrolled && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 transition-all duration-200">
                  {description}
                </p>
              )}
            </div>

            {/* Actions: Show compactActions or standard actions */}
            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
              {isScrolled && compactActions ? compactActions : actions}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
