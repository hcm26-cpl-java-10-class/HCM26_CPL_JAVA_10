# US-GIT-001 · Kết nối GitHub App — Implementation Plan

> As a Project Manager, I want to install the authorized GitHub App into my GitHub organization or account, so that the platform can access my team's repositories without my GitHub password.

Trạng thái: **Backend đã triển khai** (package `system/git_integration`, test `GitHubConnectIntegrationTest`, `RestGitHubApiClientTest`) · Frontend: chưa · Branch: `feat/git-integration`.
Mặc định đang dùng cho Q1/Q2: `GIT_INTEGRATION_MANAGE` cấp cho `ADMIN` và role `PM` (nếu có); một project được nối nhiều installation.

---

## 0. Quyết định thiết kế (cần team xác nhận trước khi code)

| # | Quyết định | Lý do / bám hệ thống |
|---|---|---|
| D1 | **Kết nối gắn với `Project`** (master project, bảng `projects`), không gắn với team/workspace | US nói "Project Manager của master project". `Project` có `tenantId`; team/workspace trỏ về project nên các US sau (link repo cho team) dùng lại được kết nối này |
| D2 | **Quyền = permission mới `GIT_INTEGRATION_MANAGE` + `GIT_INTEGRATION_READ`** | Hệ thống phân quyền theo permission (`WorkspaceAccessService.permitted`). Hiện không có role "Project Manager" ở cấp project (`ProjectRole` chỉ có TEAM_LEADER, DEV…), role hệ thống `PM` có thể có hoặc không → cấp quyền qua permission, seed cho `ADMIN` (tự có mọi permission) và role `PM` nếu tồn tại. Đây là phần "người có quyền quản lý tích hợp" trong business rule |
| D3 | **Phạm vi dữ liệu**: project phải cùng tenant với user, đang active | Dùng lại `WorkspaceAccessService.requireUser` / `requireProject` |
| D4 | **Không lưu token nào trong DB** | User access token chỉ dùng 1 lần để xác minh rồi bỏ. Installation token sinh lại khi cần (TTL 1h) từ private key nằm ngoài DB. DB chỉ lưu `installation_id` + metadata công khai → thỏa rule "credential không nằm trong DB" mà không phải mã hóa |
| D5 | **State lưu ở DB** (bảng `git_integration_oauth_states`), không dùng Redis | Có dependency Redis nhưng chưa có code/config nào dùng; local chạy H2. State chỉ lưu **SHA-256 hash**, dùng 1 lần, hết hạn sau `app.github.state-ttl-seconds` (600s) |
| D6 | **Callback đi qua frontend**: GitHub → `/git-integration/github/callback` (FE) → `POST` backend kèm Bearer token | Access token chỉ gửi qua header `Authorization` (`axios.ts`, `JwtAuthenticationFilter`), redirect thẳng về backend sẽ không biết user. Endpoint vẫn qua Spring Security → AC03 trả 403 tự nhiên |
| D7 | **Một installation = một bản ghi** (unique `provider + installation_id`) | Rule "mỗi installation chỉ lưu một lần" (AC05). Nếu installation đã gắn với project khác → 409, không ghi đè |
| D8 | Schema tạo bằng JPA `ddl-auto=update` | Repo không dùng Flyway/Liquibase |
| D9 | API prefix `/api/v1/...` | Theo các controller mới (`/api/v1/classes`, `/api/v1/project-templates`) |

**Câu hỏi mở**
- Q1: "Project Manager" trong hệ thống tương ứng role nào? (role hệ thống `PM`, `PROGRAM_MANAGER`, hay `MENTOR`?) → quyết định role nào được seed `GIT_INTEGRATION_MANAGE`.
- Q2: Một project có thể có **nhiều** installation (vd. cả org lẫn account cá nhân) không? Plan này cho phép nhiều, mỗi installation một bản ghi; nếu chỉ cho 1 thì thêm unique `project_id` ở bảng connection.

---

## 1. Luồng tổng thể

