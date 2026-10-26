# Hướng dẫn nghiệm thu Workspace AC08–AC13

Bộ tài liệu này dùng API đang có trong repository. Collection kiểm thử qua HTTP thật khi bạn chạy Postman; báo cáo trong evidence là kiểm thử Spring Boot/MockMvc với database kiểm thử riêng. Hai loại bằng chứng này có mục đích khác nhau.

## 1. Chuẩn bị dữ liệu và Postman

1. Chạy backend ở http://localhost:8080. AC08–AC12 không cần frontend; AC13 cần frontend http://localhost:5173.
2. Mở http://localhost:8080/h2-console. Dùng thông tin kết nối H2 của backend đang chạy. Cấu hình mặc định là JDBC URL jdbc:h2:file:./data/fams_lms, user sa, password rỗng nếu bạn chưa đổi cấu hình. Không tạo một DB khác rồi dùng kết quả đó làm bằng chứng cho backend.
3. Chạy setup-h2.sql. Script tạo đúng bốn cặp QA riêng cho AC08, AC09, AC10, AC11; mỗi team có mentor và một thành viên active. Không thay đổi các team WS-DEMO.
4. Chụp kết quả cuối: bốn dòng, mỗi dòng MEMBER_COUNT = 1 và WORKSPACE_COUNT = 0. Lưu FIXTURE_PREFIX. Mỗi lần chạy script sẽ tạo một prefix mới; dữ liệu cũ không tự bị xóa.
5. Import Workspace-AC08-AC11.postman_collection.json vào Postman. Chọn No Environment để các biến môi trường cũ không ghi đè biến của collection. Trong Variables của collection, đặt fixturePrefix bằng FIXTURE_PREFIX vừa lấy. Các ID/token trong file import ban đầu đều rỗng.
6. Chạy ba request trong 00 - Setup: đăng nhập creator, lấy candidates, đăng nhập viewer. Request candidates tự lấy projectId/teamId cho bốn ca dựa trên prefix. Nếu không có demo account, cập nhật email/password và dùng một tài khoản có đúng tenant, scope, quyền tạo; script SQL cũng cần cập nhật email tương ứng.
7. Chạy từng folder/ca theo hướng dẫn dưới đây. Không chạy toàn bộ collection liên tục vì các ca đổi trạng thái hoặc thu hồi scope cần bước SQL ở giữa. Sau khi đã bắt đầu kiểm thử, không chạy lại request capture IDs trên cùng fixture: request này khởi tạo lại các biến key/response.
8. Trong verify.sql, thay 123/456 bằng đúng projectId/teamId của ca đang xét. Chụp kết quả SQL trước và sau.

Headers tạo workspace:

~~~http
Authorization: Bearer <accessToken>
Content-Type: application/json
X-Idempotency-Key: <key của lần thao tác>
X-Correlation-ID: <mã theo dõi bằng chứng>
~~~

Body dùng ID dạng số lấy từ dữ liệu thật:

~~~json
{
  "projectId": 123,
  "teamId": 456
}
~~~

Không dùng lại cặp AC09 cho AC10. Đổi key không làm cặp dữ liệu trở về trạng thái chưa có workspace. Restart backend cũng không reset DB file hiện tại.

## 2. AC08 — Chặn workspace trùng

Dùng folder AC08 - Duplicate workspace.

1. Chạy verify.sql với cặp AC08. Cả sáu count phải bằng 0.
2. Gửi A - First creation. Kỳ vọng 201, lưu id workspace.
3. Chạy verify.sql, lưu ảnh các count sau thành công.
4. Gửi B - Same pair, different key: 409. Payload giữ nguyên, key khác.
5. Kỳ vọng 409 và workspaceId bằng id ở bước 2. Dùng GET /api/workspaces/{workspaceId} với creator để chứng minh workspace cũ vẫn mở được.
6. Chạy lại SQL: không tăng số record.

Bằng chứng: ảnh 201, ảnh 409 có workspaceId, hai key khác nhau, ảnh DB trước/sau và GET workspace cũ 200.

Sau bước thành công, số lượng theo cặp phải là:

| Workspace | Sections | Audit | Outbox event | Activity | Idempotency record |
| --- | --- | --- | --- | --- | --- |
| 1 | 8 | 1 | 1 | 1 | 1 |

## 3. AC09 — Replay cùng key

Dùng folder AC09 - Durable replay và cặp AC09 mới, chưa có workspace.

1. SQL trước khi chạy: sáu count = 0.
2. Gửi A - First creation, fixed key: kỳ vọng 201. Collection lưu toàn bộ response.
3. Gửi B - Same key and body: identical 201. Không sửa ac09_run; không tự tạo GUID mới ở mỗi lần Send.
4. Kỳ vọng 201, toàn bộ response giống lần A, bao gồm id và createdAt. Test Results có assertion so sánh toàn bộ JSON.
5. SQL vẫn là 1/8/1/1/1/1, chứng minh không tăng audit, logical event hoặc activity.
6. Gửi C - Same key, different body: 409. Collection đổi teamId sang một ID hợp lệ khác, giữ nguyên key. Kỳ vọng 409 và SQL không đổi.

Đây là cách tái hiện hành vi retry sau khi client không nhận được kết quả; không cần thực sự làm mất response để kiểm tra tính ổn định của key. Tình huống mất kết quả trên UI có thể kiểm thử bổ sung ở AC13.

Bằng chứng: hai response 201 giống nhau, cùng key/cùng body; một response 409 khi đổi body; ảnh SQL trước/sau.

## 4. AC10 — Hai request đồng thời

Dùng cặp AC10 riêng. Không dùng hai lần bấm Send tuần tự để kết luận AC10.

1. SQL với cặp AC10: sáu count = 0. Chụp ảnh trước khi gửi.
2. Mở request Run concurrent creation on a clean pair.
3. Xem Scripts > Post-response. Script đầy đủ đã có sẵn trong collection và trong ac10-concurrent.post-response.js.
4. Mở Postman Console. Bấm Send đúng một lần. GET của request chính chỉ kiểm tra precondition; script sau đó gửi hai POST bằng pm.sendRequest, với cùng body nhưng hai key khác nhau.
5. Hai lời gọi được tạo trước khi Promise.all chờ kết quả. Không lồng request B vào callback hoàn tất của A.
6. Trong Test Results, phải PASS: precondition sạch; hai key khác nhau; Exactly HTTP 201 + HTTP 409; winner đúng project/team.
7. Console có AC10 concurrent evidence: payload, hai key, thời điểm gửi/nhận, status và response của cả hai POST. Có thể sao chép JSON từ ac10_evidence trong Variables của collection.
8. Chạy verify.sql: workspace_count = 1, section_count = 8, audit/event/activity/idempotency mỗi loại = 1. Lưu ảnh.
9. Muốn chạy lại, cleanup đúng prefix cũ rồi chạy setup mới và capture lại ID. Trên cặp đã có workspace, kết quả 409/409 là sai precondition, không phải bằng chứng hệ thống lỗi race condition.

Postman hỗ trợ pm.sendRequest bất đồng bộ: https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-send-request

Client phát song song không bảo đảm hai thread backend đi tới cùng một lệnh ở cùng một millisecond. Bổ sung bằng chứng từ test đồng bộ điểm bắt đầu bằng latch:

~~~powershell
Set-Location "D:\SE172316\Semeter 6\HCM26_CPL_JAVA_10"
& ".\docs\workspace-acceptance\run-evidence.ps1" -Ac AC10
~~~

Kỳ vọng 2 test PASS:

- Khác key: đúng 201 + 409, DB chỉ một workspace và một bộ journal.
- Cùng key: 201 + 201 với response giống nhau, vẫn chỉ một logical creation. Đây là kiểm tra bổ sung, không thay thế ca AC10 khác key.

Bằng chứng cần lưu: SQL trước; Postman Console và Test Results; SQL sau; báo cáo evidence/AC10-results.md. Chỉ ảnh status 201/409 không đủ chứng minh số record trong DB.

## 5. AC11 — Kiểm tra lại trước khi lưu

