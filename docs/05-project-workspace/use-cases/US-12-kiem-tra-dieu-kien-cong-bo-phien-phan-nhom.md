### 5.2.7. UC-US-12 – Kiểm tra điều kiện công bố phiên phân nhóm (Mentor / Quản lý chương trình)

> Mã use case: **US-12** — Validate Class Readiness Before Publishing Team Allocation Session
> Phân hệ: Quản lý Mock Project — Team Allocation (Hub PRJ-03)

#### 5.2.7.1. Mục tiêu

Cung cấp bước **kiểm tra điều kiện công bố (strict-mode readiness)** cho một phiên phân nhóm trước khi Mentor/Quản lý chương trình công bố chính thức. Hệ thống kiểm tra toàn bộ lớp: mọi học viên đang hoạt động đã được xếp vào nhóm, mỗi nhóm có đề bài hợp lệ và còn hoạt động, sĩ số nằm trong khoảng cho phép, mọi thành viên có vai trò hợp lệ và cấu hình vai trò đáp ứng định suất của đề bài. Kết quả trả về `readyToPublish`, danh sách học viên tự do và từng lỗi theo nhóm; thao tác công bố chính thức chỉ được thực hiện khi toàn bộ điều kiện đạt, nếu không sẽ bị chặn với **422** kèm lý do chi tiết.

#### 5.2.7.2. Tác nhân

- **Tác nhân chính:** Mentor / người quản lý phân nhóm của lớp — người kiểm tra và công bố phiên phân nhóm.
- **Tác nhân liên quan:**
  - **Quản lý chương trình / Quản trị viên (ADMIN):** có quyền tương ứng, thực hiện được use case.
  - **Hệ thống:** lớp bảo mật JWT + RBAC, `ScopeAuthorizationService` (quyền quản lý lớp/nhóm), `AllocationReadinessService` (tính báo cáo readiness), `ProjectTeamPublishCoordinator` (công bố chính thức, idempotency), `TeamPublishItemService` (kiểm tra và publish từng nhóm), `ProjectAssignmentService` (kiểm tra phân công Master), `ProjectTeamMentorService` (kiểm tra Mentor).

#### 5.2.7.3. Điều kiện trước

- Người dùng đã đăng nhập, JWT còn hiệu lực; tenant và phạm vi dữ liệu hợp lệ; có quyền quản lý lớp được cấp.
- Phiên phân nhóm tồn tại và thuộc đúng lớp (`classId`).
- **Kiểm tra readiness:** người dùng có `PEO_TEAM_ALLOCATE` hoặc `PRJ_WORKSPACE_MANAGE`.
- **Công bố chính thức:** người dùng có `PEO_TEAM_ALLOCATE`; phiên đang `OPEN`; có ít nhất một nhóm `DRAFT`; cung cấp header `X-Idempotency-Key` (1–128 ký tự).
- Các nhóm `DRAFT` đã được gán Mentor, có Leader là thành viên `ACTIVE`, đã gán Project Template còn hoạt động và cấu hình vai trò hợp lệ.

#### 5.2.7.4. Điều kiện sau

- **Khi gọi kiểm tra (`GET .../readiness`):** không thay đổi dữ liệu; trả báo cáo gồm:
  - `readyToPublish` (toàn bộ điều kiện đạt hay không);
  - số học viên hoạt động, số đã vào nhóm, số học viên tự do kèm `memberId`, `fullName`, `userCode`;
  - số nhóm (tổng, `DRAFT`, `ACTIVE`), số nhóm đã có đề bài;
  - danh sách `teamIssues` (mã lỗi, thông điệp, thành viên liên quan, vi phạm định suất);
  - danh sách `blockers` (mã lỗi cấp phiên) và thời điểm kiểm tra `checkedAt`.
