# Audit coverage (business actions)

Everything below is written to the Audit Log **without any change in the audited service**: each line is a rule in
`ModuleAuditRules.java` (and `BusinessAuditRules.java`). CRUD (create / update / delete) of every service that extends
`BaseCrudServiceImpl` is logged automatically by `AuditLogAspect`.

Only the outermost audited call of a request is logged, so one user action is one log line.

| Entity type | Action | Service.method |
|---|---|---|
| COURSE | CREATE | `CourseFromSyllabusService.create` |
| COURSE | CREATE | `CourseFromSyllabusService.createCustomized` |
| COURSE | IMPORT | `CourseBundleImportService.importBundle` |
| COURSE | APPLY | `AiCourseBuilderService.apply` |
| COURSE_REVIEW | CREATE | `CourseReviewServiceImpl.createReview` |
| COURSE_REVIEW | UPDATE | `CourseReviewServiceImpl.updateMyReview` |
| COURSE_REVIEW | DELETE | `CourseReviewServiceImpl.deleteMyReview` |
| CURRICULUM | UPDATE | `CurriculumServiceImpl.reorder` |
| COURSE_ENROLLMENT | CREATE | `CourseEnrollmentService.enrollStudent` |
| COURSE_ENROLLMENT | CREATE | `CourseEnrollmentService.enrollDepartment` |
| COURSE_ENROLLMENT | CREATE | `CourseEnrollmentService.enrollDepartments` |
| LESSON_REPORT | CREATE | `LessonReportService.create` |
| LESSON_REPORT | RESOLVE | `LessonReportService.resolve` |
| LESSON_QUESTION | CREATE | `LessonQnaService.createQuestion` |
| LESSON_QUESTION | UPDATE | `LessonQnaService.updateQuestion` |
| LESSON_QUESTION | DELETE | `LessonQnaService.deleteQuestion` |
| LESSON_ANSWER | CREATE | `LessonQnaService.createAnswer` |
| LESSON_ANSWER | UPDATE | `LessonQnaService.updateAnswer` |
| LESSON_ANSWER | DELETE | `LessonQnaService.deleteAnswer` |
| LESSON_ANSWER | ACCEPT | `LessonQnaService.acceptAnswer` |
| SYLLABUS | CREATE | `SyllabusService.create` |
| SYLLABUS | UPDATE | `SyllabusService.update` |
| SYLLABUS | DELETE | `SyllabusService.delete` |
| SYLLABUS | UPDATE | `SyllabusService.updateInformation` |
| SYLLABUS | PUBLISH | `SyllabusWorkflowService.publish` |
| SYLLABUS | CREATE | `SyllabusTemplateService.copy` |
| SYLLABUS | IMPORT | `SyllabusBundleImportService.importExcel` |
| SYLLABUS_SECTION | CREATE | `SyllabusService.createSection` |
| SYLLABUS_SECTION | CREATE | `SyllabusService.bulkCreateSections` |
| SYLLABUS_SECTION | UPDATE | `SyllabusService.updateSection` |
| SYLLABUS_SECTION | DELETE | `SyllabusService.deleteSection` |
| SYLLABUS_TOPIC | CREATE | `SyllabusService.createTopic` |
| SYLLABUS_TOPIC | UPDATE | `SyllabusService.updateTopic` |
| SYLLABUS_TOPIC | DELETE | `SyllabusService.deleteTopic` |
| SYLLABUS_TOPIC | UPDATE | `SyllabusCoverageService.setTopicClos` |
| SYLLABUS_CLO | CREATE | `SyllabusCloService.create` |
| SYLLABUS_CLO | CREATE | `SyllabusCloService.createBulk` |
| SYLLABUS_CLO | UPDATE | `SyllabusCloService.update` |
| SYLLABUS_CLO | DELETE | `SyllabusCloService.delete` |
| SYLLABUS_MATERIAL | CREATE | `SyllabusMaterialService.create` |
| SYLLABUS_MATERIAL | UPDATE | `SyllabusMaterialService.update` |
| SYLLABUS_MATERIAL | DELETE | `SyllabusMaterialService.delete` |
| SYLLABUS_MATERIAL | UPLOAD | `SyllabusMaterialFileService.upload` |
| SYLLABUS_MATERIAL | EXPORT | `SyllabusMaterialsArchiveService.export` |
| EXAM_COURSE_LINK | UPDATE | `ExamCourseLinkService.apply` |
| EXAM_COURSE_LINK | LINK | `ExamCourseLinkService.linkExam` |
| EXAM_COURSE_LINK | UNLINK | `ExamCourseLinkService.unlinkExam` |
| EXAM | IMPORT | `ExamImportService.importExams` |
| EXAM | EXPORT | `ExamExportService.exportCsv` |
| EXAM | EXPORT | `ExamExportService.exportExcel` |
| EXAM | EXPORT | `ExamExportService.exportPdf` |
| EXAM | CREATE | `ExamTemplateService.createExamFromTemplate` |
| EXAM_RESULT | EXPORT | `ExamResultExportService.exportCsv` |
| EXAM_RESULT | EXPORT | `ExamResultExportService.exportExcel` |
| EXAM_RESULT | EXPORT | `ExamResultExportService.exportPdf` |
| EXAM_RESULT | PUBLISH | `ExamResultPublicationService.publish` |
| EXAM_RESULT | UNPUBLISH | `ExamResultPublicationService.unpublish` |
| EXAM_TEMPLATE | CREATE | `ExamTemplateService.saveAsTemplate` |
| EXAM_TEMPLATE | UPDATE | `ExamTemplateService.updateTemplate` |
| EXAM_TEMPLATE | DELETE | `ExamTemplateService.deleteTemplate` |
| ESSAY_GRADING | UPDATE | `ExamEssayGradingService.submitReferenceAnswer` |
| ESSAY_GRADING | UPDATE | `ExamEssayGradingService.submitRubric` |
| ESSAY_GRADING | GRADE | `ExamEssayGradingService.submitOfficialGrade` |
| CODING_SUBMISSION | GRADE | `ExamEssayGradingService.regradeCoding` |
| SCORE_APPEAL | CREATE | `ScoreAppealService.createAppeal` |
| SCORE_APPEAL | REVIEW | `ScoreAppealService.review` |
| EXAM_ATTEMPT | SUBMIT | `ExamAttemptService.submit` |
| EXAM_ATTEMPT | SUBMIT | `AnonymousExamService.submit` |
| INVITATION | ACCEPT | `InvitationService.acceptInvitation` |
| INVITATION | REJECT | `InvitationService.rejectInvitation` |
| QUESTION | EXPORT | `QuestionExportService.exportLegacyCsv` |
| QUESTION | EXPORT | `QuestionExportService.exportExcel` |
| QUESTION | EXPORT | `QuestionExportService.exportPdf` |
| COURSE_ANALYTICS | EXPORT | `CourseAnalyticsExportService.exportAll` |
| COURSE_ANALYTICS | EXPORT | `CourseAnalyticsExportService.exportLessonFunnel` |
| COURSE_ANALYTICS | EXPORT | `CourseAnalyticsExportService.exportTrend` |
| COURSE_ANALYTICS | EXPORT | `CourseAnalyticsExportService.exportActivity` |
| COURSE_ANALYTICS | EXPORT | `CourseAnalyticsExportService.exportReviews` |
| COURSE_ANALYTICS | EXPORT | `CourseAnalyticsExportService.exportDepartments` |
| COURSE_ANALYTICS | EXPORT | `CourseAnalyticsExportService.exportCourseRanking` |
| COURSE_ANALYTICS | EXPORT | `CourseAnalyticsExportService.exportContentQuality` |
| COURSE_ANALYTICS | EXPORT | `CourseAnalyticsExportService.exportExams` |
| COURSE_ANALYTICS | EXPORT | `CourseAnalyticsExportService.exportStudyTime` |
| PROJECT_TEAM_DRAFT | UPDATE | `ProjectTeamDraftService.saveBatch` |
| PROJECT_TEAM_DRAFT | UPDATE | `ProjectTeamDraftService.updateDraftTeam` |
| PROJECT_TEAM_MEMBER | CREATE | `ProjectTeamMembershipService.addMember` |
| PROJECT_TEAM_MEMBER | DELETE | `ProjectTeamMembershipService.removeMember` |
| PROJECT_TEAM | ASSIGN | `ProjectTeamMentorService.updateTeamMentor` |
| PROJECT_TEAM | ASSIGN | `ProjectTeamTemplateService.assignTemplate` |
| PROJECT_TEAM | ASSIGN | `ProjectTeamTemplateService.assignTemplateAsTeamLeader` |
| PROJECT_TEAM | PUBLISH | `TeamPublishItemService.publish` |
| PROJECT_TEAM_ROLE | UPDATE | `ProjectTeamRoleService.updateRoles` |
| PROJECT_TEAM_ROLE | UPDATE | `ProjectTeamRoleService.updateRolesAsTeamLeader` |
| TEAM_ALLOCATION_SESSION | UPDATE | `TeamAllocationSessionService.updateMaxMembers` |
| PROJECT_ALERT | SEND | `ProjectAlertService.send` |
| PROJECT_ALERT | UPDATE | `ProjectAlertService.link` |
| TASK_ALERT | SEND | `TaskAlertService.send` |
| MILESTONE_ALERT | SEND | `MilestoneRiskService.send` |
| MEMBER_REMINDER | SEND | `MemberReminderService.send` |
| TEAM_SPRINT | CREATE | `ProjectBoardServiceImpl.createTeamSprint` |
| MILESTONE | CREATE | `MilestoneCommandService.create` |
| MILESTONE | UPDATE | `MilestoneLifecycleService.editPlanned` |
| MILESTONE | UPDATE | `MilestoneLifecycleService.editActive` |
| MILESTONE | DELETE | `MilestoneLifecycleService.deleteDraft` |
| ARTIFACT_SUBMISSION | SUBMIT | `ArtifactSubmissionService.submit` |
| ARTIFACT_SUBMISSION | SUBMIT | `TeamArtifactSubmissionService.submit` |
| ARTIFACT_SUBMISSION | REVIEW | `SubmissionReviewService.review` |
| ARTIFACT | UPLOAD | `ArtifactUploadService.upload` |
| PROJECT_COMPLETION | LOCK | `ProjectCompletionCommandService.lockFinalGrade` |
| RUBRIC | CREATE | `RubricService.create` |
| RUBRIC | UPDATE | `RubricService.updateDraft` |
| RUBRIC | PUBLISH | `RubricService.publish` |
| RUBRIC | CREATE | `RubricService.createVersion` |
| RUBRIC | DELETE | `RubricService.deleteDraft` |
| PROJECT | ASSIGN | `ProjectHubService.assignMentor` |
| PROJECT | UPDATE | `ProjectHubService.saveCharter` |
| PROJECT_TEMPLATE_VERSION | ARCHIVE | `TemplateVersionLifecycleService.archivePublishedVersions` |
| PROJECT_TEMPLATE_VERSION | UPDATE | `TemplateMilestoneService.savePlan` |
| PROJECT_TEMPLATE_VERSION | UPDATE | `TemplateSampleContentService.save` |
| PROJECT_TEMPLATE_VERSION | IMPORT | `TemplateVersionConfigurationService.importTemplate` |
| PROJECT_TEMPLATE_VERSION | UPDATE | `TemplateVersionConfigurationService.saveOverview` |
| PROJECT_TEMPLATE_VERSION | UPDATE | `TemplateVersionConfigurationService.saveTeam` |
| PROJECT_TEMPLATE_VERSION | UPDATE | `TemplateVersionConfigurationService.saveMilestones` |
| PROJECT_TEMPLATE_VERSION | UPDATE | `TemplateVersionConfigurationService.saveBacklog` |
| PROJECT_TEMPLATE_VERSION | PUBLISH | `TemplateVersionConfigurationService.publish` |
| TEMPLATE_RESOURCE | CREATE | `TemplateResourceVersionServiceImpl.create` |
| TEMPLATE_RESOURCE | UPDATE | `TemplateResourceVersionServiceImpl.update` |
| TEMPLATE_RESOURCE | DELETE | `TemplateResourceVersionServiceImpl.delete` |
| TEMPLATE_RESOURCE | UPLOAD | `TemplateResourceVersionServiceImpl.upload` |
| TEMPLATE_RESOURCE | DELETE | `TemplateResourceVersionServiceImpl.deleteFile` |
| WORKSPACE_RESOURCE | CREATE | `WorkspaceResourceCommandService.create` |
| WORKSPACE_RESOURCE | UPDATE | `WorkspaceResourceCommandService.update` |
| WORKSPACE_RESOURCE | DELETE | `WorkspaceResourceCommandService.delete` |
| WORKSPACE_RESOURCE | UPLOAD | `WorkspaceResourceCommandService.upload` |
| WORKSPACE_RESOURCE | DELETE | `WorkspaceResourceCommandService.deleteFile` |
| PROJECT_TEMPLATE | CREATE | `ProjectTemplateService.create` |
| PROJECT_TEMPLATE | UPDATE | `ProjectTemplateService.update` |
| PROJECT_TEMPLATE | UPDATE | `ProjectTemplateService.updateTeamConstraints` |
| PROJECT_TEMPLATE | ARCHIVE | `ProjectTemplateService.archive` |
| PROJECT_TEMPLATE | DELETE | `ProjectTemplateDeletionService.delete` |
| PROJECT_TEMPLATE | ACTIVATE | `TemplateActivationService.activate` |
| WORKSPACE | CREATE | `WorkspaceServiceImpl.createWorkspace` |
| WORKSPACE | CONFIRM | `WorkspaceServiceImpl.confirmWorkspace` |
| WORKSPACE_SECTION | CREATE | `WorkspaceSectionService.create` |
| WORKSPACE_SECTION | SUBMIT | `WorkspaceSectionService.submit` |
| WORKSPACE_SECTION | REVIEW | `WorkspaceSectionService.review` |
| WORKSPACE_SECTION | UPDATE | `WorkspaceSectionService.updateBoardColumns` |
| WORKSPACE_GIT_REPOSITORY | UPDATE | `WorkspaceGitService.save` |
| WORKSPACE_GIT_REPOSITORY | DELETE | `WorkspaceGitService.unlink` |
| PROJECT_LOG | CREATE | `ProjectLogService.create` |
| PROJECT_LOG | UPDATE | `ProjectLogService.updateRisk` |

## Not audited on purpose
- Read-only methods (get / list / search / export previews).
- High-frequency or automatic actions: saving answers, autosaving drafts, lesson progress, notifications, schedulers.
- Tasks, sprints, backlog and project resources have their own audit services in the project module; add rules here only if the team wants them in the central Audit Log as well.

## Add one more action
Add a line to `ModuleAuditRules.auditRules()`:
```java
rule("MyService", "approve", AuditAction.APPROVE, "MY_ENTITY", false, 0, "id", 0),
```
Arguments: service class name, method name, action, entity type, idFromResult, index of the id argument, then pairs of (input name, argument index) to store as the new value.
If a method is renamed or its parameters are re-ordered, update its rule (a rule that matches nothing is silently ignored).
