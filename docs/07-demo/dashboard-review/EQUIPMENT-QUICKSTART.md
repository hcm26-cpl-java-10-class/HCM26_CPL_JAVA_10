# Template mới và đặt giờ bắt đầu cho demo local

## Template đã tạo

Trong database local `backend/data/fams_lms_after_merge.mv.db` đã có:

- Code đang dùng: **DASH-EQUIP-CD1**.
- Tên: **Muon thiet bi hoc tap**.
- Template ID local: **145**; phiên bản nguồn **v1.0**, version ID **232**.
- Trạng thái: template ACTIVE, phiên bản PUBLISHED.
- Đề tài: tìm thiết bị còn trống, đặt mượn theo khoảng thời gian, duyệt/từ chối, giao và trả thiết bị; chặn lịch mượn trùng.
- Team 4 người: tối thiểu 1 PM; BA/DEV/QA tối thiểu 0 theo cấu hình template 145 bạn tạo; không kiêm nhiệm.
- 3 milestone: M1 - Analysis 40% / M2 - Implementation 40% / M3 - Handover 20%; deadline sau thời điểm bắt đầu lần lượt 1 / 3 / 7 ngày.
- 12 backlog mẫu, mỗi milestone có 4 item gợi ý, đủ PM/BA/DEV/QA. Prefix M1/M2/M3 trong tên là gợi ý để bạn tự liên kết vào milestone khi lập kế hoạch.
- Rubric đã publish, checklist bắt buộc, cho nộp trễ tối đa 2 ngày và phạt 5%/ngày.

Template 145 do bạn tạo. Theo yêu cầu sau đó, đã chuyển ba team Choji/Ino/Shikamaru từ template 144 sang 145 trong dữ liệu local, giữ nguyên ID Project/Workspace và đồng bộ snapshot, rubric, checklist, backlog. Template 144 đã Archived; lịch sử snapshot cũ vẫn được giữ. Không chạy nộp bài hoặc chấm Accepted cho bạn.

## Hiện đã chọn giờ ngay trên form được chưa?

**Chưa.** Form hiện dùng Start date dạng ngày và chỉ chấp nhận từ ngày mai, tự bắt đầu lúc 00:00 theo múi giờ tenant. Backend cũng kiểm tra điều kiện này. Template milestone chỉ có Due after theo ngày/tuần; luồng tạo Workspace chưa gán lịch bắt đầu cho milestone sinh từ template.

Theo lựa chọn **chỉ chuẩn bị local**, không sửa quy tắc chung hoặc form/API. File `04-equipment-start-time.sql` cho bạn đặt giờ trên dữ liệu demo sau khi tạo Workspace. File bật Project để có thể submit và đặt lịch; việc chuyển milestone `PLANNED → IN_PROGRESS` do scheduler thật của ứng dụng thực hiện. File không gán sẵn `IN_PROGRESS`, `SUBMITTED`, `ACCEPTED` hay `COMPLETED` cho milestone.

## 1. Dữ liệu sau khi chuyển sang template 145

1. Chạy backend bằng `backend/data/Start-Dashboard-Local.ps1`, frontend bằng `npm run dev` trong thư mục `frontend`.
2. Project Team Allocation → DASH-C có **Choji** và **Ino**; DASH-D có **Shikamaru**. Cả ba đang DRAFT và đã có Project/Workspace, template 145 đã gắn sẵn sau lần chuyển local này.
3. Hoàn tất vai trò, leader và mentor cho từng team nếu còn thiếu. Không cần gán lại đề bài. Với một team mới chưa có Project trong lần thực hành khác, gán template thành công sẽ tự sinh Project/Workspace.
4. Công bố team khi đủ điều kiện; mở Workspace của đúng team. Kiểm tra Workspace có M1/M2/M3 và rubric theo template 145.
5. Chưa đặt lịch cho Shikamaru để giữ một team ở trạng thái Chưa bắt đầu.

