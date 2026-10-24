# Milestone Frontend Guide

## Phạm vi hiện tại

Frontend đã tích hợp các API Milestone hiện có:

- Xem danh sách: `GET /api/projects/{projectId}/milestones?page=0&size=20` cùng search/filter server-side
- Mở form: `GET /api/projects/{projectId}/milestones/create-options`
- Tạo mới: `POST /api/projects/{projectId}/milestones`
- Xem chi tiết: `GET /api/projects/{projectId}/milestones/{milestoneId}`

Danh sách dùng phân trang server-side và thứ tự cố định `deadline ASC`, sau đó `id ASC`. Backend chưa có API cập nhật và xóa milestone nên frontend không hiển thị các action này.

## Chạy ứng dụng

Chạy backend trước, sau đó từ thư mục `frontend`:

```bash
npm install
npm run dev
```

API URL mặc định là `http://localhost:8080/api`. Có thể cấu hình bằng:

```env
VITE_API_URL=http://localhost:8080/api
VITE_MILESTONE_MOCK_PROJECT_ID=11111111-1111-1111-1111-111111111111
```

Đăng nhập bằng Mentor mock:

```text
email: teacher@example.com
password: password123
```

Sau khi đăng nhập, vào trang Teacher và chọn **Manage milestones**. Có thể mở trực tiếp:

```text
/projects/11111111-1111-1111-1111-111111111111/milestones
```

Trang tạo trực tiếp:

```text
/projects/11111111-1111-1111-1111-111111111111/milestones/new
```

Backend mock mặc định seed 7 milestone cho project này, cùng 3 rubric và 3 reviewer. Vì có nhiều lựa chọn, form tạo milestone yêu cầu Mentor chủ động chọn rubric và reviewer. Để kiểm tra empty state, chạy backend với `MILESTONE_MOCK_SEED_ENABLED=false`.

## Luồng sử dụng

1. Teacher landing mở trang danh sách milestone của project mock.
2. Danh sách hiển thị table trên desktop và card trên mobile. Click toàn bộ row/card để mở chi tiết.
3. `page` và `size` được giữ trong URL, vì vậy quay lại từ trang chi tiết vẫn đúng vị trí trước đó.
4. Chọn **Create milestone** để mở form. Nút chỉ xuất hiện khi có `MILESTONE_CREATE` và bị vô hiệu hóa khi project không còn active.
5. Form tự lấy project, rubric và reviewer hợp lệ từ `create-options`.
6. Nếu chỉ có một rubric hoặc reviewer, UI tự chọn để giảm thao tác.
7. Nhập tên, deadline và checklist. Nhấn `Enter` tại checklist cuối để thêm nhanh một mục.
8. `NO_LATE` là lựa chọn mặc định. Khi chọn `ALLOW_LATE`, nhập thời hạn nhận bài trễ và mức phạt.
9. Chọn **Create milestone**. Thành công sẽ mở trang chi tiết milestone vừa tạo.
10. Nếu kết nối bị gián đoạn, nút **Retry safely** sử dụng cùng `Idempotency-Key` và cùng payload.

## Màn hình chi tiết

- Trang detail luôn tải lại bằng `projectId` và `milestoneId` trong URL; navigation state chỉ giữ URL quay lại danh sách. Vì vậy reload hoặc mở link trực tiếp vẫn có đủ dữ liệu.
- Header hiển thị status, mandatory, tên và mô tả. Nội dung chính hiển thị checklist theo đúng `orderIndex` và rubric snapshot gồm tên, version, từng criterion, weight và maximum score.
- Sidebar hiển thị Project, reviewer và late policy. `NO_LATE` và `ALLOW_LATE` có nội dung riêng để tránh hiểu nhầm.
- Deadline, thời hạn nộp trễ và thời điểm tạo được chuyển từ UTC instant sang `tenantTimeZone` do backend trả về; chuỗi hiển thị có cả offset như `GMT+7`.
- `403` giải thích quyền/assignment không còn hợp lệ; `404` giải thích milestone không thuộc Project hoặc không tồn tại. Chỉ lỗi network/system mới có nút **Try again**.
- Backend chưa có API update nên detail không render nút Edit. Khi bổ sung update, UI chỉ được hiện thao tác sau khi backend trả capability/quyền update; gọi trực tiếp vẫn phải được backend kiểm tra lại.

