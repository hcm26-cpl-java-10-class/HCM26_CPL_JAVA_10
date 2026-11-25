/**
 * English -> Vietnamese phrase dictionary used by the whole-system language switch.
 *
 * One entry per line: `English | Vietnamese`. Matching is exact on the trimmed text of a
 * text node / placeholder / title / aria-label (case-insensitive; ALL-CAPS stays ALL-CAPS).
 * To translate a new string, just add a line here — no component changes needed.
 *
 * Strings that mix static text and variables should use `t()` from react-i18next
 * (see `locales`), because the DOM only sees the pieces separately.
 */
const EN_VI = `
# ---- Brand / product names (must not be machine-translated) ----
RBAC System | RBAC System
RBAC System v1.0 | RBAC System v1.0
FAMS LMS | FAMS LMS

# ---- Sidebar groups & menus (come from the backend @ResourceMenu) ----
Dashboard | Bảng điều khiển
Dashboard Stats | Thống kê tổng quan
Analytics | Phân tích
Course Analytics | Phân tích khóa học
Student Analytics | Phân tích học viên
Course Usage | Mức sử dụng khóa học
Course Management | Quản lý khóa học
Course Online | Khóa học trực tuyến
Assessment Management | Quản lý đánh giá
Book Management | Quản lý sách
Project Management | Quản lý dự án
RBAC Management | Quản lý phân quyền
Score Management | Quản lý điểm
Syllabus Management | Quản lý giáo trình
System Management | Quản lý hệ thống
Training Management | Quản lý đào tạo
Student | Học viên
Students | Học viên
Courses | Khóa học
Enrollments | Đăng ký học
Enrollment Logs | Nhật ký đăng ký
Lesson Reports | Báo cáo bài học
Categories | Danh mục
Certificates | Chứng chỉ
Assessments | Bài đánh giá
Books | Sách
Class | Lớp học
Classes | Lớp học
Class List | Danh sách lớp
Curriculum | Chương trình học
Department | Phòng ban
Departments | Phòng ban
Invitations | Lời mời
Module Groups | Nhóm module
Modules | Module
My Appeals | Phúc khảo của tôi
My Exams | Bài thi của tôi
My Scores | Điểm của tôi
Permissions | Quyền hạn
Questions | Câu hỏi
Roles | Vai trò
Score Appeals | Phúc khảo điểm
Student Scores | Điểm học viên
Sprints | Sprint
Sprint Backlogs | Backlog sprint
Syllabus Templates | Mẫu giáo trình
Syllabuses | Giáo trình
Topic Mark Gradebook | Sổ điểm theo chủ đề
Topics & Syllabus | Chủ đề & Giáo trình
Topics | Chủ đề
Training Calendar | Lịch đào tạo
Training Programs | Chương trình đào tạo
Trainers | Giảng viên
Trainer | Giảng viên
Unanswered Questions | Câu hỏi chưa trả lời
Users | Người dùng
Weekly Timetable | Thời khóa biểu tuần
Workspace | Không gian làm việc
Alerts | Cảnh báo
Project Dashboard | Bảng điều khiển dự án
Project Templates | Mẫu dự án
Audit | Kiểm toán
Trainee | Học viên thực tập
Log Work | Ghi nhận công việc
Reports | Báo cáo
Menus | Menu
Menu | Menu
Home | Trang chủ
Breadcrumb | Đường dẫn
Logout | Đăng xuất
Log out | Đăng xuất
Sign out | Đăng xuất
Profile | Hồ sơ
Settings | Cài đặt
Notifications | Thông báo
Notification | Thông báo
Mark all as read | Đánh dấu tất cả đã đọc
Mark all read | Đánh dấu tất cả đã đọc
No notifications | Không có thông báo
Toggle Sidebar | Bật/tắt thanh bên
Change theme | Đổi giao diện
More navigation | Thêm điều hướng
Online Learning Platform | Nền tảng học trực tuyến

# ---- Generic actions ----
Cancel | Hủy
Save | Lưu
Save Changes | Lưu thay đổi
Saving | Đang lưu
Saving... | Đang lưu...
Saved | Đã lưu
Unsaved changes | Thay đổi chưa lưu
Submit | Nộp
Submitted | Đã nộp
Confirm | Xác nhận
Close | Đóng
Close dialog | Đóng hộp thoại
Edit | Sửa
Delete | Xóa
Deleting... | Đang xóa...
Remove | Gỡ bỏ
Create | Tạo
Add | Thêm
Update | Cập nhật
Reset | Đặt lại
Clear | Xóa
Clear all | Xóa tất cả
Clear filters | Xóa bộ lọc
Clear search | Xóa tìm kiếm
Clear search and filters | Xóa tìm kiếm và bộ lọc
Clear selection | Bỏ chọn
Search | Tìm kiếm
Filters | Bộ lọc
Filter by status | Lọc theo trạng thái
Sort by | Sắp xếp theo
Refresh | Làm mới
Reload | Tải lại
Retry | Thử lại
Try again | Thử lại
Try Again | Thử lại
Back | Quay lại
Go Back | Quay lại
Go to Home | Về trang chủ
Back to Login | Quay lại đăng nhập
Next | Tiếp
Previous | Trước
Next page | Trang sau
Previous page | Trang trước
Rows per page | Số dòng mỗi trang
Showing | Hiển thị
View | Xem
View details | Xem chi tiết
View detail | Xem chi tiết
Detail | Chi tiết
Details | Chi tiết
Preview | Xem trước
Duplicate | Nhân bản
Download | Tải xuống
Download Template | Tải mẫu
Upload | Tải lên
Import | Nhập
Import CSV | Nhập CSV
Importing... | Đang nhập...
Export | Xuất
Export CSV | Xuất CSV
Export Excel | Xuất Excel
Export File | Xuất tệp
Exporting... | Đang xuất...
Select | Chọn
Select All | Chọn tất cả
Select a class | Chọn lớp
Copy | Sao chép
Dismiss | Bỏ qua
Apply | Áp dụng
Continue | Tiếp tục
Finish | Hoàn tất
Start | Bắt đầu
Open | Mở
Done | Xong
Remind | Nhắc nhở
Move up | Di chuyển lên
Move down | Di chuyển xuống
Manage | Quản lý
Assign | Phân công
Approve | Duyệt
Reject | Từ chối
Review | Xem xét
History | Lịch sử
Overview | Tổng quan
Release notes | Ghi chú phát hành

# ---- Status / state ----
Status | Trạng thái
All statuses | Tất cả trạng thái
All Statuses | Tất cả trạng thái
All Status | Tất cả trạng thái
Active | Đang hoạt động
Inactive | Ngưng hoạt động
Draft | Bản nháp
Published | Đã xuất bản
Completed | Hoàn thành
In progress | Đang thực hiện
In Progress | Đang thực hiện
Pending | Đang chờ
Failed | Thất bại
Passed | Đạt
Not passed | Chưa đạt
Success | Thành công
Error | Lỗi
Warning | Cảnh báo
Locked | Đã khóa
Late | Trễ hạn
On time | Đúng hạn
Valid | Hợp lệ
Invalid | Không hợp lệ
Yes | Có
No | Không
Option | Lựa chọn
Options | Lựa chọn
No deadline | Không có hạn chót
Invalid deadline | Hạn chót không hợp lệ
Late window | Trong thời gian trễ hạn
overdue | trễ hạn
Due soon | Sắp đến hạn
per day | mỗi ngày
tenant timezone unavailable | không xác định được múi giờ
Planning | Lên kế hoạch
Cancelled | Đã hủy
Not set | Chưa thiết lập
Invalid date | Ngày không hợp lệ
word | từ
words | từ
characters | ký tự
Unable to load the report. Please try again. | Không thể tải báo cáo. Hãy thử lại.
Your session has expired. Please sign in again. | Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.
You do not have permission to view data in this scope. | Bạn không có quyền xem dữ liệu trong phạm vi này.
Unable to load the report. Please check your connection and try again. | Không thể tải báo cáo. Hãy kiểm tra kết nối và thử lại.
Online | Trực tuyến
Offline | Ngoại tuyến
Dropped | Đã bỏ học
Dropped out | Đã bỏ học
Drop-off | Tỷ lệ rời bỏ
Closed | Đã đóng
Required | Bắt buộc
Mandatory | Bắt buộc
Optional | Tùy chọn
Not provided | Chưa cung cấp
Not selected | Chưa chọn
Not linked | Chưa liên kết
Not submitted | Chưa nộp
Unassigned | Chưa gán
Manual | Thủ công
Correct | Đúng
Wrong | Sai
Answered | Đã trả lời
Flagged | Bị gắn cờ
Expected | Dự kiến
Critical | Nghiêm trọng
High | Cao
Medium | Trung bình
Low | Thấp
Easy | Dễ
Hard | Khó

# ---- Loading / empty states ----
Loading... | Đang tải...
Loading | Đang tải
Processing... | Đang xử lý...
No data | Không có dữ liệu
No data available | Không có dữ liệu
No results | Không có kết quả
No results found | Không tìm thấy kết quả
No results found. | Không tìm thấy kết quả.
Something went wrong | Đã xảy ra lỗi
Something went wrong. | Đã xảy ra lỗi.
Page not found | Không tìm thấy trang
Unauthorized | Không có quyền truy cập
Access denied | Truy cập bị từ chối
Code copied! | Đã sao chép mã!
Copy Access Code | Sao chép mã truy cập

# ---- Table / form fields ----
Name | Tên
Full Name | Họ và tên
Code | Mã
Email | Email
Email Address | Địa chỉ email
Personal Email | Email cá nhân
Password | Mật khẩu
Confirm Password | Xác nhận mật khẩu
Remember me | Ghi nhớ đăng nhập
Forgot password? | Quên mật khẩu?
Description | Mô tả
Description (optional) | Mô tả (tùy chọn)
Type | Loại
Action | Thao tác
Actions | Thao tác
No. | STT
Date | Ngày
Time | Thời gian
Title | Tiêu đề
Content | Nội dung
Note | Ghi chú
Notes | Ghi chú
Reason | Lý do
Result | Kết quả
Score | Điểm
Max score | Điểm tối đa
Max Score | Điểm tối đa
Maximum score | Điểm tối đa
Highest Score | Điểm cao nhất
Passing Score | Điểm đạt
Weight | Trọng số
Weight (%) | Trọng số (%)
Total weight | Tổng trọng số
Total | Tổng
Total Attempts | Tổng số lượt làm
Attempt | Lượt làm
Attempts | Lượt làm
Rank | Xếp hạng
Level | Mức độ
Difficulty | Độ khó
Priority | Độ ưu tiên
Duration | Thời lượng
Deadline | Hạn chót
Due date | Hạn nộp
Created | Ngày tạo
Created At | Ngày tạo
Updated At | Ngày cập nhật
Submitted At | Thời gian nộp
From | Từ
To | Đến
All | Tất cả
All courses | Tất cả khóa học
All Types | Tất cả loại
All categories | Tất cả danh mục
All departments | Tất cả phòng ban
All levels | Tất cả cấp độ
Version | Phiên bản
Region | Khu vực
Gender | Giới tính
DOB | Ngày sinh
Student ID | Mã học viên
Progress | Tiến độ
Completion | Hoàn thành
Completion rate | Tỷ lệ hoàn thành
Completion Progress | Tiến độ hoàn thành
Course progress | Tiến độ khóa học
Lessons completed | Bài học đã hoàn thành
Total learners | Tổng số học viên
Total study time | Tổng thời gian học
Learner | Người học
Learners | Người học
Instructor | Giảng viên
Leader | Trưởng nhóm
Members | Thành viên
Team | Nhóm
Cohort | Khóa
Course | Khóa học
Course name | Tên khóa học
Lesson | Bài học
Lessons | Bài học
Section | Phần
Sections | Các phần
Topic | Chủ đề
Topic Name | Tên chủ đề
Topic Code | Mã chủ đề
Topic ID | Mã chủ đề
Technical Group | Nhóm kỹ thuật
Syllabus | Giáo trình
Syllabus Name | Tên giáo trình
Milestone | Cột mốc
Milestones | Cột mốc
Project | Dự án
Sprint | Sprint
Task | Nhiệm vụ
Assignee | Người thực hiện
Repository | Kho mã nguồn
Repository URL | URL kho mã nguồn
Deployment | Triển khai
Deployment URL | URL triển khai
Artifacts | Sản phẩm bàn giao
Criteria | Tiêu chí
Resource type | Loại tài nguyên
Room | Phòng
Location | Địa điểm
Locations | Địa điểm
Location Management | Quản lý địa điểm
Rubric | Tiêu chí đánh giá
Rubrics | Tiêu chí đánh giá
Project Team Allocation | Phân bổ nhóm dự án
Backlog sprint | Backlog sprint
Sprint Backlogs | Backlog sprint
Module | Module
Modules | Module
Question | Câu hỏi
Question Type | Loại câu hỏi
Multiple Choice | Trắc nghiệm
Essay | Tự luận
Coding | Lập trình
Answer | Câu trả lời
Solution | Lời giải
Input | Đầu vào
Format | Định dạng
Template | Mẫu
Activity | Hoạt động
Certificate of Completion | Chứng nhận hoàn thành
Issued on | Ngày cấp
Certificate Verification | Xác minh chứng chỉ
Learning Objectives | Mục tiêu học tập
General Information | Thông tin chung
Delivery Type | Hình thức giảng dạy
Assessment Category | Nhóm đánh giá
Assessment overview | Tổng quan đánh giá
Overall feedback | Nhận xét chung
Version history | Lịch sử phiên bản
Alert history | Lịch sử cảnh báo
Activity Trail | Dấu vết hoạt động
Reminders | Nhắc nhở
Schedule Reminder | Lên lịch nhắc nhở
Recipient | Người nhận
Search... | Tìm kiếm...
Select... | Chọn...
https://... | https://...

# ---- Create / Add / Edit phrases ----
Create Sprint | Tạo sprint
Create Exam | Tạo bài thi
Create milestone | Tạo cột mốc
Add Section | Thêm phần
Add Topic | Thêm chủ đề
Add resource | Thêm tài nguyên
Add to selected questions | Thêm vào câu hỏi đã chọn
Edit Topic | Sửa chủ đề
Delete Topic | Xóa chủ đề
Delete sprint | Xóa sprint
Clone Version | Nhân bản phiên bản
Use template | Dùng mẫu
Link Existing Course | Liên kết khóa học có sẵn
Manage rubrics | Quản lý rubric
Mark as completed | Đánh dấu hoàn thành
Reschedule | Lên lịch lại
Cancel session | Hủy buổi học
Submit artifact | Nộp sản phẩm
My submissions | Bài nộp của tôi
Late submissions | Bài nộp trễ
No late submissions | Không có bài nộp trễ
Review status | Trạng thái xét duyệt
Evaluation rubric | Rubric đánh giá
Back to Class List | Quay lại danh sách lớp
Back to Training Program List | Quay lại danh sách chương trình đào tạo
Back to milestone | Quay lại cột mốc
Back to workspace | Quay lại không gian làm việc
Back to Assessment Management | Quay lại quản lý đánh giá
Continue learning | Tiếp tục học
Already enrolled | Đã đăng ký
Select Export Format | Chọn định dạng xuất
Choose the format for your exported data | Chọn định dạng cho dữ liệu xuất
Step 1: Download sample format template | Bước 1: Tải tệp mẫu định dạng
Step 2: Choose your file to upload | Bước 2: Chọn tệp để tải lên
Import Validation Failed | Kiểm tra dữ liệu nhập thất bại
Error Details | Chi tiết lỗi
Changes not submitted | Thay đổi chưa được nộp

# ---- Auth ----
Login | Đăng nhập
Log in | Đăng nhập
Sign in | Đăng nhập
Sign In | Đăng nhập
Sign up | Đăng ký
Register | Đăng ký
Welcome back | Chào mừng trở lại
Back to login | Quay lại đăng nhập
Reset password | Đặt lại mật khẩu
Forgot Password | Quên mật khẩu
Send reset link | Gửi liên kết đặt lại
Continue with Google | Tiếp tục với Google
Sign in with Google | Đăng nhập bằng Google
Remember Me | Ghi nhớ đăng nhập
Google sign-in failed. Please try again. | Đăng nhập Google thất bại. Vui lòng thử lại.
Light | Sáng
Dark | Tối
System | Hệ thống
Bright interface | Giao diện sáng
Low-light friendly | Dịu mắt khi thiếu sáng
Match your device | Theo thiết bị
Change language | Đổi ngôn ngữ
Backlogs | Backlog
Cannot reach the server | Không thể kết nối máy chủ
Coming soon | Sắp ra mắt
Could not load notifications. | Không thể tải thông báo.
Curriculum Mapping | Ánh xạ chương trình học
Exam Supervisor | Giám thị
For you | Dành cho bạn
Loading navigation... | Đang tải điều hướng...
Loading notifications... | Đang tải thông báo...
Master training system unavailable | Hệ thống đào tạo chính không khả dụng
My Submissions | Bài nộp của tôi
Navigation could not be loaded. | Không thể tải điều hướng.
No navigation items are available for this role. | Không có mục điều hướng nào cho vai trò này.
No notifications yet. | Chưa có thông báo.
Not available | Không khả dụng
Open navigation menu | Mở menu điều hướng
Page Not Found | Không tìm thấy trang
Register now | Đăng ký ngay
Reset here | Đặt lại tại đây
Server error | Lỗi máy chủ
Session expired | Phiên đăng nhập đã hết hạn
Student navigation | Điều hướng học viên
Toggle navigation sidebar | Bật/tắt thanh điều hướng
Waiting for: | Đang chờ:
Welcome back! | Chào mừng trở lại!
Forgot Password? | Quên mật khẩu?
Don't have an account? | Chưa có tài khoản?
Already have an account? | Đã có tài khoản?
{{role}} View | Chế độ xem {{role}}
Language | Ngôn ngữ
Unable to complete sign-in. Please try again. | Không thể hoàn tất đăng nhập. Vui lòng thử lại.
Quick Actions | Thao tác nhanh
Menu Items | Mục menu
Navigation items | Mục điều hướng
Your Permissions | Quyền của bạn
Learning Funnel | Phễu học tập
Export All (Excel) | Xuất tất cả (Excel)
Change course | Đổi khóa học
Open Workspace | Mở không gian làm việc
Total Users | Tổng người dùng
Total Roles | Tổng vai trò
Total Menus | Tổng menu
Total Courses | Tổng khóa học
Total Classes | Tổng lớp học
Total Exams | Tổng bài thi
Total Projects | Tổng dự án
Total Questions | Tổng câu hỏi
Total Scores | Tổng điểm
Total Notifications | Tổng thông báo
Total Certificates | Tổng chứng chỉ
Total Categories | Tổng danh mục
Total Enrollments | Tổng đăng ký học
Total Instructors | Tổng giảng viên
Total Departments | Tổng phòng ban
Total Locations | Tổng địa điểm
Total Workspaces | Tổng không gian làm việc
Total Sprints | Tổng sprint
Total Milestones | Tổng cột mốc
Total Tasks | Tổng nhiệm vụ
Total Trainers | Tổng huấn luyện viên
Active Users | Người dùng đang hoạt động
Inactive Users | Người dùng ngừng hoạt động
Active Roles | Vai trò đang hoạt động
Active Menus | Menu đang hoạt động
Active Courses | Khóa học đang hoạt động
Agree | Đồng ý
Filter | Lọc
Export file | Xuất file
Import file | Nhập file
Not found | Không tìm thấy
More | Thêm
Less | Ít hơn
Page | Trang
Category | Danh mục
Created at | Thời điểm tạo
Updated at | Thời điểm cập nhật
Summary | Tổng quan
Full URL | URL đầy đủ
Attachments | Tệp đính kèm
Reviewer feedback | Nhận xét của người đánh giá
Accepted | Đã chấp nhận
Rejected | Đã từ chối
Changes requested | Yêu cầu chỉnh sửa
Last updated | Cập nhật lần cuối
Updated | Đã cập nhật
Any | Bất kỳ
None | Không có
Yes or no | Có hoặc không
Unknown | Không xác định
Are you sure? | Bạn có chắc không?
This action cannot be undone. | Hành động này không thể hoàn tác.
Separate release notes and attachment metadata are not available for this version. | Không có ghi chú phát hành hoặc thông tin tệp đính kèm riêng cho phiên bản này.
Attachment information is not available for this version. | Thông tin tệp đính kèm không khả dụng cho phiên bản này.
No files attached to this artifact version. | Không có tệp nào được đính kèm cho phiên bản này.
Source code and deployment | Mã nguồn và triển khai
Submission link | Liên kết bài nộp
Open link | Mở liên kết
Kanban Board | Bảng điều khiển dự án
Project Template Versions | Phiên bản mẫu dự án
Instructors | Giảng viên
Explore Projects | Khám phá dự án
Student Home | Trang chủ học viên
Trainees | Học viên
`.trim();