- **Khi công bố thành công:** toàn bộ nhóm `DRAFT` được publish (mỗi nhóm có Project/Workspace tương ứng), phiên chuyển sang `PUBLISHED` khi không còn nhóm `DRAFT`; trả `200 OK` với `allocationSessionId`, `succeededItems`, `failedItems`.
- **Khi công bố bị chặn:** trả **422** với `errorCode` (`ERR_UNASSIGNED_MEMBERS` hoặc `ERR_TEAMS_NOT_READY`), danh sách học viên tự do (`unassignedMembers`) và `teamIssues`; không có dữ liệu nào bị thay đổi.
- **Khi publish từng nhóm thất bại:** transaction bị rollback toàn bộ, trả `200 OK` với `succeededItems = []` và `failedItems` mô tả lỗi; không nhóm nào được ghi nhận publish.
- Các lần gọi công bố lặp với cùng `X-Idempotency-Key` trả lại kết quả đã lưu; dùng cùng key với payload khác trả **409** `ERR_IDEMPOTENCY_KEY_REUSED`.

#### 5.2.7.5. Kích hoạt

Mentor mở màn hình **Team Allocation** của lớp (`/management/team-allocation/...`), chọn phiên phân nhóm đang `OPEN`, sau khi đã lưu đủ nhóm `DRAFT`/`ACTIVE` thì bấm **“Kiểm tra điều kiện công bố”**, xem báo cáo và (nếu đạt) bấm **“Công bố chính thức”** trong dialog kết quả.

#### 5.2.7.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở màn hình Team Allocation của lớp và chọn phiên phân nhóm. |
| 2 | Hệ thống | Kiểm tra quyền quản lý lớp, tải phiên, danh sách nhóm và trạng thái hiện tại. |
| 3 | Người dùng | Bấm **“Kiểm tra điều kiện công bố”**. |
| 4 | Hệ thống | Gửi `GET /api/v1/classes/{classId}/allocation-sessions/{sessionId}/readiness` (chỉ đọc). |
| 5 | Hệ thống | Xác thực quyền `PEO_TEAM_ALLOCATE` / `PRJ_WORKSPACE_MANAGE` và quyền quản lý lớp; tìm phiên trong lớp (**404** nếu không có). |
| 6 | Hệ thống | Xác định học viên `ACTIVE` đủ điều kiện, tập học viên đã thuộc nhóm `DRAFT`/`ACTIVE` của phiên và danh sách học viên tự do. |
| 7 | Hệ thống | Duyệt các nhóm không `ARCHIVED`, kiểm tra từng nhóm: Mentor, Leader, đề bài tồn tại và còn `ACTIVE`, cấu hình đề bài hợp lệ, sĩ số trong khoảng `min–max`, thành viên có vai trò hợp lệ, quy tắc kiêm nhiệm và định suất `PM/BA/DEV/QA`. |
| 8 | Hệ thống | Tổng hợp `teamIssues`, `blockers` (`ERR_SESSION_NOT_OPEN`, `ERR_NO_TEAMS`, `ERR_UNASSIGNED_MEMBERS`, các mã lỗi nhóm) và `readyToPublish = blockers.isEmpty()`; trả `200 OK` với báo cáo. |
| 9 | Hệ thống | Mở dialog **“Kiểm tra điều kiện công bố”**: hiển thị trạng thái `READY`/`BLOCKED`, thống kê (học viên đã vào nhóm, tổng số nhóm, nhóm có đề bài hợp lệ, học viên tự do/lỗi nhóm), danh sách học viên tự do và lỗi theo nhóm. |
| 10 | Hệ thống | Hiển thị toast: “Lớp đủ điều kiện công bố (Ready to Publish).” hoặc “Lớp chưa đủ điều kiện công bố: N học viên tự do, M lỗi nhóm.”. |
| 11 | Người dùng | Nếu `readyToPublish = true`, bấm **“Công bố chính thức”**. |
| 12 | Hệ thống | Gửi `POST /api/v1/classes/{classId}/allocation-sessions/{sessionId}/publish-session` với header `X-Idempotency-Key`, không có body. |
| 13 | Hệ thống | Kiểm tra `PEO_TEAM_ALLOCATE`, quyền quản lý lớp, `X-Idempotency-Key` hợp lệ (**400** nếu thiếu/quá 128 ký tự) và trạng thái phiên. |
| 14 | Hệ thống | Chạy lại **kiểm tra readiness trên máy chủ** (authoritative). Nếu chưa đạt → **422** với `errorCode` và toàn bộ học viên tự do/lỗi nhóm; giao diện hiển thị danh sách để Mentor xử lý. |
| 15 | Hệ thống | Nếu đạt: publish các phân công Master đang chờ, sau đó publish từng nhóm `DRAFT` (kiểm tra lại Mentor, Leader, đề bài, sĩ số, vai trò, định suất). |
| 16 | Hệ thống | Nếu mọi nhóm thành công: đóng phiên ở trạng thái `PUBLISHED`, trả `200 OK` với danh sách `succeededItems`; giao diện hiển thị “Đã công bố chính thức N nhóm.”. |
| 17 | Hệ thống | Nếu có nhóm lỗi: rollback toàn bộ transaction, trả `200 OK` với `failedItems`; giao diện hiển thị “N nhóm chưa thể công bố” và lý do từng nhóm. |