Bắt đầu với cặp AC11 sạch, project PLANNING và team đủ scope/thành viên.

Gửi A - Confirm valid pair without writes, kỳ vọng 200 và SQL vẫn 0. Sau đó kiểm tra các nhánh:

| Nhánh | Thao tác Postman / dữ liệu | Kỳ vọng |
| --- | --- | --- |
| Không có xác thực | B, auth = No Auth | 401; không tạo workspace |
| Token từng hợp lệ đã hết hạn | Token được backend ký, có exp đã qua; chạy test tích hợp nếu không muốn chờ TTL | 401; không tạo workspace |
| Không có quyền tạo | Đăng nhập viewer ở Setup rồi gửi C | 403; không tạo workspace |
| Mất scope sau xác nhận | Giữ token creator; bỏ mentor và tắt membership đúng team QA theo SQL dưới đây; gửi G | 403; không tạo workspace |
| Target không tồn tại | D, missingTeamId phải không có trong DB | 404; không tạo workspace |
| Quan hệ sai | E: project của team AC09 nhưng team là AC11, hai ID đều tồn tại cùng tenant | 422, không phải 409 |
| Trạng thái thay đổi | Confirm khi PLANNING; chuyển project QA sang COMPLETED, gửi F; lặp với CANCELLED | 409; không tạo workspace |

Request B/C là kiểm tra nhanh về authentication/permission; không được dùng ảnh đó để khẳng định đã kiểm thử token hết hạn hoặc quyền vừa bị thu hồi sau confirmation.

### Trạng thái thay đổi sau confirmation

Trong H2 Console, thay 123 bằng projectId AC11, thay prefix bằng đúng prefix đã lưu:

~~~sql
SET @qa11_project = 123;
SET @qa_prefix = 'PASTE-EXACT-QA-WS-PREFIX-HERE';

UPDATE projects
SET status = 'COMPLETED'
WHERE id = @qa11_project AND code = @qa_prefix || '-AC11';
~~~

Gửi F, chụp 409 và SQL vẫn 0. Khôi phục:

~~~sql
UPDATE projects
SET status = 'PLANNING'
WHERE id = @qa11_project AND code = @qa_prefix || '-AC11';
~~~

Confirm lại 200, đổi sang CANCELLED và lặp quy trình. F có pre-request guard để không vô tình tạo workspace nếu bạn quên đổi trạng thái.

### Thu hồi scope của cùng creator

Thực hiện trên team QA AC11 chưa có workspace; không dùng admin vì admin có scope rộng. Đặt các biến đúng trước:

~~~sql
SET @qa11_team = 456;
SET @qa_prefix = 'PASTE-EXACT-QA-WS-PREFIX-HERE';
SET @qa_actor = (SELECT id FROM users WHERE email = 'workspace.mentor.demo@example.com');

SELECT id, code, mentor_id FROM teams
WHERE id = @qa11_team AND code = @qa_prefix || '-AC11';

UPDATE teams SET mentor_id = NULL
WHERE id = @qa11_team AND code = @qa_prefix || '-AC11';

UPDATE team_members SET is_active = FALSE
WHERE team_id = @qa11_team AND user_id = @qa_actor
  AND EXISTS (SELECT 1 FROM teams WHERE id = @qa11_team AND code = @qa_prefix || '-AC11');
~~~

Giữ nguyên token từ trước khi thay đổi, gửi G, kỳ vọng 403 và SQL count vẫn 0. Khôi phục đúng dữ liệu fixture:

~~~sql
UPDATE teams SET mentor_id = @qa_actor
WHERE id = @qa11_team AND code = @qa_prefix || '-AC11';

UPDATE team_members SET is_active = TRUE
WHERE team_id = @qa11_team AND user_id = @qa_actor
  AND EXISTS (SELECT 1 FROM teams WHERE id = @qa11_team AND code = @qa_prefix || '-AC11');
~~~

Không tắt tenant dùng chung hoặc sửa role mặc định chỉ để chụp một ảnh 403. Các nhánh tenant ngừng hoạt động, quyền/role/account bị thu hồi dùng tenant/role/user riêng trong integration test.

