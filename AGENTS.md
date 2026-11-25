# AGENTS.md – QUY TẮC PHÁT TRIỂN VÀ BẢO VỆ HỆ THỐNG

> **QUY ĐỊNH BẮT BUỘC DÀNH CHO AI**
>
> Trước khi thực hiện bất kỳ yêu cầu phân tích, chỉnh sửa, bổ sung hoặc xóa mã nguồn nào, AI BẮT BUỘC phải đọc và tuân thủ toàn bộ quy định trong tài liệu này.
>
> Mục tiêu quan trọng nhất là bảo vệ hệ thống hiện tại, duy trì tính nhất quán của mã nguồn, không làm mất chức năng đã xây dựng và đảm bảo mọi chức năng mới hoạt động tương thích với các chức năng cũ.

---

# 1. NGUYÊN TẮC CỐT LÕI

AI phải tuân thủ tuyệt đối các nguyên tắc sau:

1. **Không phá vỡ hệ thống hiện tại:** Không tự ý xóa, thay thế, viết lại hoặc làm thay đổi hành vi của các chức năng đã tồn tại.
2. **Hiểu trước khi sửa:** Bắt buộc đọc và phân tích mã nguồn liên quan trước khi thực hiện thay đổi.
3. **Không tự suy đoán:** Không tự tạo ra Entity, API, thuộc tính, quan hệ dữ liệu hoặc nghiệp vụ khi chưa kiểm tra source code.
4. **Tôn trọng kiến trúc:** Không tự ý thay đổi kiến trúc, công nghệ, thư viện hoặc quy ước lập trình hiện tại.
5. **Tái sử dụng mã nguồn:** Ưu tiên sử dụng lại Service, Repository, DTO, Mapper, Component và các chức năng đã có.
6. **Hạn chế phạm vi chỉnh sửa:** Chỉ sửa những file thực sự cần thiết cho yêu cầu.
7. **Bảo toàn dữ liệu:** Không tự ý xóa bảng, cột, dữ liệu hoặc thay đổi cấu trúc cơ sở dữ liệu gây mất dữ liệu.
8. **Đảm bảo tương thích:** Chức năng mới không được làm hỏng các chức năng đang hoạt động.
9. **Kiểm tra sau khi sửa:** Phải kiểm tra build, lỗi biên dịch, API và các luồng nghiệp vụ liên quan.
10. **Không che giấu lỗi:** Nếu không thể kiểm tra hoặc hoàn thành một phần yêu cầu, phải thông báo rõ ràng.

### Thứ tự ưu tiên khi đưa ra quyết định

1. Yêu cầu cụ thể của người dùng.
2. Nghiệp vụ và hành vi hiện tại của hệ thống.
3. Kiến trúc và quy ước đã được sử dụng trong source code.
4. Quy định trong file AGENTS.md.
5. Đề xuất cải tiến của AI.

Không được tự ý thay đổi thiết kế hiện tại chỉ vì AI cho rằng một kiến trúc khác tốt hơn.

---

# 2. THÔNG TIN CÔNG NGHỆ VÀ KIẾN TRÚC

## 2.1. Frontend

Công nghệ sử dụng:

- React
- Vite
- JavaScript hoặc TypeScript theo cấu hình hiện tại.
- Axios để giao tiếp API nếu dự án đang sử dụng.
- React Hooks.
- Các thư viện UI và CSS hiện có.

Không tự ý thay đổi thư viện hoặc chuyển đổi công nghệ khi chưa được cho phép.

## 2.2. Backend

Công nghệ sử dụng:

- Java; tuân thủ phiên bản Java được cấu hình trong dự án.
- Spring Framework; sử dụng Spring Boot nếu dự án hiện tại đang dùng.
- Spring Web/MVC cho API HTTP nếu phù hợp với cấu hình hiện có.
- Spring Data JPA/Hibernate chỉ khi dự án đang sử dụng.
- Cơ sở dữ liệu và công cụ quản lý schema theo cấu hình hiện tại của dự án.
- Spring Security và JWT/RBAC nếu hệ thống hiện tại đang sử dụng.

