# ============================================================================
# E2E test: Flow "Share link" cho hoc sinh KHONG co tai khoan (anonymous)
#
#   Teacher/Admin  -> tao link (KHONG can nhap ten/email)
#   Student (no account) -> mo link -> nhap TEN + EMAIL -> lam bai -> nop bai
#
# Script nay goi truc tiep API thật, nen backend phai dang chay.
# Thong tin dang nhap lay tu bien moi truong (E2E_EMAIL / E2E_PASSWORD),
# fallback ve tai khoan dev neu chua dat.
#
# Usage (backend dang chay):
#   $env:E2E_EMAIL="teacher@example.com"; $env:E2E_PASSWORD="your-password"
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\e2e-anon-test.ps1 `
#       -BaseUrl "http://localhost:8082"
# ============================================================================

param(
    [string]$BaseUrl = "http://localhost:8082",
    [string]$Email = $(if ($env:E2E_EMAIL) { $env:E2E_EMAIL } else { "admin@example.com" }),
    [string]$Password = $(if ($env:E2E_PASSWORD) { $env:E2E_PASSWORD } else { "password123" })
)

$ErrorActionPreference = "Stop"
$script:Fails = 0

function Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    [OK]   $msg" -ForegroundColor Green }
function Bad($msg)  { Write-Host "    [FAIL] $msg" -ForegroundColor Red; $script:Fails++ }
function Check($cond, $msg) { if ($cond) { Ok $msg } else { Bad $msg } }

# --------------------------------------------------------------------------
Step "1. Login as teacher/admin"
$login = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post `
    -Body (@{ email = $Email; password = $Password } | ConvertTo-Json) `
    -ContentType "application/json"
$token = $login.accessToken
Check ([bool]$token) "Login OK ($Email)"

$hdr = @{ Authorization = "Bearer $token" }

# --------------------------------------------------------------------------
Step "2. Find or create an active exam"
$exams = Invoke-RestMethod -Uri "$BaseUrl/api/exams" -Headers $hdr
$examList = @($exams.content) + @($exams)
$exam = $examList | Where-Object { $_.isActive -eq $true } | Select-Object -First 1
if (-not $exam) {
    $body = @{
        title = "E2E Anonymous Exam $(Get-Date -Format 'HHmmss')"
        description = "Auto-created by e2e-anon-test.ps1"
        durationMinutes = 15
        isActive = $true
        startTime = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        endTime = (Get-Date).AddDays(2).ToString("yyyy-MM-ddTHH:mm:ss")
    } | ConvertTo-Json
    $exam = Invoke-RestMethod -Uri "$BaseUrl/api/exams" -Method Post -Headers $hdr `
        -Body $body -ContentType "application/json"
    Ok "Created new exam id=$($exam.id)"
} else {
    Ok "Reusing active exam id=$($exam.id)"
}
$examId = $exam.id

# --------------------------------------------------------------------------
Step "2b. Dam bao de thi co cau hoi (truong hop DB trong)"
$examDetail = Invoke-RestMethod -Uri "$BaseUrl/api/exams/$examId" -Headers $hdr
if (@($examDetail.questions).Count -eq 0) {
    $qBody = @{
        content = "1 + 1 = ?"
        type = "MULTIPLE_CHOICE"
        difficulty = "EASY"
        points = 10
        isActive = $true
        options = @(
            @{ content = "1"; correct = $false }
            @{ content = "2"; correct = $true }
        )
    } | ConvertTo-Json -Depth 6
    $q = Invoke-RestMethod -Uri "$BaseUrl/api/questions" -Method Post -Headers $hdr `
        -Body $qBody -ContentType "application/json"
    Ok "Created question id=$($q.id)"

    Invoke-RestMethod -Uri "$BaseUrl/api/exams/$examId/questions" -Method Post -Headers $hdr `
        -Body (@{ questionIds = @($q.id) } | ConvertTo-Json) -ContentType "application/json" | Out-Null
    Ok "Attached question to exam $examId"
} else {
    Ok "Exam already has $(@($examDetail.questions).Count) question(s)"
}

