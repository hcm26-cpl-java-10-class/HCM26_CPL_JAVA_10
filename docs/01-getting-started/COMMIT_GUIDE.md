# HƯỚNG DẪN COMMIT ĐÚNG CÁCH

> Dự án: **HCM26_CPL_JAVA_10** (Spring Boot 3 + Java 21 · React + Vite + TypeScript)
> Repo: `https://github.com/hcm26-cpl-java-10-class/HCM26_CPL_JAVA_10`
> Cập nhật lần cuối: October 27, 2026

---

## 0. Tóm tắt nhanh (Quick Reference)

```bash
# 1. Kiểm tra trạng thái trước khi commit
git status

# 2. Lấy code mới nhất từ nhánh đích (tránh conflict khi commit)
git fetch origin
git rebase origin/dev

# 3. Stage đúng file cần commit — KHÔNG dùng `git add .`
git add <file-1> <file-2>

# 4. Xem lại thay đổi sắp commit
git diff --staged

# 5. Commit theo Conventional Commits
git commit -m "feat(exam): add shareable anonymous link for students without account"

# 6. Đẩy lên nhánh của bạn
git push origin feature/exam_management

# 7. Mở Pull Request
gh pr create --base dev --title "..." --body "..."
```

> **Nguyên tắc số 1:** Một commit = một thay đổi logic. Không commit tất cả mọi thứ chung một lần.

---

## 1. Quy trình làm việc với Git trong dự án này

### 1.1. Cấu trúc nhánh

```
main          ← bản production, chỉ merge khi release
  └── dev    ← nhánh tích hợp chung, base cho mọi Pull Request
        └── feature/<tên-feature>   ← nhánh làm việc cá nhân
```

Quy tắc chọn base branch:

| Nhánh hiện tại của bạn | PR target |
|---|---|
| `feature/...` (đang phát triển tính năng) | `dev` |
| `main` / `dev` (sau khi tính năng xong, chuẩn bị release) | `main` |

> **Lưu ý:** Repo hiện có rất nhiều nhánh `feature/*` từ nhiều thành viên. Trước khi tạo nhánh mới, hãy kiểm tra `git branch -a` để tránh trùng tên với người khác.

### 1.2. Tạo nhánh mới

```bash
git checkout dev
git pull origin dev
git checkout -b feature/ten-tinh-nang-mo-tai
```

Đặt tên nhánh theo mẫu: `feature/`, `fix/`, `hotfix/`, `chore/`.

| Tiền tố | Dùng khi |
|---|---|
| `feature/` | Thêm tính năng mới |
| `fix/` | Sửa lỗi |
| `hotfix/` | Sửa lỗi gấp trên production |
| `chore/` | Việc không ảnh hưởng code (config, build, docs) |
| `refactor/` | Tái cấu trúc code, không thêm tính năng |

### 1.3. Đồng bộ với nhánh đích

Cách **khuyến nghị** — `rebase` (giữ lịch sử gọn, không tạo commit merge thừa):

```bash
git fetch origin
git rebase origin/dev
```

Nếu có conflict:

```bash
# 1. Mở file conflict, sửa tay cho đúng
# 2. Đánh dấu đã xử lý
git add <file-conflict>
# 3. Tiếp tục rebase
git rebase --continue
# 4. Hủy nếu không muốn giải quyết
git rebase --abort
```

> ⚠️ **Không dùng `git rebase` khi nhánh đã push lên remote và có người khác làm việc trên đó.** Khi đó dùng `git merge origin/dev` thay thế.

---

## 2. Quy ước commit message (Conventional Commits)

### 2.1. Cấu trúc

```
<type>(<scope>): <subject>

<body>

<footer>
```

