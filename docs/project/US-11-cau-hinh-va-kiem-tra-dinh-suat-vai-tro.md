### 5.2.6. UC-US-11 – Cấu hình và kiểm tra định suất vai trò thành viên nhóm (Program Manager / Mentor)

> Mã use case: **US-11** — Configure &amp; Validate Team Member Role Quotas
> Phân hệ: Quản lý Mock Project — Project Template &amp; Team Allocation (Hub PRJ-02/03)

#### 5.2.6.1. Mục tiêu

Cho phép **Quản lý chương trình** cấu hình định suất nhân sự cho một phiên bản Project Template (số thành viên tối thiểu/tối đa, định suất tối thiểu cho từng vai trò PM / BA / DEV / QA và việc có cho phép kiêm nhiệm vai trò hay không), sau đó cho phép **Mentor** cấu hình vai trò cho từng thành viên của nhóm và **kiểm tra** cấu hình đó có thoả định suất của template hay không. Hệ thống chặn các cấu hình sai (thiếu vai trò bắt buộc, vượt định suất, kiêm nhiệm khi template không cho phép) bằng lỗi **422** kèm mô tả chi tiết theo từng vai trò, đồng thời ghi nhận audit và phát sự kiện thông báo.

#### 5.2.6.2. Tác nhân

- **Tác nhân chính:**
  - **Quản lý chương trình (Program Manager):** cấu hình định suất trên Project Template.
  - **Mentor / người quản lý phân nhóm:** cấu hình vai trò thành viên của nhóm trong phiên phân nhóm.
- **Tác nhân liên quan:**
  - **Quản trị viên (ADMIN):** có toàn bộ quyền, thực hiện được cả hai phần.
  - **Hệ thống:** lớp bảo mật JWT + RBAC, `TemplateVersionConfigurationService` / `ProjectTemplateService` (lưu định suất vào `constraints_json`), `ProjectTemplateValidator` (kiểm tra định suất hợp lệ), `ProjectTeamRoleService` (kiểm tra và lưu vai trò thành viên), `ProjectTemplateConstraints` (đọc `role_quotas` / `allow_multi_role`), `ProjectTemplateSnapshotAuditService` và `ProjectTeamAudit` / outbox (audit và sự kiện).

#### 5.2.6.3. Điều kiện trước

- Người dùng đã đăng nhập, JWT còn hiệu lực; tenant đang hoạt động và thuộc phạm vi dữ liệu được cấp.
- **Cấu hình định suất trên template:**
  - Có `PROJECT_TEMPLATE_UPDATE` và `PROJECT_TEMPLATE_VERSION_UPDATE` khi lưu qua phiên bản (hoặc `PROJECT_TEMPLATE_UPDATE` khi lưu trực tiếp trên template).
  - Project Template đang `DRAFT`; phiên bản đang `DRAFT`, là phiên bản mới nhất, đang active, chưa được dùng để sinh project và có cấu hình “canonical” (đủ `description`, `category`, `level`, `estimatedDurationWeeks`, `constraints`, `milestones`, `backlogItems`).
  - Người dùng có `lockVersion` hiện tại của template.
- **Cấu hình vai trò nhóm:**
  - Có `PEO_TEAM_ALLOCATE` hoặc `PRJ_WORKSPACE_MANAGE` trên lớp/phiên phân nhóm.
  - Phiên phân nhóm đang `OPEN` hoặc `PUBLISHED`; nhóm ở trạng thái `DRAFT` hoặc `ACTIVE`.
  - Nhóm đã được gán Project Template (định suất được lấy từ template đã gán).
  - `expectedVersion` của nhóm khớp với phiên bản hiện tại.

#### 5.2.6.4. Điều kiện sau

- `constraints_json` của template/phiên bản được cập nhật với các khóa:
  - `min_members`, `max_members`: số thành viên tối thiểu/tối đa;
  - `allow_multi_role`: cho phép một thành viên giữ nhiều vai trò hay không;
  - `role_quotas`: định suất tối thiểu của `PM`, `BA`, `DEV`, `QA` (giữ nguyên `max` nếu cấu hình đã có, và nâng `max` lên bằng `min` nếu `max` nhỏ hơn).