#### 5.2.7.7. Luồng thay thế và ngoại lệ

**5.2.7.7.1. Còn học viên chưa được xếp nhóm**

- Báo cáo readiness ghi `ERR_UNASSIGNED_MEMBERS` vào `blockers`, trả danh sách học viên tự do kèm họ tên/mã.
- Khi công bố, hệ thống chặn với **422** `ERR_UNASSIGNED_MEMBERS` và thông điệp “Không thể công bố. Còn N học viên chưa được xếp nhóm. Vui lòng phân nhóm cho toàn bộ học viên trước khi công bố”.
- Không có dữ liệu nào bị thay đổi.

**5.2.7.7.2. Phiên chưa có nhóm hoặc phiên không mở**

- Không có nhóm nào (sau khi loại `ARCHIVED`): blocker `ERR_NO_TEAMS`.
- Phiên không ở trạng thái `OPEN`: blocker `ERR_SESSION_NOT_OPEN` trong báo cáo.
- Khi gọi publish-session với phiên không `OPEN`: **400** `ERR_INVALID_BATCH_DATA` (“Allocation session is not open”); nếu phiên đã `PUBLISHED`, hệ thống cố trả lại kết quả theo idempotency key, nếu không tìm thấy thì **400** “Allocation session is already published”.

**5.2.7.7.3. Nhóm chưa đủ điều kiện**

Báo cáo trả các mã lỗi theo nhóm (kèm `memberIds` và/hoặc `violations` khi có):

| Mã lỗi | Nguyên nhân |
| --- | --- |
| `ERR_TEAM_MENTOR_REQUIRED` | Nhóm `DRAFT` chưa được gán Mentor |
| `ERR_TEAM_MENTOR_INVALID` | Mentor không hợp lệ/không còn phụ trách lớp |
| `ERR_TEAM_PROJECT_ALREADY_ASSIGNED` | Phân công dự án trực tiếp của nhóm `DRAFT` còn vướng điều kiện publish (ví dụ còn phân công Master chờ xử lý) |
| `ERR_TEAM_LEADER_REQUIRED` | Nhóm chưa có Leader là thành viên `ACTIVE` |
| `ERR_TEAM_TEMPLATE_REQUIRED` | Nhóm chưa được gán đề bài dự án |
| `ERR_TEAM_TEMPLATE_INVALID` | Đề bài không còn `ACTIVE` hoặc `constraints_json` không đọc được |
| `ERR_TEAM_CAPACITY_EXCEEDED` | Sĩ số nhóm nằm ngoài khoảng `min–max` của đề bài |
| `ERR_TEAM_ROLE_REQUIRED` | Có thành viên chưa được gán vai trò hợp lệ |
| `ERR_MULTI_ROLE_NOT_ALLOWED` | Có thành viên giữ nhiều vai trò khi đề bài không cho phép kiêm nhiệm |
| `ERR_TEAM_ROLE_QUOTA_NOT_MET` | Thiếu vai trò bắt buộc hoặc vượt định suất (`violations` chi tiết) |

