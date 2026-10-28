# FAMS & LMS — Hướng dẫn demo tính năng Learning và phân quyền

Ngày kiểm tra: 28/10/2026. Thời lượng: **6 phút 40 giây**. Phạm vi là các thay đổi Learning/Profile/RBAC; không dành thời gian trình diễn Login, Logout hoặc CRUD mẫu.

## 1. Readiness matrix

| Tính năng | Mức triển khai | Bằng chứng và điều kiện demo |
| --- | --- | --- |
| My Learning: tabs, CourseCard, enrollment count | UI + API + CourseEnrollment thật | `/my-learning` → `GET /api/learning/me`; hiện chưa có course để trình diễn card trực tiếp. Cần fixture được duyệt. |
| Profile Learning Overview | UI + API, theo quyền cá nhân | Profile luôn của principal; overview chỉ có khi đủ `LEARNER_ACCESS` và `LEARNING_SELF_READ`. Admin hiện tại đã được kiểm tra: không có overview. |
| Admin/Learner View | Đã triển khai theo permission | Một view khi chỉ có một nhóm quyền; dropdown hai view chỉ khi có cả hai. Không đổi role hay cấp quyền khi chuyển view. |
| User Detail > Learning | UI + API theo selected user | Kiểm tra trực tiếp Student #2: general tab là `student@example.com`, Learning có 0 enrollment. |
| Navigation/route guards | Đã triển khai | Dựa vào permission, không chỉ tên role. Backend kiểm tra độc lập. Tests kiểm tra boundary và cache; không thay role live. |
| Light/Dark, responsive | Đã triển khai; kiểm tra trực tiếp Admin Learning | Desktop và 390×844; đã sửa tab mobile chồng lên summary. Không có horizontal overflow ở 390px sau sửa. |
| In Progress, Completed, Saved, Certificates | Giữ UI, chưa có persistence tương ứng | Các tab giải thích chưa có dữ liệu; không coi enrollment là completion. |
| Study time, activity, overall progress, assessment results | Chưa có dữ liệu Learning đáng tin cậy | Hiển thị unavailable; không trình diễn số liệu giả. |

**Trạng thái dữ liệu hiện tại:** danh sách Course không có kết quả (0/0); Student #2 không có enrollment; User Management có ADMIN, STUDENT, TEACHER, chưa thấy account ADMIN + STUDENT. Đây là quan sát của phiên hiện tại, không phải bảo đảm trạng thái ở lần demo sau. Phiên ADMIN đang mở được sử dụng chỉ để đọc. Không tạo record, không đăng nhập mới, không thay role.

## 2. Các đường dẫn và API thực tế

| Vai trò / đường đi | URL | Backend / kiểm tra quyền |
| --- | --- | --- |
| STUDENT → User Account Menu → My Learning | `/my-learning` | `GET /api/learning/me`: `LEARNER_ACCESS` + `LEARNING_SELF_READ`; identity lấy từ UserPrincipal, không truyền userId. |
| STUDENT → Explore Catalog | `/courses` trong Learner View | Course catalog; `GET /api/enrollments/my-courses` đọc enrollment của principal. `POST /api/enrollments` với `courseId`, cần learner access + `ENROLLMENT_CREATE`. Chỉ thực hiện POST trong fixture đã duyệt. |
| Mọi account có quyền view tương ứng → User Account Menu → My Profile | `/fams/ho-so-ca-nhan-oi-mat-khau` (alias `/profile`) | `GET /api/profile` của principal; overview dùng dữ liệu personal learning, không lấy selected-user ID. |
| ADMIN → RBAC Management → Users → View detail → Learning | `/users` → `/users/{selectedUserId}/detail` | `GET /api/users/{userId}/learning`: `ADMIN_ACCESS` + `USER_READ` + `USER_LEARNING_READ`; target phải hợp lệ và tồn tại. |
| TEACHER → trang quản lý được cấp quyền → My Profile | `/teacher`, sau đó Profile | Management subset hiện có; không tự cấp `USER_READ`, `USER_LEARNING_READ` hoặc personal learner access. |
| ADMIN + STUDENT → header view dropdown | Learner → `/my-learning`; Admin → trang quản lý được phép | Union permission quyết định view; session giữ nguyên. Không gọi API đổi role. |

