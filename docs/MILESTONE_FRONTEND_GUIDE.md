# Milestone Frontend Guide

## Phạm vi hiện tại

Frontend đã tích hợp các API Milestone hiện có:

- Mở form: `GET /api/projects/{projectId}/milestones/create-options`
- Tạo mới: `POST /api/projects/{projectId}/milestones`
- Xem chi tiết: `GET /api/projects/{projectId}/milestones/{milestoneId}`

Backend chưa có API danh sách, cập nhật và xóa milestone nên frontend chưa cung cấp table dữ liệu thật hoặc các action tương ứng.

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

Sau khi đăng nhập, vào trang Teacher và chọn **Tạo milestone**. Có thể mở trực tiếp:

```text
/projects/11111111-1111-1111-1111-111111111111/milestones/new
```

## Luồng sử dụng

1. Form tự lấy project, rubric và reviewer hợp lệ từ `create-options`.
2. Nếu chỉ có một rubric hoặc reviewer, UI tự chọn để giảm thao tác.
3. Nhập tên, deadline và checklist. Nhấn `Enter` tại checklist cuối để thêm nhanh một mục.
4. `NO_LATE` là lựa chọn mặc định. Khi chọn `ALLOW_LATE`, nhập thời hạn nhận bài trễ và mức phạt.
5. Chọn **Tạo milestone**. Thành công sẽ mở trang chi tiết milestone vừa tạo.
6. Nếu kết nối bị gián đoạn, nút **Thử lại an toàn** sử dụng cùng `Idempotency-Key` và cùng payload.

## Validation và lỗi

- Client validation dùng React Hook Form và Zod để phản hồi nhanh.
- Backend vẫn là nguồn quyết định cuối cùng cho deadline, quyền, scope, rubric, reviewer và project status.
- Lỗi backend như `checklist[0].content` được chuyển thành field path của form và focus đúng trường.
- Response lỗi có `correlationId` sẽ hiển thị mã tra cứu và nút sao chép.
- Request lỗi không reset form.
- Hủy form đã thay đổi yêu cầu xác nhận; đóng hoặc reload tab được trình duyệt cảnh báo.

## Idempotency phía client

- Một key được sinh ở lần submit đầu tiên.
- Retry cùng payload giữ nguyên key.
- Khi payload thay đổi, lần submit tiếp theo dùng key mới.
- Sau `201 Created`, attempt được xóa và UI điều hướng tới detail.

## Thay Project mock bằng module thật

Trang tạo đọc `projectId` từ URL, không phụ thuộc trực tiếp vào mock adapter. Khi Project frontend hoàn thành, nút tại Project detail chỉ cần điều hướng:

```ts
navigate(`/projects/${project.id}/milestones/new`);
```

Sau đó có thể gỡ entry tạm trên Teacher landing và biến môi trường `VITE_MILESTONE_MOCK_PROJECT_ID`.

## API cần bổ sung để hoàn thiện workspace

Để triển khai table milestone thật, backend cần ít nhất:

```http
GET /api/projects/{projectId}/milestones?page=0&size=20&sort=deadline,asc
```

Detail response cũng nên bổ sung rubric name/version và reviewer display name. Hiện frontend dùng navigation state để hiển thị tên ngay sau khi tạo; khi reload detail, UI phải fallback về UUID do backend chỉ trả ID.

## Kiểm tra build

```bash
cd frontend
npm run build
```

Build phải hoàn thành cả TypeScript check và Vite production bundle.
