# QUY CHUẨN ĐẶC TẢ GIAO DIỆN FAMS (FUTURE ACADEMY MANAGEMENT SYSTEM)

## 1. HỆ THỐNG THƯƠNG HIỆU (BRANDING & STYLING)
- **Primary Color (Màu chính):** Cam FAMS (`#EA580C` / Tailwind: `bg-orange-600`, `hover:bg-orange-700`, `text-orange-600`)
- **Dark Theme / Sidebar:** Slate Đậm (`#0F172A` / Tailwind: `bg-slate-900`)
- **Light Background:** Xám nhạt (`#F8FAFC` / Tailwind: `bg-slate-50`)
- **Border Radius:** `rounded-lg` hoặc `rounded-xl` cho Card/Modal.
- **Font / Input UI:** Border xám nhạt (`border-slate-300`), focus màu cam (`focus:ring-orange-500`).

---

## 2. CHI TIẾT CÁC MÀN HÌNH (SCREENS SPECIFICATION)

### SCR-01: ĐĂNG NHẬP (Route: /login)
- **Layout:** Split-screen 50/50 Desktop (Mobile: 1 cột). Nửa trái nền `#0F172A` chứa Logo & Thương hiệu FAMS, nửa phải chứa Form.
- **Form Fields:** Email công ty (`trainer@fams.edu.vn`), Mật khẩu (kèm icon ẩn/hiện password).
- **Controls:** Checkbox "Ghi nhớ đăng nhập", Link "Quên mật khẩu?" dẫn tới `/forgot-password`.
- **Button:** Nút "Đăng nhập" chính màu cam (`#EA580C`). Không có đăng nhập Google/Đăng ký.

### SCR-02: QUÊN MẬT KHẨU (Route: /forgot-password)
- **Layout:** Card trắng nổi bật căn giữa màn hình (`max-w-md`, `shadow-lg`, `rounded-xl`) trên nền trang `bg-slate-50`.
- **Form:** Input "Email công ty" (placeholder: `trainer@fams.edu.vn`) + Nút submit "Gửi yêu cầu khôi phục" màu cam `#EA580C`.
- **Logic:** Khi gửi thành công, hiển thị thông báo và đếm ngược 60s (Countdown timer) vô hiệu hóa nút gửi.
- **Navigation:** Link "Quay lại Đăng nhập" về `/login`.

### SCR-03: ĐẶT LẠI MẬT KHẨU (Route: /reset-password)
- **Layout:** Card căn giữa màn hình.
- **Form:** 2 ô input "Mật khẩu mới" và "Xác nhận mật khẩu mới" (kèm icon toggle show/hide).
- **Validation:** Bắt buộc tối thiểu 8 ký tự, 2 ô phải trùng khớp. Nút "Xác nhận đổi mật khẩu" màu cam `#EA580C`.

### SCR-04: TỔNG QUAN ĐÀO TẠO (Route: /dashboard)
- **Sidebar**:
  - Logo: Icon vuông màu cam chữ "F" + chữ "FAMS" trắng.
  - Active Menu: Tab "Dashboard" highlight nền cam sặc sỡ (`bg-orange-600`), chữ trắng, bo góc rounded-xl.
  - Footer Sidebar: "FAMS v2.4.0 / Training Operations".
- **Header**:
  - Trái: Ô tìm kiếm rounded-lg `Tìm kiếm học viên, lớp học...`.
  - Phải: Icon Chuông thông báo + User Avatar "TA" + Họ tên "Trần Minh Anh" (Sub: Training Admin).
- **Sub-header**:
  - Breadcrumb: `FAMS / Tổng quan đào tạo`.
  - Tiêu đề chính: `Tổng quan đào tạo`.
  - Nút hành động góc phải: Nút "Tải báo cáo" (nền trắng viền xám) và nút "+ Thêm học viên" (nền cam `#EA580C` chữ trắng).
- **4 Thẻ thống kê (Stat Cards Top)**:
  1. TỔNG HỌC VIÊN: Số `10.245` (Font to đậm), subtext `↑ 8,2% so với tháng trước` (màu xanh).
  2. ĐANG HỌC: Số `2.486`, subtext `24 lớp đang hoạt động` (màu xanh).
  3. BẢO LƯU: Số `120`, subtext `18 sắp hết hạn` (màu đỏ/cam).
  4. TỶ LỆ ĐẠT: Số `82%`, subtext `↑ 3,4%` (màu xanh).
  *(Lưu ý: Label chữ in hoa màu xám, số hiển thị lớn ở giữa, bỏ bớt icon góc phải card).*