Custom role cũng tuân theo permission thực tế. Tên ADMIN/TEACHER không thay thế việc kiểm tra permission. Administrative target hiện được kiểm tra bằng quyền đọc toàn cục và target existence; chưa có policy giới hạn theo lớp/phòng ban/tenant. Không quảng bá khả năng scope đó.

Personal cache key có account email; administrative cache thêm selected userId. Cache được clear khi account/quyền thay đổi. Không dùng tab browser cùng origin để giữ nhiều account: localStorage và refresh cookie có thể dùng chung.

## 3. Dữ liệu demo và kế hoạch chuẩn bị an toàn — chưa thực hiện

Để chứng minh nonempty enrollment xuyên suốt, cần **một môi trường demo disposable riêng được duyệt**, không ghi vào database đang chạy:

1. Xác nhận target/runtime riêng, ownership, database disposable và trình duyệt profile riêng. Không dừng hoặc restart Java hiện tại, không đổi active DataSource/Vite API URL. Không dùng MySQL/Flyway hoặc thêm Learning Progress table.
2. Chuẩn bị cơ chế fixture riêng với danh sách initializer được phép. Các initializer hiện chưa được cách ly hoàn toàn; không khởi chạy mặc định rồi giả định không có seed grade/question hoặc thay account. Cơ chế cách ly này chưa được triển khai trong task demo.
3. Chỉ tạo course `[DEMO] FAMS & LMS — Ghi danh khóa học`, STUDENT và các account ADMIN/TEACHER cần thiết trong target disposable. Optional ADMIN + STUDENT chỉ khi được duyệt riêng trong fixture; không sửa role account live.
4. Dùng API Course hiện có để tạo course và chính STUDENT gọi `POST /api/enrollments` với courseId thật. Ghi lại courseId, studentUserId và enrollmentId từ response; không hardcode ID mẫu.
5. So sánh `GET /api/learning/me` của Student với `GET /api/users/{studentUserId}/learning` của Admin: cùng courseId/enrollmentId. Profile Student có enrollment count 1. Không seed percentage, completion, study time, activity, certificate hay grade.
6. Dùng browser profile/context riêng cho mỗi vai trò. Cookie localhost có thể dùng chung giữa các port; port khác đơn thuần không đủ cách ly session. Chuẩn bị account trước buổi trình bày, không dành thời gian demo authentication.

**Cần phê duyệt trước khi tạo fixture hoặc chạy runtime riêng.** Đây là yêu cầu của Phase 3 trong task. Hiện chỉ có kế hoạch, chưa có fixture hoặc lệnh khởi tạo được chạy. Nếu chưa duyệt, dùng nhánh empty state dưới đây và nói rõ chưa kiểm chứng flow có enrollment bằng dữ liệu live.

## 4. Kịch bản tiếng Việt — 6 phút 40 giây

Chuẩn bị các phiên đã xác thực, cách ly theo vai trò. Trong bảng, nhánh “có fixture” chỉ dùng sau khi fixture được duyệt và kiểm tra. Nếu chưa có Student/Teacher session an toàn, trình bày bằng source/test evidence và ghi rõ không phải kiểm thử live trong phiên này.