```
PM (FE)                    Backend                                GitHub
  │ POST /projects/{id}/git-integration/github/connect
  │──────────────────────────▶ check auth + GIT_INTEGRATION_MANAGE (AC03)
  │                            tạo state (hash, user, project, exp)
  │◀────────── { installUrl?state=... }
  │ window.location = installUrl ─────────────────────────────────▶ cài App + authorize
  │                                                                 │ hủy ở trang cài → không redirect (AC02a)
  │◀──── redirect /git-integration/github/callback?code&installation_id&setup_action&state
  │      (hoặc ?error=access_denied&state=...)                      (AC02b)
  │ POST /git-integration/github/callback {state, code, installationId, setupAction, error}
  │──────────────────────────▶ 1. consume state: đúng user, chưa hết hạn, chưa dùng (AC04)
  │                            2. error=access_denied → 400 DENIED, không ghi gì (AC02)
  │                            3. đổi code → user token ───────────────▶ POST /login/oauth/access_token
  │                            4. GET /user/installations (user token) ─▶ installation_id ∈ list? (AC04)
  │                            5. GET /app/installations/{id} (App JWT) ─▶ account, selection, suspended
  │                            6. upsert theo installation_id (AC01, AC05), audit
  │◀────────── 200 { status: CONNECTED, account... }
```

`setup_action=request` (user không phải owner org, chỉ gửi yêu cầu cài): không có `installation_id` → trả `202 PENDING_APPROVAL`, không tạo kết nối.

---

## 2. Database

### 2.1 `git_integration_connections` — entity `GitIntegrationConnection extends BaseEntity`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | BIGINT PK | từ `BaseEntity` (+ `is_active`, `created_at`, `updated_at`, `created_by`, `updated_by`) |
| `tenant_id` | BIGINT NOT NULL | lấy từ project, phục vụ lọc tenant |
| `project_id` | BIGINT NOT NULL | FK logic → `projects.id` (D1) |
| `provider` | VARCHAR(20) NOT NULL | enum `GitProvider { GITHUB }` — chừa chỗ cho GitLab |
| `installation_id` | BIGINT NOT NULL | ID installation GitHub |
| `account_id` | BIGINT NOT NULL | GitHub account/org id (ổn định, không đổi khi rename) |
| `account_login` | VARCHAR(100) NOT NULL | hiển thị |
| `account_type` | VARCHAR(20) NOT NULL | `User` / `Organization` |
| `repository_selection` | VARCHAR(20) | `all` / `selected` |
| `status` | VARCHAR(20) NOT NULL | enum `GitConnectionStatus { CONNECTED, SUSPENDED, DISCONNECTED }` |
| `connected_by_user_id` | BIGINT NOT NULL | user nội bộ thực hiện kết nối gần nhất |
| `github_user_id` / `github_user_login` | BIGINT / VARCHAR(100) | GitHub user đã authorize (bằng chứng xác minh) |
| `connected_at` | TIMESTAMP NOT NULL | lần kết nối/kết nối lại gần nhất |
| `last_verified_at` | TIMESTAMP NOT NULL | |
| `version` | BIGINT | `@Version` chống ghi đè đồng thời |

Ràng buộc / index:
- `uk_git_connection_provider_installation (provider, installation_id)` — **AC05**
- `idx_git_connection_project (project_id, provider, is_active)`

**Không có cột nào chứa token / secret / private key.**

### 2.2 `git_integration_oauth_states` — entity `GitIntegrationOAuthState extends BaseEntity`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `state_hash` | CHAR(64) NOT NULL UNIQUE | SHA-256 hex của state ngẫu nhiên 32 byte (Base64URL). State thô chỉ trả cho FE, không lưu, không log |
| `user_id` | BIGINT NOT NULL | người bấm Connect — callback phải cùng user (AC04) |
| `project_id` | BIGINT NOT NULL | project lấy từ state, **không** tin `projectId` từ callback |
| `provider` | VARCHAR(20) NOT NULL | `GITHUB` |
| `expires_at` | TIMESTAMP NOT NULL | now + `state-ttl-seconds` |
| `consumed_at` | TIMESTAMP NULL | set khi callback xử lý (thành công hay thất bại) → dùng 1 lần |
| `outcome` | VARCHAR(30) NULL | `CONNECTED`, `RECONNECTED`, `DENIED`, `PENDING_APPROVAL`, `INVALID_INSTALLATION`… phục vụ audit |

Index: `idx_git_oauth_state_expires (expires_at)`. Dọn rác: `@Scheduled` xóa bản ghi hết hạn > 1 ngày (app đã `@EnableScheduling`).

### 2.3 Permission seed