/**
 * Vietnamese strings that already exist in the source code -> English.
 * (Reverse direction; the reverse of every EN_VI line is added automatically.)
 */
const VI_EN_EXTRA = `# ---- Brand / product names ----
Hệ thống RBAC | RBAC System
Trang chủ học viên | Student Home
Trang chủ | Home
Mở rộng trợ lý AI | Expand AI assistant
Lưu | Save
Lưu thay đổi | Save changes
Đang lưu... | Saving...
Đang lưu | Saving
Đang xử lý... | Processing...
Đang xử lý | Processing
Đang tải... | Loading...
Đang tải | Loading
Đang gửi... | Sending...
Hủy | Cancel
Hủy bỏ | Cancel
Đóng | Close
Xóa | Delete
Sửa | Edit
Chỉnh sửa | Edit
Thêm | Add
Thêm mới | Add new
Tạo | Create
Tạo mới | Create new
Tìm kiếm | Search
Làm mới | Refresh
Thử lại | Try again
Quay lại | Back
Tiếp tục | Continue
Xem | View
Xem chi tiết | View details
Chi tiết | Details
Thao tác | Actions
Áp dụng | Apply
Xác nhận | Confirm
Đồng ý | Agree
Chọn | Select
Tất cả | All
Bộ lọc | Filters
Lọc | Filter
Xóa bộ lọc | Clear filters
Xóa tìm kiếm | Clear search
Nhập | Import
Xuất | Export
Xuất file | Export file
Tải xuống | Download
Tải lên | Upload
Gửi | Submit
Nộp bài | Submit
Vào thi | Start exam
Bắt đầu | Start
Kết thúc | End
Hoàn thành | Complete
Từ chối | Reject
Phê duyệt | Approve
Duyệt | Approve
Kích hoạt | Activate
Vô hiệu hóa | Deactivate
Mở rộng | Expand
Thu gọn | Collapse
Chọn file | Select file
Chọn file Excel | Select Excel file
Tải lên file | Upload file
Tiến hành Import | Proceed with import
Làm lại | Redo
Sao chép | Copy
Đổi mật khẩu | Change password
Đăng xuất | Sign Out
Đăng nhập | Sign In
Đăng ký | Register
Quên mật khẩu | Forgot Password
Quên mật khẩu? | Forgot Password?
Nhớ mật khẩu | Remember password
Gửi lại | Resend
Gửi lại mã | Resend code
Họ và tên | Full Name
Họ tên | Full Name
Tên | Name
Họ | Last Name
Email | Email
Số điện thoại | Phone Number
Mật khẩu | Password
Xác nhận mật khẩu | Confirm Password
Mật khẩu mới | New Password
Mật khẩu hiện tại | Current Password
Mã | Code
Mã số | Code
Mã nhân viên | Staff Code
Mã học viên | Student Code
Mô tả | Description
Trạng thái | Status
Vai trò | Role
Quyền | Permissions
Quyền hạn | Permissions
Phòng ban | Department
Lớp | Class
Lớp học | Class
Danh sách lớp | Class List
Khóa học | Course
Danh sách khóa học | Course List
Chương trình học | Curriculum
Chương trình đào tạo | Training Program
Giảng viên | Trainer
Học viên | Student
Người phụ trách | Person in charge
Mentor phụ trách | Mentor in charge
Chưa gán Mentor | No mentor assigned
Chưa phân công | Unassigned
Chưa gán | Unassigned
Thành viên | Members
Danh sách thành viên | Member list
Độ ưu tiên | Priority
Lý do | Reason
Thời gian | Time
Ngày bắt đầu | Start date
Ngày kết thúc | End date
Thời gian bắt đầu | Start time
Thời gian kết thúc | End time
Phòng | Room
Phòng học | Room
Địa điểm | Location
Ghi chú | Notes
Số lượng | Quantity
Số lượng: | Quantity:
Mức độ | Level
Mức độ: | Level:
Độ khó | Difficulty
Chủ đề | Topic
Chủ đề (Topic) | Topic
Bài thi | Exam
Điểm | Score
Điểm số | Score
Điểm thi | Exam Score
Trọng số | Weight
Đạt | Passed
Không đạt | Failed
Rớt | Failed
Đã hoàn thành | Completed
Đã hủy | Cancelled
Đang hoạt động | Active
Ngừng hoạt động | Inactive
Bắt buộc | Required
Không bắt buộc | Optional
Thông tin | Information
Thông báo | Notifications
Cảnh báo | Warning
Thành công | Success
Lỗi | Error
Cài đặt | Settings
Tài khoản | Account
Hồ sơ | Profile
Hồ sơ cá nhân | Personal Profile
Bảng điều khiển | Dashboard
Báo cáo | Reports
Lịch sử | History
Nhật ký | Logs
Cấu hình | Configuration
Phiên bản | Version
Tiêu đề | Title
Nội dung | Content
Loại | Type
Hình thức | Format
Chuyên cần | Attendance
Điểm danh | Attendance
Có mặt | Present
Vắng mặt | Absent
Đi trễ | Late
Có phép | Excused
Thứ Hai | Monday
Thứ Ba | Tuesday
Thứ Tư | Wednesday
Thứ Năm | Thursday
Thứ Sáu | Friday
Thứ Bảy | Saturday
Chủ nhật | Sunday
Chủ Nhật | Sunday
Hôm nay | Today
Tuần này | This week
Tháng này | This month
Trang | Page
Trước | Previous
Sau | Next
Tổng cộng | Total
Hiển thị | Showing
Không có dữ liệu | No data
Không có dữ liệu. | No data.
Chưa có dữ liệu | No data yet
Chưa có dữ liệu. | No data yet.
Không tìm thấy kết quả | No results found
Không tìm thấy kết quả nào | No results found
Không có thông báo nào | No notifications
Lưu thành công | Saved successfully
Tạo thành công | Created successfully
Cập nhật thành công | Updated successfully
Xóa thành công | Deleted successfully
Thao tác thành công | Action completed successfully
Đã xảy ra lỗi | An error occurred
Vui lòng thử lại | Please try again
Vui lòng điền đầy đủ thông tin | Please fill in all required fields
Bạn có chắc chắn muốn xóa? | Are you sure you want to delete?
Hành động này không thể hoàn tác | This action cannot be undone
Bạn có chắc chắn? | Are you sure?
Lập trình Java căn bản & OOP | Java Fundamentals & OOP
Lập trình Web Backend với Spring Boot | Web Backend with Spring Boot
Cơ sở dữ liệu & Thiết kế CSDL SQL | Database & SQL Design
Lập trình Giao diện Web với ReactJS | Web Frontend with ReactJS
DevOps & CI/CD căn bản | DevOps & CI/CD Fundamentals
Kiểm thử phần mềm & Đảm bảo chất lượng QA | Software Testing & QA
Quản lý phân quyền | RBAC Management
Quản lý đánh giá | Assessment Management
Quản lý đào tạo | Training Management
Quản lý giáo trình | Syllabus Management
Quản lý dự án | Project Management
Quản lý điểm | Score Management
Khóa học trực tuyến | Online Course
Thống kê tổng quan | Dashboard Stats
Phân tích khóa học | Course Analytics
Phân tích học viên | Student Analytics
Mức sử dụng khóa học | Course Usage
Bài thi của tôi | My Exams
Điểm của tôi | My Scores
Lớp của tôi | My Classes
Khóa học của tôi | My Courses
Phúc khảo của tôi | My Appeals
Ngân hàng câu hỏi | Question Bank
Danh mục câu hỏi | Question Categories
Đề thi | Exam Paper
Xem đề thi | View Exam Paper
Nộp bài thi | Submit Exam
Phiên làm bài | Test Session
Thời gian còn lại | Time Remaining
Câu hỏi | Question
Câu tiếp theo | Next Question
Câu trước | Previous Question
Danh sách câu hỏi | Question List
Đã trả lời | Answered
Chưa trả lời | Unanswered
Đánh dấu | Flag
Bỏ đánh dấu | Unflag
Đã đánh dấu | Flagged
Xem lại bài làm | Review Submission
Kết quả bài thi | Exam Results
Điểm số đạt được | Score Achieved
Tổng điểm | Total Score
Thời gian làm bài | Test Duration
Bắt đầu làm bài | Start Test
Xác nhận nộp bài | Confirm Submission
Bạn có chắc chắn muốn nộp bài? | Are you sure you want to submit?
Tiếng Việt | Vietnamese
Tiếng Anh | English
Tiếng Nhật | Japanese
Đúng | Correct
Sai | Incorrect
Thao tác nhanh | Quick Actions
Mục menu | Menu Items
Mục điều hướng | Navigation items
Quyền của bạn | Your Permissions
Phễu học tập | Learning Funnel
Xuất tất cả (Excel) | Export All (Excel)
Đổi khóa học | Change course
Mở không gian làm việc | Open Workspace
Tổng người dùng | Total Users
Tổng vai trò | Total Roles
Tổng menu | Total Menus
Tổng khóa học | Total Courses
Tổng lớp học | Total Classes
Tổng bài thi | Total Exams
Tổng dự án | Total Projects
Tổng câu hỏi | Total Questions
Tổng thông báo | Total Notifications
Tổng chứng chỉ | Total Certificates
Tổng danh mục | Total Categories
Tổng đăng ký học | Total Enrollments
Tổng giảng viên | Total Instructors
Tổng phòng ban | Total Departments
Tổng địa điểm | Total Locations
Tổng không gian làm việc | Total Workspaces
Tổng sprint | Total Sprints
Tổng cột mốc | Total Milestones
Tổng nhiệm vụ | Total Tasks
Tổng lượt thi | Total Attempts
Tổng huấn luyện viên | Total Trainers
Người dùng đang hoạt động | Active Users
Người dùng ngừng hoạt động | Inactive Users
Vai trò đang hoạt động | Active Roles
Menu đang hoạt động | Active Menus
Khóa học đang hoạt động | Active Courses
Nhập file | Import file
Không tìm thấy | Not found
Ít hơn | Less
Danh mục | Category
Thời điểm tạo | Created at
Thời điểm cập nhật | Updated at
Tổng quan | Summary
URL đầy đủ | Full URL
Tệp đính kèm | Attachments
Nhận xét của người đánh giá | Reviewer feedback
Đã chấp nhận | Accepted
Đã từ chối | Rejected
Yêu cầu chỉnh sửa | Changes requested
Cập nhật lần cuối | Last updated
Đã cập nhật | Updated
Bất kỳ | Any
Không có | None
Có hoặc không | Yes or no
Không xác định | Unknown
Bạn có chắc không? | Are you sure?
Hành động này không thể hoàn tác. | This action cannot be undone.
Chưa cung cấp | Not provided
Mã nguồn và triển khai | Source code and deployment
Kho lưu trữ mã | Repository
Môi trường triển khai | Deployment
Liên kết bài nộp | Submission link
Mở liên kết | Open link
Nhận xét tổng thế | Overall feedback
Đã nộp | Submitted
Bảng điều khiển dự án | Kanban Board
Phiên bản mẫu dự án | Project Template Versions
Khám phá dự án | Explore Projects
Danh sách backlog | Backlogs
Bài nộp của tôi | My Submissions
Dành cho bạn | For you
Giáo trình | Syllabuses
`.trim();