- Phiên bản được lưu; nếu template đang `DRAFT`, cấu hình cũng được áp dụng lên template và `contentJson` của phiên bản được làm mới.
- Audit `UPDATE_CONFIGURATION` được ghi cho phiên bản (khi lưu qua phiên bản) hoặc `PROJECT_TEMPLATE_TEAM_RULES_UPDATED` (khi lưu trực tiếp trên template).
- Khi cấu hình vai trò nhóm hợp lệ: `member_role` của từng thành viên được lưu dưới dạng danh sách chuẩn hoá (ví dụ `PM,BA`), mỗi thay đổi được ghi vào lịch sử thành viên (`ROLE_CHANGED`), audit `UPDATE_TEAM_MEMBER_ROLES` và outbox event `PROJECT_TEAM_MEMBER_ROLES_UPDATED`; API trả **204 No Content**.
- Khi cấu hình vai trò nhóm không hợp lệ: không có dữ liệu nào bị thay đổi, API trả **422** kèm `errorCode` và danh sách vi phạm để giao diện hiển thị theo từng vai trò.
- Sự kiện công bố nhóm (publish) cũng kiểm tra lại định suất và từ chối nhóm chưa đạt định suất.

#### 5.2.6.5. Kích hoạt

- **Cấu hình định suất:** người dùng mở Project Template → tab/phiên bản cấu hình → tab **Team constraints**, chỉnh các trường và bấm **“Save team rules”**.
- **Cấu hình vai trò nhóm:** Mentor mở màn hình Team Allocation của lớp → chọn phiên phân nhóm → mở chi tiết nhóm → chọn vai trò cho từng thành viên và bấm **“Lưu vai trò”** (nhóm `ACTIVE`) hoặc **“Lưu”** (nhóm `DRAFT`).

#### 5.2.6.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở Project Template → trang chi tiết → tab **Versions** → chọn phiên bản `DRAFT` mới nhất. |
| 2 | Hệ thống | Kiểm tra quyền đọc, tải cấu hình phiên bản (`GET /api/project-template-versions/{id}/configuration`) và hiển thị các tab cấu hình. |
| 3 | Người dùng | Mở tab **Team constraints**. |
| 4 | Hệ thống | Hiển thị form: **Minimum members**, **Maximum members**, **Minimum role quotas** (PM, BA, DEV, QA — mặc định `0`), công tắc **Allow multiple roles per member**, badge `Configured` / `Not configured` và tổng định suất tối thiểu. |
| 5 | Người dùng | Nhập min/max, định suất từng vai trò, bật/tắt kiêm nhiệm và bấm **“Save team rules”**. |
| 6 | Hệ thống | Kiểm tra phía client: min/max là số nguyên dương, min ≤ max; mỗi quota là số nguyên ≥ 0; tổng quota tối thiểu ≤ max. Nếu sai, hiển thị lỗi tại trường và **không** gửi request. |
| 7 | Hệ thống | Gửi `PUT /api/project-template-versions/{id}/configuration/team-constraints` với body `{minMembers, maxMembers, roleQuotas: {pm, ba, dev, qa}, allowMultiRole, lockVersion}`. |
| 8 | Hệ thống | Kiểm tra `PROJECT_TEMPLATE_UPDATE` + `PROJECT_TEMPLATE_VERSION_UPDATE`; kiểm tra phiên bản còn editable (DRAFT, mới nhất, active, chưa dùng bởi project, canonical) và `lockVersion` khớp (**409** nếu dữ liệu đã thay đổi). |
| 9 | Hệ thống | `validateTeamConstraints`: min/max là số nguyên ≥ 1; min ≤ max; quota từng vai trò là số nguyên ≥ 0; tổng quota ≤ max; `roleQuotas` và `allowMultiRole` bắt buộc. |
| 10 | Hệ thống | Ghi các khóa `min_members`, `max_members`, `allow_multi_role`, `role_quotas` vào `constraints_json` (giữ `max` cũ của từng vai trò nếu có), lưu phiên bản; nếu template đang `DRAFT` thì áp dụng lên template và làm mới `contentJson`; ghi audit `UPDATE_CONFIGURATION`. |
| 11 | Hệ thống | Trả `200 OK` kèm cấu hình phiên bản mới; giao diện cập nhật badge **Configured**, tổng định suất và toast “Team rules saved successfully.”. |
| 12 | Người dùng | Mentor mở màn hình Team Allocation của lớp, chọn phiên phân nhóm và mở chi tiết một nhóm đã gán Project Template. |
| 13 | Hệ thống | Hiển thị danh sách thành viên, badge định suất của đề bài (ví dụ `PM 1/1`, `DEV 2/3`), trạng thái kiêm nhiệm và các gap hiện tại (nếu có). |
| 14 | Người dùng | Chọn vai trò cho từng thành viên (chọn nhiều vai trò nếu template cho phép kiêm nhiệm) và bấm **“Lưu vai trò”**. |
| 15 | Hệ thống | Kiểm tra phía client: mọi thành viên phải có ít nhất một vai trò; nếu không kiêm nhiệm thì đúng một vai trò; hiển thị cảnh báo nếu còn gap định suất. |
| 16 | Hệ thống | Gửi `PUT /api/v1/classes/{classId}/allocation-sessions/{sessionId}/teams/{teamId}/roles` với body `{expectedVersion, members: [{memberId, roles: [...]}]}`. |
| 17 | Hệ thống | Kiểm tra quyền `PEO_TEAM_ALLOCATE` / `PRJ_WORKSPACE_MANAGE`; kiểm tra phiên `OPEN`/`PUBLISHED`, nhóm `DRAFT`/`ACTIVE`; `expectedVersion` khớp (**409** nếu không); mọi thành viên thuộc nhóm, có vai trò hợp lệ và được cung cấp đủ (**422** `ERR_INVALID_TEAM_MEMBER_ROLES` nếu thiếu/sai). |
| 18 | Hệ thống | `validateTemplatePolicy`: nếu `allow_multi_role = false` mà có thành viên giữ nhiều vai trò → **422** `ERR_MULTI_ROLE_NOT_ALLOWED`; đếm số thành viên theo từng vai trò, so với `role_quotas` → thiếu/vượt định suất trả **422** `ERR_TEAM_ROLE_QUOTA_NOT_MET` kèm `violations` (`role`, `reason`, `required`, `actual`). |
| 19 | Hệ thống | Lưu `member_role` đã chuẩn hoá, ghi lịch sử `ROLE_CHANGED` cho từng thành viên, audit `UPDATE_TEAM_MEMBER_ROLES` và outbox `PROJECT_TEAM_MEMBER_ROLES_UPDATED`; trả **204 No Content**. |
| 20 | Hệ thống | Giao diện cập nhật badge định suất theo dữ liệu máy chủ và thông báo lưu thành công. |