Thêm `GitIntegrationPermissionInitializer` (`CommandLineRunner`, `@Order(1)`, mẫu như `WorkspacePermissionInitializer`):
- tạo `GIT_INTEGRATION_READ`, `GIT_INTEGRATION_MANAGE` (resource `GIT_INTEGRATION`).
- `ADMIN` tự nhận vì `RoleDataInitializer` gán toàn bộ permission (Order 2 chạy sau).
- cấp cho role `PM` (nếu tồn tại) — sửa trong `RoleDataInitializer` cạnh khối `findByName("PM")` hoặc trong initializer mới; chốt sau Q1.

---

## 3. Backend — cấu trúc package

```
system/git_integration/
├─ config/                       (đã có) GitHubAppProperties, GitHubAppCredentials, GitHubAppConfig, GitHubPrivateKeyLoader
├─ domain/
│  ├─ GitIntegrationConnection.java
│  ├─ GitIntegrationOAuthState.java
│  ├─ GitProvider.java, GitConnectionStatus.java, GitOAuthOutcome.java
├─ repository/
│  ├─ GitIntegrationConnectionRepository.java
│  └─ GitIntegrationOAuthStateRepository.java
├─ github/                       # chỉ nói chuyện với GitHub, không biết gì về project/user nội bộ
│  ├─ GitHubAppJwtFactory.java   # ký JWT RS256 (iss=appId, iat=now-60s, exp=now+jwtTtl) bằng jjwt 0.11.5
│  ├─ GitHubApiClient.java       # interface → dễ mock trong test
│  ├─ RestGitHubApiClient.java   # impl dùng gitHubRestClient
│  ├─ dto/ GitHubUserToken, GitHubInstallation, GitHubAccount, GitHubUser (record, @JsonIgnoreProperties(ignoreUnknown))
│  └─ GitHubApiException.java    # message không chứa code/token/response body
├─ service/
│  ├─ GitIntegrationAccessService.java   # wrap WorkspaceAccessService: requireManage(projectId), requireRead(projectId)
│  ├─ GitHubOAuthStateService.java       # issue(user, project) / consume(rawState, user)
│  ├─ GitHubConnectionService.java       # orchestration connect + callback + status
│  └─ GitHubOAuthStateCleanupJob.java
├─ dto/
│  ├─ GitHubConnectStartResponse.java    # { installUrl, expiresAt }
│  ├─ GitHubCallbackRequest.java         # { state*, code, installationId, setupAction, error, errorDescription }
│  ├─ GitHubConnectionResponse.java      # { id, status, accountLogin, accountType, repositorySelection, connectedAt, connectedBy }
│  └─ GitHubConnectionStatusResponse.java# { status: NOT_CONNECTED|CONNECTED|SUSPENDED, connections: [...] }
├─ exception/
│  ├─ GitIntegrationException.java       # mang errorCode + HttpStatus
│  └─ GitIntegrationExceptionHandler.java# @RestControllerAdvice(basePackages=git_integration) → ErrorResponse + code
└─ controller/
   ├─ ProjectGitIntegrationController.java   # /api/v1/projects/{projectId}/git-integration/github
   └─ GitHubCallbackController.java          # /api/v1/git-integration/github/callback
```

### 3.1 `GitHubApiClient` — các call cần cho US này

| Method | GitHub endpoint | Auth | Dùng cho |
|---|---|---|---|
| `exchangeCode(code)` | `POST {webBaseUrl}/login/oauth/access_token` (`client_id`, `client_secret`, `code`, `redirect_uri=callbackUrl`, `Accept: application/json`) | client secret | lấy user token. Lưu ý: endpoint này ở `github.com`, **không** phải `api.github.com` → không dùng `baseUrl` của `gitHubRestClient`, truyền URL tuyệt đối |
| `getAuthenticatedUser(userToken)` | `GET /user` | `Bearer userToken` | `github_user_id/login` |
| `userCanAccessInstallation(userToken, installationId)` | `GET /user/installations?per_page=100` (duyệt trang theo header `Link`) | `Bearer userToken` | **xác minh installation thuộc user (AC04)** |
| `getInstallation(installationId)` | `GET /app/installations/{id}` | `Bearer appJwt` | account, `repository_selection`, `suspended_at`; 404 → installation không thuộc App này |

Lỗi GitHub (401/403/404/5xx, timeout) → `GitHubApiException` với loại lỗi, không đính kèm body. Không retry `exchangeCode` (code chỉ dùng 1 lần).

