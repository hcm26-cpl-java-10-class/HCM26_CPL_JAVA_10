# Kế hoạch triển khai Backend — UFR-PRJ-005 Board và Activity

> **Mục đích:** Kế hoạch triển khai API đọc Sprint Board và Activity Trail, bám theo user story UFR-PRJ-005-01, Acceptance Criteria đã cung cấp, SRS FAMS LMS MockProject Hub v2.0 và cấu trúc backend hiện tại.
>
> **Trạng thái:** Tài liệu kế hoạch; chưa triển khai code. Các tên class, quyền và route đề xuất dưới đây cần được đối chiếu khi bắt đầu code.

## 1. Tóm tắt phạm vi

Backend cung cấp Board của một Project và Sprint đã chọn. API trả thông tin Sprint, sáu cột công việc và Activity Trail chỉ đọc. Trước khi trả dữ liệu, backend kiểm tra phiên đăng nhập, quyền chức năng, tenant đang hoạt động và object scope của người dùng đối với Project.

Đây là use case đọc. Tải hoặc tải lại Board không cập nhật Task, không thay đổi người phụ trách, không ghi lịch sử thay đổi trạng thái và không phát sự kiện nghiệp vụ thay đổi Task. Những thay đổi trạng thái Task và việc ghi actor/timestamp/audit/event thuộc các luồng ghi Task, không thuộc request GET Board.

### Trong phạm vi

- API lấy Board theo Project và Sprint.
- Thông tin Sprint: tên, ngày bắt đầu, ngày kết thúc và mục tiêu.
- Sáu nhóm/cột cố định: Backlog, To do, In progress, Review, Done, Blocked.
- Card hiển thị dữ liệu Task đã lưu: mã, tên, người phụ trách nếu có, độ ưu tiên nếu có và trạng thái.
- Activity Trail dạng chỉ đọc.
- Kiểm tra permission, tenant và object scope phía server.
- Trả lỗi đúng ngữ nghĩa: `401`, `403`, `404`; không biến lỗi thành Board rỗng.
- Kiểm thử không thay đổi dữ liệu hoặc tạo event khi đọc Board.

### Ngoài phạm vi

- CRUD Project, Sprint, Task, thành viên, milestone, submission hoặc artifact, trừ phần domain tối thiểu cần để Board đọc và xác thực scope.
- Tạo Task từ nút Add task.
- Di chuyển card hoặc chuyển trạng thái Task.
- Phát event `card_moved` từ API Board.
- Bộ lọc theo thành viên, chuyển Board/List, dependency, estimate, subtask, commit/PR và các trường mở rộng chỉ xuất hiện trong hình mẫu.
- Tự sinh mã Task. Quy tắc mã thuộc luồng tạo Task của UFR-PRJ-004; SRS hiện không quy định prefix hoặc định dạng mã cụ thể.

## 2. Nguồn yêu cầu và quy tắc đã chốt

### 2.1 Nguồn

1. User story **UFR-PRJ-005-01 — Xem bảng công việc** và AC01–AC04 trong yêu cầu người dùng.
2. **SRS FAMS LMS MockProject Hub v2.0**, đặc biệt:
   - Mô hình RBAC kết hợp permission và data scope; backend phải kiểm tra tenant, actor, permission và object scope, mặc định từ chối.
   - UFR-PRJ-001..010 và logical data baseline Project/Team, Milestone/Sprint/Task, AuditLog.
   - UFR-PRJ-003 về Sprint và backlog; UFR-PRJ-004 về Task; UFR-PRJ-005 về Board và activity.
   - UI-STD-03 Sprint Board, route giao diện `/student/projects/{id}/board`; các trạng thái loading, empty, error, success và permission denied.
   - Yêu cầu kiểm toán: actor, timestamp, entity, before/after, reason và correlation ID cho thay đổi trọng yếu.
3. Hình tham khảo Board & Activity; hình dùng để tham khảo bố cục, không ghi đè AC.
4. Các lựa chọn người dùng đã xác nhận trong cuộc trao đổi:
   - Giữ đủ sáu cột theo AC, không dùng bốn cột trạng thái như hình.
   - Activity Trail được trả dạng chỉ đọc.
   - Card chỉ gồm các trường bắt buộc trong AC.
   - Backlog là Task có `sprint_id = null`.
   - Board gồm Backlog của toàn Project và Task của Sprint đang xem; không gồm Task thuộc Sprint khác.
   - Dùng API lồng Project/Sprint: `GET /api/projects/{projectId}/sprints/{sprintId}/board`.
   - Một User thuộc một Tenant.
   - Mentor được phân công được mô hình hóa là ProjectMember có vai trò Mentor.
   - Project là domain dùng chung cho các story Mock Project, không phải entity tạm cho Board.
   - Không tự chốt định dạng mã Task; chỉ đọc mã đã được UFR-PRJ-004 tạo và lưu.

### 2.2 Đối chiếu ảnh và Acceptance Criteria