### Target bị xóa sau confirmation

D là kiểm tra nhanh ID không tồn tại. Nếu cần chứng minh đối tượng bị xóa sau confirmation, dùng cặp QA AC11 riêng, confirm 200, rồi xóa membership và đúng team QA đó trước khi gửi POST với ID cũ. Thực hiện cuối cùng vì team không còn để tiếp tục các ca khác. Không xóa team demo.

Test tích hợp đã có cả TEAM/PROJECT bị xóa sau confirmation. Chạy toàn bộ phần này:

~~~powershell
& ".\docs\workspace-acceptance\run-evidence.ps1" -Ac AC08-AC12
~~~

Bằng chứng mỗi nhánh: confirmation 200 trước khi thay đổi nếu áp dụng; ảnh/SQL thay đổi fixture; response đúng status; SQL trước/sau không phát sinh workspace. Token hết hạn phải là token có chữ ký hợp lệ do backend tạo; sửa exp thủ công làm chữ ký sai, không chứng minh đúng tình huống expired session.

## 6. AC12 — Rollback và ghi nhận một lần

AC12 cần chứng minh hai phần riêng: lỗi giữa giao dịch và journal/event khi thành công. Body JSON sai hoặc tắt backend trước khi request tới nơi không chứng minh rollback của các bước lưu.

Repository không có API public để chèn lỗi giữa transaction. Dùng test tích hợp có fault injection:

~~~powershell
Set-Location "D:\SE172316\Semeter 6\HCM26_CPL_JAVA_10"
& ".\docs\workspace-acceptance\run-evidence.ps1" -Ac AC12
~~~

Kỳ vọng 7 test PASS:

| Ca | Cách tạo lỗi / kiểm tra | Assertion bắt buộc |
| --- | --- | --- |
| 1 | Lỗi lưu workspace | API 500; toàn bộ count không đổi; project vẫn PLANNING |
| 2 | Lỗi ràng buộc section bắt buộc | Như trên |
| 3 | Lỗi lưu audit | Như trên |
| 4 | Lỗi lưu outbox | Như trên |
| 5 | Lỗi lưu activity | Như trên |
| 6 | Lỗi lưu idempotency record | Như trên |
| 7 | Tạo thành công; gửi lại cùng event nhiều lần | Audit đủ actor/tenant/project/team/time/action/correlation/before/after; activity vẫn đúng một lần |

Trong sáu ca rollback, test so sánh số record của cả sáu bảng trước/sau, không chỉ query những record join được với workspace còn tồn tại. Sau khi bỏ fault, retry cùng key phải tạo thành công.

Test case tương ứng:

- ac12MandatorySaveFailureRollsEverythingBackAndSameKeyCanRetry: parameterized sáu bước lỗi.
- ac12AuditHasFullContextAndOutboxRedeliveryNeverDuplicatesActivity: kiểm tra audit và phát lại cùng logical event.

Bằng chứng:

1. Ảnh terminal có Tests run: 7, Failures: 0, Errors: 0 và BUILD SUCCESS.
2. Lưu evidence/AC12-results.md hoặc JSON, cùng source các assertion để reviewer đối chiếu.
3. Có thể chạy test từng method trong IDE và chụp debugger tại bước sau response 500 / kiểm tra count.
4. Dùng verify.sql trên một ca tạo thành công để bổ sung ảnh audit/event/activity có cùng event_id. Ảnh SQL thành công này chưa thay thế bằng chứng fault injection.
5. Nếu muốn chứng minh UI không báo thành công khi nhận lỗi, bổ sung AC13 bằng lỗi gửi request có kiểm soát.

Log có thể chứa stack trace do test chủ động gây lỗi. Kết luận theo kết quả assertion và BUILD SUCCESS/FAILURE, không theo việc có một dòng ERROR trong log.

Tests dùng H2 riêng và profile test; không cần tắt backend/FE đang chạy, không thay dữ liệu demo hoặc DB ứng dụng. Script lưu log chi tiết trong backend/target và xuất báo cáo chỉ gồm tên ca/kết quả/thời gian. -ReportOnly chỉ xuất lại report đã có, không chạy test mới.