| Thành phần | Bắt buộc | Quy tắc |
|---|---|---|
| `type` | ✅ | Xem bảng bên dưới |
| `scope` | ⬜ | Tên module/feature liên quan, trong ngoặc |
| `subject` | ✅ | Mô tả **hiện tại** (không dùng "đã sửa"), ≤ 72 ký tự, không kết thúc bằng dấu `.` |
| `body` | ⬜ | Giải thích **tại sao**, ngắt dòng ở 100 ký tự |
| `footer` | ⬜ | `BREAKING CHANGE:`, `Refs: #123`, `Co-authored-by:` |

### 2.2. Bảng `type`

| Type | Dùng khi | Ví dụ |
|---|---|---|
| `feat` | Thêm tính năng mới | `feat(exam): add QR code to shareable invitation link` |
| `fix` | Sửa lỗi | `fix(invitation): resolve 400 error when generating share link` |
| `docs` | Chỉ thay đổi tài liệu | `docs: add commit guide` |
| `style` | Định dạng, whitespace (không đổi logic) | `style: remove redundant blank lines` |
| `refactor` | Tái cấu trúc, không thêm/khắc feature | `refactor: extract guest user provisioning to GuestUserService` |
| `perf` | Tối ưu hiệu năng | `perf(exam): cache exam score aggregation` |
| `test` | Thêm/sửa test | `test: cover anonymous session expiry` |
| `build` | Build system, dependencies | `build: bump spring boot to 3.4.0` |
| `ci` | CI/CD pipeline | `ci: run backend tests on PR` |
| `chore` | Việc phụ (deps, config, gitignore) | `chore: ignore nested workspace folder` |
| `revert` | Hoàn tác commit trước | `revert: revert anonymous link generation` |

### 2.3. Bảng `scope` — dùng scope nào

| Scope | Module tương ứng |
|---|---|
| `exam` | `system/exam` — đề thi, câu hỏi, chấm điểm |
| `invitation` | Module Invitation (lời mời, QR, share link) |
| `rbac` | User, Role, Permission, Department |
| `question` | Bank câu hỏi, import/export CSV |
| `notification` | Email, thông báo |
| `auth` | Login, JWT, OAuth2 |
| `ui` | Component giao diện dùng chung |
| `student` | Trang/hành vi phía sinh viên |
| `teacher` | Trang/hành vi phía giảng viên |
| `admin` | Trang/hành vi phía quản trị |

Nếu thay đổi trải rộng nhiều module → **bỏ scope**, viết: `refactor: remove comments across codebase`.

### 2.4. Ví dụ thực tế từ dự án

```bash
# Tính năng mới
git commit -m "feat(invitation): generate shareable link without requiring student name and email"

# Sửa lỗi
git commit -m "fix(invitation): resolve 400 error when generating anonymous share link"

# Tái cấu trúc
git commit -m "refactor(exam): extract score formatting into examScore utility"

# Có body giải thích
git commit -m "feat(exam): send exam result email on anonymous submission

Guest students have no account in the RBAC system, so the result email
is the only way for them to receive their score.

- Add sendAnonymousExamResult to EmailService
- Add exam_result.html template
- Dispatch result right after submit"

# Breaking change
git commit -m "feat(exam): change attempt status enum values

BREAKING CHANGE: PENDING_SUBMIT has been renamed to IN_PROGRESS."
```

### 2.5. ❌ Anti-pattern — không được làm

```bash
git commit -m "update"                    # quá chung chung
git commit -m "fix bug"                  # không rõ bug gì
git commit -m "sửa lỗi"                  # không mô tả thay đổi
git commit -m "asdfgh"                   # không nghĩa
git commit -m "feat: add feature."       # thừa dấu chấm ở cuối
git commit -m "WIP"                      # đừng commit WIP lên remote
git commit -m "thêm code mới và fix bug ở chỗ khác"   # nhiều thay đổi trong 1 commit
```

> **Tiếng Anh hay tiếng Việt?** → **Dùng tiếng Anh** cho commit message. Đây là quy ước đã được thống nhất trong team (xem lịch sử `git log`).

---

## 3. Stage đúng file — không `git add .`

### 3.1. Vì sao không `git add .`