Trước bước đặt lịch, có thể mở Dashboard và chụp trạng thái Chưa bắt đầu. Team chưa có Project chưa nằm trong thống kê Reports.

### Lỗi 409 đã gặp và lần chuyển local được yêu cầu

Sau khi gán đề bài thành công, Project và bản chụp đề bài đã được tạo. Team còn DRAFT vẫn không được đổi sang template khác nếu đã có Project. Tạo hoặc clone template mới không tự thay đề bài của Project hiện có.

Trạng thái sau chuyển local ngày 05/11/2026:

| Team | Project | Workspace | Template đang gắn | Thành viên |
| --- | ---: | ---: | --- | --- |
| Choji | 148 | 212 | DASH-EQUIP-CD1 (145) | 4/4 |
| Ino | 149 | 213 | DASH-EQUIP-CD1 (145) | 4/4 |
| Shikamaru | 150 | 214 | DASH-EQUIP-CD1 (145) | 4/4 |

Lỗi `This team already has a project. Its assigned project brief cannot be changed` xuất hiện trước đó khi đổi template 144 sang 145 qua UI; backend đang khóa đề bài sau khi sinh Project. Lần chuyển này là bảo trì demo local có sao lưu, không đổi quy tắc backend. Đã cập nhật cả liên kết team, snapshot Project và cấu hình milestone/backlog theo 145. Tiếp tục demo trực tiếp trên các Workspace trong bảng, không cần bấm gán lại. Nội dung để gửi người phụ trách module nằm trong [note lỗi](TEMPLATE-ASSIGNMENT-ISSUE.md).

Frontend trước đây dùng tiêu đề vượt sức chứa cho mọi lỗi gán đề bài ngoài hai nhánh đặc biệt. Đã sửa để chỉ hiển thị vượt sức chứa khi backend trả `MAX_MEMBERS_EXCEEDED`; các lỗi khác có tiêu đề gán đề bài thất bại và giữ thông báo chi tiết từ backend.

## 2. Đặt giờ bắt đầu ngay cho Choji

1. Khi backend đang chạy, mở `http://localhost:8080/h2-console`. Driver `org.h2.Driver`, user `sa`, mật khẩu trống, JDBC URL:

   ```text
   jdbc:h2:file:D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/data/fams_lms_after_merge;IFEXISTS=TRUE;DB_CLOSE_ON_EXIT=FALSE
   ```

2. Mở `04-equipment-start-time.sql`. Chạy các câu SET đầu tiên:

   ```sql
   SET TIME ZONE 'Asia/Ho_Chi_Minh';
   SET @equipment_class = 'DASH-C';
   SET @equipment_team = 'Choji';
   SET @equipment_template = 'DASH-EQUIP-CD1';
   SET @equipment_start = CURRENT_TIMESTAMP;
   ```

3. Chạy SELECT preview ngay bên dưới trong file. Kết quả phải là đúng Project của Choji và ba milestone còn PLANNED. Nếu rỗng, kiểm tra đúng template 145/Workspace; nếu nhiều hơn một Project, dừng và xác định đúng fixture.
4. Khi preview đúng, chạy phần từ `SET AUTOCOMMIT FALSE` đến cuối file. File chỉ áp dụng trong lớp C/D, đúng team đang chọn, đúng template mới và milestone chưa bắt đầu.
5. Chờ scheduler **khoảng 60 giây**, refresh Workspace → Milestone. M1/M2/M3 phải thành **IN_PROGRESS**. Khi đó student mới soạn/nộp artifact được.

**In progress không phải Completed.** Chưa có task Done, bài nộp hoặc Accepted do thao tác đặt lịch này. Nếu muốn giữ milestone chưa bắt đầu, không chạy khối UPDATE cho team đó.

## 3. Chọn một giờ sắp tới

Ở bước SET, dùng **một** trong các lựa chọn sau thay cho `CURRENT_TIMESTAMP`:

```sql
-- Bắt đầu sau 10 phút tính từ lúc chạy câu SET:
SET @equipment_start = DATEADD('MINUTE', 10, CURRENT_TIMESTAMP);

-- Hoặc một thời điểm cụ thể: thay bằng ngày/giờ thực tế của buổi demo:
SET @equipment_start = TIMESTAMP WITH TIME ZONE '2026-11-05 15:30:00+07:00';
```

Preview lại rồi chạy khối UPDATE. Deadline được căn lại từ giờ bắt đầu bạn chọn: +1 / +3 / +7 ngày; cửa sổ trễ = deadline +2 ngày. Đến giờ hẹn, scheduler mở milestone trong chu kỳ kế tiếp. Không đổi giờ Windows để giả lập thời gian.

Project được bật ACTIVE khi chạy SQL; Reports có thể hiển thị Đang thực hiện ngay cả khi milestone đang chờ giờ mở. Để xác nhận đã bắt đầu thật, kiểm tra **trạng thái milestone IN_PROGRESS**, không chỉ nhìn nhãn Project trên Dashboard.

## 4. Cho Ino bắt đầu nhưng giữ D chưa bắt đầu

Đổi `@equipment_team` sang `Ino`, đặt giờ rồi preview/chạy lại khối SQL trên. Muốn thao tác với một team lớp D sau này, đổi cả `@equipment_class` sang `DASH-D` và tên team tương ứng.

Gợi ý giữ dữ liệu để review lại:

| Team | Thao tác bạn tự làm tiếp | Điểm dừng |
| --- | --- | --- |
| Choji | Liên kết 4 item M1; hoàn thành 1 item | M1 25%, Project 10%, đang làm và có thể sắp hạn |
| Ino | Draft → submit → teacher yêu cầu sửa → student nộp v2 | Giữ version mới SUBMITTED, chờ chấm |
| Shikamaru (DASH-D) | Có Workspace/Project nhưng chưa đặt lịch | Chưa bắt đầu; chỉ hoàn thành riêng team D khi cần |

Các ca thao tác artifact, review, filter và export theo [hướng dẫn chi tiết](README.md). Trong hướng dẫn đó, DASH-C-RISK tương ứng **Choji**, DASH-C-REVIEW tương ứng **Ino**; dùng file **04** này thay file 01/02 để đặt giờ cho template thiết bị. Các file cũ có tên team cố định, nên không chạy nguyên bản trên Choji/Ino.

## Kiểm tra đã làm và giới hạn

- Template 145 đang ACTIVE, source v1.0 (232) PUBLISHED. Ba team gắn đúng template/source mới; ba snapshot assignment mới là 261/262/263.
- So sánh khi chuyển: mọi dòng ngoài phạm vi ba Project và template 144 trong 131 bảng giữ nguyên. ID/membership/Workspace không đổi; thêm audit rõ `LOCAL_DEMO_TEMPLATE_SWITCH`.
- 9 milestone còn PLANNED; 36 backlog còn TODO. Chưa nộp/chấm hoặc chạy lịch bắt đầu thay bạn.
- SQL đặt giờ đã cập nhật sang template 145; bạn kiểm tra scheduler ở bước 2 khi bắt đầu demo.
- Mở lại backend của bạn trước khi demo nếu đang dừng.

Sao lưu trước chuyển: `backend/data/backups/template-144-to-145-20261105-114659-301/before.mv.db`; kết quả thử và áp dụng nằm cùng thư mục (`rehearsal.json`, `applied.json`). `SwitchDemoTemplate145.java` là công cụ local chạy một lần có kiểm tra hash; không chạy lại sau khi đã chuyển. `Create-EquipmentDemoTemplate.ps1`/`equipment-template.json` là bộ tạo template 144 ban đầu, giữ làm tài liệu lịch sử; không dùng để ghi đè template 145 do bạn tạo.