## Danh sách và phân trang

- Page mặc định `0`, size mặc định `20`.
- Các size hỗ trợ trên UI: `10`, `20`, `30`, `50`, `100`.
- Đổi size tự quay về page `0`.
- Search theo title/description được debounce 300 ms và thực hiện server-side trên toàn bộ dữ liệu của project.
- Filter hỗ trợ status, mandatory/optional, late policy và khoảng deadline theo ngày.
- Search/filter/page/size được giữ trong URL; reload, chia sẻ URL hoặc quay lại từ detail không làm mất trạng thái.
- Thay đổi search/filter tự quay về page `0`; đổi page/size giữ nguyên search/filter.
- Frontend không cung cấp sort client-side vì backend giữ thứ tự deadline cố định. Điều này tránh hiển thị kết quả gây hiểu nhầm trên một page riêng lẻ.
- Khi chuyển page, dữ liệu hiện tại được giữ lại với trạng thái mờ và chỉ báo loading nhỏ để tránh layout nhấp nháy.
- Nếu page trong URL vượt quá tổng số page, UI tự điều hướng về page cuối hợp lệ.
- API list không tải checklist. Checklist được lấy khi mở detail.

### Trạng thái danh sách

- Loading: skeleton theo đúng cấu trúc header và rows.
- Empty: chỉ hiển thị sau response `200` có `totalElements = 0`.
- Empty khi có query hiển thị **No matching milestones** và cho phép xóa toàn bộ search/filter.
- Error: hiển thị riêng `403`, `404`, network/system error và correlation ID nếu có.
- Network/system error có nút **Try again**.
- `403/404` không bị hiển thị thành “No milestones yet”.
- Project chưa có milestone và Mentor có quyền tạo sẽ hiển thị **Create the first milestone**.

## Validation và lỗi

- Client validation dùng React Hook Form và Zod để phản hồi nhanh.
- Backend vẫn là nguồn quyết định cuối cùng cho deadline, quyền, scope, rubric, reviewer và project status.
- Lỗi backend như `checklist[0].content` được chuyển thành field path của form và focus đúng trường.
- Response lỗi có `correlationId` sẽ hiển thị mã tra cứu và nút sao chép.
- Error parser lấy HTTP status và `X-Correlation-ID` từ response header nếu body bảo mật không có các field này.
- Request lỗi không reset form.
- Hủy form đã thay đổi yêu cầu xác nhận; đóng hoặc reload tab được trình duyệt cảnh báo.

## Idempotency phía client

- Một key được sinh ở lần submit đầu tiên.
- Retry cùng payload giữ nguyên key.
- Khi payload thay đổi, lần submit tiếp theo dùng key mới.
- Sau `201 Created`, attempt được xóa và UI điều hướng tới detail.

## Thay Project mock bằng module thật

Các trang list/create/detail đều đọc `projectId` từ URL, không phụ thuộc trực tiếp vào mock adapter. Khi Project frontend hoàn thành, nút tại Project detail chỉ cần điều hướng:

```ts
navigate(`/projects/${project.id}/milestones`);
```

Sau đó có thể gỡ entry tạm trên Teacher landing và biến môi trường `VITE_MILESTONE_MOCK_PROJECT_ID`.

## Dữ liệu cần thay bằng integration thật

Detail hiện đã nhận rubric name/version/criteria, reviewer display name và tenant timezone qua API. Các giá trị này đang do backend mock adapter cung cấp; khi module Project, Rubric, User và Tenant Settings hoàn tất, thay adapter backend nhưng giữ nguyên response contract để frontend không cần đổi luồng.

## Kiểm tra build

```bash
cd frontend
npm run build
```

Build phải hoàn thành cả TypeScript check và Vite production bundle.