| Thành phần | Yêu cầu triển khai |
|---|---|
| Cột Board | Sáu cột theo AC: `BACKLOG`, `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`, `BLOCKED`. |
| Backlog | Nhóm vị trí của Task chưa gắn Sprint, không phải trạng thái Task mới. |
| Review | Dùng trạng thái `REVIEW` theo SRS, không dùng `IN_REVIEW` từ hình tham khảo. |
| Activity Trail | Chỉ đọc sự kiện đã lưu. GET Board không tạo event/audit về thay đổi Task. |
| Add task | Nằm ngoài API GET. Frontend hiển thị theo `TASK_CREATE`; API tạo Task thuộc UFR-PRJ-004. |
| Bộ lọc, dependency, estimate, commit | Không đưa vào response của bản đầu vì chưa nằm trong AC đã chốt. |

### 2.3 Quy tắc Backlog cần thể hiện rõ

SRS liệt kê trạng thái Task là `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`, `BLOCKED`; SRS không định nghĩa Backlog là trạng thái. Do đó:

- `sprint_id = null` xác định Task nằm trong **nhóm Backlog**.
- Không thêm enum `BACKLOG` chỉ để biểu diễn cột.
- Cột Backlog không được diễn giải thành trạng thái Task. Trường `status` trên card vẫn là trạng thái thật đã lưu.
- Quy tắc “trạng thái card phù hợp với cột” áp dụng cho năm cột trạng thái; vị trí Backlog được xác định bởi việc Task chưa thuộc Sprint.
- Backend không tự sửa trạng thái hoặc gán Sprint khi đọc Board.

## 3. Tình trạng code và mức độ tái sử dụng

Backend hiện dùng Java 21, Spring Boot 3.3.3, Spring Data JPA, Spring Security và MapStruct.

| Hiện có | Có thể tận dụng | Khoảng trống liên quan Board |
|---|---|---|
| `BaseEntity` với ID, `isActive`, audit timestamps và actor fields | Kiểu ID Long, timestamp/auditing và quy ước entity | Chưa có tenant scope trên entity theo yêu cầu SRS. |
| `BaseCrudController`, `BaseCrudServiceImpl`, `BaseCrudRepository` | Pattern package, repository và error handling | Board là truy vấn/use case tổng hợp, không nên dựng từ generic CRUD vì phải lọc scope và trả sáu cột. |
| `Sprint`, `SprintDTO`, `SprintRepository`, `SprintServiceImpl`, `SprintController` | Tên, goal, start/end date; các quy ước mapper/service | `Sprint.projectId` hiện là raw Long; service ghi audit/outbox cho thao tác Sprint. Không dùng các thao tác ghi đó trong GET Board. |
| `User`, `UserPrincipal`, authority trong Spring Security | Lấy actor hiện tại và permission | User chưa có Tenant; chưa có Project, ProjectMember, Task, ProjectActivityLog. |
| `GlobalExceptionHandler` | Mapping `ResourceNotFoundException` thành 404 và `AccessDeniedException` thành 403 | Cần bảo đảm endpoint không bắt lỗi rồi biến thành response rỗng. |
| Sprint audit/outbox | Tham khảo pattern audit/outbox cho luồng ghi | Sprint audit không thay thế Activity Trail của Project/Task. |

Các file Sprint hiện có nằm trong:

```text
backend/src/main/java/com/example/starter_project_2025/system/project/sprint/
```

Các entity Project, Tenant, ProjectMember, Task và Activity chưa thấy trong code backend tại thời điểm lập kế hoạch. Cần kiểm tra lại nhánh làm việc trước khi tạo để tránh trùng với code mới được merge.

## 4. Hợp đồng API đề xuất

### 4.1 Endpoint

```http
GET /api/projects/{projectId}/sprints/{sprintId}/board
Authorization: Bearer <access-token>
```

UI-STD-03 dùng route giao diện `/student/projects/{id}/board`. Frontend có thể dùng `id` làm `projectId`, lấy Sprint đang chọn từ trạng thái/route rồi gọi endpoint API này. Route giao diện và API là hai hợp đồng riêng.

### 4.2 Response đề xuất

Response luôn có đủ sáu cột theo thứ tự cố định, kể cả khi không có Task. `count` bằng số card được trả về trong cột đó.

```json
{
  "projectId": 12,
  "sprint": {
    "id": 5,
    "name": "Sprint 1",
    "startDate": "2026-10-01T00:00:00",
    "endDate": "2026-10-14T00:00:00",
    "sprintGoal": "Hoàn thiện chức năng quản lý Task"
  },
  "columns": [
    {
      "key": "BACKLOG",
      "name": "Backlog",
      "count": 0,
      "tasks": []
    },
    {
      "key": "TODO",
      "name": "To do",
      "count": 1,
      "tasks": [
        {
          "id": 81,
          "code": "SWP391-001",
          "title": "Thiết kế API",
          "assignee": {
            "id": 24,
            "displayName": "Nguyen Van A"
          },
          "priority": "HIGH",
          "status": "TODO"
        }
      ]
    },
    {
      "key": "IN_PROGRESS",
      "name": "In progress",
      "count": 0,
      "tasks": []
    },
    {
      "key": "REVIEW",
      "name": "Review",
      "count": 0,
      "tasks": []
    },
    {
      "key": "DONE",
      "name": "Done",
      "count": 0,
      "tasks": []
    },
    {
      "key": "BLOCKED",
      "name": "Blocked",
      "count": 0,
      "tasks": []
    }
  ],
  "activityTrail": []
}
```