#### 5.2.6.7. Luồng thay thế và ngoại lệ

**5.2.6.7.1. Định suất cấu hình không hợp lệ**

- Min/max không phải số nguyên dương: **422** với lỗi `minMembers` / `maxMembers`: “Minimum members must be a positive whole number” / “Maximum members must be a positive whole number”.
- Min lớn hơn max: **422** với cùng thông điệp “Minimum members must not exceed maximum members” trên cả hai trường.
- Quota âm hoặc không phải số nguyên: **422** với lỗi `roleQuotas.pm` / `.ba` / `.dev` / `.qa`: “&lt;ROLE&gt; minimum must be a whole number of 0 or greater”.
- Tổng quota tối thiểu lớn hơn max members: **422** với lỗi `roleQuotas`: “Total minimum role quotas must not exceed maximum members”.
- Thiếu `roleQuotas`: **422** “Enter the minimum number for PM, BA, DEV and QA”; thiếu `allowMultiRole`: **422** “Choose whether members can hold multiple roles”.
- Giao diện giữ nguyên dữ liệu đã nhập, tô đỏ đúng trường lỗi.

**5.2.6.7.2. Phiên bản/template không còn cho phép sửa**

- Template không ở `DRAFT` (lưu trực tiếp trên template): **409** “Only draft templates can be edited”.
- Phiên bản không phải bản `DRAFT` mới nhất/đang active: **409** “Only the latest draft version can be edited or published”.
- Phiên bản đã được dùng để sinh project: **409** “This version is already used by a project. Create a new version instead”.
- Phiên bản legacy không đủ cấu trúc canonical: **422** “This legacy version is read-only. Duplicate it to create a complete template”.
- Phiên bản là workspace snapshot: **403** “Workspace snapshots cannot be edited as template versions”.

**5.2.6.7.3. Dữ liệu đã bị thay đổi bởi người khác**

- `lockVersion` không khớp: **409** “This template has changed. Reload it before saving your changes”.
- Khi lưu vai trò nhóm, `expectedVersion` không khớp: **409** `ERR_TEAM_VERSION_CONFLICT`; giao diện yêu cầu tải lại nhóm.

**5.2.6.7.4. Thiếu quyền hoặc sai trạng thái phiên/nhóm**

- Thiếu quyền cấu hình template: **403 Forbidden**; thiếu `PEO_TEAM_ALLOCATE` / `PRJ_WORKSPACE_MANAGE`: **403 Forbidden**.
- Phiên phân nhóm không cho phép cập nhật vai trò: **400** “Phiên phân nhóm hiện không cho phép cập nhật vai trò”.
- Nhóm không ở `DRAFT`/`ACTIVE`: **400** “Chỉ có thể cập nhật vai trò cho nhóm DRAFT hoặc ACTIVE”.
- Chưa đăng nhập/token hết hạn: **401 Unauthorized**.