- Khi công bố, nếu còn bất kỳ lỗi nhóm nào và không còn học viên tự do: **422** `ERR_TEAMS_NOT_READY` với thông điệp “Không thể công bố. Còn N lỗi điều kiện nhóm (đề bài/vai trò). Vui lòng xử lý toàn bộ trước khi công bố”.

**5.2.7.7.4. Không có quyền hoặc phiên/lớp không tồn tại**

- Thiếu quyền kiểm tra/publish: **403 Forbidden**.
- Lớp hoặc phiên không tồn tại, hoặc phiên không thuộc lớp: **404 Not Found**.
- Chưa đăng nhập/token hết hạn: **401 Unauthorized**.

**5.2.7.7.5. Header idempotency không hợp lệ hoặc bị dùng lại**

- Thiếu `X-Idempotency-Key`, rỗng hoặc dài hơn 128 ký tự: **400** `ERR_INVALID_BATCH_DATA` (“X-Idempotency-Key is required and must not exceed 128 characters”).
- Dùng lại cùng key nhưng payload khác: **409** `ERR_IDEMPOTENCY_KEY_REUSED`.
- Cùng key và cùng payload: trả lại đúng response đã lưu (idempotent replay).

**5.2.7.7.6. Còn phân công Master đang chờ (luồng publish theo lô)**

- Với API publish theo danh sách nhóm, nếu còn phân công Master đang chờ (`projectAssignments.hasPending`): **422** `ERR_TEAMS_NOT_READY` với thông điệp “Sử dụng Công bố chính thức để kiểm tra toàn lớp và tạo Workspace cho phân công Master.”.
- Danh sách `teamIds` bị trùng: **400** `ERR_INVALID_BATCH_DATA` (“Duplicate team IDs are not allowed”).

**5.2.7.7.7. Publish từng nhóm thất bại**

- Một nhóm có thể thất bại do `ERR_STUDENT_ALREADY_ASSIGNED`, `ERR_TEAM_NOT_FOUND` hoặc dữ liệu đã thay đổi (`TeamPublishValidationException`).
- Toàn bộ transaction publish-session bị rollback; API trả `200 OK` với `succeededItems = []` và `failedItems` để giao diện hiển thị lý do từng nhóm.

**5.2.7.7.8. Lỗi máy chủ hoặc mất kết nối**

- Hệ thống trả **500 Internal Server Error**; giao diện hiển thị thông báo lỗi trong dialog/banner và giữ nguyên trạng thái để người dùng kiểm tra lại.

#### 5.2.7.8. Quy tắc nghiệp vụ và ghi chú

1. Strict mode: chỉ được công bố khi **tất cả** điều kiện sau đạt: phiên `OPEN`, có ít nhất một nhóm, không còn học viên `ACTIVE` đủ điều kiện nào chưa thuộc nhóm `DRAFT`/`ACTIVE` của phiên, và không có lỗi nhóm.
2. Học viên được xét là thành viên `ACTIVE` của lớp và vượt qua `AllocationStudentEligibility`; học viên đã thuộc nhóm `DRAFT` hoặc `ACTIVE` của phiên được tính là “đã xếp nhóm”.
3. Nhóm `ARCHIVED` không được xét trong báo cáo readiness.
4. Mỗi nhóm được kiểm tra: Mentor (chỉ nhóm `DRAFT`), phân công dự án, Leader, đề bài tồn tại và `isActive`, cấu hình đề bài đọc được, sĩ số trong `[min_members, max_members]`, thành viên có ít nhất một vai trò hợp lệ, quy tắc `allow_multi_role` và định suất `role_quotas`.
5. Lỗi định suất được trả trong `violations` với `role`, `reason` (`MISSING_REQUIRED_ROLE` / `ROLE_QUOTA_EXCEEDED`), `required`, `actual` để giao diện hiển thị chính xác vai trò nào còn thiếu/vượt.
6. `blockers` là tập mã lỗi không trùng lặp, gồm lỗi cấp phiên và mọi mã lỗi nhóm; `readyToPublish = blockers.isEmpty()`.
7. Báo cáo readiness là **read-only**; cùng logic được dùng lại bên trong transaction công bố để bảo đảm UI và máy chủ không lệch nhau.
8. Công bố chính thức publish toàn bộ nhóm `DRAFT` của phiên; nếu không còn nhóm `DRAFT` nào thì **400** “Allocation session has no DRAFT teams to publish”.
9. Publish-session là **all-or-nothing**: nếu bất kỳ nhóm nào lỗi, transaction rollback và không nhóm nào được ghi nhận; response vẫn là `200 OK` kèm `failedItems`.
10. `X-Idempotency-Key` là bắt buộc cho cả publish theo lô và publish-session; key được lưu kèm hash payload để chống gọi lặp/khác payload.
11. Quyền: readiness cần `PEO_TEAM_ALLOCATE` hoặc `PRJ_WORKSPACE_MANAGE`; publish-session và publish theo lô cần `PEO_TEAM_ALLOCATE`.
12. Sau khi publish thành công, phiên được đóng ở trạng thái `PUBLISHED` khi không còn nhóm `DRAFT`; Project/Workspace của các nhóm được tạo/ kích hoạt theo luồng publish.