`git add .` sẽ stage **mọi thứ** trong thư mục, kể cả:
- File debug/tạm (`debug.log`, `test.txt`, `scratch.ts`)
- Secret (`application-local.properties`, `.env`)
- Artifact build (`target/`, `dist/`)
- Thay đổi của người khác do merge nhầm

Sau khi `git add .`, bạn phải `git reset` từng file — mất thời gian và dễ sót.

### 3.2. Cách stage đúng

```bash
git status                                    # xem file nào thay đổi
git diff                                       # xem nội dung thay đổi (chưa stage)
git add <file-cụ-thể>                          # stage file cụ thể
git add -p <file>                              # stage từng hunk (interactive)
git diff --staged                              # xem lại trước khi commit
```

### 3.3. Bảng chọn file theo loại thay đổi

| Loại | Lệnh stage |
|---|---|
| 1 file Java cụ thể | `git add backend/src/main/java/.../InvitationService.java` |
| Toàn bộ thư mục module | `git add backend/src/main/java/.../system/exam/` |
| File mới | `git add <đường-dẫn-file-mới>` (file mới phải add, `git add .` cũng add nhưng kèm rác) |
| Xoá file | `git rm <đường-dẫn>` hoặc `git add -A <đường-dẫn>` |
| Stage từng phần | `git add -p <file>` (chọn `y` / `n` từng hunk) |

### 3.4. File KHÔNG BAO GIỜ được commit

| File | Lý do |
|---|---|
| `backend/target/**` | Artifact build |
| `frontend/node_modules/**` | Dependency |
| `frontend/dist/**` | Artifact build |
| `**/.env`, `**/*.local` | Chứa secret |
| `backend/src/main/resources/application-local.properties` | Config máy local |
| `.idea/`, `.vscode/` | Config IDE cá nhân |
| `*.log` | Log runtime |
| `HCM26_CPL_JAVA_10/` (thư mục con) | Nested clone thừa |

Các pattern này đã có trong `.gitignore`. Nếu vô tình đã commit file nhạy cảm → xem mục 7.

### 3.5. Kiểm tra trước khi commit (safety check)

```bash
# Không có file build/secret trong staging
git diff --staged --name-only | grep -E "target/|node_modules/|\.env$|dist/"

# Không có debug code sót
git diff --staged | grep -nE "console\.log|System\.out\.print|debugger;|TODO|FIXME"

# Không có file quá lớn (>1MB)
git diff --staged --name-only | xargs -I{} sh -c 'test $(stat -c%s "{}") -gt 1048576 && echo "TOO BIG: {}"'
```

---

## 4. Kiểm tra chất lượng TRƯỚC khi commit

> **Không commit code không build được.** Đây là nguyên tắc số 2.

### 4.1. Backend (Spring Boot / Maven)

```bash
cd backend

# Compile — bắt lỗi Java
./mvnw compile

# Compile cả test
./mvnw test-compile

# Chạy toàn bộ test
./mvnw test
```

Trên Windows dùng `.\mvnw.cmd` thay cho `./mvnw`.

### 4.2. Frontend (React / TypeScript)

```bash
cd frontend

# Type check — bắt lỗi type
npx tsc --noEmit

# Lint
npm run lint

# Build production
npm run build
```

### 4.3. Checklist trước khi commit

- [ ] `cd backend && .\mvnw.cmd test` → **BUILD SUCCESS**
- [ ] `cd frontend && npx tsc --noEmit` → **không lỗi**
- [ ] `cd frontend && npm run lint` → **không lỗi mới**
- [ ] `git diff --staged` → đã đọc kỹ, đúng ý
- [ ] Không có `console.log` / `System.out.println` mới
- [ ] Không có file rác trong staging
- [ ] Commit message đúng Conventional Commits

---

## 5. Chia nhỏ commit (Atomic Commits)

### 5.1. Nguyên tắc

Một commit nên là **một thay đổi logic độc lập**, build & test được. Nếu commit của bạn cần mô tả bằng "và" (và), nên tách ra.

### 5.2. Ví dụ: một task gồm 3 phần

