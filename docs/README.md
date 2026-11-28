# Tài liệu FAMS LMS — Index

Thư mục `docs/` được chia theo chủ đề. Mỗi mục có prefix số để thứ tự đọc được rõ ràng.

| Mục | Nội dung | File chính |
|---|---|---|
| `01-getting-started/` | Cài đặt, chạy dự án, quy tắc commit | `COURSE_ANALYTICS_SETUP.md`, `COMMIT_GUIDE.md` |
| `02-architecture/` | Kiến trúc, class diagram, i18n & rulebook thiết kế Entity | `CLASS_DIAGRAM.md`, `I18N_GUIDE.md`, `ENTITY_RELATIONSHIP_RULEBOOK.md` |
| `03-exam-assessment/` | Module thi cử & bảo mật Auth/Exam: invitation, trọng số điểm, tích hợp Course ↔ Assessment, Phase 1–3 | `INVITATION_MODULE.md`, `assessment-weights-v1.md`, `course-assessment-integration-v1.md`, `PEER_REVIEW_WORKFLOW.md`, `AUTH_AND_EXAM_PHASE1_3_UPDATE_AND_TEST_GUIDE.md` |
| `04-course-learning/` | Khóa học, gợi ý khóa học, liên kết khóa học ↔ bài thi, E2E workflow, student analytics | `course-recommendations.md`, `COURSE_EXAM_LINKING_TEST_PLAN.md`, `COURSE_EXAM_E2E_TEST_WORKFLOW.md`, `STUDENT_ANALYTICS.md` |
| `05-project-workspace/` | Mock Project Hub: workspace, milestone, cảnh báo, báo cáo | `PROJECT_HUB.md`, `milestone-lifecycle.md`, `MILESTONE_BACKEND_GUIDE.md`, `MILESTONE_FRONTEND_GUIDE.md`, `project-alert-rules.md`, `project-report-rules.md` |
| `05-project-workspace/plans/` | Kế hoạch triển khai & guide theo từng user story | `UFR-PRJ-005-backend-implementation-plan.md`, `US-PRJ-001-implementation-plan.md`, `MILESTONE_*_IMPLEMENTATION_PLAN.md`, … |
| `05-project-workspace/use-cases/` | Đặc tả use case (UFR-PRJ-003-01/02/03, US-07/08/11/12) + `USE-CASES.md` tổng hợp | `USE-CASES.md` |
| `05-project-workspace/fixtures/` | SQL fixture dùng cho test/demo | `project-hub-demo.sql` |
| `05-project-workspace/images/` | Ảnh minh hoạ | `workspace-git-repository-overview.png` |
| `06-testing-verification/` | Xác minh bug, báo cáo điều tra/sửa lỗi & bộ test nghiệm thu | `BUG-*-verification.md`, `class-readiness-investigation.md`, `FRONTEND_ROUTING_404_FIX_REPORT.md` |
| `06-testing-verification/workspace-overview-acceptance/` | Nghiệm thu Workspace overview & members (US-PRJ-001-02) | `README.md`, `MANUAL_TEST_AC01_AC10.md` |
| `06-testing-verification/workspace-sections-reference/` | Mã & hướng dẫn tham chiếu cho Workspace sections (US-PRJ-001-03) | `IMPLEMENTATION_GUIDE.md`, `VALIDATION.md` |
| `06-testing-verification/workspace-acceptance/` | Nghiệm thu Workspace AC08–AC13 + evidence | `README.md`, `evidence/` |
| `06-testing-verification/issues/` | Ghi nhận lỗi còn mở | `AC11-project-team-relationship.md` |
| `07-demo/` | Kịch bản demo & walkthrough | `UFR-PRJ-005-demo-script.md`, `UFR-PRJ-005-demo-walkthrough.md`, `UFR-PRJ-005-006-demo-guide.md`, `UFR-PRJ-001-01-SUBTASK.md` |
| `07-demo/dashboard-review/` | Bộ demo Dashboard review (SQL, script, quickstart) | `README.md`, `EQUIPMENT-QUICKSTART.md` |
| `08-training-operations/` | Quản lý đào tạo: Class Setup, Training Calendar, Trainer Management | `CLASS_SETUP_IMPLEMENTATION.md`, `TRAINER_MANAGEMENT.md`, `calendar.md`, `SRS_Training_Calendar_Management.md` |
| `09-deployment-operations/` | Triển khai, cutover, rollback, safe startup & kiểm tra hạ tầng (SMTP, Trainer) | `trainer/README.md`, `trainer/FINAL_PRE_CUTOVER.md`, `trainer/ROLLBACK_PLAN.md`, `smtp/SMTP_HEALTH_REPORT_2026-11-12.md` |

## Quy ước

- **Không đặt file `.md` trực tiếp ở gốc `docs/`** (ngoại trừ `docs/README.md`). Mọi tài liệu mới phải đặt vào đúng thư mục chủ đề `01-`..`09-`.
- File mới nên đặt đúng mục theo chủ đề, đặt tên theo dạng `UFR-XXX` / `US-XXX` nếu thuộc một user story cụ thể.
- Tài liệu kế hoạch triển khai đặt vào `plans/`; tài liệu đặc tả nghiệp vụ đặt vào `use-cases/`.
- Báo cáo điều tra, fix bug, nghiệm thu đặt vào `06-testing-verification/`; tài liệu cutover/rollback/hạ tầng đặt vào `09-deployment-operations/`.
- Khi tham chiếu tới file khác trong repo, dùng đường dẫn tương đối so với vị trí file hiện tại và cập nhật `docs/README.md` nếu thêm nhóm tài liệu mới.
- Bật kiểm tra tự động khi commit ở local (chạy 1 lần sau khi clone): `git config core.hooksPath .githooks`. Kiểm tra thủ công toàn repo: `node scripts/check-docs-rule.mjs --ci`.

Course Management validation: [Course covers and assessment configuration — 2026-11-26](06-testing-verification/course-management-20261126.md).

Integrated Course Management fixes: [Navigation, form alignment and Curriculum visibility — 2026-11-28](06-testing-verification/course-management-20261128.md).