#### 5.2.7.9. Minh chứng kiểm thử Backend trên Swagger

##### 5.2.7.9.1. API kiểm tra điều kiện công bố (read-only)

- **API:** `GET /api/v1/classes/{classId}/allocation-sessions/{sessionId}/readiness`
- **Header:** `Authorization: Bearer <access_token>`.
- **Dữ liệu gửi lên:** không có body; `classId` và `sessionId` truyền trên path.
- **Kết quả mong đợi:** `200 OK`, trả về `AllocationReadinessResponse` với `readyToPublish`, các chỉ số `totalStudents` / `assignedStudents` / `unassignedStudentCount`, danh sách `unassignedStudents`, thống kê nhóm (`totalTeams`, `draftTeamCount`, `activeTeamCount`, `teamsWithTemplate`), `teamIssues`, `blockers` và `checkedAt`; không có dữ liệu nào bị thay đổi.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.7-1. Kết quả kiểm thử API kiểm tra điều kiện công bố trên Swagger**

##### 5.2.7.9.2. API công bố chính thức phiên phân nhóm

- **API:** `POST /api/v1/classes/{classId}/allocation-sessions/{sessionId}/publish-session`
- **Header:** `Authorization: Bearer <access_token>`; `X-Idempotency-Key: <uuid>` (bắt buộc).
- **Dữ liệu gửi lên:** không có body.
- **Kết quả mong đợi:** `200 OK` với `{allocationSessionId, succeededItems: [...], failedItems: []}` khi lớp đủ điều kiện; toàn bộ nhóm `DRAFT` được publish và phiên chuyển `PUBLISHED`. Nếu lớp chưa đủ điều kiện, API trả **422** với `errorCode = "ERR_UNASSIGNED_MEMBERS"` hoặc `"ERR_TEAMS_NOT_READY"`, kèm `unassignedMembers`, `teamIssues`, `blockers`.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.7-2. Kết quả kiểm thử API công bố chính thức phiên phân nhóm trên Swagger**

#### 5.2.7.10. Màn hình Frontend

Màn hình **Team Allocation** của lớp với nút **“Kiểm tra điều kiện công bố”**; dialog **“Kiểm tra điều kiện công bố”** hiển thị trạng thái `READY` / `BLOCKED`, bốn chỉ số thống kê (học viên đã vào nhóm, tổng số nhóm, nhóm có đề bài hợp lệ, học viên tự do/lỗi nhóm), danh sách học viên chưa có nhóm và danh sách lỗi theo nhóm (kèm chi tiết vi phạm định suất); khi đạt điều kiện, dialog hiển thị nút **“Công bố chính thức”**.

Ảnh chụp cần thể hiện: (1) dialog kết quả kiểm tra ở trạng thái `BLOCKED` với học viên tự do và lỗi nhóm, và (2) trạng thái `READY` kèm nút “Công bố chính thức”/thông báo công bố thành công.

**Hình 5.2.7-3. Màn hình kiểm tra điều kiện công bố phiên phân nhóm**
