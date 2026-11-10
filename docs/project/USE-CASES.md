# Use Cases – FAMS LMS (Mock Project Hub)

Tài liệu tóm tắt các use case trong `docs/project/`. Các tài liệu chi tiết được giữ riêng; bản này chỉ giữ luồng chính, trạng thái HTTP và các quy tắc người dùng cần biết.

## Danh sách use case

- 5.2.1. Tạo Sprint và thiết lập Sprint Goal
- 5.2.2. Tạo và quản lý Backlog Item
- 5.2.3. Gán Backlog Item vào Sprint
- 5.2.4. Tạo phiên bản mới cho Project Template
- 5.2.5. Nhân bản Project Template
- 5.2.6. Cấu hình và kiểm tra định suất vai trò thành viên nhóm
- 5.2.7. Kiểm tra điều kiện công bố phiên phân nhóm

---

### 5.2.1. UC-PRJ-003-01 – Tạo Sprint và thiết lập Sprint Goal

> Mã use case: **UFR-PRJ-003-01** — Create Sprint and Set Sprint Goal
> Phân hệ: Quản lý Mock Project (Hub PRJ-03)

#### 5.2.1.1. Mục tiêu

Sinh viên tạo một Sprint mới cho nhóm, đặt mục tiêu và thời gian thực hiện. Sprint mới luôn bắt đầu ở trạng thái **Planned** để nhóm tiếp tục đưa công việc vào Sprint Backlog.

#### 5.2.1.2. Tác nhân

- **Sinh viên (Team Leader / Team Member):** người tạo Sprint.
- **Quản trị viên:** có thể thực hiện khi có quyền.
- **Hệ thống:** kiểm tra dữ liệu, lưu Sprint, ghi lịch sử và thông báo cho các bên liên quan.

#### 5.2.1.3. Điều kiện trước

- Người dùng đã đăng nhập và đang ở đúng workspace của nhóm.
- Có quyền tạo Sprint.
- Nhóm/dự án đang hoạt động, không bị đóng.
- Đang ở Sprint Workspace hoặc trang Backlog.

#### 5.2.1.4. Điều kiện sau

- Sprint mới được lưu ở trạng thái **Planned**.
- Danh sách Sprint và board được cập nhật; hiển thị thông báo “Đã tạo Sprint mới.”.
- Thao tác được ghi vào lịch sử để truy vết.

#### 5.2.1.5. Kích hoạt

Người dùng bấm **“Create Sprint”** trên Sprint Workspace hoặc chọn **“Create sprint”** ở trang Backlog.

#### 5.2.1.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở Sprint Workspace hoặc trang Backlog. |
| 2 | Hệ thống | Hiển thị danh sách Sprint và nút tạo Sprint (nếu có quyền). |
| 3 | Người dùng | Mở form, nhập tên Sprint, mục tiêu, thời gian bắt đầu/kết thúc. |
| 4 | Hệ thống | Kiểm tra dữ liệu bắt buộc và thời gian hợp lệ; báo lỗi ngay trên form nếu sai. |
| 5 | Hệ thống | Gửi `POST /api/sprints` để tạo Sprint. |
| 6 | Hệ thống | Lưu Sprint ở trạng thái Planned, trả **200 OK**. |
| 7 | Giao diện | Đóng form, tải lại danh sách, chọn Sprint mới và hiển thị thông báo thành công. |

#### 5.2.1.7. Luồng thay thế và ngoại lệ

- **422:** thiếu tên, mục tiêu hoặc thời gian; tên/mục tiêu quá dài; thời gian kết thúc không sau thời gian bắt đầu. Form giữ nguyên dữ liệu để sửa.
- **409:** tên Sprint đã tồn tại trong cùng nhóm/dự án.
- **401/403:** chưa đăng nhập hoặc không có quyền tạo Sprint.
- **500:** lỗi hệ thống; dữ liệu trên form vẫn được giữ để thử lại.

#### 5.2.1.8. Quy tắc nghiệp vụ và ghi chú

1. Tên Sprint bắt buộc, tối đa 255 ký tự và không trùng trong cùng nhóm/dự án.
2. Sprint Goal bắt buộc, từ 1 đến 500 ký tự.
3. Thời gian kết thúc phải sau thời gian bắt đầu.
4. Sprint mới luôn ở trạng thái **Planned**; muốn chuyển sang **Active** hoặc **Cancelled** phải cập nhật sau khi tạo.
5. Chỉ có thể bắt đầu Sprint khi đã có ít nhất một công việc trong Sprint Backlog.
6. Mọi thao tác tạo đều được ghi lịch sử và phát thông báo cho nhóm.

#### 5.2.1.9. Minh chứng kiểm thử Backend trên Swagger