```
❌ Sai — 1 commit làm hết:
feat(invitation): add anonymous link, guest user service, and email result

✅ Đúng — 3 commit:
feat(invitation): add shareable link generation endpoint
feat(invitation): provision guest user on anonymous session
feat(invitation): send exam result email after anonymous submit
```

### 5.3. Cách tách commit khi đã sửa lẫn lộn

```bash
# Reset staging nhưng GIỮ nguyên thay đổi trong working tree
git reset

# Stage từng hunk, chỉ chọn phần thuộc commit đầu
git add -p <file>
git commit -m "feat(...): phần 1"

# Lặp lại cho phần tiếp theo
git add -p <file>
git commit -m "feat(...): phần 2"
```

### 5.4. Khi nào được phép gộp lại

- Viết lại message thuần tuý (chưa push) → `git commit --amend`
- Sửa message đã push → `git commit --amend` + `git push --force-with-lease`
- Gộp nhiều commit thành 1 (chưa push) → `git reset --soft HEAD~n` rồi commit lại

> ⚠️ **Không `git push --force` lên nhánh dùng chung.** Luôn dùng `--force-with-lease`.

---

## 6. Đẩy code lên remote & tạo Pull Request

### 6.1. Push

```bash
git push origin feature/exam_management

# Nếu branch mới, tạo luôn trên remote
git push -u origin feature/ten-moi
```

### 6.2. Tạo Pull Request

```bash
# Dùng GitHub CLI
gh pr create --base dev --title "feat(invitation): shareable link for students without account" --body "$(cat <<'EOF'
## Summary
- Teacher/Admin generates a shareable link + QR code without entering student details
- Student without an account enters name and email when opening the link
- Exam result is emailed to the student on submission

## Changes
- `AnonymousInvitationRequest`: make studentName/studentEmail optional
- `InvitationService`: accept student-supplied identity when creating anonymous session
- `GuestUserService`: auto-provision hidden guest user
- `CreateInvitationModal`: remove student name/email inputs

## Testing
- [x] `mvnw test` — BUILD SUCCESS
- [x] `tsc --noEmit` — clean
- [ ] Manual test: open link as guest student, take exam, receive result email
EOF
)"
```

### 6.3. Title và body của PR

| Phần | Quy tắc |
|---|---|
| Title | Giống hệt commit message chính, theo Conventional Commits |
| Summary | 2–4 dòng, nói feature làm được gì |
| Changes | Bullet list theo module/file |
| Testing | Checklist các bước đã verify |
| Screenshots | Nếu có thay đổi UI (bắt buộc với thay đổi UI) |
| Related | Link issue/task nếu có |

### 6.4. Trước khi tạo PR

```bash
git fetch origin
git rebase origin/dev     # đồng bộ code mới nhất
git push origin feature/exam_management
```

> **Luôn rebase trước khi push** để PR không bị conflict và lịch sử gọn.

---

## 7. Xử lý khi commit nhầm

### 7.1. Commit sai message (chưa push)

```bash
git commit --amend -m "message mới đúng"
```

### 7.2. Lỡ commit file nhạy cảm (secret, file rác)

```bash
# Xoá file khỏi staging nhưng giữ trong disk
git rm --cached <file>
git commit --amend --no-edit

# Nếu ĐÃ push → dùng filter-repo để xoá khỏi toàn bộ lịch sử
```

> ⚠️ **Secret đã push lên remote = phải rotate/revoke ngay lập tức**, kể cả khi xoá khỏi lịch sử sau. GitHub có cơ chế phát hiện push secret và tự động vô hiệu hoá.

### 7.3. Cần bỏ commit khỏi lịch sử (chưa push)

```bash
# Bỏ commit cuối, giữ thay đổi trong working tree
git reset --soft HEAD~1

# Bỏ commit cuối, bỏ luôn thay đổi (KHÔNG LÀM nếu chưa backup)
git reset --hard HEAD~1

# Bỏ 3 commit cuối
git reset --soft HEAD~3
```