### 3.2 `GitHubOAuthStateService`

- `issue(User, Project)`: `SecureRandom` 32 byte → Base64URL = `rawState`; lưu `sha256(rawState)`, `expiresAt`. Trả `rawState`.
- `consume(rawState, User)` trong `@Transactional`: tìm theo hash **với khóa ghi** (`@Lock(PESSIMISTIC_WRITE)`) →
  - không thấy / `consumedAt != null` / `expiresAt < now` → `GIT_STATE_INVALID` (400) — AC04
  - `userId != user.id` → `GIT_STATE_INVALID` (400, không tiết lộ là của người khác) — AC04
  - hợp lệ → set `consumedAt = now` **ngay**, kể cả khi bước sau thất bại (state không dùng lại được).

### 3.3 `GitHubConnectionService`

```java
GitHubConnectStartResponse startConnect(Long projectId);          // AC01 bước 1, AC03
GitHubConnectionResponse   handleCallback(GitHubCallbackRequest);  // AC01, AC02, AC04, AC05
GitHubConnectionStatusResponse getStatus(Long projectId);
```

`handleCallback` (thứ tự quan trọng):
1. `access.requireUser()` + `credentials.requireEnabled()` (503 `GIT_INTEGRATION_DISABLED` nếu tắt).
2. `state = stateService.consume(req.state, user)` → lấy `projectId` từ state.
3. `access.requireManage(user, projectId)` — kiểm tra **lại** quyền (có thể bị thu hồi trong 10 phút) → 403, không ghi gì (AC03).
4. `req.error == "access_denied"` → outcome `DENIED`, ném `GIT_AUTHORIZATION_DENIED` (400). **AC02**
5. `setupAction == "request"` & không có `installationId` → outcome `PENDING_APPROVAL`, trả 202.
6. Thiếu `code` hoặc `installationId` → `GIT_CALLBACK_INVALID` (400). **AC04**
7. `userToken = github.exchangeCode(code)` — lỗi → `GIT_CALLBACK_INVALID`.
8. `github.userCanAccessInstallation(userToken, installationId)` = false → `GIT_INSTALLATION_NOT_OWNED` (403). **AC04**
9. `installation = github.getInstallation(installationId)` — 404 → `GIT_INSTALLATION_NOT_OWNED`.
10. **Upsert** (bước duy nhất ghi DB, trong transaction riêng sau khi các call mạng đã xong):
    - `findByProviderAndInstallationId(GITHUB, id)`:
      - có & `projectId` khác → `GIT_INSTALLATION_LINKED_ELSEWHERE` (409), không đổi gì.
      - có & cùng project → cập nhật account/selection/status (`SUSPENDED` nếu `suspended_at != null`, ngược lại `CONNECTED`), `isActive=true`, `connectedBy`, `connectedAt`, `lastVerifiedAt` → outcome `RECONNECTED`. **AC05**
      - không có → insert, outcome `CONNECTED`. **AC01**
    - Hai request song song cùng installation: bắt `DataIntegrityViolationException` từ unique key → đọc lại và chạy nhánh cập nhật.
11. Ghi audit (outcome lên state; tùy chọn ghi `WorkspaceActivity`/log) — **không** ghi code/token.
12. `userToken` ra khỏi scope, không lưu.

> Không giữ transaction DB trong lúc gọi GitHub (bước 7–9): tránh khóa lâu và tránh rollback mất `consumedAt`. Bước 2 commit riêng (`REQUIRES_NEW` hoặc gọi qua bean khác).

### 3.4 `GitIntegrationAccessService`

```java
User requireUser();                                   // WorkspaceAccessService.requireUser(false) → 401 nếu chưa login
Project requireManage(User user, Long projectId);     // permitted(user,"GIT_INTEGRATION_MANAGE") else AccessDeniedException (403)
                                                      // + workspaceAccess.requireProject(user, projectId, false) (tenant, active)
Project requireRead(User user, Long projectId);       // GIT_INTEGRATION_READ hoặc MANAGE
```

Lưu ý: `WorkspaceAccessService.requireUser` đang đòi quyền `WORKSPACE_READ` — nếu role PM không có, viết `requireUser` riêng chỉ kiểm tra principal + active + tenant (copy phần đầu), không phụ thuộc quyền workspace.

---

## 4. API