**5.2.6.7.5. Vai trò thành viên không hợp lệ**

- Thiếu vai trò cho một thành viên, vai trò không thuộc `PM/BA/DEV/QA`, thành viên không thuộc nhóm, hoặc danh sách gửi lên không bao phủ đủ thành viên: **422** `ERR_INVALID_TEAM_MEMBER_ROLES` với `invalidMemberIds` và thông điệp “Vui lòng chọn vai trò hợp lệ cho từng thành viên trong nhóm”.
- Không có dữ liệu nào được lưu.

**5.2.6.7.6. Kiêm nhiệm vai trò không được phép**

- Template có `allow_multi_role = false` nhưng một thành viên được gán nhiều vai trò: **422** `ERR_MULTI_ROLE_NOT_ALLOWED` kèm `multiRoleMemberIds` và thông điệp “Đề bài dự án không cho phép kiêm nhiệm vai trò. Mỗi thành viên chỉ được đảm nhận đúng 1 vai trò.”.

**5.2.6.7.7. Không đạt định suất vai trò của template**

- Thiếu vai trò bắt buộc (actual &lt; min) hoặc vượt định suất (actual &gt; max) sau khi đếm số thành viên theo vai trò: **422** `ERR_TEAM_ROLE_QUOTA_NOT_MET` với `violations` dạng `{role, reason, required, actual}`, `reason` là `MISSING_REQUIRED_ROLE` hoặc `ROLE_QUOTA_EXCEEDED`.
- Thông điệp tổng hợp: “Cấu hình vai trò chưa đáp ứng định suất của đề bài. Còn thiếu vai trò bắt buộc: … / Vượt định suất: …”.
- Giao diện hiển thị danh sách vi phạm theo vai trò và giữ nguyên lựa chọn để Mentor sửa.

**5.2.6.7.8. Công bố nhóm khi chưa đạt định suất**

- Khi publish nhóm, hệ thống kiểm tra lại `role_quotas`; nhóm thiếu vai trò bắt buộc/vượt định suất hoặc có kiêm nhiệm không được phép bị từ chối với `TeamPublishValidationException` và thông điệp tương ứng.

**5.2.6.7.9. Lỗi máy chủ hoặc mất kết nối**

- Hệ thống trả **500 Internal Server Error**; giao diện hiển thị thông báo lỗi và giữ nguyên dữ liệu để người dùng thử lại.

#### 5.2.6.8. Quy tắc nghiệp vụ và ghi chú

1. Định suất gồm: `min_members` ≥ 1, `max_members` ≥ 1, `max_members` ≥ `min_members`; mỗi quota vai trò `PM/BA/DEV/QA` là số nguyên ≥ 0.
2. Tổng các quota tối thiểu không được vượt quá `max_members`, **kể cả khi** template cho phép kiêm nhiệm vai trò.
3. `allow_multi_role` bắt buộc khi lưu; template cũ/không có khóa này được hiểu là **không cho phép kiêm nhiệm** (`false`) và chưa có yêu cầu định suất.
4. Định suất được lưu trong `constraints_json` của template/phiên bản dưới dạng `min_members`, `max_members`, `allow_multi_role`, `role_quotas`. Khi ghi, mapper giữ nguyên `max` cũ của từng vai trò nếu có và nâng `max` lên bằng `min` nếu `max` nhỏ hơn `min`.
5. Việc lưu định suất qua phiên bản yêu cầu phiên bản `DRAFT` mới nhất, đang active, chưa dùng bởi project và có cấu hình canonical; template phải đang `DRAFT` để cấu hình được áp dụng ngược lên template.
6. Khi kiểm tra vai trò nhóm, hệ thống đếm **số lần xuất hiện của từng vai trò** trên tất cả thành viên; mỗi thành viên phải có ít nhất một vai trò hợp lệ.
7. Nếu `allow_multi_role = false`, mỗi thành viên chỉ được giữ đúng một vai trò; vi phạm trả `ERR_MULTI_ROLE_NOT_ALLOWED`.
8. Nếu vai trò nào có số người ít hơn `min` → `MISSING_REQUIRED_ROLE`; nếu vượt quá `max` (khi có upper bound) → `ROLE_QUOTA_EXCEEDED`; tất cả vi phạm được trả trong một response 422.
9. Nhóm chưa gán Project Template sử dụng chính sách mặc định: không kiêm nhiệm, không yêu cầu định suất; giao diện nhắc “Gán đề bài dự án để áp dụng định suất và quy tắc kiêm nhiệm vai trò.”.
10. Mọi thay đổi vai trò thành viên được ghi lịch sử `ROLE_CHANGED`, audit `UPDATE_TEAM_MEMBER_ROLES` (before/after, correlation ID) và outbox event `PROJECT_TEAM_MEMBER_ROLES_UPDATED`.
11. Lưu định suất trên template ghi audit `PROJECT_TEMPLATE_TEAM_RULES_UPDATED`; lưu qua phiên bản ghi audit `UPDATE_CONFIGURATION` kèm before/after của phiên bản.
12. Công bố nhóm kiểm tra lại toàn bộ định suất và quy tắc kiêm nhiệm; không thể publish một nhóm chưa đạt định suất.
13. Quyền: cấu hình định suất cần `PROJECT_TEMPLATE_UPDATE` và (với API phiên bản) `PROJECT_TEMPLATE_VERSION_UPDATE`; cấu hình vai trò nhóm cần `PEO_TEAM_ALLOCATE` hoặc `PRJ_WORKSPACE_MANAGE`.

