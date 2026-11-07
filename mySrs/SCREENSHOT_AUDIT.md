# Rà soát ảnh chụp và truy vết SRS

Tài liệu được rà soát: `mySrs.docx`. Bản đã chỉnh: `mySrs-reviewed.docx`.

| Hình | Kết quả đối chiếu | Điều chỉnh trong bản đã rà soát |
| --- | --- | --- |
| A.01 | Đúng màn hình danh sách milestone. Ảnh cho thấy tìm kiếm, phân trang và trạng thái; không chứng minh lọc tenant/scope. | Giữ ảnh. |
| A.02 | Đúng biểu mẫu tạo. Ảnh đầu có 1 checklist item, hai ảnh sau có 2 item vì được chụp trong lúc nhập liệu. | Thêm chú thích về trình tự chụp. |
| A.03 | Ảnh là phần dưới trang chi tiết: rubric và revision history, không phải toàn bộ trang. | Sửa chú thích và chỉ truy vết trực tiếp FR-MIL-03/AC-MIL-03; FR-MIL-07 cần kiểm thử chuyển trạng thái. |
| A.04 | Đúng biểu mẫu sửa milestone PLANNED. | Bổ sung truy vết FR-MIL-04/AC-MIL-04 ở mức giao diện. |
| A.05 | Đúng biểu mẫu sửa milestone IN_PROGRESS với mô tả, hạn và rubric bị khóa. | Giữ ảnh. |
| A.06 | Bản gốc còn chỗ giữ ảnh. | Chèn ảnh lịch sử revision và ảnh mới chụp hộp thoại xác nhận xóa từ ứng dụng chạy trên bản sao cơ sở dữ liệu. Hai ảnh là hai ví dụ độc lập. Kết quả xóa mềm và điều kiện chặn xóa cần kiểm thử riêng. |
| A.07 | Đúng danh sách rubric, trạng thái draft/published và các nút thao tác. | Nêu rõ ảnh chỉ cho thấy nút publish/xóa, chưa chứng minh kết quả thao tác. |
| A.08 | Hai ảnh đều là biểu mẫu **sửa** draft v2; không có ảnh tạo rubric mới. | Bỏ truy vết trực tiếp FR-RUB-02/AC-RUB-02. |
| A.09 | Thấy version 2 DRAFT và version 1 PUBLISHED; không thấy thao tác publish, clone version hay xóa draft. | Giới hạn truy vết trực tiếp vào hiển thị version; các thao tác cần kiểm thử riêng. |
| A.10 | Danh sách cùng bài nộp có v1 đã yêu cầu sửa và v2 đang chờ review. | Làm rõ phiên bản trong chú thích. Điểm và feedback lịch sử chưa hiện trong ảnh. |
| A.11 | Chi tiết ghi **v3**, còn A.10 ghi **v2**. Ảnh A.11 là thời điểm sau khi phát sinh version mới. | Nêu rõ khác thời điểm; chỉ truy vết trực tiếp thông tin bài nộp, không nhận là ảnh lịch sử review. |
| A.12 | Đúng form rating, checklist và ba nút quyết định. Ảnh không có kết quả sau khi lưu hoặc lịch sử review. | Bỏ truy vết trực tiếp FR-REV-04/AC-REV-04; giữ FR-REV-02/03 ở mức biểu mẫu. |

Ảnh giao diện không thay cho kiểm thử nghiệm thu các quy tắc backend như 403/409/422, idempotency, xóa mềm, tính điểm, lưu lịch sử review và tính bất biến của rubric version. Các điểm này vẫn cần bằng chứng kiểm thử hoặc ảnh trạng thái sau thao tác.

Nguồn ảnh mới A.06: giao diện ứng dụng chạy cục bộ ngày 04/11/2026 trên **bản sao** của `data/fams_lms_after_merge.mv.db`; không nhấn nút xác nhận xóa khi chụp.
