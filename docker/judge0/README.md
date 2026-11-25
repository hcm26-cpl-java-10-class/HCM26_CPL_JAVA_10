# Judge0 cho bài thi lập trình

1. Cài Docker Desktop, bật rồi chạy: `docker compose up -d` trong thư mục này.
2. Đợi khoảng 1 phút rồi kiểm tra: mở `http://localhost:2358/languages` bằng trình duyệt hoặc
   `curl -H "X-Auth-Token: change-me-judge0-token" http://localhost:2358/languages`
3. Đặt token trong `judge0.conf` (AUTHN_TOKEN) và trong `backend/src/main/resources/application.properties`:

```
code.judge.url=http://localhost:2358
code.judge.token=change-me-judge0-token
```

(Nếu không đặt gì, backend dùng `http://localhost:2358` và không gửi token. Khi đó phải xóa 2 dòng AUTHN trong `judge0.conf`.)

## Lưu ý
- Backend gọi ngôn ngữ **Java (id 62, OpenJDK 13)**; đổi bằng `code.judge.language-id`.
- Cổng 2358 chỉ mở trên `127.0.0.1`. Không mở ra ngoài mạng.
- Judge0 1.13.1 cần cgroup v1. Nếu Docker Desktop (WSL2) báo lỗi `isolate`/`cgroup` khi chạy bài,
  tạo file `C:\Users\<tên bạn>\.wslconfig` với nội dung:
  ```
  [wsl2]
  kernelCommandLine = systemd.unified_cgroup_hierarchy=0
  ```
  rồi chạy `wsl --shutdown` và mở lại Docker Desktop.
- Nếu Judge0 không chạy lúc nộp, bài vẫn được lưu nhưng ở trạng thái PENDING_REVIEW, chưa có điểm (hiện chưa có màn hình chấm lại câu code — cần bật Judge0 trước giờ thi).