### 7.4. Hoàn tác một commit đã push

```bash
# Tạo commit ngược lại (an toàn, giữ lịch sử)
git revert <commit-hash>
git push origin <branch>
```

---

## 8. .gitignore — kiểm tra định kỳ

File `.gitignore` hiện tại của dự án đã cover:

```
.idea/  *.iml  .vscode/           # IDE
.DS_Store  Thumbs.db              # OS
backend/target/  backend/*.jar    # Backend build
backend/.env                      # Secret
frontend/node_modules/  frontend/dist/   # Frontend
frontend/.env  frontend/.env.local        # Secret
docker/.env                       # Secret
*.log                             # Log
```

Nếu phát hiện file mới cần ignore, thêm vào `.gitignore` và commit riêng:

```bash
git add .gitignore
git commit -m "chore: ignore nested workspace folder"
```

---

## 9. Quy trình đầy đủ — checklist cho 1 task

```
┌─────────────────────────────────────────────┐
│ 1. TẠO NHÁNH                                 │
│    git checkout dev && git pull              │
│    git checkout -b feature/xxx               │
├─────────────────────────────────────────────┤
│ 2. VIẾT CODE                                  │
│    + tự kiểm tra trên browser                │
├─────────────────────────────────────────────┤
│ 3. KIỂM TRA CHẤT LƯỢNG                       │
│    cd backend && .\mvnw.cmd test              │
│    cd frontend && npx tsc --noEmit            │
│    cd frontend && npm run lint                │
├─────────────────────────────────────────────┤
│ 4. STAGE CẨN THẬN                             │
│    git status → git add <file cụ thể>         │
│    git diff --staged → đọc kỹ                │
├─────────────────────────────────────────────┤
│ 5. COMMIT (1 task = 1 commit)                 │
│    git commit -m "feat(scope): mô tả"         │
├─────────────────────────────────────────────┤
│ 6. ĐỒNG BỘ & PUSH                            │
│    git fetch origin && git rebase origin/dev  │
│    git push origin feature/xxx                │
├─────────────────────────────────────────────┤
│ 7. TẠO PULL REQUEST                           │
│    gh pr create --base dev                    │
└─────────────────────────────────────────────┘
```

---

## 10. Nhanh tắc dành cho người vội

```bash
# 1 commit gọn, đúng chuẩn
git add <file> && git commit -m "feat(exam): add X feature"

# Sửa message vừa commit
git commit --amend

# Xem thay đổi chưa commit
git diff

# Xem thay đổi đã stage
git diff --staged

# Bỏ stage (giữ thay đổi)
git reset

# Hủy mọi thay đổi chưa commit (DANGEROUS)
git restore .

# Đồng bộ với dev
git fetch origin && git rebase origin/dev

# Push
git push origin <branch>
```

---

## 11. Về repo này

| Mục | Chi tiết |
|---|---|
| Remote | `origin` → `https://github.com/hcm26-cpl-java-10-class/HCM26_CPL_JAVA_10.git` |
| Nhánh hiện tại | `feature/exam_management` |
| Base branch cho PR | `dev` |
| Backend | Spring Boot 3, Java 21, Maven — `cd backend && .\mvnw.cmd test` |
| Frontend | React 18 + Vite + TypeScript — `cd frontend && npx tsc --noEmit` |
| Quy ước message | Conventional Commits, tiếng Anh |
| Quy ước code | Không comment thừa trong code, UI dùng tiếng Anh |

> **Lưu ý:** Trước khi tạo PR, đảm bảo đã `git fetch origin && git rebase origin/dev` — nhánh `dev` có người khác push thường xuyên nên conflict rất dễ xảy ra nếu bạn dựa trên bản cũ.

---

**Nếu gặp lỗi git mà không biết xử lý, hãy dùng `git status` trước — nó thường chỉ ra đúng hướng xử lý. Không bao giờ chạy `git reset --hard` khi chưa chắc thay đổi đã được commit hoặc backup.**
