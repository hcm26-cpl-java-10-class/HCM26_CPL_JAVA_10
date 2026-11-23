# Tài liệu FAMS LMS — Index

Thư mục `docs/` được chia theo chủ đề. Mỗi mục có prefix số để thứ tự đọc được rõ ràng.

| Mục | Nội dung | File chính |
|---|---|---|
| `01-getting-started/` | Cài đặt, chạy dự án, quy tắc commit | `COURSE_ANALYTICS_SETUP.md`, `COMMIT_GUIDE.md` |
| `02-architecture/` | Kiến trúc & class diagram | `CLASS_DIAGRAM.md`, `I18N_GUIDE.md` |
| `03-exam-assessment/` | Module thi cửu: invitation, khối lượng điểm, tích hợp Course ↔ Assessment | `INVITATION_MODULE.md`, `assessment-weights-v1.md`, `course-assessment-integration-v1.md`, `PEER_REVIEW_WORKFLOW.md` |
| `04-course-learning/` | Kiểm thử liên kết khóa học ↔ bài thi, E2E workflow, student analytics | `COURSE_EXAM_LINKING_TEST_PLAN.md`, `COURSE_EXAM_E2E_TEST_WORKFLOW.md`, `STUDENT_ANALYTICS.md` |
| `05-project-workspace/` | Mock Project Hub: workspace, milestone, cảnh báo, báo cáo | `PROJECT_HUB.md`, `milestone-lifecycle.md`, `MILESTONE_BACKEND_GUIDE.md`, `MILESTONE_FRONTEND_GUIDE.md`, `project-alert-rules.md`, `project-report-rules.md` |
| `05-project-workspace/plans/` | Kế hoạch triển khai & guide theo từng user story | `UFR-PRJ-005-backend-implementation-plan.md`, `US-PRJ-001-implementation-plan.md`, `MILESTONE_*_IMPLEMENTATION_PLAN.md`, … |
| `05-project-workspace/use-cases/` | Đặc tả use case (UFR-PRJ-003-01/02/03, US-07/08/11/12) + `USE-CASES.md` tổng hợp | `USE-CASES.md` |
| `05-project-workspace/fixtures/` | SQL fixture dùng cho test/demo | `project-hub-demo.sql` |
| `05-project-workspace/images/` | Ảnh minh hoạ | `workspace-git-repository-overview.png` |
| `06-testing-verification/` | Xác minh bug & bộ test nghiệm thu | `BUG-*-verification.md` |
| `06-testing-verification/workspace-overview-acceptance/` | Nghiệm thu Workspace overview & members (US-PRJ-001-02) | `README.md`, `MANUAL_TEST_AC01_AC10.md` |
| `06-testing-verification/workspace-sections-reference/` | Mã & hướng dẫn tham chiếu cho Workspace sections (US-PRJ-001-03) | `IMPLEMENTATION_GUIDE.md`, `VALIDATION.md` |
| `06-testing-verification/workspace-acceptance/` | Nghiệm thu Workspace AC08–AC13 + evidence | `README.md`, `evidence/` |
| `06-testing-verification/issues/` | Ghi nhận lỗi còn mở | `AC11-project-team-relationship.md` |
| `07-demo/` | Kịch bản demo & walkthrough | `UFR-PRJ-005-demo-script.md`, `UFR-PRJ-005-demo-walkthrough.md`, `UFR-PRJ-005-006-demo-guide.md`, `UFR-PRJ-001-01-SUBTASK.md` |
| `07-demo/dashboard-review/` | Bộ demo Dashboard review (SQL, script, quickstart) | `README.md`, `EQUIPMENT-QUICKSTART.md` |

## Quy ước

- File mới nên đặt đúng mục theo chủ đề, đặt tên theo dạng `UFR-XXX` / `US-XXX` nếu thuộc một user story cụ thể.
- Tài liệu kế hoạch triển khai đặt vào `plans/`; tài liệu đặc tả nghiệp vụ đặt vào `use-cases/`.
- Khi tham chiếu tới file khác trong repo, dùng đường dẫn tương đối so với vị trí file hiện tại.