- **API:** `POST /api/sprints`
- **Dữ liệu gửi lên:** tên Sprint, mục tiêu, thời gian bắt đầu/kết thúc, nhóm/dự án.
- **Kết quả mong đợi:** `200 OK`, Sprint mới có trạng thái `PLANNED`.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.1-1. Kết quả kiểm thử API tạo Sprint trên Swagger**

#### 5.2.1.10. Màn hình Frontend

Màn hình Sprint Workspace với nút **“Create Sprint”**, form nhập tên, mục tiêu và thời gian; sau khi lưu, Sprint mới xuất hiện trong danh sách/board.

Ảnh chụp cần thể hiện: form đã nhập đủ dữ liệu và trạng thái sau khi tạo thành công.

**Hình 5.2.1-2. Màn hình tạo Sprint và thiết lập Sprint Goal**

---

### 5.2.2. UC-PRJ-003-02 – Tạo và quản lý Backlog Item

> Mã use case: **UFR-PRJ-003-02** — Create and Manage Backlog Items
> Phân hệ: Quản lý Mock Project (Hub PRJ-03)

#### 5.2.2.1. Mục tiêu

Sinh viên tạo và quản lý công việc trong Product Backlog hoặc Sprint Backlog, liên kết với Milestone, gán người thực hiện, ước lượng thời gian và theo dõi trạng thái công việc.

#### 5.2.2.2. Tác nhân

- **Sinh viên (Team Leader / Team Member):** tạo, sửa, chuyển trạng thái và xoá công việc.
- **Quản trị viên:** có thể thực hiện khi có quyền.
- **Hệ thống:** kiểm tra dữ liệu, lưu thay đổi, ghi lịch sử và thông báo cho nhóm.

#### 5.2.2.3. Điều kiện trước

- Người dùng đã đăng nhập và có quyền xem/tạo/sửa công việc.
- Sprint (nếu chọn) đang tồn tại; dự án/nhóm đang hoạt động.
- Milestone (nếu chọn) còn hiệu lực và thuộc đúng dự án/nhóm.
- Đang ở trang Backlog hoặc tab Backlog của Sprint Workspace.

#### 5.2.2.4. Điều kiện sau

- Công việc được lưu với trạng thái mặc định **To do**, độ ưu tiên **Medium**, loại **Task** và xuất hiện trong đúng ô Backlog.
- Nếu có milestone, công việc hiển thị kèm nhãn milestone.
- Thay đổi được ghi lịch sử và thông báo cho các thành viên nhóm.
- Khi xoá, công việc bị gỡ khỏi hệ thống và board được cập nhật.

#### 5.2.2.5. Kích hoạt

Người dùng bấm **“+ Create”** dưới một ô Backlog, hoặc mở một công việc để sửa, đổi trạng thái, đổi milestone hay xoá.

#### 5.2.2.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở trang Backlog hoặc tab Backlog của Sprint. |
| 2 | Hệ thống | Tải board, danh sách milestone và thành viên có thể giao việc. |
| 3 | Người dùng | Bấm “+ Create”, nhập tên, mô tả, chọn milestone, hạn và người thực hiện. |
| 4 | Hệ thống | Kiểm tra dữ liệu; báo lỗi ngay trên form nếu thiếu hoặc quá dài. |
| 5 | Hệ thống | Gửi `POST /api/sprint-backlogs`, trả **200 OK** khi tạo thành công. |
| 6 | Giao diện | Hiển thị công việc mới và thông báo thành công. |
| 7 | Người dùng | Mở công việc để sửa hoặc đổi trạng thái. |
| 8 | Hệ thống | Gửi `PUT /api/sprint-backlogs/{id}`, cập nhật và trả **200 OK**. |
| 9 | Người dùng | Có thể xoá công việc bằng nút Delete. |
| 10 | Hệ thống | Gửi `DELETE /api/sprint-backlogs/{id}`, trả **204 No Content** khi thành công. |

#### 5.2.2.7. Luồng thay thế và ngoại lệ

- **422:** thiếu tên, mô tả quá dài, ngày không hợp lệ, trạng thái không hợp lệ, milestone/project không khớp hoặc công việc đã có Subtask nên không thể xoá/chuyển dự án. Form giữ dữ liệu để sửa.
- **404:** milestone đã bị xoá hoặc không còn hiệu lực; form giữ dữ liệu và yêu cầu chọn lại.
- **409:** người khác vừa sửa cùng công việc; cần tải lại trước khi lưu tiếp.
- **401/403:** chưa đăng nhập, thiếu quyền hoặc dự án ngoài phạm vi.
- **500:** lỗi hệ thống; dữ liệu vẫn được giữ để thử lại.

#### 5.2.2.8. Quy tắc nghiệp vụ và ghi chú

