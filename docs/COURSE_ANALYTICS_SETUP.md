# Hướng dẫn cài đặt & chạy dự án (dành cho thành viên mới)

Tài liệu này áp dụng cho **mọi máy**, không phụ thuộc vào máy của tác giả.
Sau khi làm theo, hệ thống sẽ chạy với **database H2 tự sinh** và **đầy đủ dữ liệu demo**
(bao gồm toàn bộ dữ liệu cho trang **Course Analytics**).

---

## 0. Yêu cầu phần mềm

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| JDK | **21** | `java -version` phải ra 21.x |
| Node.js | **20 trở lên** (khuyến nghị 22 LTS) | kèm npm |
| Git | bất kỳ | để clone/pull |
| Maven | **không cần cài** | dự án đã có `mvnw` / `mvnw.cmd` tự tải Maven |

> Maven Wrapper (`mvnw.cmd`) sẽ tự động tải Maven 3.9.9 ở lần chạy đầu tiên.
> Chỉ cần có **JDK 21** là đủ.

---

## 1. Lấy code

```bash
git clone https://github.com/hcm26-cpl-java-10-class/HCM26_CPL_JAVA_10.git
cd HCM26_CPL_JAVA_10

# nếu làm việc trên nhánh Course Analytics:
git checkout course-analytics
git pull
```

Sau khi `git pull`, các file sau **phải có** trong máy bạn:

```
backend/src/main/java/com/example/starter_project_2025/init/CourseAnalyticsDataInitializer.java
backend/src/main/java/com/example/starter_project_2025/system/demo/analytics/
frontend/src/pages/management/demo/analytics/
frontend/src/api/features/demo/course-analytics.api.ts
```

---

## 2. Chạy Backend

```bash
cd backend
./mvnw spring-boot:run          # macOS / Linux
mvnw.cmd spring-boot:run        # Windows
```

Lần chạy đầu tiên sẽ mất vài phút (tải dependency). Khi log in ra
`Started StarterProject2025Application` là thành công.

Backend mặc định chạy ở <http://localhost:8080>.

### 2.1. Không cần tạo database thủ công

* Database là **H2 file mode**, đường dẫn `./data/fams_lms_after_merge` (tương đối so với thư mục `backend/`).
* Lần chạy đầu tiên, H2 tự tạo file `.mv.db` và Hibernate tự tạo bảng (`ddl-auto=update`).
* Toàn bộ dữ liệu mẫu được **seed tự động** bởi các `CommandLineRunner`:
  users/vai trò, khóa học + giáo trình, 50 học viên, và dữ liệu **Course Analytics**
  (enrollment, lesson progress, certificate, review, exam attempt).

  Bạn sẽ thấy trong log:
  ```
  c.e.s.i.CourseAnalyticsDataInitializer - Seeded course analytics demo data: course=Java Fundamentals, learners=50, lessons=10.
  ```

### 2.2. (Tùy chọn) Cấu hình Gemini API cho tính năng AI

Chỉ cần khi bạn muốn test chấm bài tự luận bằng AI / phát hiện đạo văn:

```bash
cp .env.example .env      # macOS/Linux
copy .env.example .env    # Windows
```

Sửa `backend/.env`:
```env
GEMINI_API_KEY=YOUR_KEY_CUA_BAN
```

Lấy key miễn phí tại <https://aistudio.google.com/>.
File `.env` đã được `.gitignore` nên mỗi người tự giữ key riêng, không ai push key lên Git.

> **Không có key vẫn chạy bình thường**, chỉ mất các chức năng gọi AI.

---

## 3. Chạy Frontend

Mở terminal **thứ hai**:

```bash
cd frontend
npm install        # chỉ cần làm lần đầu
npm run dev
```

Frontend mặc định chạy ở <http://localhost:5173>.

> Không cần tạo file `.env` cho frontend: `src/api/axios.ts` đã có fallback
> `http://localhost:8080/api`. Nếu bạn đổi cổng backend, hãy copy `frontend/.env.example`
> thành `frontend/.env` và sửa `VITE_API_URL`.

---