Ghi chú:

- Ví dụ mã Task chỉ minh họa response, **không phải** quyết định định dạng mã.
- `assignee` và `priority` có thể là `null`.
- Thời gian trả về dùng định dạng ISO-8601 phù hợp với Java time type và timezone contract của ứng dụng.
- Activity Trail rỗng là hợp lệ nếu Project chưa có activity; lỗi truy vấn activity không được giả thành danh sách rỗng.
- Có thể thêm metadata pagination cho Activity Trail nếu UI cần tải nhiều sự kiện; cần chốt giới hạn/page contract trước khi code.

### 4.3 Quy tắc chọn dữ liệu

Với `projectId = P` và `sprintId = S`:

```text
Backlog = Task thuộc P AND sprint_id IS NULL
Các cột trạng thái = Task thuộc P AND sprint_id = S
Task thuộc sprint khác = không trả về
```

Board không đếm Task ngoài phạm vi được cấp. Nếu scope của người dùng bị giới hạn nhỏ hơn toàn Project, query phải áp dụng scope đó trước khi tính `count` và dựng card.

### 4.4 Mã lỗi

| Trường hợp | HTTP | Quy tắc |
|---|---:|---|
| Không có/phiên hết hạn | `401` | Giữ xử lý xác thực của Spring Security; không trả Board. |
| Thiếu `BOARD_READ`, Tenant không hoạt động hoặc actor ngoài object scope | `403` | Không tiết lộ tên Project/Sprint, count hoặc Task ngoài scope. |
| Project không tồn tại | `404` | Không thay bằng dữ liệu của Project khác. |
| Sprint không tồn tại hoặc không thuộc Project được yêu cầu | `404` | Không trả thông tin Sprint/Task. |
| Board tải thành công nhưng không có Task | `200` | Sáu cột tồn tại, mỗi cột count `0`; Activity Trail và thông tin Sprint trả theo dữ liệu hợp lệ. |
| Lỗi database/hệ thống | `5xx` theo handler chuẩn | Không chuyển thành empty Board. |

## 5. Domain và dữ liệu cần có

Logical data baseline của SRS là chuẩn nghiệp vụ; thiết kế JPA cụ thể có thể khác nếu vẫn giữ được khóa, tenant isolation, trạng thái và audit.

### 5.1 Tenant và User

- Tenant có mã/tên/trạng thái tối thiểu; trạng thái phải kiểm tra là `ACTIVE`.
- User thuộc đúng một Tenant theo quyết định đã chốt.
- User trong SRS dùng email duy nhất trong tenant; code hiện có đang unique toàn cục. Nếu đổi từ unique toàn cục sang unique `(tenant_id, email)`, cần xử lý dữ liệu và DB constraint có chủ đích, không đổi ngầm trong Board.
- Luồng đăng ký, tạo User quản trị, OAuth/Google và seed User phải được rà soát nếu `tenant_id` được yêu cầu bắt buộc. Không được thêm `NOT NULL` trước khi các luồng này có cách xác định Tenant hợp lệ.

### 5.2 Project/Team và membership

Project/Team là workspace dùng lại cho các UFR trong Mock Project. Theo SRS, Project gắn với `class_id`, `template_snapshot_id`, thành viên/vai trò, charter và trạng thái. Tenant scope phải được xác định nhất quán từ Project và các quan hệ cha; SRS yêu cầu tenant_id trên bản ghi nghiệp vụ hoặc kiểm soát tương đương bằng truy vấn.

ProjectMember tối thiểu cần liên kết Project với User và có:

- Vai trò trong Project (tối thiểu Student/Member, Team Lead nếu được dùng, Mentor).
- Trạng thái membership hoạt động.
- Các trường created/updated/audit theo pattern hiện tại.

Chỉ membership đang hoạt động hoặc assignment hợp lệ mới cấp object scope. Mentor chỉ được xem Project được phân công. Không tin `projectId`, `tenantId` hoặc `userId` do client tự gửi để chứng minh quyền.

### 5.3 Sprint

- Tái sử dụng entity Sprint hiện có.
- Xác thực Sprint thuộc Project được yêu cầu; hiện Sprint chỉ lưu `projectId` raw Long nên repository/service cần kiểm tra đúng quan hệ.
- Không gọi `getById()` generic như một thay thế cho check scope; generic service hiện kiểm tra CRUD authority nhưng không kiểm tra membership Project.
- Entity hiện có unique constraint chỉ theo `name`, trong khi Sprint thuộc Project. Cần xác nhận/điều chỉnh thành quy tắc phù hợp, thường là unique `(project_id, name)`, đồng thời giữ dữ liệu cũ hợp lệ.

### 5.4 Task

Task cần các trường tối thiểu để đọc Board:

- ID; mã Task đã lưu; tiêu đề.
- `project_id`.
- `sprint_id` nullable.
- assignee nullable, liên kết tới ProjectMember hoặc User theo mô hình Task cuối cùng.
- priority nullable.
- status: `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`, `BLOCKED`.
- timestamp/audit và `version` nếu Task có cập nhật cạnh tranh.

Ràng buộc chuyển Sprint, Project và assignee cần được kiểm tra ở luồng ghi UFR-PRJ-003/004; Board không chữa dữ liệu sai hoặc tự chuyển Task.

### 5.5 Project Activity

Activity Trail đọc từ nguồn Activity/Audit của Project, không từ audit Sprint. Tối thiểu mỗi bản ghi cần có Project, actor, loại hành động, entity/task liên quan, timestamp và correlation ID; nếu là thay đổi trạng thái thì cần before/after.

Thiết kế trong nội dung class diagram trước đó có `ProjectActivityLog` với `project_id`, `actor_id`, `action_type`, `entity_type`, `entity_id`, `before_state`, `after_state`, `occurred_at`. Cần rà soát với SRS và code thực tế trước khi chốt schema.

## 6. Kiến trúc code và file dự kiến

Giữ package naming hiện có dưới `com.example.starter_project_2025`. Tên file dưới đây là đề xuất, không phải yêu cầu phải tạo tất cả cùng lúc.

### 6.1 Domain nền tảng dùng chung

```text
backend/src/main/java/com/example/starter_project_2025/system/tenant/
    Tenant.java
    TenantRepository.java

backend/src/main/java/com/example/starter_project_2025/system/project/
    Project.java
    ProjectRepository.java
    ProjectMember.java
    ProjectMemberRepository.java
```

Tùy phạm vi UFR-PRJ-001 và phần code được merge, Project có thể cần DTO/service/controller riêng. Không nhồi CRUD Project đầy đủ vào UFR-PRJ-005 nếu chưa được giao; nhưng domain dùng chung phải đủ ổn định để các story sau dùng lại.

File hiện có cần rà soát khi thêm Tenant:

```text
system/rbac/user/User.java
system/rbac/user/UserDTO.java
system/rbac/user/UserMapper.java
system/rbac/user/UserServiceImpl.java
system/auth/authentication/AuthServiceImpl.java
init/UserDataInitializer.java
```

Không nhất thiết tất cả đều phải sửa nếu tenant được gán bằng một luồng onboarding riêng; khi đó phải ghi rõ luồng đó và bảo đảm không tạo User thiếu Tenant.

### 6.2 Task và activity

```text
backend/src/main/java/com/example/starter_project_2025/system/project/task/
    Task.java
    TaskStatus.java
    TaskPriority.java
    TaskRepository.java

backend/src/main/java/com/example/starter_project_2025/system/project/activity/
    ProjectActivityLog.java
    ProjectActivityRepository.java
```

Activity entity/repository có thể đặt package khác theo convention đã chọn sau khi rà soát Sprint audit/outbox. Chỉ tạo những file cần thiết cho Board và không nhân bản cơ chế audit hiện có nếu một event store chung đã được project chọn.

### 6.3 Board use case

```text
backend/src/main/java/com/example/starter_project_2025/system/project/board/
    ProjectBoardController.java
    ProjectBoardService.java
    ProjectBoardServiceImpl.java
    ProjectBoardResponse.java
    SprintSummaryResponse.java
    BoardColumnResponse.java
    TaskCardResponse.java
    ActivityItemResponse.java
```

- Controller mỏng: nhận path variables, gọi service, trả response.
- Service chịu trách nhiệm xác thực resource/scope, query dữ liệu và assemble response.
- Repository query trả projection/entity cần thiết; tránh N+1 khi lấy assignee/activity.
- DTO Board riêng, không dùng `SprintDTO` hoặc Task entity trực tiếp làm response.
- Dùng constructor projection hoặc mapper theo convention dự án; không serialize lazy JPA entity trực tiếp.

## 7. Luồng xử lý service

Đề xuất thứ tự xử lý:

1. Spring Security xác thực request; endpoint yêu cầu authority `BOARD_READ`.
2. Lấy actor hiện tại từ `UserPrincipal`; không nhận actor ID từ body/query.
3. Tìm Project trong tenant/scope phù hợp và xác nhận Tenant đang `ACTIVE`.
4. Nếu Project không tồn tại trả `404`; nếu actor không được phép biết/xem Project trả `403` theo hợp đồng đã chốt.
5. Tìm Sprint và xác nhận `sprint.projectId == projectId`; sai quan hệ trả `404`, không lộ dữ liệu.
6. Xác minh actor là ProjectMember phù hợp hoặc Mentor được phân công. Dù có `BOARD_READ`, vẫn phải qua object scope.
7. Query Task trong phạm vi Project/Sprint đã xác nhận; lấy Backlog của Project và Task của Sprint đang xem, không lấy Sprint khác.
8. Đưa mỗi Task vào đúng nhóm trạng thái; tạo sáu cột kể cả khi rỗng, tính `count` từ danh sách đã lọc.
9. Query Activity Trail có scope Project; giới hạn/paginate theo hợp đồng đã chốt; map thông tin được phép hiển thị.
10. Trả DTO. Không gọi save, audit writer hoặc outbox writer; đánh dấu transaction là read-only.