/**
 * English -> Japanese phrase dictionary for reviewed core UI terms.
 *
 * One entry per line: `English | Japanese`.
 */
const EN_JA = `
# ---- Sidebar groups & menus ----
Dashboard | ダッシュボード
Dashboard Stats | ダッシュボード統計
Analytics | 分析
Course Analytics | コース分析
Student Analytics | 受講生分析
Course Usage | コース利用状況
Course Management | コース管理
Course Online | オンラインコース
Assessment Management | アセスメント管理
Book Management | 書籍管理
Project Management | プロジェクト管理
RBAC Management | 権限管理
Score Management | 成績管理
Syllabus Management | シラバス管理
System Management | システム管理
Training Management | トレーニング管理
Student | 受講生
Students | 受講生
Courses | コース
Enrollments | 登録
Enrollment Logs | 登録ログ
Lesson Reports | レッスンレポート
Categories | カテゴリ
Certificates | 修了証
Assessments | アセスメント
Books | 書籍
Class | クラス
Classes | クラス
Class List | クラス一覧
Curriculum | カリキュラム
Department | 部署
Departments | 部署
Invitations | 招待
Module Groups | モジュールグループ
Modules | モジュール
My Appeals | 異議申し立て
My Exams | 試験一覧
My Scores | 成績一覧
My Classes | 担当クラス
My Courses | 受講コース
Question Bank | 問題バンク
Questions | 問題一覧
Reports | レポート
Reservation | 休学管理
Roles | 役割
Permissions | 権限
Users | ユーザー
User Management | ユーザー管理
Settings | 設定
Audit Logs | 監査ログ
Locations | 拠点
Skills | スキル
Training Programs | 研修プログラム
Topics | トピック
Cohorts | コホート
Milestones | マイルストーン
Sprints | スプリント
Tasks | タスク
Interviews | 面接
Rubrics | ルーブリック
Notifications | 通知

# ---- Common Actions & Buttons ----
Save | 保存
Cancel | キャンセル
Delete | 削除
Edit | 編集
Update | 更新
Create | 作成
Add | 追加
View | 表示
Details | 詳細
View details | 詳細を表示
Actions | 操作
Search | 検索
Filter | フィルター
Filters | フィルター
Reset | リセット
Reset filters | フィルターをリセット
Apply | 適用
Export | エクスポート
Export Excel | Excelエクスポート
Export CSV | CSVエクスポート
Import | インポート
Import Excel | Excelインポート
Back | 戻る
Next | 次へ
Previous | 前へ
Submit | 送信
Confirm | 確認
Close | 閉じる
Download | ダウンロード
Upload | アップロード
Select | 選択
Select all | すべて選択
Refresh | 更新
Retry | 再試行
Try again | もう一度試す
Clear | クリア
Copy | コピー
Publish | 公開
Unpublish | 非公開
Approve | 承認
Reject | 却下
Print | 印刷

# ---- Common Form Labels & Fields ----
Name | 名前
Full Name | 氏名
First Name | 名
Last Name | 姓
Email | メールアドレス
Phone | 電話番号
Password | パスワード
Confirm Password | パスワード確認
New Password | 新しいパスワード
Current Password | 現在のパスワード
Code | コード
Description | 説明
Status | ステータス
Role | 役割
Type | 種類
Date | 日付
Start Date | 開始日
End Date | 終了日
Time | 時間
Duration | 所要時間
Score | スコア
Grade | 成績
Weight | 重み
Note | 備考
Notes | 備考
Reason | 理由
Priority | 優先度
Category | カテゴリ
Action | アクション
Created At | 作成日時
Updated At | 更新日時
Created By | 作成者
Updated By | 更新者
Room | 教室
Trainer | 講師
Teacher | 講師
Master Trainer | 主担当講師
Class Admin | クラス管理者
Mentor | メンター

# ---- Statuses ----
Active | 有効
Inactive | 無効
ACTIVE | 有効
INACTIVE | 無効
Draft | 下書き
DRAFT | 下書き
Published | 公開済み
Pending | 保留中
Approved | 承認済み
Rejected | 却下
Ongoing | 進行中
Completed | 完了
Cancelled | キャンセル済み
Planning | 計画中
Passed | 合格
Failed | 不合格
Pass | 合格
Fail | 不合格
Present | 出席
Absent | 欠席
Late | 遅刻
Excused | 公休
All | すべて
None | なし
Yes | はい
No | いいえ

# ---- Dialogs & Feedback ----
Are you sure? | 本当によろしいですか？
Are you sure you want to delete? | 本当に削除しますか？
This action cannot be undone. | この操作は取り消せません。
Loading... | 読み込み中...
Loading | 読み込み中
No data found | データが見つかりません
No data available | データがありません
No records found | レコードが見つかりません
Success | 成功
Error | エラー
Warning | 警告
Info | 情報
Saved successfully | 正常に保存されました
Created successfully | 正常に作成されました
Updated successfully | 正常に更新されました
Deleted successfully | 正常に削除されました

# ---- Auth & Navigation ----
Sign In | ログイン
Sign Out | ログアウト
Log In | ログイン
Log Out | ログアウト
Login | ログイン
Logout | ログアウト
Register | 新規登録
Forgot Password | パスワードをお忘れですか
Forgot Password? | パスワードをお忘れですか？
Reset Password | パスワードをリセット
Profile | プロフィール
My Profile | プロフィール
Account Settings | アカウント設定
Change Password | パスワード変更
Remember me | ログイン状態を保持する
Don't have an account? | アカウントをお持ちではありませんか？
Already have an account? | すでにアカウントをお持ちですか？
Change language | 言語を変更
English | English
Tiếng Việt | Tiếng Việt
日本語 | 日本語
`.trim();

function parse(raw: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf(" | ");
    if (index < 0) continue;
    pairs.push([trimmed.slice(0, index).trim(), trimmed.slice(index + 3).trim()]);
  }
  return pairs;
}

const enViPairs = parse(EN_VI);
const viEnPairs = parse(VI_EN_EXTRA);
const enJaPairs = parse(EN_JA);

export const EN_TO_VI: Record<string, string> = Object.fromEntries(enViPairs);
export const EN_TO_JA: Record<string, string> = Object.fromEntries(enJaPairs);

/** Explicit Vietnamese->English entries win over the automatic reverse of EN_VI. */
export const VI_TO_EN: Record<string, string> = (() => {
  const reverse: Record<string, string> = {};
  for (const [en, vi] of enViPairs) {
    if (!(vi in reverse) && vi !== en) reverse[vi] = en;
  }
  for (const [vi, en] of viEnPairs) reverse[vi] = en;
  return reverse;
})();