Lỗi trả về theo `ErrorResponse` hiện có + thêm trường `code` (handler riêng của module để không đổi format chung).

### 4.1 `GET /api/v1/projects/{projectId}/git-integration/github`
Quyền: `GIT_INTEGRATION_READ | MANAGE`. Trả trạng thái để FE hiện **Connected / Not connected**.
```json
{ "status": "CONNECTED",
  "connections": [{ "id": 12, "status": "CONNECTED", "accountLogin": "my-org",
                    "accountType": "Organization", "repositorySelection": "selected",
                    "connectedAt": "2026-11-16T13:00:00", "connectedBy": { "id": 5, "name": "..." } }] }
```

### 4.2 `POST /api/v1/projects/{projectId}/git-integration/github/connect`
Quyền: `GIT_INTEGRATION_MANAGE`. Không body.
- `200` `{ "installUrl": "https://github.com/apps/demo-github-01/installations/new?state=...", "expiresAt": "..." }`
- `403` không có quyền — **AC03**, không tạo state
- `404` project không tồn tại / ngoài tenant
- `503 GIT_INTEGRATION_DISABLED`

### 4.3 `POST /api/v1/git-integration/github/callback`
Quyền: đã đăng nhập (kiểm tra `MANAGE` theo project trong state).
```json
{ "state": "…", "code": "…", "installationId": 123456, "setupAction": "install", "error": null }
```

| HTTP | `code` | Khi nào | AC |
|---|---|---|---|
| 200 | — | kết nối mới / kết nối lại, body = `GitHubConnectionResponse` (+ `"outcome": "CONNECTED" \| "RECONNECTED"`) | AC01, AC05 |
| 202 | `GIT_INSTALLATION_PENDING_APPROVAL` | org owner cần duyệt | — |
| 400 | `GIT_AUTHORIZATION_DENIED` | user từ chối cấp quyền | AC02 |
| 400 | `GIT_STATE_INVALID` | state sai / hết hạn / đã dùng / không phải của user | AC04 |
| 400 | `GIT_CALLBACK_INVALID` | thiếu code/installationId, đổi code thất bại | AC04 |
| 403 | (mặc định) | user không có `GIT_INTEGRATION_MANAGE` | AC03 |
| 403 | `GIT_INSTALLATION_NOT_OWNED` | installation không thuộc GitHub user đã authorize / không thuộc App | AC04 |
| 409 | `GIT_INSTALLATION_LINKED_ELSEWHERE` | installation đã gắn project khác | AC05 |
| 502 | `GIT_PROVIDER_UNAVAILABLE` | GitHub lỗi/timeout | — |

Mọi nhánh lỗi: **không tạo/sửa** `git_integration_connections`.

---

## 5. Bảo mật — checklist

- [ ] Không log `code`, `state` thô, user token, client secret, JWT. Log chỉ `installationId`, `projectId`, `userId`, outcome.
- [ ] `GlobalExceptionHandler.handleGlobalException` hiện trả `ex.getMessage()` ra client → `GitHubApiException` phải có message an toàn; module có handler riêng chạy trước.
- [ ] Response không bao giờ chứa token/secret (DTO tách biệt entity).
- [ ] `projectId` của callback lấy từ state, không từ request.
- [ ] State: 32 byte `SecureRandom`, lưu hash, TTL 10 phút, dùng 1 lần, gắn user.
- [ ] So sánh hash bằng truy vấn theo hash (không so chuỗi thô trong code).
- [ ] Kiểm tra lại quyền ở callback, không chỉ ở bước connect.
- [ ] GitHub App settings: Callback URL = `http://localhost:5173/git-integration/github/callback`; tick **Request user authorization (OAuth) during installation**; quyền repo tối thiểu (Metadata: read, Contents: read) cho tới khi US sau cần thêm.

---

## 6. Frontend (tóm tắt, để ước lượng)