### Permission

- `BOARD_READ`: quyền chức năng đọc Board.
- `TASK_CREATE`: chỉ để frontend/API tạo Task trong UFR-PRJ-004; Board không dùng quyền này để quyết định có trả dữ liệu hay không.
- Backend có thể trả `canCreateTask` để hỗ trợ UI, nhưng AC hiện yêu cầu quyền Add task ở giao diện. Nếu chọn trả trường này, trường phải được tính theo authority và scope thật; không thay thế kiểm tra ở API tạo Task.
- SRS dùng tên “permission tương ứng”, không quy định cụ thể `BOARD_READ`. `BOARD_READ` là tên đã thống nhất trong trao đổi và cần được đăng ký/cấp trong RBAC.

### Lưu ý về quyền Supervisor/Admin

SRS mô tả scope theo role; người quản trị có thể được cấp tenant hoặc scope rộng hơn. Service nên gọi một helper/object-scope policy rõ ràng (nếu dự án bổ sung), tránh hard-code điều kiện `role == ...` trong controller. Super Admin chỉ xem Project theo scope được cấp hoặc policy toàn hệ thống đã được duyệt.

## 8. Phân rã triển khai từng bước

### Bước 0 — Đồng bộ nhánh và khảo sát lại

1. Lấy nhánh mới nhất theo quy trình Git của nhóm.
2. Kiểm tra xem Project, Task, Tenant hoặc activity đã được merge từ nhánh khác chưa.
3. Đọc entity/DTO/repository/initializer hiện có trước khi tạo file; giữ nguyên thay đổi của thành viên khác.
4. Kiểm tra schema hiện tại, DB profile, migration strategy và seed data.

**Kết quả:** danh sách chính xác file sẽ dùng lại và file sẽ thêm/sửa, không tạo domain trùng.

### Bước 1 — Chốt schema và migration

1. Ánh xạ logical model SRS vào JPA: Tenant, User, Project/Team, ProjectMember, Sprint, Task và Activity.
2. Quyết định ràng buộc tenant: cột tenant_id trực tiếp hay phân giải qua quan hệ lớp; dù chọn cách nào, mọi query phải tenant-safe.
3. Quyết định mapping assignee tới User hay ProjectMember.
4. Xác định trạng thái hoạt động của membership/Project/Tenant.
5. Xác định cách migrate/seed dữ liệu hiện có, đặc biệt User và Sprint.
6. Viết/điều chỉnh ràng buộc DB trước khi thêm `NOT NULL` hoặc đổi unique index.

**Kết quả:** schema tối thiểu để Board query được mà không tạo phá vỡ luồng hiện hành.

### Bước 2 — Bổ sung Tenant/User và seed

1. Thêm Tenant entity/repository và quan hệ User -> Tenant theo quyết định một User/một Tenant.
2. Bổ sung Tenant vào các luồng tạo User (đăng ký, admin CRUD, OAuth, seed) hoặc dùng onboarding có kiểm soát.
3. Cập nhật DTO/mapper chỉ khi API quản trị User cần nhận/hiển thị Tenant.
4. Seed một Tenant mẫu trước các user seed; mọi thao tác seed chạy lặp an toàn.
5. Thêm test cho tạo User thiếu Tenant và User có Tenant inactive.

**Không làm:** gán mọi User vào một tenant mặc định một cách im lặng nếu đó không phải quy tắc đã được chủ dự án chấp nhận.

### Bước 3 — Bổ sung Project/Team và object scope

1. Tạo Project theo logical model SRS, liên kết TrainingClass/template snapshot nếu các domain đó đã có.
2. Thêm ProjectMember với role, trạng thái hoạt động và liên kết User.
3. Tạo repository query kiểm tra membership/assignment theo actor + project.
4. Xác định tenant của Project một cách nhất quán với Tenant của User và lớp.
5. Cập nhật Sprint để xác minh Project; xem xét unique Sprint theo Project thay vì unique toàn cục.
6. Thêm unit/integration test cho member, mentor được assign, user khác tenant và project ngoài scope.

**Quan trọng:** không cho phép client tự chọn `tenantId` hoặc `memberId` rồi coi đó là bằng chứng quyền.

### Bước 4 — Bổ sung Task và truy vấn Board

1. Tạo Task entity/status/priority/repository theo UFR-PRJ-004 và SRS.
2. Đảm bảo `sprint_id` nullable để hỗ trợ quy tắc Backlog đã xác nhận.
3. Tạo query riêng cho:
   - Task backlog của Project (`sprint_id IS NULL`).
   - Task thuộc đúng Sprint được chọn.
4. Query assignee trong cùng truy vấn/projection hoặc fetch plan để tránh N+1.
5. Không phát sinh Task code khi Board được đọc.
6. Test task của Sprint khác, task không assignee, priority null và từng trạng thái.