# --------------------------------------------------------------------------
Step "3. Teacher tao share link (KHONG truyen ten/email)"
$req = @{ maxAccessAttempts = 2 } | ConvertTo-Json
$inv = Invoke-RestMethod -Uri "$BaseUrl/api/exams/$examId/invitations/anonymous" `
    -Method Post -Headers $hdr -Body $req -ContentType "application/json"
Check ($null -ne $inv.accessCode) "Link created, accessCode = $($inv.accessCode)"
Check ($null -eq $inv.guestName)  "guestName = null (teacher khong nhap)"
Check ($null -eq $inv.guestEmail) "guestEmail = null (teacher khong nhap)"

# --------------------------------------------------------------------------
Step "3b. GV co the nhap email -> link duoc gui cho hoc sinh (optional)"
$invMail = Invoke-RestMethod -Uri "$BaseUrl/api/exams/$examId/invitations/anonymous" `
    -Method Post -Headers $hdr `
    -Body (@{
        maxAccessAttempts = 1
        studentName = "Mail Student"
        studentEmail = "mail.$([DateTimeOffset]::Now.ToUnixTimeSeconds())@example.com"
    } | ConvertTo-Json) -ContentType "application/json"
Check ($invMail.guestEmail -like "mail.*@example.com") "guestEmail duoc luu: $($invMail.guestEmail)"

# --------------------------------------------------------------------------
Step "4. Verify access code (public)"
$verify = Invoke-RestMethod -Uri "$BaseUrl/api/exams/verify-access/$($inv.accessCode)"
Check ($verify.valid -eq $true) "Code verifies as valid"

# --------------------------------------------------------------------------
Step "5. Student (no account) nhap TEN + EMAIL de doi sessionToken"
$studentName = "Nguyen Van A"
$studentEmail = "sv.test.$([DateTimeOffset]::Now.ToUnixTimeSeconds())@example.com"
$sess = Invoke-RestMethod -Uri "$BaseUrl/api/exams/anonymous-session" -Method Post `
    -Body (@{
        accessCode = $inv.accessCode
        studentName = $studentName
        studentEmail = $studentEmail
    } | ConvertTo-Json) -ContentType "application/json"
Check ($sess.valid -eq $true) "Session created"
Check ($sess.sessionToken -ne $null) "sessionToken issued"
Check ($sess.studentName -eq $studentName) "Response echoes student name"

# --------------------------------------------------------------------------
Step "6. Bat dau lam bai"
$att = Invoke-RestMethod -Uri "$BaseUrl/api/exams/anonymous/attempt" -Method Post `
    -Headers @{ "X-Anonymous-Session" = $sess.sessionToken } `
    -Body (@{ sessionToken = $sess.sessionToken } | ConvertTo-Json) -ContentType "application/json"

$answerable = @($att.questions | Where-Object { $_.type -ne "ESSAY" -and @($_.options).Count -gt 0 })
$attId = $att.id
Check ($attId -ne $null) "Attempt started id=$attId"
Check ($answerable.Count -gt 0) "$($answerable.Count) answerable question(s)"

# --------------------------------------------------------------------------
Step "7. Luu dap an"
if ($answerable.Count -gt 0) {
    $answers = @(
        foreach ($q in $answerable) {
            @{
                questionId = $q.id
                selectedOptionIds = @($q.options[0].id)
            }
        }
    )
    # -InputObject de ConvertTo-Json giu nguyen mang (khong unwrap khi chi co 1 phan tu)
    $answersJson = ConvertTo-Json -InputObject $answers -Depth 6
    $saved = Invoke-RestMethod -Uri "$BaseUrl/api/exams/anonymous/attempts/$attId/answers" -Method Put `
        -Headers @{ "X-Anonymous-Session" = $sess.sessionToken } `
        -Body $answersJson -ContentType "application/json"
    Check ($saved.status -ne $null) "Answers autosaved (status=$($saved.status))"
}

# --------------------------------------------------------------------------
Step "8. Submit -> email ket qua"
$sub = Invoke-RestMethod -Uri "$BaseUrl/api/exams/anonymous/attempts/$attId/submit" -Method Post `
    -Headers @{ "X-Anonymous-Session" = $sess.sessionToken } `
    -Body (ConvertTo-Json -InputObject @() -Depth 4) -ContentType "application/json"
Check ($sub.status -eq "SUBMITTED") "Attempt SUBMITTED"
Check ($sub.finalScore -ne $null) "finalScore = $($sub.finalScore)"

# --------------------------------------------------------------------------
Step "9. Link chi dung 1 lan -> lan thu 2 bi chan"
$inv1 = Invoke-RestMethod -Uri "$BaseUrl/api/exams/$examId/invitations/anonymous" `
    -Method Post -Headers $hdr -Body (@{ maxAccessAttempts = 1 } | ConvertTo-Json) -ContentType "application/json"
$body1 = @{
    accessCode = $inv1.accessCode
    studentName = "First Student"
    studentEmail = "first.$([DateTimeOffset]::Now.ToUnixTimeSeconds())@example.com"
} | ConvertTo-Json
Invoke-RestMethod -Uri "$BaseUrl/api/exams/anonymous-session" -Method Post `
    -Body $body1 -ContentType "application/json" | Out-Null
Ok "Lan 1 cua link maxAccessAttempts=1 thanh cong"

$body2 = @{
    accessCode = $inv1.accessCode
    studentName = "Cheater"
    studentEmail = "cheater@example.com"
} | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "$BaseUrl/api/exams/anonymous-session" -Method Post `
        -Body $body2 -ContentType "application/json" | Out-Null
    Bad "Khong chan lan thu 2 (maxAccessAttempts = 1)"
} catch {
    Ok "Lan thu 2 bi chan: $($_.Exception.Message)"
}

Write-Host "`n=========================================" -ForegroundColor Cyan
if ($script:Fails -eq 0) {
    Write-Host " E2E ANONYMOUS: ALL PASSED " -ForegroundColor Green
} else {
    Write-Host " E2E ANONYMOUS: $script:Fails CHECK(S) FAILED " -ForegroundColor Red
}
Write-Host "=========================================`n" -ForegroundColor Cyan
exit $script:Fails