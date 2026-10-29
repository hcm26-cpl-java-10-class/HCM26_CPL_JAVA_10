<#
.SYNOPSIS
Previews or creates demo course metadata through the existing authenticated API.
.DESCRIPTION
Read-only by default. -Apply and -ConfirmIsolatedDatabase are both required to POST.
Use only against an independently verified disposable development database.
The API cannot prove database identity. This script never starts the backend.
Requires an existing access token with COURSE_READ and (for writes) COURSE_CREATE.
Does not refresh expired tokens, update/delete courses, or create enrollments.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [uri] $ApiBaseUrl,
    [Security.SecureString] $AccessToken,
    [string] $DataPath = (Join-Path $PSScriptRoot '../test-data/course-reference-metadata.json'),
    [switch] $Apply,
    [switch] $ConfirmIsolatedDatabase
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($Apply -and -not $ConfirmIsolatedDatabase) {
    throw 'Writing requires -Apply -ConfirmIsolatedDatabase after independently verifying database isolation.'
}
if (-not $ApiBaseUrl.IsAbsoluteUri -or $ApiBaseUrl.UserInfo -or $ApiBaseUrl.Query -or $ApiBaseUrl.Fragment -or
    ($ApiBaseUrl.Scheme -ne 'https' -and -not ($ApiBaseUrl.Scheme -eq 'http' -and $ApiBaseUrl.IsLoopback))) {
    throw 'Use an absolute HTTPS API URL (or HTTP loopback), without credentials, query, or fragment.'
}

$courses = @(Get-Content -LiteralPath $DataPath -Raw -Encoding UTF8 | ConvertFrom-Json)
if ($courses.Count -eq 0) { throw 'Dataset contains no courses.' }
$names = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($course in $courses) {
    foreach ($field in @('name', 'description', 'instructor', 'thumbnailUrl')) {
        if ($null -eq $course.PSObject.Properties[$field]) { throw "Dataset is missing field: $field" }
    }
    if ($course.name -isnot [string] -or [string]::IsNullOrWhiteSpace($course.name) -or
        $course.name.Length -gt 150 -or -not $names.Add($course.name.Trim())) {
        throw 'Dataset contains a blank, oversized, or duplicate course name.'
    }
    foreach ($limit in @{ description = 500; instructor = 100; thumbnailUrl = 255 }.GetEnumerator()) {
        $value = $course.($limit.Key)
        if ($null -ne $value -and ($value -isnot [string] -or $value.Length -gt $limit.Value)) {
            throw "Invalid dataset field: $($limit.Key)"
        }
    }
}
if (-not $AccessToken) { $AccessToken = Read-Host 'Existing API access token' -AsSecureString }
if ($AccessToken.Length -eq 0) { throw 'An existing API access token is required.' }
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($AccessToken)
$headers = $null
$created = 0
$skipped = 0
$failed = 0
$pending = @()
try {
    $headers = @{ Authorization = 'Bearer ' + [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer) }
    $base = $ApiBaseUrl.AbsoluteUri.TrimEnd('/')
    # Complete the entire read-only preflight before allowing any writes.
    $existing = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $pageNumber = 0
    do {
        try {
            $page = Invoke-RestMethod -Uri "$base/courses?page=$pageNumber&size=100&sort=id,asc" -Headers $headers -Method Get -MaximumRedirection 0 -TimeoutSec 30
        } catch {
            throw 'Course preflight GET failed. Verify API URL, connectivity and COURSE_READ token. No records were written.'
        }
        if ($null -eq $page -or $null -eq $page.PSObject.Properties['content'] -or
            $null -eq $page.PSObject.Properties['last'] -or $page.last -isnot [bool]) {
            throw 'Unexpected paginated course response; refusing to write.'
        }
        foreach ($item in $page.content) {
            if ([string]::IsNullOrWhiteSpace($item.name)) { throw 'Invalid course response; refusing to write.' }
            [void] $existing.Add($item.name.Trim())
        }
        $pageNumber++
        if ($pageNumber -gt 10000) { throw 'Pagination safety limit exceeded; refusing to write.' }
    } while (-not $page.last)

    foreach ($course in $courses) {
        if ($existing.Contains($course.name.Trim())) {
            $skipped++
            Write-Host "SKIP existing name (never updated): $($course.name)"
        } else {
            $pending += $course
            Write-Host "CREATE candidate: $($course.name)"
        }
    }
    if (-not $Apply) {
        Write-Host "DRY RUN: candidates=$($pending.Count), skipped=$skipped, created=0, failed=0. No writes requested."
        return
    }
    foreach ($course in $pending) {
        $body = @{
            name = $course.name; description = $course.description
            instructor = $course.instructor; thumbnailUrl = $course.thumbnailUrl
            isActive = $true # Required by BaseDTO OnCreate validation.
        } | ConvertTo-Json -Compress
        try {
            $null = Invoke-RestMethod -Uri "$base/courses" -Headers $headers -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -MaximumRedirection 0 -TimeoutSec 30
            $created++
            Write-Host "CREATED: $($course.name)"
        } catch {
            $failed++
            # Never print request headers, credentials, or raw HTTP exception bodies.
            Write-Warning "CREATE failed for '$($course.name)'. Stopping; verify token, permissions and server validation. Earlier successful creates remain."
            break
        }
    }
    $notAttempted = $pending.Count - $created - $failed
    Write-Host "IMPORT: created=$created, skipped=$skipped, failed=$failed, not-attempted=$notAttempted."
    if ($failed -gt 0) { throw 'Import stopped after a failed create. No automatic retries, updates, or deletes were performed.' }
} finally {
    if ($null -ne $headers) { $headers.Clear() }
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
}