### Bước 5 — Bổ sung Activity Trail

1. Chọn nguồn activity chính thức: ProjectActivityLog hoặc audit/event store được nhóm thống nhất.
2. Bảo đảm event thay đổi trạng thái được ghi từ use case ghi Task (UFR-PRJ-004), có actor, timestamp, entity, before/after và correlation ID.
3. API Board chỉ truy vấn log thuộc đúng Project/scope.
4. Xác định giới hạn mặc định, sort mới nhất trước và pagination nếu feed có thể dài.
5. Tạo test xác nhận GET Board không thêm log/outbox event.

### Bước 6 — Tạo DTO, service và controller Board

1. Tạo DTO response theo mục 4; đảm bảo 6 cột được trả đủ và đúng thứ tự.
2. Tạo service `@Transactional(readOnly = true)` theo thứ tự kiểm tra trong mục 7.
3. Đặt `@PreAuthorize("hasAuthority('BOARD_READ')")` trên endpoint hoặc cách bảo vệ tương ứng theo convention.
4. Tạo controller với route API đã chọn.
5. Dùng `ResourceNotFoundException` và `AccessDeniedException` để dùng lại global handler.
6. Không dùng `BaseCrudServiceImpl.getAll()` làm query Board vì filter đó không thể hiện toàn bộ điều kiện object scope, quan hệ Sprint/Project và response nhiều cột.

### Bước 7 — Cấu hình RBAC

1. Đăng ký `BOARD_READ` trong permission seed/initializer; không giả định tự sinh từ annotation nếu Board không phải CRUD entity.
2. Cấp quyền cho đúng role sau khi xác minh ma trận role trong SRS và cấu hình dự án.
3. Cấp `TASK_CREATE` ở luồng/task role phù hợp; không mở rộng quyền chỉ để làm nút UI hiện lên.
4. Test cả permission thiếu và permission có nhưng object scope không hợp lệ.

### Bước 8 — Kiểm thử, chạy và tích hợp

1. Chạy test unit của service và repository.
2. Chạy integration test với H2 hoặc DB profile tương đương môi trường nhóm.
3. Chạy build backend qua Maven wrapper.
4. Kiểm tra schema khởi động/seed và luồng đăng nhập, đăng ký, quản lý User sau thay đổi Tenant.
5. Kiểm tra OpenAPI response/error contract.
6. Tạo commit theo quy ước nhóm khi user story đã hoàn chỉnh; không xem task là hoàn thành cho tới khi demo và được nhóm accept.

## 9. Ma trận kiểm thử theo Acceptance Criteria

| AC/Scenario | Kiểm thử mong đợi |
|---|---|
| AC01 — sprint summary | Trả đúng tên, ngày bắt đầu/kết thúc, mục tiêu từ Sprint đã chọn. |
| AC01 — sáu cột | Luôn có đúng thứ tự `BACKLOG`, `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`, `BLOCKED`; count khớp số card. |
| AC01 — Backlog | Chỉ Task cùng Project có `sprint_id = null`. |
| AC01 — Task của Sprint | Chỉ Task cùng Project và đúng Sprint đang xem; Task thuộc Sprint khác không xuất hiện. |
| AC01 — card | Mã, tiêu đề, assignee, priority, status đúng với record; assignee/priority thiếu dữ liệu được trả null. |
| AC01 — Add task | `TASK_CREATE` không làm thay đổi response Task; quyền tạo chỉ ảnh hưởng affordance/API tạo Task khác. |
| AC01 — read-only | So sánh Task, audit và outbox trước/sau GET; không có thay đổi hay event mới. |
| AC02 — loading | Là trách nhiệm UI; API không cần trả payload giả trong thời gian chờ. |
| AC02 — empty | Trả `200`, thông tin Sprint nếu hợp lệ, sáu cột với danh sách rỗng/count 0. |
| AC02 — lỗi tải | Lỗi DB/activity được trả lỗi hệ thống phù hợp, không trả empty success. |
| AC03 — phiên hết hạn | API `401`; không có response Board. |
| AC03 — thiếu quyền | API `403`; không lộ Project, sprint, count hoặc card. |
| AC03 — ngoài scope/tenant | API `403`; query không trả hoặc đếm dữ liệu ngoài scope. |
| AC04 — Project không tồn tại | API `404`; response không chứa Sprint/Task khác. |
| Sprint không thuộc Project | API `404` theo hợp đồng để tránh lộ quan hệ ngoài scope. |
| Activity | Chỉ log trong phạm vi Project; feed rỗng hợp lệ nếu không có sự kiện. |

Ngoài AC, kiểm thử biên cần có:

- Project tồn tại nhưng tenant bị inactive.
- User tồn tại nhưng membership inactive/đã bị thu hồi.
- Mentor không được phân công Project.
- Sprint ID hợp lệ nhưng project ID khác.
- Task bị soft-inactive/archived (nếu domain chọn hỗ trợ) phải theo chính sách hiển thị đã chốt.
- Activity pagination/sort ổn định.
- Các trạng thái Task không hợp lệ hoặc null trong DB phải được phát hiện; không âm thầm bỏ qua mà không có log/validation.

