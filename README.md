# FAMS LMS - Hệ Thống Quản Lý Đào Tạo & Khảo Thí Trực Tuyến

Dự án nhóm: **HCM26_CPL_JAVA_10**

---

## HƯỚNG DẪN CẤU HÌNH GEMINI API KEY BẰNG FILE .ENV (DÀNH CHO THÀNH VIÊN)

Hệ thống AI trong dự án (bao gồm **AI Chấm bài tự luận theo tiêu chí** và **AI Phát hiện bài thi trùng lặp/đạo văn**) sử dụng Google Gemini API.

Mỗi thành viên trong nhóm chỉ cần cấu hình một lần duy nhất trên máy cá nhân bằng file `.env` theo hướng dẫn dưới đây.

### 1. Lần đầu cấu hình

1. Clone project từ GitHub:
   ```bash
   git clone <URL_REPOSITORY>
   cd HCM26_CPL_JAVA_10
   ```
2. Mở project bằng **Visual Studio Code**:
   ```bash
   code .
   ```
3. Trong cây thư mục VS Code bên trái, mở thư mục `backend`.
4. Tạo một file mới tên là `.env` (nằm ngang hàng với `pom.xml` và `.env.example`).
5. Paste nội dung sau vào file `backend/.env`:
   ```env
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY
   ```
   *(Thay `YOUR_GEMINI_API_KEY` bằng API key cá nhân lấy miễn phí từ [Google AI Studio](https://aistudio.google.com/)).*
6. Lưu file (`Ctrl + S`).
7. Chạy backend:
   ```bash
   cd backend
   ./mvnw spring-boot:run
   ```

### 2. Những lần chạy sau

Chỉ cần chạy lệnh:
```bash
cd backend
./mvnw spring-boot:run
# hoặc: mvn spring-boot:run
```
Hệ thống sẽ **tự động đọc API key** từ file `backend/.env` khi khởi động. Không cần tạo lại file, không cần sử dụng lệnh `set` hay `setx`, và không cần nhập lại key.

---

## NGUYÊN TẮC BẢO MẬT

- **Không commit file `.env`**: File `backend/.env` đã được cấu hình trong `.gitignore` ở cả cấp độ repository và thư mục backend. Git sẽ tự động bỏ qua file này để tránh rò rỉ secret lên GitHub.
- **Không đưa API key vào Frontend**: Frontend React/Vite tuyệt đối không chứa API key. Mọi tương tác AI đều được bảo mật qua REST API của backend.
- **Thứ tự ưu tiên cấu hình**: 
  1. Biến môi trường hệ thống OS / CI-CD (`System.getenv`).
  2. File `backend/.env` (hoặc `.env`).
  3. Giá trị mặc định trong `application.properties`.
- **An toàn log**: Hệ thống không bao giờ in hay ghi giá trị API key ra console/log.