- **Khu vực giữa (Biểu đồ)**:
  - Cột trái (2/3 width): Biểu đồ Cột "Học viên theo tháng" (các cột màu cam T3, T4, T5, T6, T7, T8) + Select dropdown "6 tháng gần nhất".
  - Cột phải (1/3 width): Biểu đồ Donut "Tiến độ đào tạo" (vòng tròn 82% màu cam/xanh) + Text "2.039 / 2.486 học viên đúng tiến độ".
- **Khu vực dưới (Công việc cần xử lý)**:
  - Header: "Công việc cần xử lý" + Link góc phải "Xem tất cả →".
  - Danh sách dòng cảnh báo:
    - Badge tròn `18` nền cam nhạt | "Yêu cầu bảo lưu sắp hết hạn - Cần xếp lớp mới hoặc cập nhật trạng thái" | Link "Xử lý →".
    - Badge tròn `7` nền đỏ nhạt | "Yêu cầu bảo lưu quá hạn - Đã vượt ngày kết thúc dự kiến" | Link "Xử lý →".
### SCR-28: DANH SÁCH NGƯỜI DÙNG (Route: /users)
- **Toolbar:** Input tìm kiếm (Search Name/Email), Dropdown lọc Role (Admin, Trainer, Trainee), Dropdown lọc Phòng ban.
- **Table Columns:** Checkbox, Mã NV/HV, Email, Họ và tên, Role (Badge màu), Phòng ban, Trạng thái (Toggle Active/Inactive), Thao tác (Icon Sửa/Xóa).
- **Pagination:** Thanh phân trang ở góc dưới bên phải.

### SCR-29: TẠO / SỬA NGƯỜI DÙNG (Route: /users/create hoặc /users/edit/:id)
- **Layout**: Trang Full-Page nằm trong MainLayout (không dùng Modal popup).
- **Header Page**:
  - Breadcrumb: `FAMS & LMS / System / Tạo / sửa người dùng`.
  - Tiêu đề: `Tạo / sửa người dùng`, Subtitle: `Quản lý dữ liệu và quy trình theo quyền được cấp`.
  - Nút hành động góc phải: Nút "Hủy" (nền trắng viền xám, redirect về `/users`) và Nút "Lưu" (nền cam `#EA580C` chữ trắng).
- **Cấu trúc Grid**: 2 cột (Cột trái 2/3 width chứa Form chính, Cột phải 1/3 width chứa Widget kiểm tra).
- **Cột trái (Main Form Card)**:
  - Tab Bar: `Thông tin chung` (active underline màu cam `#EA580C`), `Phân quyền & nguồn lực`, `Lịch sử`.
  - Các trường Form (Grid 2 cột):
    - Họ và tên * | Username *
    - Email * | Employee code (Mã NV/HV)
    - Roles * (Tag Select: e.g. CLASS ADMIN) | Departments * (Tag Select: e.g. FHN.G2)
    - Trạng thái (Dropdown Select: ACTIVE / INACTIVE) | Kỹ năng (Tag Select: e.g. Java, SQL)
  - Trường Mô tả / ghi chú (Textarea full-width).
- **Cột phải (Widget Kiểm tra dữ liệu)**:
  - Header: "Kiểm tra dữ liệu".
  - Danh sách checklist trạng thái (Icon check màu xanh):
    - ✓ Các trường bắt buộc đã hợp lệ
    - ✓ Không phát hiện mã trùng
    - ✓ Quyền và phạm vi hợp lệ
  - Notice Box (Nền cam nhạt `bg-amber-50 text-amber-800`): "Thay đổi sẽ được ghi vào audit log sau khi lưu."

### SCR-30: MA TRẬN PHÂN QUYỀN (Route: /role-matrix)
- **UI Grid:** Hàng = Danh sách Quyền (USER_CREATE, USER_READ,...), Cột = Vai trò (Admin, Trainer,...).
- **Cells:** Checkbox toggle permission màu cam `#EA580C`.