## 10. Rủi ro và biện pháp giảm thiểu

| Rủi ro | Tác động | Biện pháp |
|---|---|---|
| Thêm Tenant bắt buộc phá luồng đăng ký/admin/OAuth/seed | Không tạo User hoặc app không khởi động | Rà soát mọi luồng tạo User; seed Tenant trước; migration có bước backfill rõ ràng. |
| Dựng Project mới trùng code của thành viên khác | Xung đột schema/API, mất công merge | Kiểm tra nhánh và trao đổi owner trước khi tạo entity. |
| Chỉ kiểm tra authority, không kiểm tra membership | IDOR/rò dữ liệu Project | Luôn kiểm tra actor + Tenant + ProjectMember/assignment ở service/repository. |
| Sprint.projectId hiện chỉ là raw ID | Có thể gắn nhầm Sprint sang Project khác | Kiểm tra quan hệ ở Board; bổ sung FK/quan hệ khi schema và migration sẵn sàng. |
| Backlog bị hiểu nhầm là status | Task sai cột hoặc status bị ghi lại khi GET | Backlog là grouping theo `sprint_id = null`, giữ status thật. |
| Hoạt động đọc bị ghi nhầm như card moved | Audit sai, event trùng | GET read-only; test xác nhận không thay đổi Task/audit/outbox. |
| Activity được đọc nhưng không có luồng ghi thống nhất | Feed trống hoặc thiếu sự kiện | UFR-PRJ-004/task transition phải là nơi ghi activity; Board chỉ query. |
| Bảng activity quá lớn | Board chậm, response lớn | Sort/pagination/limit; index theo project và timestamp. |
| Seed Sprint hiện tại không gắn Project | Board không tìm thấy Sprint hợp lệ | Điều chỉnh seed sau khi Project seed tồn tại; tránh dữ liệu sample vô chủ. |
| Đổi unique name Sprint thành unique theo Project | Migration thất bại nếu tên trùng hoặc index cũ | Rà dữ liệu; thiết kế migration tương thích. |

## 11. Các phụ thuộc cần có trước khi code

1. Xác nhận nhánh hiện tại chưa có Project/Task/Tenant/Activity được phát triển song song.
2. Xác nhận team sở hữu UFR-PRJ-001 và UFR-PRJ-004 để không trùng phạm vi entity/service.
3. Chốt cách migrate dữ liệu User khi Tenant trở thành bắt buộc.
4. Chốt nơi lưu ProjectActivityLog và luồng ghi trạng thái Task.
5. Xác nhận role nào được cấp `BOARD_READ` theo SRS; quyền không thể suy ra chỉ từ tên actor “Team/Mentor”.
6. Chốt giới hạn/pagination Activity Trail.
7. Chốt chính sách dữ liệu `isActive`/archive cho Project, Sprint, Task và membership.
8. Chốt timezone/định dạng ngày API nhất quán với frontend và tenant.

Các điểm sau **không cần ngăn việc thiết kế API Board**, nhưng cần được chủ sở hữu story liên quan xác nhận trước khi triển khai phần tương ứng:

- Định dạng mã Task và quy tắc cấp mã (UFR-PRJ-004).
- Có trả `canCreateTask` trong response hay frontend tự dùng quyền trong auth payload.
- `ProjectMember` có cần vai trò Team Lead riêng hay chỉ Member/Mentor.
- Project thuộc đúng một lớp hay có thể liên quan nhiều cohort/class.

## 12. Definition of Done cho backend Board

- [ ] Endpoint có OpenAPI operation/tag mô tả rõ UFR-PRJ-005 và contract response.
- [ ] Có kiểm tra authentication, `BOARD_READ`, Tenant active và object scope phía backend.
- [ ] Project/Sprint mismatch và Project không tồn tại không trả dữ liệu thay thế.
- [ ] Board trả đủ sáu cột theo thứ tự cố định; Backlog và status columns đúng query.
- [ ] `count` chỉ tính card được phép trả; empty/error/denied không bị nhập làm một.
- [ ] Activity Trail chỉ đọc, có giới hạn truy vấn và không lấy log ngoài Project.
- [ ] GET không ghi Task, audit thay đổi trạng thái hoặc outbox event.
- [ ] Unit, repository và integration test bao phủ AC01–AC04 cùng trường hợp scope/IDOR.
- [ ] Build Maven thành công; app khởi động được với cấu hình dev và seed không phá luồng User.
- [ ] Không lộ stack trace, token, secret hoặc thông tin Project ngoài scope trong response/log.
- [ ] Được demo và nhóm accept trước khi đánh dấu user story hoàn thành.

## 13. Thứ tự làm việc khuyến nghị

```text
Khảo sát nhánh/code và ownership
        ↓
Chốt schema + migration/seed Tenant và Project
        ↓
ProjectMember/object-scope policy
        ↓
Task model/query + Activity source
        ↓
Board DTO/service/controller/RBAC
        ↓
Unit + integration + security tests
        ↓
Build, chạy project, demo và nhận accept
```

