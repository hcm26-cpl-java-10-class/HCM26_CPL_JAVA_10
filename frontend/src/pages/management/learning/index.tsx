import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  GraduationCap,
  Bookmark,
  Award,
  RefreshCw,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { RootState } from "@/store/store";
import { enrollmentApi } from "@/api/features/demo/enrollment.api";
import {
  INITIAL_LEARNING_COURSES,
  INITIAL_SAVED_COURSES,
  MONTHLY_ACTIVITY_DATA,
  LEARNING_STATS_LAST_4_WEEKS,
  mergeEnrollmentsWithCourses,
  calculateLearningSummary,
} from "./learning.data";
import type { LearningCourse, CertificateInfo } from "./learning.types";
import { CourseCard } from "./components/CourseCard";
import { LearningActivityCalendar } from "./components/LearningActivityCalendar";
import { LearningStatisticsCard } from "./components/LearningStatisticsCard";
import { RecentCertificatesSidebar } from "./components/RecentCertificatesSidebar";
import { CertificateViewerModal } from "./components/CertificateViewerModal";

export const MyLearningPage: React.FC = () => {
  const auth = useSelector((state: RootState) => state.auth);
  const [activeTab, setActiveTab] = useState<string>("in_progress");
  const [selectedCertificate, setSelectedCertificate] = useState<CertificateInfo | null>(null);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);

  // Saved courses state (allows bookmarking interaction without fabricating persistent backend DB)
  const [savedCourses, setSavedCourses] = useState<LearningCourse[]>(INITIAL_SAVED_COURSES);

  // Fetch actual enrollments from backend
  const {
    data: backendEnrollments = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: enrollmentApi.getMyCourses,
    retry: 1,
  });

  // Merge backend enrollments with existing curriculum courses
  const allCourses = useMemo(() => {
    return mergeEnrollmentsWithCourses(INITIAL_LEARNING_COURSES, backendEnrollments);
  }, [backendEnrollments]);

  // Compute learning counts
  const summary = useMemo(() => {
    const res = calculateLearningSummary(allCourses);
    return {
      ...res,
      savedCount: savedCourses.length,
      savedCourses,
    };
  }, [allCourses, savedCourses]);

  const userName = useMemo(() => {
    if (auth.firstName && auth.lastName) return `${auth.firstName} ${auth.lastName}`;
    return auth.firstName || "Admin User";
  }, [auth.firstName, auth.lastName]);

  const handleOpenCertificate = (cert: CertificateInfo) => {
    setSelectedCertificate({
      ...cert,
      recipientName: userName,
    });
    setIsCertificateModalOpen(true);
  };

  const handleCourseViewCertificate = (course: LearningCourse) => {
    if (course.certificate) {
      handleOpenCertificate(course.certificate);
    }
  };

  const handleRemoveBookmark = (courseId: string) => {
    setSavedCourses((prev) => prev.filter((c) => c.id !== courseId));
  };

  return (
    <MainLayout
      pathName={{
        "my-learning": "My Learning",
        learning: "My Learning",
        enrollments: "My Learning",
        fams: "FAMS & LMS",
      }}
    >
      <div className="flex-1 w-full max-w-7xl mx-auto space-y-6">
        {/* 1. Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-gray-200 dark:border-[#262626]">
          <div>
            {/* Breadcrumb with readable neutral-gray text and visible separators */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400 mb-1.5">
              <Link to="/dashboard" className="hover:text-gray-800 dark:hover:text-neutral-200 transition-colors">
                Home
              </Link>
              <span className="text-gray-400 dark:text-neutral-600">/</span>
              <span className="hover:text-gray-800 dark:hover:text-neutral-200 transition-colors">
                FAMS & LMS
              </span>
              <span className="text-gray-400 dark:text-neutral-600">/</span>
              <span className="text-gray-900 dark:text-white font-medium">
                My Learning
              </span>
            </nav>

            {/* Page Heading & Description */}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              My Learning
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-neutral-400 mt-1">
              Pick up where you left off, manage enrolled courses, and track your certifications.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="bg-white dark:bg-transparent border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white shadow-xs cursor-pointer font-medium"
            >
              <Link to="/courses" className="inline-flex items-center gap-1.5">
                <BookOpen className="size-4 text-blue-600 dark:text-blue-400" />
                <span>Explore Catalog</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Backend loading or error notice */}
        {isError && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
            <span>Could not synchronize external enrollments. Displaying active profile curriculum.</span>
            <Button
              size="xs"
              variant="outline"
              onClick={() => void refetch()}
              className="bg-white dark:bg-transparent border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer text-xs"
            >
              <RefreshCw className="size-3 mr-1" />
              Retry Sync
            </Button>
          </div>
        )}

        {/* 2. Coursera-Style Horizontal Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList
            variant="line"
            className="w-full justify-start border-b border-gray-200 dark:border-[#262626] pb-0 h-auto gap-6 bg-transparent rounded-none px-0"
          >
            <TabsTrigger
              value="in_progress"
              className="text-sm font-semibold pb-3 px-1 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:after:bg-blue-600 after:h-0.5 transition-all rounded-none cursor-pointer"
            >
              In Progress ({summary.inProgressCount})
            </TabsTrigger>

            <TabsTrigger
              value="completed"
              className="text-sm font-semibold pb-3 px-1 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:after:bg-blue-600 after:h-0.5 transition-all rounded-none cursor-pointer"
            >
              Completed ({summary.completedCount})
            </TabsTrigger>

            <TabsTrigger
              value="saved"
              className="text-sm font-semibold pb-3 px-1 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:after:bg-blue-600 after:h-0.5 transition-all rounded-none cursor-pointer"
            >
              Saved ({summary.savedCount})
            </TabsTrigger>

            <TabsTrigger
              value="certificates"
              className="text-sm font-semibold pb-3 px-1 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:after:bg-blue-600 after:h-0.5 transition-all rounded-none cursor-pointer"
            >
              Certificates & Badges ({summary.certificatesCount})
            </TabsTrigger>
          </TabsList>

          {/* 3. Main Two-Column Layout (Desktop: 68% / 32%, Mobile: stacked) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-6">
            {/* Left Column: ~68% width (col-span-8) */}
            <div className="lg:col-span-8 min-w-0">
              {/* Tab 1: In Progress */}
              <TabsContent value="in_progress" className="mt-0 space-y-4">
                {isLoading ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-44 bg-gray-100 dark:bg-[#181818] rounded-xl border border-gray-200 dark:border-[#262626]" />
                    <div className="h-44 bg-gray-100 dark:bg-[#181818] rounded-xl border border-gray-200 dark:border-[#262626]" />
                  </div>
                ) : summary.inProgressCourses.length === 0 ? (
                  <div className="bg-white dark:bg-[#141414] border border-dashed border-gray-300 dark:border-[#2e2e2e] rounded-xl p-12 text-center space-y-4 shadow-xs">
                    <GraduationCap className="size-12 text-gray-400 dark:text-neutral-500 mx-auto" />
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">No Courses In Progress</h3>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1 max-w-md mx-auto">
                        You have completed all enrolled courses or haven't started a new course yet.
                      </p>
                    </div>
                    <Button asChild className="bg-[#2563eb] hover:bg-blue-600 text-white font-medium">
                      <Link to="/courses">Explore Course Catalog</Link>
                    </Button>
                  </div>
                ) : (
                  summary.inProgressCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      onViewCertificate={handleCourseViewCertificate}
                    />
                  ))
                )}
              </TabsContent>

              {/* Tab 2: Completed */}
              <TabsContent value="completed" className="mt-0 space-y-4">
                {summary.completedCourses.length === 0 ? (
                  <div className="bg-white dark:bg-[#141414] border border-dashed border-gray-300 dark:border-[#2e2e2e] rounded-xl p-12 text-center space-y-4 shadow-xs">
                    <Award className="size-12 text-gray-400 dark:text-neutral-500 mx-auto" />
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">No Completed Courses Yet</h3>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1 max-w-md mx-auto">
                        Keep making progress on your active courses to complete them and earn verified certificates.
                      </p>
                    </div>
                  </div>
                ) : (
                  summary.completedCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      onViewCertificate={handleCourseViewCertificate}
                    />
                  ))
                )}
              </TabsContent>

              {/* Tab 3: Saved */}
              <TabsContent value="saved" className="mt-0 space-y-4">
                {summary.savedCourses.length === 0 ? (
                  <div className="bg-white dark:bg-[#141414] border border-dashed border-gray-300 dark:border-[#2e2e2e] rounded-xl p-12 text-center space-y-4 shadow-xs">
                    <div className="size-14 rounded-full bg-blue-50 dark:bg-[#1c1c1c] border border-blue-100 dark:border-[#2e2e2e] flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
                      <Bookmark className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">No Saved Courses</h3>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1 max-w-md mx-auto">
                        Find courses you want to take later and bookmark them to keep them organized here.
                      </p>
                    </div>
                    <Button asChild variant="outline" className="border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <Link to="/courses">Browse Catalog</Link>
                    </Button>
                  </div>
                ) : (
                  summary.savedCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      onRemoveBookmark={handleRemoveBookmark}
                    />
                  ))
                )}
              </TabsContent>

              {/* Tab 4: Certificates & Badges */}
              <TabsContent value="certificates" className="mt-0 space-y-4">
                {summary.certificates.length === 0 ? (
                  <div className="bg-white dark:bg-[#141414] border border-dashed border-gray-300 dark:border-[#2e2e2e] rounded-xl p-12 text-center space-y-4 shadow-xs">
                    <Award className="size-12 text-gray-400 dark:text-neutral-500 mx-auto" />
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">No Certificates Issued</h3>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1 max-w-md mx-auto">
                        Complete courses in your curriculum to earn official verifiable certificates.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {summary.certificates.map((cert) => (
                      <div
                        key={cert.id}
                        className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#262626] rounded-xl p-5 hover:border-gray-300 dark:hover:border-[#383838] shadow-xs transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="size-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                              <Award className="size-4" />
                            </span>
                            <span className="text-[11px] font-mono text-gray-400 dark:text-neutral-500">{cert.id}</span>
                          </div>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2">{cert.courseTitle}</h4>
                          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">Issued by {cert.issuer}</p>
                          <p className="text-[11px] text-gray-400 dark:text-neutral-500 mt-0.5">{cert.issuedDate}</p>
                        </div>

                        <div className="pt-4 mt-4 border-t border-gray-100 dark:border-[#262626] flex items-center justify-between">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{cert.grade}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenCertificate(cert)}
                            className="h-8 text-xs bg-white dark:bg-transparent border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white cursor-pointer font-medium"
                          >
                            View Certificate
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>

            {/* Right Column: ~32% width (col-span-4) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Learning Activity Calendar */}
              <LearningActivityCalendar activityData={MONTHLY_ACTIVITY_DATA} />

              {/* Learning Statistics Summary */}
              <LearningStatisticsCard stats={LEARNING_STATS_LAST_4_WEEKS} />

              {/* Recent Certificates & Badges */}
              <RecentCertificatesSidebar
                certificates={summary.certificates}
                onViewCertificate={handleOpenCertificate}
              />
            </div>
          </div>
        </Tabs>

        {/* Certificate Inspection Modal */}
        <CertificateViewerModal
          certificate={selectedCertificate}
          isOpen={isCertificateModalOpen}
          onClose={() => setIsCertificateModalOpen(false)}
        />
      </div>
    </MainLayout>
  );
};

export default MyLearningPage;