- `src/api/gitIntegration.api.ts`: `getGitHubStatus(projectId)`, `startGitHubConnect(projectId)`, `submitGitHubCallback(payload)`.
- `src/types/features/git-integration.ts`: type cho các DTO ở mục 4.
- Trang/khối **Git Integration** trong project: hiện trạng thái, nút **Connect GitHub** (ẩn/disable khi không có `GIT_INTEGRATION_MANAGE` — kiểm tra bằng `rbac.utils.ts`); bấm → gọi 4.2 → `window.location.assign(installUrl)`.
- Route `/git-integration/github/callback`: đọc query → gọi 4.3 một lần (chống gọi 2 lần do StrictMode) → hiển thị thông báo theo `code` → điều hướng về trang project. `sessionStorage` lưu `projectId` để quay về.
- AC02 khi hủy ở trang cài (GitHub không redirect): trạng thái vẫn **Not connected**; khi user quay lại trang project hiện hint "Chưa hoàn tất kết nối".

---

## 7. Test plan (backend)

Đặt tại `backend/src/test/java/com/example/starter_project_2025/system/git_integration/`.

| Test | Loại | Nội dung |
|---|---|---|
| `GitHubOAuthStateServiceTest` | unit | issue lưu hash ≠ raw; consume hợp lệ set `consumedAt`; hết hạn / dùng lại / sai user → `GIT_STATE_INVALID` |
| `GitHubAppJwtFactoryTest` | unit | JWT RS256, `iss=appId`, `exp-iat ≤ 600`, verify bằng public key |
| `GitHubConnectionServiceTest` | unit (mock `GitHubApiClient`, repos) | AC01 insert; AC05 update cùng bản ghi, không insert; AC02 denied không ghi; AC04 installation không thuộc user không ghi; 409 project khác; pending approval |
| `ProjectGitIntegrationControllerTest` | `@SpringBootTest` + MockMvc | AC03: user thiếu `GIT_INTEGRATION_MANAGE` → 403 và không có state/connection mới; chưa login → 401 |
| `GitHubCallbackIntegrationTest` | `@SpringBootTest` + `@MockBean GitHubApiClient` | luồng đầy đủ connect → callback → status CONNECTED; callback lần 2 cùng state → 400; reconnect → vẫn 1 bản ghi |
| `RestGitHubApiClientTest` | `MockRestServiceServer` | map response GitHub, phân trang `/user/installations`, lỗi không lộ body |

Lưu ý: test context trên máy có `backend/.env` sẽ bật GitHub App thật → test integration đặt `@TestPropertySource(properties = "app.github.enabled=true", ...)` với key sinh trong test, hoặc mock `GitHubApiClient` để không gọi mạng.

Kiểm tra thủ công (demo):
1. Login user có quyền → Connect → cài App vào account test → thấy Connected.
2. Connect lại cùng account → vẫn 1 bản ghi, `connected_at` đổi.
3. Từ chối authorize → thông báo từ chối, không có bản ghi.
4. Sửa `state` trên URL callback → lỗi, không có bản ghi.
5. Login user không có quyền → gọi API connect → 403.

---

## 8. Thứ tự triển khai & chia việc (2 người)

| Bước | Việc | Người | Phụ thuộc |
|---|---|---|---|
| 1 | Merge phần cấu hình hiện tại (`config/`, properties, `.env` loader) | A | — |
| 2 | Domain + repository + permission initializer | A | 1 |
| 3 | `GitHubAppJwtFactory`, `GitHubApiClient` + `RestGitHubApiClient` + test | B | 1 |
| 4 | `GitHubOAuthStateService` + cleanup job + test | A | 2 |
| 5 | `GitIntegrationAccessService`, `GitHubConnectionService` (dùng `GitHubApiClient` interface — mock được khi bước 3 chưa xong) + test | A | 2, 4 |
| 6 | Controllers, exception handler, Swagger annotations | A | 5 |
| 7 | Frontend: API, types, nút Connect, route callback | B | hợp đồng API mục 4 (làm song song với 5–6) |
| 8 | Integration test + demo thủ công trên GitHub thật | A + B | 3, 6, 7 |

Kiểm tra trước PR: `cd backend && ./mvnw test`, `cd frontend && npm run build && npm run lint`. PR ghi rõ: **thay đổi DB** (2 bảng mới, 2 permission mới), **thay đổi cấu hình** (`app.github.*`, `spring.config.import`).

---

## 9. Ngoài phạm vi US này (để dành US sau)

- Webhook (`installation.deleted`, `installation.suspend`, `installation_repositories`) để tự cập nhật trạng thái → cần Webhook URL public (smee.io/ngrok) + `GITHUB_APP_WEBHOOK_SECRET`.
- Ngắt kết nối (Disconnect), liệt kê repo, gắn repo cho team.
- Cache installation access token.