| Thời gian | Trang / vai trò / thao tác chính xác | Kết quả và nguồn dữ liệu | Lời trình bày |
| --- | --- | --- | --- |
| 0:00–0:25 | Bắt đầu tại `/my-learning`, STUDENT; chỉ vào header Learner View. | Permission learner quyết định giao diện; personal API lấy principal. | “Phần demo tập trung vào việc tách quyền quản trị và quyền học tập, đồng thời bảo đảm dữ liệu cá nhân luôn thuộc tài khoản đang sử dụng.” |
| 0:25–1:30 | My Learning → Enrolled. Có fixture: chỉ tên course trên CourseCard. Chưa có fixture: chỉ empty state. Lần lượt mở In Progress, Completed, Saved, Certificates & Badges rồi trở lại Enrolled. | `GET /api/learning/me` trả enrollment thật. Tabs chưa hỗ trợ persistence có thông báo rõ. Card không có phần trăm giả. | “Khóa học ở đây đến từ bản ghi ghi danh. Ghi danh chưa có nghĩa là đã học xong. Các chỉ số chưa được lưu sẽ được thông báo chưa khả dụng, thay vì hiển thị số liệu mẫu.” |
| 1:30–2:10 | User Account Menu → My Profile; STUDENT. Chỉ thông tin account và Learning Overview. | `/api/profile` của principal; overview từ personal learning. Có fixture count 1; không có enrollment có empty state. | “Hồ sơ cá nhân được dùng chung giữa các giao diện. Phần tổng quan học tập chỉ xuất hiện khi tài khoản có quyền xem hồ sơ học tập của chính mình.” |
| 2:10–2:55 | Chỉ learner navigation; nếu có phiên Student disposable an toàn, mở trực tiếp `/users` để minh họa chặn route rồi quay lại My Learning. | Learner không có admin access/user-read; backend cũng kiểm tra permission. Không cần gửi request có userId vào personal API. | “Ẩn menu là một lớp trải nghiệm. Route và backend vẫn kiểm tra quyền độc lập, nên nhập đường dẫn quản trị trực tiếp cũng không cấp thêm quyền.” |
| 2:55–4:05 | Chuyển sang browser profile ADMIN → RBAC Management → Users → View detail của đúng Student → xác nhận email ở Thông tin chung → Learning. Không bấm Edit/Delete. | `/api/users/{selectedUserId}/learning`. Có fixture: cùng course/enrollment với Student; hiện tại selected Student #2 có 0 enrollment. | “Đây là chức năng quản trị xem người dùng được chọn, tách biệt với My Learning. Chúng em xác nhận email trước khi mở Learning để tránh nhầm dữ liệu của quản trị viên với dữ liệu sinh viên.” |
| 4:05–4:40 | ADMIN → User Account Menu → My Profile. | Profile vẫn là Admin; không có learner overview khi thiếu personal learning access. | “Tài khoản quản trị có thể kiểm tra học tập của người khác theo quyền, nhưng không tự động trở thành người học. Vì vậy hồ sơ Admin không hiện tổng quan học tập cá nhân.” |
| 4:40–5:10 | Phiên TEACHER riêng → `/teacher` → My Profile; chỉ menu được cấp quyền. | Teacher management subset; không personal learner/user-management theo mapping mặc định. Source/tests hỗ trợ; cần phiên riêng để kiểm chứng live. | “Giảng viên giữ các chức năng quản lý được phân quyền. Vai trò này không mặc nhiên được xem hồ sơ học tập cá nhân hoặc quản lý toàn bộ người dùng.” |
| 5:10–5:40 | Optional dual account an toàn: dropdown header → Learner View → My Profile → Admin View. Nếu chưa có: không thay role live; giải thích bằng tests và source. | Combined permission cho hai view, giữ session. Hiện chưa có dual account live để trình diễn. | “Tài khoản có cả hai nhóm quyền được chuyển giao diện ngay trong cùng phiên. Thao tác này chỉ đổi ngữ cảnh hiển thị, không nâng quyền tài khoản.” |
| 5:40–6:20 | Admin User Detail > Learning hoặc Student My Learning → Change theme → Dark → Light. DevTools responsive 390×844; mở menu mobile nếu cần, sau đó trả desktop. | Theme token/card/tab hiện có; tab wrap không đè summary. Fresh browser check đã thực hiện trên Admin Learning. | “Chúng em giữ hệ thống giao diện ban đầu, đồng thời kiểm tra thẻ, tab và trạng thái rỗng trong cả hai theme và trên màn hình nhỏ.” |
| 6:20–6:40 | Trở lại Enrolled; kết thúc trên Learning page. | Enrollment và phân quyền đã có; progress persistence vẫn là đề xuất. | “Phần đã hoàn thành là luồng ghi danh, hiển thị dữ liệu đúng người và phân quyền theo ngữ cảnh. Tiến độ bài học, hoàn thành khóa học và chứng chỉ là giai đoạn tiếp theo, chưa được trình bày như chức năng đã hoàn tất.” |

Không trình diễn dashboard thống kê mẫu, điểm seed hoặc bài thi như bằng chứng hoàn thành khóa học. Không chỉnh sửa Profile, mật khẩu, role hoặc dữ liệu quản trị trong walkthrough.

## 5. Bản sửa nhỏ và kiểm chứng trong task này