## 7. AC13 — Không chỉ là khóa Cancel

Cần bằng chứng đủ ba ca UI.

### A. Cancel trước khi gửi

1. Trên Workspace, đặt bộ lọc/từ khóa dễ nhận diện.
2. Chọn team/project hợp lệ chưa có workspace, Continue để tới confirmation.
3. Mở DevTools > Network, xóa danh sách request đang hiển thị.
4. Bấm Cancel.
5. Danh sách giữ nguyên các bộ lọc; không có POST tạo workspace đến đúng /api/workspaces; SQL vẫn 0.
6. POST /api/workspaces/confirm trước đó là tải thông tin xác nhận, không phải request tạo.

Bằng chứng: ảnh bộ lọc trước/sau; Network không có create POST; SQL không đổi.

### B. Request đang xử lý

1. Chọn một cặp chưa có workspace khác hoặc fixture mới.
2. Trong Network, đặt throttling có latency vài giây, rồi bấm Confirm creation.
3. Khi request còn Pending, nút hiển thị Creating... và disabled. Thử bấm nhanh thêm: chỉ có một POST tạo workspace.
4. Code hiện tại cũng khóa Cancel/Back và chặn Esc/click ngoài dialog trong lúc xử lý.
5. Chờ kết quả rồi kiểm tra UI và DB.

AC13 bắt buộc khóa nút xác nhận khi pending. Khóa Cancel là hành vi bổ sung hiện tại; không có nghĩa là người dùng có thể hủy/rollback một transaction đã gửi tới backend.

Bằng chứng: ảnh/clip nút đang disabled và Network Pending; tổng create POST = 1.

### C. Lỗi có thể khắc phục và Try again

1. Chọn cặp sạch, tới confirmation. Trong DevTools > Network request blocking, thêm pattern */api/workspaces để chặn đúng create endpoint trước khi gửi; không chặn /api/workspaces/confirm. URL thực tế có thể qua Vite proxy, dùng URL đang thấy trong Network.
2. Bấm Confirm creation. Request bị chặn ở client nên chưa tạo record.
3. UI hiện lỗi, giữ project/team, có Try again. Chụp ảnh và key/body của request lỗi.
4. Tắt request blocking rồi bấm Try again.
5. So sánh Request Headers/Request Payload hai lần: X-Idempotency-Key và body giống nhau.
6. Kỳ vọng một workspace; sau khi thành công mở Overview, DB là 1/8/1/1/1/1.

Bằng chứng: ảnh lỗi và lựa chọn được giữ, hai request cùng key/body, response thành công và SQL. Khi chụp headers, ẩn giá trị Bearer token.

## 8. Thu dọn và bằng chứng bàn giao

- Sau khi lưu bằng chứng, dùng cleanup-h2.sql với đúng prefix vừa kiểm thử.
- Chạy SELECT preview trước. Script chỉ xóa bốn cặp có code chính xác trong đúng tenant, cùng workspace/journal/membership liên quan.
- Không reset schema hoặc xóa WS-DEMO. Không thêm dữ liệu nghiệp vụ khác vào các fixture QA.
- Chạy lại bằng setup mới; không kỳ vọng restart sẽ reset cặp đã dùng.

Bộ ảnh đề xuất:

| AC | Bằng chứng |
| --- | --- |
| AC08 | 201 lần đầu + 409 khác key + workspaceId cũ + DB không tăng |
| AC09 | Hai 201 giống response/key/body + 409 đổi body + journal không tăng |
| AC10 | DB = 0 trước; hai POST song song 201/409; DB = 1 sau; report latch test |
| AC11 | Từng mã 401/403/404/422/409; thay đổi sau confirmation nếu áp dụng; DB không phát sinh |
| AC12 | 7 test fault-injection/audit-redelivery PASS + source assertions + ảnh audit thành công |
| AC13 | Cancel giữ lọc/không tạo; Pending disabled/một POST; lỗi rồi Try again cùng key/body |

