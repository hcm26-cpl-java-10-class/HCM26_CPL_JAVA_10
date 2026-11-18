# Backend - FAMS LMS (Spring Boot 3.3.3 / Java 21)

## Cấu Hình Gemini API Key bằng file `.env`

Để sử dụng các tính năng AI (chấm bài tự luận và phát hiện trùng lặp), bạn cần cấu hình Gemini API Key:

### 1. Lần đầu cấu hình:
1. Mở thư mục `backend/` trong VS Code.
2. Tạo file mới tên `.env` (ngang hàng với `pom.xml` và `.env.example`).
3. Dán nội dung:
   ```env
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY
   ```
4. Lưu file (`Ctrl + S`).
5. Khởi động backend:
   ```bash
   ./mvnw spring-boot:run
   ```

### 2. Những lần sau:
Chỉ cần chạy:
```bash
./mvnw spring-boot:run
# hoặc: mvn spring-boot:run
```
Không cần tạo lại file hay nhập lại key.

### Lưu ý bảo mật:
- File `.env` chứa secret cá nhân và được bỏ qua bởi `.gitignore`. Tuyệt đối không commit hoặc push file `.env` lên Git.
- File mẫu `.env.example` được lưu trên Git để các thành viên khác biết cấu trúc biến môi trường cần thiết.