#### 5.2.6.9. Minh chứng kiểm thử Backend trên Swagger

##### 5.2.6.9.1. API cấu hình định suất vai trò của phiên bản template

- **API:** `PUT /api/project-template-versions/{id}/configuration/team-constraints`
- **Header:** `Authorization: Bearer <access_token>`.
- **Dữ liệu gửi lên:**

```json
{
  "minMembers": 4,
  "maxMembers": 6,
  "roleQuotas": {
    "pm": 1,
    "ba": 1,
    "dev": 2,
    "qa": 1
  },
  "allowMultiRole": false,
  "lockVersion": 3
}
```

- **Kết quả mong đợi:** `200 OK`, trả về `TemplateVersionConfigurationResponse` với `template.teamConstraints = {minMembers: 4, maxMembers: 6, roleQuotas: {pm: 1, ba: 1, dev: 2, qa: 1}, allowMultiRole: false}`, `editable = true`; audit `UPDATE_CONFIGURATION` được ghi nhận.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.6-1. Kết quả kiểm thử API cấu hình định suất vai trò trên Swagger**

##### 5.2.6.9.2. API lưu và kiểm tra vai trò thành viên của nhóm

- **API:** `PUT /api/v1/classes/{classId}/allocation-sessions/{sessionId}/teams/{teamId}/roles`
- **Header:** `Authorization: Bearer <access_token>`.
- **Dữ liệu gửi lên:**

```json
{
  "expectedVersion": 2,
  "members": [
    { "memberId": 11, "roles": ["PM"] },
    { "memberId": 12, "roles": ["BA"] },
    { "memberId": 13, "roles": ["DEV"] },
    { "memberId": 14, "roles": ["QA"] }
  ]
}
```

- **Kết quả mong đợi:** `204 No Content` khi cấu hình thoả định suất; lịch sử `ROLE_CHANGED`, audit `UPDATE_TEAM_MEMBER_ROLES` và outbox `PROJECT_TEAM_MEMBER_ROLES_UPDATED` được ghi nhận. Nếu thiếu vai trò bắt buộc (ví dụ bỏ `QA`), API trả **422** với `errorCode = "ERR_TEAM_ROLE_QUOTA_NOT_MET"` và `violations = [{role: "QA", reason: "MISSING_REQUIRED_ROLE", required: 1, actual: 0}]`.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.6-2. Kết quả kiểm thử API lưu/kiểm tra vai trò thành viên trên Swagger**

#### 5.2.6.10. Màn hình Frontend

Hai màn hình của use case:

- **Team constraints** trong cấu hình phiên bản Project Template: các trường **Minimum members**, **Maximum members**, **Minimum role quotas** (PM/BA/DEV/QA), công tắc **Allow multiple roles per member**, badge `Configured`/`Not configured`, tổng định suất tối thiểu và nút **“Save team rules”**.
- **Team Allocation** của lớp: danh sách thành viên nhóm kèm bộ chọn vai trò, badge định suất của đề bài (`PM 1/1`, `DEV 2/3`…), trạng thái kiêm nhiệm, cảnh báo gap và nút **“Lưu vai trò”**.

Ảnh chụp cần thể hiện: (1) form Team constraints đã nhập min/max và quota, và (2) màn hình cấu hình vai trò nhóm với badge định suất cùng một trường hợp lỗi định suất (422) hiển thị danh sách vai trò còn thiếu/vượt.

**Hình 5.2.6-3. Màn hình cấu hình và kiểm tra định suất vai trò thành viên nhóm**