## 4. Đăng nhập & kiểm tra tính năng

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@example.com` | `password123` |
| Giảng viên | `teacher@example.com` | `password123` |
| Học viên | `student01@example.com` … `student50@example.com` | `Student123!` |

Đăng nhập bằng **giảng viên** (`teacher@example.com`), vào menu **Analytics → Course Analytics**
(URL: `/course-analytics`), chọn khóa học **Java Fundamentals** và kiểm tra 5 tab:

1. **Phễu học tập** – tỉ lệ hoàn thành từng bài + bài tụt nhiều nhất.
2. **Xu hướng** – đăng ký / bài hoàn thành / chứng chỉ theo ngày–tuần–tháng.
3. **Hoạt động** – Active / Inactive / chưa bắt đầu + danh sách nguy cơ bỏ học.
4. **Đánh giá** – điểm TB, phân bố 1–5 sao + bảng xếp hạng giữa các khóa học.
5. **Bài thi** – điểm TB, tỉ lệ đạt, phân bố điểm theo từng bài thi.

---

## 5. Kiểm tra nhanh API (không cần mở giao diện)

```bash
# lấy token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@example.com","password":"password123"}'

# gọi API analytics (thay <TOKEN> và <COURSE_ID>)
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:8080/api/reports/courses/<COURSE_ID>/lesson-funnel
```

Các endpoint:

| Endpoint | Mô tả |
|---|---|
| `GET /api/reports/courses/{id}/lesson-funnel` | Phễu học tập |
| `GET /api/reports/courses/{id}/trend?from=&to=&granularity=` | Xu hướng |
| `GET /api/reports/courses/{id}/activity?inactiveDays=&limit=` | Hoạt động / nguy cơ bỏ học |
| `GET /api/reports/courses/{id}/review-analytics` | Đánh giá 1 khóa học |
| `GET /api/reports/course-ratings` | Xếp hạng rating các khóa học |
| `GET /api/reports/courses/{id}/exam-analytics` | Kết quả bài thi |

---

## 6. Xử lý sự cố thường gặp

### `The file is locked: .../data/fams_lms_after_merge.mv.db`
H2 không cho phép 2 tiến trình mở cùng 1 file DB.
→ **Chỉ chạy 1 backend tại một thời điểm.** Đóng instance cũ (IntelliJ / terminal / `taskkill /F /IM java.exe`)
rồi chạy lại. Nếu muốn chạy 2 backend cùng lúc, đặt `DB_URL` khác nhau cho mỗi instance.

### `Failed to delete .../target/be-run.log` khi chạy `mvn clean`
Log file đang bị process backend giữ. → Tắt backend rồi `mvn clean`.

### Port 8080 / 5173 đã bị chiếm
```bash
# Windows
netstat -ano | findstr :8080
taskkill /F /PID <PID>

# macOS/Linux
lsof -i :8080
kill -9 <PID>
```
Hoặc đổi cổng: `SERVER_PORT=8081 ./mvnw spring-boot:run` và sửa `VITE_API_URL` bên frontend.

### Không đăng nhập được
Xác nhận backend đã lên `http://localhost:8080` và **không** có hai backend cùng chạy
(trường hợp thường gặp: vừa mở IntelliJ vừa chạy `mvnw`).
Xem log backend, sẽ có dòng `Ensured seed users and role assignments.` nếu seed thành công.

### Muốn tạo lại database từ đầu
```bash
cd backend
rm -rf data                       # macOS/Linux
# hoặc rmdir /s /q data          # Windows
./mvnw spring-boot:run            # seed lại từ đầu
```

### Tắt dữ liệu demo (không muốn seed)
```bash
APP_SEED_COURSE_ANALYTICS_ENABLED=false ./mvnw spring-boot:run
```

---

## 7. Quy tắc cho người mới cập nhật code

1. **Không commit file `.env`** (đã được `.gitignore` ở cả root và `backend/`).
2. **Không commit thư mục `backend/data/`** hay file `*.mv.db` — mỗi máy có DB riêng, seed tự tạo lại.
3. **Không hardcode đường dẫn tuyệt đối** (ví dụ `C:\Users\...\...`) trong code.
4. Cấu hình mặc định phải chạy được **không cần `.env`**:
   `application.properties` dùng cú pháp `${ENV_VAR:default}`.
5. Thêm dependency frontend → chạy `npm install` và **commit luôn `package-lock.json`**.
