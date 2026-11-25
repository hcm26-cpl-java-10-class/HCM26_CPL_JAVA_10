param(
    [ValidateSet('prepare', 'apply', 'verify')]
    [string]$Mode = 'prepare',
    [string]$BackupDirectory,
    [string]$JavaDirectory = 'C:\Users\PC MSI\.jdks\openjdk-21'
)
$ErrorActionPreference = 'Stop'
$reviewRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$reviewDatabase = Join-Path $reviewRoot 'backend/data/fams_lms_after_merge.mv.db'
$reviewTools = Join-Path $reviewRoot 'backend/target/dashboard-review-tools'
if (-not $BackupDirectory) {
    if ($Mode -ne 'prepare') { throw 'Specify the backup directory printed by prepare.' }
    $BackupDirectory = Join-Path $reviewRoot ('backend/data/backups/dashboard-review-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
}
$reviewRepository = Join-Path $env:USERPROFILE '.m2/repository'
$reviewJars = @(
    'com/h2database/h2/2.2.224/h2-2.2.224.jar',
    'org/springframework/security/spring-security-crypto/6.3.3/spring-security-crypto-6.3.3.jar',
    'org/springframework/spring-jcl/6.1.12/spring-jcl-6.1.12.jar'
) | ForEach-Object {
    $reviewJar = Join-Path $reviewRepository $_
    if (-not (Test-Path -LiteralPath $reviewJar)) { throw "Missing local dependency: $reviewJar" }
    $reviewJar
}
if (-not (Test-Path -LiteralPath $reviewDatabase)) { throw 'Reviewed local database missing.' }
New-Item -ItemType Directory -Path $reviewTools -Force | Out-Null
$reviewClasspath = $reviewJars -join [IO.Path]::PathSeparator
& (Join-Path $JavaDirectory 'bin/javac.exe') -encoding UTF-8 -cp $reviewClasspath -d $reviewTools (Join-Path $PSScriptRoot 'AddDashboardReviewClasses.java')
if ($LASTEXITCODE -ne 0) { throw 'Fixture compilation failed.' }
& (Join-Path $JavaDirectory 'bin/java.exe') -cp ($reviewTools + [IO.Path]::PathSeparator + $reviewClasspath) AddDashboardReviewClasses $Mode $reviewDatabase $BackupDirectory
if ($LASTEXITCODE -ne 0) { throw "Fixture $Mode failed. See the error above." }
Write-Output "BackupDirectory: $BackupDirectory"