Nếu Project, Task hoặc Activity đang được thành viên khác triển khai, phối hợp để dùng chung domain/API contract; không tạo bản sao chỉ để Board hoạt động độc lập.

## 14. Tài liệu tham chiếu trong repository

- `backend/src/main/java/com/example/starter_project_2025/base/crud/domain/BaseEntity.java`
- `backend/src/main/java/com/example/starter_project_2025/base/crud/service/BaseCrudServiceImpl.java`
- `backend/src/main/java/com/example/starter_project_2025/security/UserPrincipal.java`
- `backend/src/main/java/com/example/starter_project_2025/exception/GlobalExceptionHandler.java`
- `backend/src/main/java/com/example/starter_project_2025/system/project/sprint/Sprint.java`
- `backend/src/main/java/com/example/starter_project_2025/system/project/sprint/SprintController.java`
- `backend/src/main/java/com/example/starter_project_2025/system/project/sprint/SprintServiceImpl.java`
- `backend/src/main/java/com/example/starter_project_2025/system/project/sprint/audit/`
- `backend/src/main/java/com/example/starter_project_2025/system/project/sprint/event/`
- `docs/CLASS_DIAGRAM.md`
- `SRS_FAMS_LMS_MockProject_Hub_ThucTe_v2.0_With_UI.docx` (tài liệu nguồn được đặt ngoài thư mục repository)

## 15. Chạy thử Board bằng dữ liệu demo

Backend có sẵn user demo `student@example.com` / `password123`, nhưng dữ liệu mặc định chưa có Tenant, Project membership và Task phù hợp để gọi Board. Có thể bật seed riêng cho Board bằng biến môi trường `APP_SEED_BOARD_ENABLED=true`; mặc định seed này tắt và chỉ thêm dữ liệu phục vụ kiểm thử cục bộ.

### Khởi động

Mở PowerShell tại thư mục `backend`:

```powershell
$env:APP_SEED_BOARD_ENABLED = "true"
.\mvnw.cmd spring-boot:run
```

Trong log khởi động, tìm dòng `Board demo data enabled` để lấy `projectId`, `sprintId`, `emptyProjectId`, `emptySprintId`, `nonMemberProjectId` và `otherTenantProjectId`. H2 đang dùng database in-memory `create-drop`, vì vậy các ID được tạo lại khi khởi động lại ứng dụng.

### Đăng nhập và đọc Board

Mở PowerShell thứ hai:

```powershell
$login = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8080/api/auth/login `
  -ContentType "application/json" `
  -Body '{"email":"student@example.com","password":"password123"}'

$token = $login.accessToken
$projectId = 1 # thay bằng projectId trong log
$sprintId = 1  # thay bằng sprintId trong log
$emptyProjectId = 2 # thay bằng emptyProjectId trong log
$emptySprintId = 2  # thay bằng emptySprintId trong log

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8080/api/projects/$projectId/sprints/$sprintId/board" `
  -Headers @{ Authorization = "Bearer $token" }
```

Kết quả mong đợi: HTTP 200, thông tin sprint, sáu cột theo thứ tự Backlog/To do/In progress/Review/Done/Blocked; Board demo có một card backlog, một card ở mỗi trạng thái còn lại và một hoạt động mẫu. Response login trả permissions để xác nhận `BOARD_READ` được cấp.

### Kiểm tra các luồng và AC

| Tình huống | Cách gọi | Kết quả mong đợi |
|---|---|---|
| Không đăng nhập | Gọi GET Board không có `Authorization` | `401`; không trả Board rỗng. |
| Xem Board thành công | Dùng user demo, `projectId` và `sprintId` trong log | `200`, sprint và sáu cột có dữ liệu. |
| Board chưa có task | Dùng `emptyProjectId` và `emptySprintId` | `200`, thông tin sprint còn nguyên; tất cả cột có `count: 0` và danh sách rỗng. |
| Không là thành viên dự án | Dùng `nonMemberProjectId` cùng token student | `403`. |
| Khác tenant | Dùng `otherTenantProjectId` cùng token student | `403`. |
| Project không tồn tại | Dùng một ID lớn chưa tồn tại, ví dụ `99999999` | `404`. |
| Sprint không tồn tại/không thuộc project | Dùng ID Sprint lớn chưa tồn tại hoặc Sprint của Project khác | `404` nếu người gọi có scope Project; gọi Project ngoài scope vẫn `403` để không làm lộ dữ liệu. |
| Reload không ghi dữ liệu | Gọi lại GET nhiều lần; so sánh các card/activity | Dữ liệu không đổi; endpoint GET không tạo event. |

Ví dụ gọi thử 401:

```powershell
try {
  Invoke-RestMethod -Method Get `
    -Uri "http://localhost:8080/api/projects/$projectId/sprints/$sprintId/board"
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Để tắt seed sau khi test:

```powershell
Remove-Item Env:APP_SEED_BOARD_ENABLED
```

Sau đó khởi động lại backend. Không bật dữ liệu demo trong môi trường dùng chung/production; seed này gán Tenant và membership cho user demo và không thay thế luồng quản trị Tenant/Project thật.