- `frontend/src/pages/management/learning/components/CourseCard.tsx`: đổi nhãn “View Syllabus” thành “View courses”, đúng với link `/courses` hiện có; không hứa có trang syllabus chưa tồn tại.
- `frontend/src/pages/management/rbac/user/pages/UserDetailPage.tsx`: đặt tab trigger tự tính chiều cao và minimum height để các tab wrap trên mobile không chồng lên summary. Chỉ sửa cục bộ ba trigger, không đổi shared component.
- `frontend/tests/learning-ui.test.mjs`: thêm kiểm tra loading không giả thành empty enrollment và lỗi đọc target user có Retry, không lẫn dữ liệu cá nhân/target. Fixtures chỉ tồn tại trong automated tests.
- Sau bản sửa mobile, chạy lại `npm test`: 17 tests pass; `npm run build`: pass. Còn cảnh báo bundle trên 500KB.
- Browser hiện tại: ADMIN Profile không có overview; User Detail của Student #2 đúng identity và empty Learning; Course list 0/0; desktop Light và mobile Light/Dark kiểm tra trực quan. Ở 390px, document/header không tràn ngang; tab children nằm trong chiều cao tablist sau sửa.
- Chưa chạy backend build/tests trong task này: backend đang chạy có DevTools, thay classpath có thể gây restart ngoài phạm vi cho phép. Kết quả backend trong [post-refactor-verification.md](post-refactor-verification.md) là lịch sử, không phải lần chạy mới.
- Chưa kiểm thử live Student, Teacher, dual hoặc lỗi mạng trong phiên hiện tại; role/cache/loading/error có source/test coverage và kiểm chứng lịch sử. Chưa kiểm chứng live nonempty enrollment vì thiếu dữ liệu được phép ghi.

## 6. Đã triển khai và kế hoạch tương lai

Đã triển khai: Course/CourseEnrollment, unique user-course enrollment, personal endpoint dùng principal, administrative read endpoint riêng, permission-aware views/navigation/guards, shared own Profile, conditional overview, enrollment cards/tabs và truthful empty/loading/error states. Reuse service/component hiện có.

Chưa triển khai trong phạm vi Learning: lesson completion evidence, module/course progress, completion facts, assessment attempt/result integration, retake policy, saved course persistence, activity/study-time aggregation, certificate issuance. Menu Module/ModuleGroup hiện có không đồng nghĩa curriculum module. Exam/score authoring hiện có không chứng minh completion. Thiết kế tại [learning-progress-architecture.md](learning-progress-architecture.md) vẫn là đề xuất, chưa được duyệt triển khai.

## 7. Rủi ro và checklist trước buổi trình bày

1. **Dữ liệu:** môi trường đang mở chưa có course/enrollment cho flow nonempty. Chỉ empty-state demo sẵn sàng; cần duyệt fixture riêng để hoàn thiện phần này.
2. **Persistence:** default H2 in-memory + Hibernate create-drop; không hứa dữ liệu tồn tại sau restart. Không restart Java. Initializer có thể seed hoặc thay retained record khi startup; kế hoạch database tại [learning-database-readiness.md](learning-database-readiness.md) chưa phải deployment đã thực hiện.
3. **Role/session:** không có live dual account; Student/Teacher cần session riêng được phép. Kiểm tra permission payload thực tế trước buổi demo; custom role dựa trên quyền, không dựa vào tên. Không thay mapping live để làm đẹp demo.
4. **Target authorization:** current administrative read là global user-read theo permission, chưa có class/department scope. Xác nhận selected email rồi mới đối chiếu enrollment.
5. **UI evidence:** fresh responsive/theme check mới trên Admin Learning; chạy rehearsal Student My Learning/Profile ở desktop/mobile sau khi có isolated session. Không coi unit tests là toàn bộ browser coverage.
6. **Loading/error:** tests đã cover; có thể rehearsal mất mạng trong disposable browser, sau đó restore và Retry. Không tắt backend để minh họa.
7. **Build:** bundle size warning còn tồn tại; không mở rộng refactor hiệu năng trong task này. Rehearsal trên máy trình chiếu, phóng chữ vừa đủ, chuẩn bị guide làm fallback nếu session hết hạn.

Không có thay đổi database, process Java, active cấu hình, production infrastructure hoặc historical learning records trong task này. Mọi uncommitted work trước đó cần được giữ nguyên.