1. Tên công việc bắt buộc, tối đa 200 ký tự; mô tả tối đa 1.000 ký tự.
2. Ngày bắt đầu và kết thúc phải nhập theo cặp; ngày kết thúc phải sau ngày bắt đầu.
3. Công việc chưa thuộc Sprint nằm ở Product Backlog và chỉ được ở trạng thái **To do**.
4. Luồng trạng thái: **To do → In progress → Review → Done** (được phép lùi theo luồng).
5. Loại công việc cố định: Story, Bug, Task; độ ưu tiên: Low, Medium, High, Urgent.
6. Milestone phải còn hiệu lực và thuộc đúng dự án/nhóm.
7. Công việc đã có Subtask thì không được xoá hoặc chuyển sang dự án khác.
8. Mọi thay đổi đều được ghi lịch sử và thông báo cho nhóm.

#### 5.2.2.9. Minh chứng kiểm thử Backend trên Swagger

- **API tạo:** `POST /api/sprint-backlogs`
- **Dữ liệu gửi lên:** tên, mô tả, milestone, hạn, người thực hiện, Sprint (nếu có).
- **Kết quả mong đợi:** `200 OK`, công việc mới ở trạng thái `TODO`.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.2-1. Kết quả kiểm thử API tạo Backlog item trên Swagger**

- **API cập nhật:** `PUT /api/sprint-backlogs/{id}`
- **Dữ liệu gửi lên:** milestone mới hoặc trạng thái mới.
- **Kết quả mong đợi:** `200 OK`, thông tin công việc được cập nhật.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.2-2. Kết quả kiểm thử API cập nhật Backlog item trên Swagger**

#### 5.2.2.10. Màn hình Frontend

Màn hình Backlog với các ô Sprint/Product Backlog, thanh tạo công việc nhanh và panel chi tiết để sửa, đổi trạng thái, liên kết milestone hoặc xoá.

Ảnh chụp cần thể hiện: thanh tạo đã nhập dữ liệu và công việc mới xuất hiện kèm nhãn milestone.

**Hình 5.2.2-3. Màn hình tạo và quản lý Backlog item**

---

### 5.2.3. UC-PRJ-003-03 – Gán Backlog Item vào Sprint

> Mã use case: **UFR-PRJ-003-03** — Assign Backlog Items to Sprint
> Phân hệ: Quản lý Mock Project (Hub PRJ-03)

#### 5.2.3.1. Mục tiêu

Sinh viên chọn công việc từ Product Backlog đưa vào Sprint, sắp xếp lại thứ tự hiển thị và bỏ công việc không còn thuộc phạm vi. Toàn bộ phạm vi được xác nhận trong một lần.

#### 5.2.3.2. Tác nhân

- **Sinh viên (Team Leader / Team Member):** người lập phạm vi Sprint.
- **Quản trị viên:** có thể thực hiện khi có quyền.
- **Hệ thống:** kiểm tra phạm vi, lưu thay đổi và cập nhật board.

#### 5.2.3.3. Điều kiện trước

- Người dùng đã đăng nhập và có quyền xem/chỉnh sửa Sprint.
- Sprint đang tồn tại và ở trạng thái **Planned** hoặc **Active**.
- Công việc cần gán đang tồn tại; công việc từ Product Backlog phải ở trạng thái **To do**.
- Sprint/dự án thuộc phạm vi người dùng và chưa bị đóng.

#### 5.2.3.4. Điều kiện sau

- Sprint chứa đúng danh sách công việc đã xác nhận; công việc bị bỏ khỏi danh sách trở về Product Backlog.
- Board hiển thị phạm vi mới và hiển thị thông báo “Đã cập nhật Sprint Backlog…”.
- Không có công việc nào bị xoá; chỉ quan hệ với Sprint thay đổi.
- Nếu Sprint đã đóng, thay đổi bị từ chối và board quay về dữ liệu cũ.

#### 5.2.3.5. Kích hoạt