Không tự ý thay đổi phiên bản Java, Spring, cơ sở dữ liệu, thư viện hoặc công cụ build (Maven/Gradle) khi chưa được cho phép. Trước khi chỉnh sửa, phải xác minh cấu hình thực tế trong `pom.xml`, `build.gradle` hoặc các file cấu hình liên quan.

## 2.3. Kiến trúc Backend

Ưu tiên kiến trúc và cách tổ chức hiện có của dự án. Nếu dự án đang dùng kiến trúc Layered Monolith, tiếp tục duy trì kiến trúc đó; không tự ý chuyển sang Microservices hoặc thay đổi lớn cấu trúc ứng dụng.

Cấu trúc tham khảo, không bắt buộc:

```text
src/
├── main/
│   ├── java/<base-package>/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── repository/
│   │   ├── entity/
│   │   ├── dto/
│   │   ├── mapper/
│   │   ├── config/
│   │   ├── security/
│   │   └── exception/
│   └── resources/
│       └── application.yml
└── test/
    └── java/
---

# 3. QUY TRÌNH BẮT BUỘC TRƯỚC KHI CODE

AI không được bắt đầu viết code ngay khi nhận yêu cầu.

Phải thực hiện lần lượt các bước sau:

## Bước 1: Phân tích yêu cầu

Xác định:

- Người dùng đang muốn bổ sung hay sửa chức năng nào?
- Chức năng đó thuộc module nào?
- Những quyền nào được phép sử dụng?
- Nghiệp vụ hiện tại hoạt động như thế nào?
- Kết quả mong muốn là gì?
- Những chức năng nào có khả năng bị ảnh hưởng?

Nếu yêu cầu chưa rõ, phải hỏi lại thay vì tự đưa ra quyết định có thể làm thay đổi nghiệp vụ.

## Bước 2: Kiểm tra source code hiện tại

Bắt buộc kiểm tra những thành phần liên quan:

**Backend:**

- Entity/domain model và DTO.
- Controller.
- Service.
- Repository/DAO.
- Mapper.
- Cấu hình ứng dụng và kết nối cơ sở dữ liệu.
- Cấu hình quan hệ, ràng buộc và quản lý schema.
- Authentication và Authorization.
- Các API và luồng nghiệp vụ liên quan.
- Cấu hình build, dependency và phiên bản Java/Spring.

**Frontend:**

- Pages.
- Components.
- Routes.
- Hooks.
- API Services.
- State Management.
- Authentication và phân quyền.
- Các giao diện có liên quan.

Không được tạo một chức năng mới khi chưa kiểm tra xem chức năng tương tự đã tồn tại hay chưa.

## Bước 3: Phân tích tác động

Trước khi chỉnh sửa, phải xác định:

- File nào cần sửa?
- File nào cần tạo mới?
- Có ảnh hưởng đến Entity không?
- Có cần thay đổi Database không?
- Có ảnh hưởng đến API hiện tại không?
- Có ảnh hưởng đến các quyền Admin, Teacher, Student không?
- Có ảnh hưởng đến các chức năng khác không?

## Bước 4: Đưa ra kế hoạch

Đối với thay đổi lớn, phải trình bày kế hoạch trước khi code:

1. Nội dung sẽ thực hiện.
2. Những file sẽ chỉnh sửa.
3. Những file sẽ tạo mới.
4. Những thay đổi về Database.
5. Những chức năng có thể bị ảnh hưởng.
6. Cách kiểm tra sau khi hoàn thành.

Không cần lập kế hoạch dài dòng với những thay đổi nhỏ, độc lập và ít rủi ro.

## Bước 5: Thực hiện

- Chỉnh sửa từng phần nhỏ.
- Giữ nguyên cấu trúc hiện tại.
- Tái sử dụng code cũ.
- Không chỉnh sửa những file không liên quan.
- Không xóa logic cũ khi chưa hiểu mục đích của nó.
- Không tạo thêm lớp hoặc abstraction không cần thiết.

## Bước 6: Kiểm tra

Sau khi hoàn thành phải:

- Kiểm tra lỗi biên dịch Backend.
- Kiểm tra lỗi build Frontend.
- Kiểm tra API liên quan.
- Kiểm tra quyền truy cập.
- Kiểm tra nghiệp vụ.
- Kiểm tra các chức năng cũ có liên quan.
- Báo cáo những phần đã kiểm tra và chưa kiểm tra.

---

# 4. QUY TẮC PHÁT TRIỂN BACKEND

## 4.1. Controller

Controller chỉ chịu trách nhiệm:

- Tiếp nhận HTTP Request.
- Kiểm tra dữ liệu đầu vào ở mức phù hợp.
- Gọi Service xử lý nghiệp vụ.
- Trả về HTTP Response với cấu trúc và mã trạng thái phù hợp.

Không đặt nghiệp vụ phức tạp hoặc truy vấn dữ liệu trực tiếp trong Controller nếu hệ thống đã có Service và Repository.

Tuân thủ cách xử lý Exception tập trung hiện có, chẳng hạn cơ chế đã được cấu hình bằng `@ControllerAdvice`. Không tự ý thêm nhiều khối try-catch hoặc làm thay đổi định dạng lỗi API.

## 4.2. Service

Service chịu trách nhiệm:

- Xử lý nghiệp vụ và Business Rules.
- Điều phối Repository và các thành phần liên quan.
- Kiểm tra điều kiện thực hiện chức năng.
- Quản lý transaction theo cách dự án đang sử dụng, chẳng hạn `@Transactional` nếu phù hợp.

Không lặp lại cùng một nghiệp vụ ở nhiều Service nếu có thể tái sử dụng logic hiện có.

## 4.3. Repository

Repository chịu trách nhiệm truy vấn và thao tác dữ liệu.

- Tái sử dụng Repository hiện có.
- Tuân thủ công nghệ truy cập dữ liệu thực tế của dự án, chẳng hạn Spring Data JPA, JDBC hoặc giải pháp khác.
- Nếu dự án dùng Spring Data JPA, ưu tiên phương thức truy vấn và cơ chế phân trang/sắp xếp hiện có.
- Dùng truy vấn chỉ đọc phù hợp với nghiệp vụ; tránh tải dữ liệu không cần thiết.
- Không tự tạo thêm một Repository Pattern khác khi dự án đã có cấu trúc tương ứng.
- Không tự ý chuyển sang xử lý bất đồng bộ hoặc reactive nếu kiến trúc hiện tại không sử dụng.

## 4.4. Entity và mô hình dữ liệu

Khi tạo hoặc sửa Entity/model:

- Tuân thủ quy tắc đặt tên và cách ánh xạ dữ liệu hiện tại.
- Bảo toàn khóa chính, khóa ngoại và quan hệ dữ liệu.
- Kiểm tra kiểu dữ liệu, tính nullable và ràng buộc.
- Tránh tạo thuộc tính hoặc quan hệ trùng lặp.
- Không tự ý đổi tên hoặc xóa trường đang được sử dụng.
- Nếu dự án dùng JPA, kiểm tra kỹ mapping, fetch strategy, cascade và vòng lặp khi serialize.
- Không để Entity persistence trở thành API response nếu dự án đang sử dụng DTO.

## 4.5. DTO

Sử dụng DTO để giao tiếp giữa Backend và Frontend theo kiến trúc hiện tại.

Phân biệt rõ khi phù hợp:

- Create Request DTO.
- Update Request DTO.
- Response DTO.

Không cho phép người dùng tự ý cập nhật các trường hệ thống như:

- Id.
- CreatedAt.
- UpdatedAt.
- CreatedBy.
- UpdatedBy.
- OwnerId.
- Role.
- Permission.

Chỉ cho phép cập nhật các trường này khi nghiệp vụ yêu cầu và đã có kiểm tra quyền phù hợp.

## 4.6. Mapper

- Tái sử dụng Mapper hiện có.
- Nếu dự án đang dùng MapStruct hoặc thư viện mapping khác, tiếp tục sử dụng thư viện đó.
- Không tự ý chuyển thư viện mapping.
- Không viết mapping thủ công trùng lặp nếu có thể tái sử dụng mapper hiện có.
- Đảm bảo các trường hệ thống hoặc trường không được phép cập nhật không bị ghi đè ngoài ý muốn.

# 5. QUY TẮC PHÁT TRIỂN FRONTEND

Trước khi tạo mới một trang hoặc Component, phải kiểm tra:

- Cấu trúc Pages hiện tại.
- Components dùng chung.
- Routing.
- API Services.
- Hooks.
- State Management.
- Cơ chế đăng nhập và phân quyền.

Các quy định:

1. Ưu tiên tái sử dụng Component.
2. Không tạo giao diện trùng lặp.
3. Không viết toàn bộ logic vào một Component quá lớn.
4. Tuân thủ cách tổ chức API Services hiện tại.
5. Tuân thủ quy tắc React Hooks.
6. Không gọi API trực tiếp ở nhiều nơi nếu có thể tái sử dụng API Service.
7. Xử lý đầy đủ trạng thái Loading, Error, Empty và Success.
8. Không hardcode dữ liệu đáng lẽ phải lấy từ Backend.
9. Không chỉ ẩn nút trên giao diện để thay thế việc phân quyền ở Backend.
10. Không tự ý thay đổi giao diện hoặc luồng hoạt động của chức năng cũ.
11. **Quy chuẩn UI/UX Đơn sắc (Monochrome Design System):** Toàn bộ giao diện FAS đã chuyển sang tông **Đen / Trắng / Xám Slate tối giản**. Tuyệt đối không tự ý thêm lại các badge hoặc nút bấm mang màu pastel sặc sỡ (xanh lá `emerald`, đỏ `rose`, vàng/cam `amber`, xanh dương `blue`) ở các màn hình điểm danh, bảng điểm, form modal, thẻ thống kê. Tất cả trạng thái điểm danh và badge phải sử dụng chuẩn màu trung tính (`bg-slate-900 text-white` hoặc dark mode `dark:bg-slate-100 dark:text-slate-900`). Các Modal form phức tạp phải đảm bảo responsive (`max-w-6xl`), có header và footer cố định (sticky).

Khi chỉnh sửa một trang hiện tại, phải bảo toàn các chức năng đang có trừ khi người dùng yêu cầu loại bỏ.

---

# 6. QUY TẮC DATABASE VÀ QUẢN LÝ SCHEMA

Database là thành phần quan trọng; mọi thay đổi phải được kiểm tra cẩn thận.

Trước khi thay đổi dữ liệu hoặc schema, phải kiểm tra:

1. Entity/model hiện tại.
2. Repository và các truy vấn liên quan.
3. Cấu hình kết nối cơ sở dữ liệu.
4. Công cụ quản lý schema/migration đang được dự án sử dụng, chẳng hạn Flyway, Liquibase hoặc SQL scripts.
5. Quan hệ giữa các bảng.
6. Dữ liệu hiện có.
7. Những chức năng đang phụ thuộc vào cấu trúc đó.

## 6.1. Quy tắc Migration và schema

- Không xóa hoặc sửa migration đã được áp dụng ở môi trường dùng chung.
- Không tự ý tạo lại Database.
- Không chạy thao tác Drop Database hoặc xóa bảng/cột đang được sử dụng.
- Không reset dữ liệu để giải quyết lỗi migration.
- Không tự ý thay đổi cấu hình kết nối hoặc thông tin môi trường.
- Không áp dụng migration lên môi trường chưa được xác nhận.
- Ưu tiên thay đổi bổ sung và tương thích ngược.

## 6.2. Quy trình thay đổi schema

1. Kiểm tra nghiệp vụ và thiết kế dữ liệu hiện tại.
2. Xác định Entity/model và quan hệ cần thay đổi.
3. Kiểm tra Repository, truy vấn và chức năng phụ thuộc.
4. Tạo migration hoặc cập nhật schema theo đúng công cụ hiện có.
5. Đọc và kiểm tra nội dung migration trước khi áp dụng.
6. Chỉ cập nhật Database khi đã xác nhận đúng môi trường và tác động.

---
# 7. QUY TẮC AUTHENTICATION VÀ AUTHORIZATION

Hệ thống sử dụng JWT và RBAC.

Các vai trò hiện có:

- Admin.
- Teacher.
- Student.

AI phải kiểm tra cơ chế phân quyền thực tế trước khi triển khai chức năng.

Quy định bắt buộc:

- Không tự ý đổi tên Role.
- Không tự ý tạo thêm Role.
- Không bỏ các thuộc tính `[Authorize]` hiện có.
- Không bỏ kiểm tra quyền trong Service.
- Không cho phép Student truy cập dữ liệu của Student khác.
- Không tin tưởng UserId, StudentId hoặc TeacherId do Frontend gửi lên nếu có thể lấy từ Claims.
- Không để người dùng tự thay đổi Role hoặc quyền của chính mình.
- Kiểm tra quyền ở Backend, không chỉ kiểm tra trên Frontend.

Mọi chức năng liên quan đến dữ liệu cá nhân phải xác định rõ quyền sở hữu dữ liệu.

---

# 8. QUY TẮC API VÀ TÍNH TƯƠNG THÍCH

Khi tạo hoặc sửa API:

- **Tiền tố Route API chuẩn:** Dự án quy ước bắt buộc dùng `/api/...` (Ví dụ: `/api/attendances`, `/api/classes`, `/api/interview-topics`). **TUYỆT ĐỐI KHÔNG** sử dụng hoặc tự sinh route `/api/v1/...`.
- Tuân thủ cách đặt tên Route hiện tại.
- Giữ nguyên HTTP Method phù hợp.
- Không tự ý đổi cấu trúc Response.
- Không tự ý đổi tên thuộc tính JSON.
- Không xóa Endpoint cũ khi chưa kiểm tra nơi sử dụng.
- Không thay đổi mã HTTP Status không có lý do.
- Không tạo nhiều API trùng mục đích.
- Kiểm tra Frontend đang gọi API nào trước khi thay đổi.

Nếu bắt buộc phải thay đổi API hiện tại, phải nêu rõ:

1. API cũ.
2. API mới.
3. Lý do thay đổi.
4. Các thành phần bị ảnh hưởng.
5. Cách đảm bảo Frontend và Backend tương thích.

---

# 9. QUY TẮC BẢO MẬT

- Không để lộ JWT Secret.
- Không đưa mật khẩu hoặc thông tin nhạy cảm vào source code.
- Không trả về mật khẩu hoặc thông tin xác thực trong API Response.
- Không lưu mật khẩu dạng văn bản thuần.
- Không thực thi SQL tùy ý từ dữ liệu người dùng.
- Sử dụng tham số hóa truy vấn.
- Kiểm tra dữ liệu đầu vào.
- Bảo vệ các API yêu cầu đăng nhập.
- Không chạy mã nguồn do người dùng gửi trực tiếp trên máy chủ Backend nếu không có môi trường Sandbox an toàn.

---

# 10. QUY TẮC BẢO TOÀN CHỨC NĂNG CŨ

Đây là một trong những nguyên tắc quan trọng nhất.

Khi bổ sung chức năng mới, AI phải bảo đảm:

- Không làm mất chức năng cũ.
- Không làm thay đổi luồng nghiệp vụ cũ ngoài phạm vi yêu cầu.
- Không làm hỏng quan hệ dữ liệu.
- Không làm hỏng các API đang hoạt động.
- Không làm thay đổi quyền truy cập hiện có.
- Không xóa các Component đang được sử dụng.
- Không tạo ra hai cách xử lý khác nhau cho cùng một nghiệp vụ nếu không có lý do.

Nếu một thay đổi có nguy cơ ảnh hưởng đến chức năng khác, phải thông báo trước và đề xuất phương án ít rủi ro hơn.

**Không được tự ý hy sinh chức năng cũ để hoàn thành chức năng mới.**

---

# 11. QUY TẮC XỬ LÝ LỖI

Khi gặp lỗi:

1. Đọc thông báo lỗi đầy đủ.
2. Xác định nguyên nhân gốc.
3. Kiểm tra những đoạn code liên quan.
4. Xác định lỗi nằm ở Frontend, Backend, Database hay cấu hình.
5. Đưa ra phương án sửa phù hợp.
6. Kiểm tra các chức năng liên quan sau khi sửa.

Không được:

- Sửa lỗi bằng cách xóa logic đang hoạt động.
- Tắt Validation để tránh lỗi.
- Bỏ Authentication hoặc Authorization.
- Xóa dữ liệu để làm cho lỗi biến mất.
- Thêm try-catch để che giấu Exception.
- Sửa nhiều file không liên quan khi chưa xác định nguyên nhân.

Ưu tiên sửa nguyên nhân gốc thay vì xử lý triệu chứng.

---

# 12. QUY TẮC QUẢN LÝ NGỮ CẢNH VÀ KIẾN THỨC DỰ ÁN

AI phải xem source code hiện tại là nguồn thông tin chính xác nhất về hệ thống.

Không được mặc định rằng những gì AI đã ghi nhớ từ các lần làm việc trước vẫn còn đúng.

Trước mỗi nhiệm vụ:

1. Đọc file AGENTS.md.
2. Kiểm tra cấu trúc source code hiện tại.
3. Kiểm tra những file liên quan đến yêu cầu.
4. Đối chiếu với các quyết định và quy tắc đã có.
5. Chỉ sử dụng thông tin đã được xác minh.

Không tự ý thay đổi các quyết định kiến trúc hoặc nghiệp vụ đã được thống nhất.

Nếu phát hiện source code thực tế khác với tài liệu, phải ưu tiên kiểm tra và báo cáo sự khác biệt, không tự động sửa source code để làm cho nó giống tài liệu.

Đối với những quyết định quan trọng, nên cập nhật tài liệu dự án để những lần làm việc tiếp theo không mất ngữ cảnh.

## 12.1. Quy tắc tổ chức tài liệu Markdown (`docs/`)

Khi tạo mới hoặc cập nhật tài liệu `.md`, **bắt buộc** tuân thủ cấu trúc thư mục tại `docs/README.md`:

1. **Không đặt file `.md` trực tiếp ở gốc `docs/`** (ngoại trừ `docs/README.md`).
2. **Không tạo file `.md` mới ở gốc repository** (chỉ giữ lại các file chuẩn như `README.md`, `AGENTS.md`, `CLAUDE.md`).
3. **Đặt đúng thư mục chủ đề đã đánh số (`docs/01-`..`09-`):**

| Thư mục | Nội dung lưu trữ |
|---|---|
| `docs/01-getting-started/` | Cài đặt môi trường, hướng dẫn chạy dự án, quy ước Git/Commit |
| `docs/02-architecture/` | Kiến trúc hệ thống, class diagram, ERD |
| `docs/03-exam-assessment/` | Module Exam, Question, Grading, Auth/Exam security, hướng dẫn kiểm thử Exam |
| `docs/04-course-learning/` | Course, Syllabus, Progress, Analytics, Recommendations |
| `docs/05-project-workspace/` | Mock Project Hub (`plans/` cho kế hoạch triển khai, `use-cases/` cho đặc tả, `fixtures/`, `images/`) |
| `docs/06-testing-verification/` | Báo cáo fix bug, điều tra sự cố, test plan, evidence, nghiệm thu |
| `docs/07-demo/` | Kịch bản demo, walkthrough, dữ liệu/quickstart demo |
| `docs/08-training-operations/` | Quản lý đào tạo: Class, Class Setup, Training Calendar, Trainer, Session |
| `docs/09-deployment-operations/` | Triển khai, cutover, rollback, safe startup, hạ tầng (SMTP, DB scripts) |

4. **Không tự tạo thư mục cấp 1 ngoài chuẩn `01-`..`09-`.** Nếu thực sự phát sinh phân hệ mới chưa thuộc danh mục nào ở trên, phải đặt tên theo mẫu `NN-kebab-case` (ví dụ `10-ten-phan-he/`) và cập nhật bảng mục lục trong `docs/README.md`.
5. **Đặt tên & liên kết:** Không dùng khoảng trắng trong tên file `.md`; dùng đường dẫn tương đối cho link nội bộ; lưu ảnh minh họa trong thư mục `images/` gần tài liệu (tuyệt đối không nhúng đường dẫn ổ đĩa cá nhân như `C:/...`, `D:/...`).

---

# 13. QUY TẮC GIT VÀ AN TOÀN MÃ NGUỒN

Trước khi chỉnh sửa:

- Kiểm tra trạng thái Git nếu có thể.
- Xác định những file người dùng đã chỉnh sửa.
- Không ghi đè các thay đổi chưa được commit.
- Không tự ý checkout, reset, revert hoặc xóa nhánh.
- Không tự ý commit hoặc push nếu chưa được yêu cầu.

Không được xóa hoặc ghi đè những thay đổi của người dùng chỉ vì chúng gây khó khăn cho quá trình triển khai.

Nếu phát hiện thay đổi chưa được lưu hoặc có nguy cơ bị mất, phải thông báo trước.

---

# 14. CHECKLIST BẮT BUỘC TRƯỚC KHI HOÀN THÀNH

Trước khi báo hoàn thành, AI phải tự kiểm tra:

## Backend

- [ ] Backend build thành công theo công cụ hiện có (Maven/Gradle).
- [ ] Không có lỗi biên dịch mới.
- [ ] Controller đúng trách nhiệm.
- [ ] Service xử lý đúng nghiệp vụ.
- [ ] Repository và truy vấn dữ liệu phù hợp.
- [ ] DTO và Mapper đúng cấu trúc.
- [ ] Entity và quan hệ dữ liệu chính xác.
- [ ] Migration/schema đã được kiểm tra nếu có thay đổi.
- [ ] Không làm mất hoặc thay đổi API cũ ngoài phạm vi yêu cầu.
- [ ] Authentication và Authorization vẫn hoạt động.
- [ ] Các test liên quan đã được chạy hoặc nêu rõ nếu chưa chạy.

## Frontend

- [ ] Không có lỗi build mới.
- [ ] Routing hoạt động đúng.
- [ ] API được gọi đúng.
- [ ] Loading và Error được xử lý.
- [ ] Giao diện không làm mất chức năng cũ.
- [ ] Phân quyền giao diện đúng.

## Database

- [ ] Migration được kiểm tra.
- [ ] Không có thao tác xóa dữ liệu ngoài yêu cầu.
- [ ] Quan hệ khóa ngoại chính xác.
- [ ] Không ảnh hưởng dữ liệu hiện có.

## Nghiệp vụ

- [ ] Đáp ứng đúng yêu cầu.
- [ ] Đúng quyền sử dụng.
- [ ] Không vi phạm nghiệp vụ hiện tại.
- [ ] Các chức năng liên quan vẫn hoạt động.

Nếu chưa kiểm tra được một mục, phải ghi rõ lý do. Không được đánh dấu hoàn thành khi chưa xác minh.

---

# 15. ĐỊNH DẠNG BÁO CÁO SAU KHI CODE

Sau mỗi nhiệm vụ, AI phải báo cáo theo cấu trúc:

## 1. Kết quả thực hiện

Mô tả ngắn gọn chức năng đã hoàn thành.

## 2. Danh sách file thay đổi

| File          | Hành động | Mục đích                |
| ------------- | --------- | ----------------------- |
| Example.cs    | Modified  | Bổ sung xử lý nghiệp vụ |
| ExampleDto.cs | Created   | Tạo DTO mới             |

## 3. Thay đổi Database

- Có hoặc không.
- Migration nào được tạo.
- Những bảng và quan hệ bị ảnh hưởng.

## 4. Kiểm tra

- Backend Build.
- Frontend Build.
- API.
- Authentication/Authorization.
- Nghiệp vụ liên quan.

Nêu rõ kết quả thực tế, không được khẳng định đã kiểm tra nếu chưa thực hiện.

## 5. Những vấn đề còn tồn tại

Liệt kê lỗi, giới hạn hoặc những phần chưa hoàn thành.

---

# 16. QUY ĐỊNH CUỐI CÙNG

AI phải luôn ghi nhớ:

**HIỂU HỆ THỐNG TRƯỚC KHI CODE – GIỮ NGUYÊN NHỮNG GÌ ĐANG HOẠT ĐỘNG – CHỈ SỬA NHỮNG GÌ ĐƯỢC YÊU CẦU – KIỂM TRA TRƯỚC KHI HOÀN THÀNH.**

Không được đánh đổi sự ổn định của toàn hệ thống để đổi lấy tốc độ hoàn thành một chức năng.

Khi không chắc chắn về nghiệp vụ, kiến trúc hoặc tác động của thay đổi, hãy dừng lại và hỏi người dùng thay vì tự ý quyết định.