Người dùng mở Sprint Workspace → tab **“Sprints & Backlog”**, chọn Sprint và bấm **Assign**/**Unassign** hoặc kéo–thả công việc, sau đó bấm **“Confirm assignment”**.

#### 5.2.3.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở tab “Sprints & Backlog” và chọn Sprint. |
| 2 | Hệ thống | Tải hai danh sách: công việc trong Sprint và công việc còn ở Product Backlog. |
| 3 | Người dùng | Chọn/kéo công việc sang Sprint hoặc bỏ khỏi Sprint. |
| 4 | Hệ thống | Hiển thị thay đổi tạm thời và banner “Unsaved scope changes”. |
| 5 | Người dùng | Bấm “Confirm assignment”. |
| 6 | Hệ thống | Gửi `PUT /api/sprints/{id}/backlog-items` với danh sách công việc của Sprint. |
| 7 | Hệ thống | Kiểm tra Sprint còn mở, công việc hợp lệ và trạng thái phù hợp. |
| 8 | Hệ thống | Lưu phạm vi mới và trả **200 OK** kèm board cập nhật. |
| 9 | Giao diện | Hiển thị phạm vi mới và thông báo thành công. |

#### 5.2.3.7. Luồng thay thế và ngoại lệ

- **404:** Sprint không còn tồn tại.
- **422:** Sprint đã hoàn thành/huỷ; danh sách công việc trùng hoặc có công việc không tồn tại; công việc sai trạng thái khi vào/ra Sprint. Board quay về dữ liệu cũ.
- **403:** thiếu quyền hoặc Sprint ngoài phạm vi.
- **409:** dữ liệu vừa bị người khác thay đổi; cần tải lại.
- **401/500:** chưa đăng nhập hoặc lỗi hệ thống.

#### 5.2.3.8. Quy tắc nghiệp vụ và ghi chú

1. Chỉ Sprint **Planned** hoặc **Active** mới được thay đổi phạm vi.
2. Danh sách gửi lên là toàn bộ công việc của Sprint; công việc không còn trong danh sách sẽ về Product Backlog.
3. Công việc từ Product Backlog chỉ được vào Sprint khi đang **To do**; chỉ công việc **To do** mới được rời Sprint.
4. Không thể lấy công việc từ Sprint đã hoàn thành/huỷ.
5. Thao tác gán chỉ đổi quan hệ với Sprint, không sửa nội dung, milestone hay người thực hiện.
6. Toàn bộ thay đổi được lưu cùng lúc: nếu một công việc lỗi thì không thay đổi nào được áp dụng.
7. Thứ tự kéo–thả hiện chỉ có tác dụng trên màn hình; hệ thống chưa lưu thứ tự này.

#### 5.2.3.9. Minh chứng kiểm thử Backend trên Swagger

- **API xác nhận:** `PUT /api/sprints/{id}/backlog-items`
- **Dữ liệu gửi lên:** danh sách công việc của Sprint theo thứ tự hiển thị.
- **Kết quả mong đợi:** `200 OK`, Sprint chứa đúng danh sách công việc.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.3-1. Kết quả kiểm thử API xác nhận phạm vi Sprint Backlog trên Swagger**

- **API tải board:** `GET /api/sprints/{id}/backlog-items`
- **Kết quả mong đợi:** `200 OK`, trả về thông tin Sprint và hai danh sách công việc.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.3-2. Kết quả kiểm thử API tải Sprint Planning board trên Swagger**

#### 5.2.3.10. Màn hình Frontend

Màn hình Sprint Workspace → tab “Sprints & Backlog” với hai panel Sprint Backlog và Product Backlog, nút Assign/Unassign và nút xác nhận phạm vi.

Ảnh chụp cần thể hiện: trạng thái có thay đổi chưa lưu và trạng thái sau khi xác nhận thành công.

**Hình 5.2.3-3. Màn hình gán Backlog item vào Sprint**

---

### 5.2.4. UC-US-07 – Tạo phiên bản mới cho Project Template

> Mã use case: **US-07** — Create New Version of Project Template
> Phân hệ: Quản lý Mock Project — Project Template

#### 5.2.4.1. Mục tiêu

Quản lý chương trình tạo phiên bản mới từ một Project Template đang có. Hệ thống tự tăng số phiên bản, sao chép cấu hình sang bản mới ở trạng thái **Draft**, giữ liên kết về phiên bản nguồn và không làm thay đổi phiên bản cũ.

#### 5.2.4.2. Tác nhân

- **Quản lý chương trình:** người tạo phiên bản mới.
- **Quản trị viên / Mentor / Teacher / Trainer:** có thể thực hiện khi có quyền.
- **Hệ thống:** tăng số phiên bản, sao chép cấu hình, lưu và ghi lịch sử.

#### 5.2.4.3. Điều kiện trước

- Người dùng đã đăng nhập và có quyền quản lý template.
- Template và phiên bản nguồn đang ở trạng thái **Draft**, chưa bị dùng cho dự án.
- Phiên bản nguồn là phiên bản template hợp lệ và có cấu hình đọc được.

#### 5.2.4.4. Điều kiện sau

- Một phiên bản mới được tạo ở trạng thái **Draft**, số phiên bản tự tăng (ví dụ `v1.0 → v2.0`).
- Cấu hình và tài nguyên được sao chép sang phiên bản mới.
- Phiên bản mới hiển thị “Derived from v1.0”; phiên bản nguồn và các Workspace đã tạo từ nó không thay đổi.

#### 5.2.4.5. Kích hoạt

Người dùng mở Project Template → tab **Versions**, chọn phiên bản và bấm **“Create New Version”**.

#### 5.2.4.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở tab Versions và chọn phiên bản nguồn. |
| 2 | Hệ thống | Hiển thị các phiên bản hiện có và nút tạo phiên bản mới. |
| 3 | Người dùng | Bấm “Create New Version”, xem trước số phiên bản tiếp theo. |
| 4 | Người dùng | Xác nhận tạo phiên bản. |
| 5 | Hệ thống | Gửi `POST /api/project-template-versions/{id}/new-version`. |
| 6 | Hệ thống | Tạo phiên bản mới ở trạng thái Draft, sao chép cấu hình và trả **201 Created**. |
| 7 | Giao diện | Chọn phiên bản mới, mở tab Versions và thông báo thành công. |

#### 5.2.4.7. Luồng thay thế và ngoại lệ

- **404:** phiên bản nguồn không tồn tại.
- **403:** thiếu quyền hoặc template ngoài phạm vi.
- **422:** template đã bị lưu trữ, phiên bản nguồn không hợp lệ hoặc cấu hình không đọc được.
- **409:** trùng số phiên bản do hai người tạo cùng lúc; chỉ cần thực hiện lại.
- **401/500:** chưa đăng nhập hoặc lỗi hệ thống.

#### 5.2.4.8. Quy tắc nghiệp vụ và ghi chú

1. Số phiên bản do hệ thống sinh: tăng số lớn nhất lên 1 và đưa phần lẻ về 0.
2. Phiên bản mới luôn ở trạng thái **Draft** và có liên kết về phiên bản nguồn.
3. Cấu hình được sao chép sang bản mới; bản nguồn chỉ được đọc và không bị sửa.
4. Chỉ phiên bản Draft mới được sửa; phiên bản đã công bố/lưu trữ là chỉ đọc.
5. Tạo phiên bản mới khác với nhân bản template: vẫn nằm trong cùng template và giữ liên kết nguồn.

#### 5.2.4.9. Minh chứng kiểm thử Backend trên Swagger

- **API:** `POST /api/project-template-versions/{id}/new-version`
- **Dữ liệu gửi lên:** không có body; truyền id phiên bản nguồn trên đường dẫn.
- **Kết quả mong đợi:** `201 Created`, phiên bản mới ở trạng thái `DRAFT`, có liên kết về phiên bản nguồn.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.4-1. Kết quả kiểm thử API tạo phiên bản mới trên Swagger**

- **API kiểm tra:** `GET /api/project-template-versions/by-template/{templateId}`
- **Kết quả mong đợi:** `200 OK`, danh sách phiên bản thể hiện chuỗi phiên bản và bản mới ở trạng thái Draft.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.4-2. Kết quả kiểm thử API danh sách phiên bản trên Swagger**

#### 5.2.4.10. Màn hình Frontend

Màn hình Project Template Versions với nút **“Create New Version”** và hộp thoại xem trước phiên bản tiếp theo.

Ảnh chụp cần thể hiện: hộp thoại xác nhận và phiên bản mới ở trạng thái Draft sau khi tạo.

**Hình 5.2.4-3. Màn hình tạo phiên bản mới cho Project Template**

---

### 5.2.5. UC-US-08 – Nhân bản Project Template

> Mã use case: **US-08** — Duplicate Project Template
> Phân hệ: Quản lý Mock Project — Project Template

#### 5.2.5.1. Mục tiêu

Quản lý chương trình tạo một Project Template mới độc lập từ template đang chọn, chỉ cần nhập tên mới. Cấu hình được sao chép nhưng bản mới không giữ liên kết phiên bản với bản gốc.

#### 5.2.5.2. Tác nhân

- **Quản lý chương trình:** người nhân bản template.
- **Quản trị viên / Mentor / Teacher / Trainer:** có thể thực hiện khi có quyền.
- **Hệ thống:** sao chép cấu hình, tạo template mới và ghi lịch sử.

#### 5.2.5.3. Điều kiện trước

- Người dùng đã đăng nhập và có quyền tạo/quản lý template.
- Template nguồn và phiên bản nguồn đang tồn tại, đọc được.
- Phiên bản nguồn có cấu hình hợp lệ (milestone và backlog đọc được).

#### 5.2.5.4. Điều kiện sau

- Một Project Template mới được tạo ở trạng thái **Draft**, phiên bản đầu tiên là `v1.0` / **Draft**.
- Cấu hình, milestone, rubric, backlog mẫu và tài nguyên được sao chép.
- Bản mới không có liên kết phiên bản về bản gốc; bản gốc không thay đổi.

#### 5.2.5.5. Kích hoạt

Người dùng mở Project Template → tab **Versions** → chọn phiên bản → bấm **“Duplicate template”**.

#### 5.2.5.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở tab Versions và chọn phiên bản nguồn. |
| 2 | Người dùng | Bấm “Duplicate template”. |
| 3 | Hệ thống | Hiển thị hộp thoại yêu cầu nhập tên template mới. |
| 4 | Người dùng | Nhập tên và xác nhận. |
| 5 | Hệ thống | Gửi `POST /api/project-template-versions/{id}/duplicate`. |
| 6 | Hệ thống | Tạo template mới, phiên bản `v1.0` ở trạng thái Draft và trả **201 Created**. |
| 7 | Giao diện | Mở template mới và thông báo nhân bản thành công. |

#### 5.2.5.7. Luồng thay thế và ngoại lệ

- **422:** tên trống/quá dài, nguồn là workspace snapshot hoặc cấu hình không hợp lệ.
- **404:** phiên bản hoặc template nguồn không tồn tại.
- **403:** thiếu quyền hoặc ngoài phạm vi dữ liệu.
- **409:** trùng mã template do hai người tạo cùng lúc.
- **401/500:** chưa đăng nhập hoặc lỗi hệ thống.

#### 5.2.5.8. Quy tắc nghiệp vụ và ghi chú

1. Người dùng chỉ nhập tên mới; mã template do hệ thống sinh.
2. Tên template bắt buộc và tối đa 255 ký tự.
3. Template mới thuộc cùng tenant, ở trạng thái Draft và bắt đầu từ phiên bản `v1.0`.
4. Cấu hình được sao chép từ phiên bản nguồn đang chọn; nếu thiếu thông tin sẽ bổ sung từ template nguồn.
5. Bản mới không có liên kết phiên bản về bản gốc; hai bản phát triển độc lập.
6. Khác với “Create New Version”: nhân bản tạo template mới, còn tạo phiên bản mới vẫn ở cùng template.

#### 5.2.5.9. Minh chứng kiểm thử Backend trên Swagger

- **API:** `POST /api/project-template-versions/{id}/duplicate`
- **Dữ liệu gửi lên:** tên template mới.
- **Kết quả mong đợi:** `201 Created`, template mới với phiên bản `v1.0` ở trạng thái Draft.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.5-1. Kết quả kiểm thử API nhân bản Project Template trên Swagger**

- **API kiểm tra:** `GET /api/project-template-versions/by-template/{templateId}`
- **Kết quả mong đợi:** `200 OK`, template mới chỉ có phiên bản `v1.0`; template cũ giữ nguyên.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.5-2. Kết quả kiểm thử API danh sách phiên bản của template mới trên Swagger**

#### 5.2.5.10. Màn hình Frontend

Màn hình chi tiết Project Template → tab Versions với nút **“Duplicate template”** và hộp thoại nhập tên mới.

Ảnh chụp cần thể hiện: hộp thoại nhân bản và template mới với phiên bản `v1.0` ở trạng thái Draft.

**Hình 5.2.5-3. Màn hình nhân bản Project Template**

---

### 5.2.6. UC-US-11 – Cấu hình và kiểm tra định suất vai trò thành viên nhóm

> Mã use case: **US-11** — Configure &amp; Validate Team Member Role Quotas
> Phân hệ: Quản lý Mock Project — Project Template &amp; Team Allocation

#### 5.2.6.1. Mục tiêu

Quản lý chương trình cấu hình số thành viên và định suất tối thiểu cho các vai trò PM/BA/DEV/QA trong Project Template. Mentor sau đó phân vai trò cho từng thành viên và hệ thống kiểm tra cấu hình có đáp ứng định suất hay không.

#### 5.2.6.2. Tác nhân

- **Quản lý chương trình:** cấu hình định suất trên template.
- **Mentor:** phân vai trò cho thành viên nhóm.
- **Quản trị viên:** có thể thực hiện cả hai phần khi có quyền.
- **Hệ thống:** kiểm tra định suất và vai trò, lưu thay đổi, ghi lịch sử.

#### 5.2.6.3. Điều kiện trước

- Người dùng đã đăng nhập và có quyền quản lý template hoặc quản lý phân nhóm.
- Template và phiên bản đang ở trạng thái **Draft**, chưa dùng cho dự án.
- Phiên phân nhóm đang mở; nhóm đang ở trạng thái **Draft** hoặc **Active**.
- Nhóm đã được gán Project Template để lấy định suất.

#### 5.2.6.4. Điều kiện sau

- Template lưu số thành viên tối thiểu/tối đa, định suất từng vai trò và việc cho phép kiêm nhiệm.
- Khi phân vai trò hợp lệ, hệ thống lưu vai trò cho từng thành viên và trả **204 No Content**.
- Khi không đạt định suất, hệ thống trả **422**, không lưu thay đổi và liệt kê vai trò còn thiếu/vượt.
- Mọi thay đổi vai trò được ghi lịch sử và thông báo cho nhóm.

#### 5.2.6.5. Kích hoạt

- Cấu hình định suất: mở Project Template → tab **Team constraints**.
- Phân vai trò: mở Team Allocation của lớp → chi tiết nhóm → chọn vai trò và bấm **“Lưu vai trò”**.

#### 5.2.6.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở tab Team constraints của phiên bản template. |
| 2 | Người dùng | Nhập số thành viên tối thiểu/tối đa, định suất PM/BA/DEV/QA và chọn có kiêm nhiệm hay không. |
| 3 | Hệ thống | Kiểm tra dữ liệu ngay trên form; báo lỗi nếu âm, không phải số nguyên hoặc tổng định suất vượt quá số thành viên tối đa. |
| 4 | Hệ thống | Gửi `PUT /api/project-template-versions/{id}/configuration/team-constraints`, trả **200 OK** khi lưu thành công. |
| 5 | Người dùng | Mentor mở chi tiết nhóm và chọn vai trò cho từng thành viên. |
| 6 | Hệ thống | Kiểm tra mỗi thành viên có ít nhất một vai trò và không kiêm nhiệm nếu template không cho phép. |
| 7 | Hệ thống | Gửi `PUT /api/v1/classes/{classId}/allocation-sessions/{sessionId}/teams/{teamId}/roles`. |
| 8 | Hệ thống | So số người từng vai trò với định suất; lưu và trả **204 No Content** nếu đạt. |

#### 5.2.6.7. Luồng thay thế và ngoại lệ

- **422:** định suất/vai trò không hợp lệ, thiếu vai trò bắt buộc, vượt định suất hoặc kiêm nhiệm không được phép. Màn hình hiển thị vai trò cần sửa và giữ lựa chọn.
- **409:** template hoặc nhóm vừa bị người khác thay đổi; cần tải lại.
- **400:** phiên phân nhóm hoặc nhóm không còn cho phép sửa vai trò.
- **403:** thiếu quyền quản lý template/phân nhóm.
- **401/500:** chưa đăng nhập hoặc lỗi hệ thống.

#### 5.2.6.8. Quy tắc nghiệp vụ và ghi chú

1. Số thành viên tối thiểu/tối đa phải là số nguyên dương; tối thiểu không vượt quá tối đa.
2. Định suất mỗi vai trò là số nguyên từ 0 trở lên; tổng định suất tối thiểu không vượt quá số thành viên tối đa.
3. Template cũ không có cấu hình kiêm nhiệm được hiểu là không cho phép kiêm nhiệm.
4. Mỗi thành viên phải có ít nhất một vai trò hợp lệ; nếu không kiêm nhiệm thì chỉ được một vai trò.
5. Hệ thống đếm số người theo từng vai trò và báo thiếu/vượt so với định suất.
6. Công bố nhóm cũng kiểm tra lại định suất; nhóm chưa đạt sẽ không được công bố.

#### 5.2.6.9. Minh chứng kiểm thử Backend trên Swagger

- **API cấu hình:** `PUT /api/project-template-versions/{id}/configuration/team-constraints`
- **Dữ liệu gửi lên:** số thành viên tối thiểu/tối đa, định suất PM/BA/DEV/QA, cho phép kiêm nhiệm.
- **Kết quả mong đợi:** `200 OK`, cấu hình định suất được cập nhật.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.6-1. Kết quả kiểm thử API cấu hình định suất vai trò trên Swagger**

- **API lưu vai trò:** `PUT /api/v1/classes/{classId}/allocation-sessions/{sessionId}/teams/{teamId}/roles`
- **Dữ liệu gửi lên:** phiên bản nhóm hiện tại và vai trò của từng thành viên.
- **Kết quả mong đợi:** `204 No Content` nếu đạt định suất; `422` kèm danh sách vai trò thiếu/vượt nếu không đạt.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.6-2. Kết quả kiểm thử API lưu/kiểm tra vai trò thành viên trên Swagger**

#### 5.2.6.10. Màn hình Frontend

Hai màn hình: form **Team constraints** của template và màn hình phân vai trò trong Team Allocation (kèm nhãn định suất theo vai trò).

Ảnh chụp cần thể hiện: form định suất đã nhập và màn hình phân vai trò với cảnh báo định suất.

**Hình 5.2.6-3. Màn hình cấu hình và kiểm tra định suất vai trò thành viên nhóm**

---

### 5.2.7. UC-US-12 – Kiểm tra điều kiện công bố phiên phân nhóm

> Mã use case: **US-12** — Validate Class Readiness Before Publishing Team Allocation Session
> Phân hệ: Quản lý Mock Project — Team Allocation

#### 5.2.7.1. Mục tiêu

Trước khi công bố phiên phân nhóm, hệ thống kiểm tra toàn bộ lớp đã sẵn sàng: không còn học viên tự do, mọi nhóm có đề bài hợp lệ, đủ sĩ số, có Leader/Mentor và vai trò đáp ứng định suất. Chỉ khi mọi điều kiện đạt mới cho phép công bố.

#### 5.2.7.2. Tác nhân

- **Mentor / người quản lý phân nhóm:** người kiểm tra và công bố.
- **Quản lý chương trình / Quản trị viên:** có thể thực hiện khi có quyền.
- **Hệ thống:** kiểm tra toàn lớp, công bố nhóm và trả danh sách lỗi nếu có.

#### 5.2.7.3. Điều kiện trước

- Người dùng đã đăng nhập và có quyền quản lý lớp.
- Phiên phân nhóm đang mở và thuộc đúng lớp.
- Các nhóm đã được gán Mentor, Leader và Project Template hợp lệ.
- Khi công bố, cần có ít nhất một nhóm **Draft**.

#### 5.2.7.4. Điều kiện sau

- **Kiểm tra:** không thay đổi dữ liệu; trả trạng thái sẵn sàng, học viên tự do và lỗi từng nhóm.
- **Công bố thành công:** các nhóm Draft được công bố, phiên chuyển sang **Published**, trả **200 OK**.
- **Công bố bị chặn:** trả **422** kèm học viên tự do/lỗi nhóm; không dữ liệu nào thay đổi.
- **Lỗi khi công bố:** toàn bộ thao tác được hoàn tác; trả danh sách nhóm chưa công bố được.

#### 5.2.7.5. Kích hoạt

Mentor mở màn hình **Team Allocation** của lớp, chọn phiên và bấm **“Kiểm tra điều kiện công bố”**, sau đó bấm **“Công bố chính thức”** nếu đạt.

#### 5.2.7.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở phiên phân nhóm và bấm kiểm tra điều kiện công bố. |
| 2 | Hệ thống | Gửi `GET /api/v1/classes/{classId}/allocation-sessions/{sessionId}/readiness`. |
| 3 | Hệ thống | Kiểm tra học viên tự do, nhóm, đề bài, sĩ số, Leader/Mentor và vai trò. |
| 4 | Hệ thống | Trả **200 OK** kèm trạng thái `READY` hoặc `BLOCKED`. |
| 5 | Giao diện | Hiển thị kết quả, học viên tự do và lỗi từng nhóm. |
| 6 | Người dùng | Nếu đạt, bấm “Công bố chính thức”. |
| 7 | Hệ thống | Gửi `POST /api/v1/classes/{classId}/allocation-sessions/{sessionId}/publish-session` kèm khóa chống gửi lặp. |
| 8 | Hệ thống | Kiểm tra lại toàn bộ điều kiện; công bố các nhóm Draft và trả **200 OK**. |

#### 5.2.7.7. Luồng thay thế và ngoại lệ

- **422:** còn học viên tự do hoặc nhóm còn lỗi (thiếu đề bài, sai sĩ số, thiếu Leader/Mentor, thiếu vai trò, vượt định suất). Màn hình liệt kê từng lỗi.
- **400:** phiên không mở, không có nhóm Draft hoặc thiếu khóa chống gửi lặp.
- **409:** khóa chống gửi lặp bị dùng lại với nội dung khác.
- **403/404:** thiếu quyền hoặc phiên/lớp không tồn tại.
- **500:** lỗi hệ thống; không nhóm nào được công bố.

#### 5.2.7.8. Quy tắc nghiệp vụ và ghi chú

1. Chỉ công bố khi phiên đang mở, có ít nhất một nhóm và không còn học viên đang hoạt động nào chưa vào nhóm.
2. Mỗi nhóm phải có đề bài còn hiệu lực, sĩ số trong khoảng cho phép, Leader và Mentor hợp lệ.
3. Mọi thành viên phải có vai trò hợp lệ; cấu hình vai trò phải đáp ứng định suất của đề bài.
4. Kết quả kiểm tra chỉ để xem; khi công bố hệ thống kiểm tra lại toàn bộ.
5. Công bố là “tất cả hoặc không”: nếu một nhóm lỗi thì không nhóm nào được ghi nhận.
6. Mỗi lần công bố cần một khóa chống gửi lặp để tránh tạo trùng khi bấm nhiều lần.

#### 5.2.7.9. Minh chứng kiểm thử Backend trên Swagger

- **API kiểm tra:** `GET /api/v1/classes/{classId}/allocation-sessions/{sessionId}/readiness`
- **Kết quả mong đợi:** `200 OK`, trả trạng thái sẵn sàng, học viên tự do và lỗi từng nhóm.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.7-1. Kết quả kiểm thử API kiểm tra điều kiện công bố trên Swagger**

- **API công bố:** `POST /api/v1/classes/{classId}/allocation-sessions/{sessionId}/publish-session`
- **Dữ liệu gửi lên:** không có body; cần khóa chống gửi lặp.
- **Kết quả mong đợi:** `200 OK` khi công bố thành công; `422` kèm lý do nếu lớp chưa đủ điều kiện.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.7-2. Kết quả kiểm thử API công bố chính thức phiên phân nhóm trên Swagger**

#### 5.2.7.10. Màn hình Frontend

Màn hình Team Allocation với nút **“Kiểm tra điều kiện công bố”**; hộp thoại hiển thị trạng thái `READY`/`BLOCKED`, thống kê học viên/nhóm, danh sách học viên tự do và lỗi từng nhóm.

Ảnh chụp cần thể hiện: kết quả kiểm tra bị chặn và trạng thái sẵn sàng kèm nút công bố.

**Hình 5.2.7-3. Màn hình kiểm tra điều kiện công bố phiên phân nhóm**
