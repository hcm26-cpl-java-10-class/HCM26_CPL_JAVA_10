$ErrorActionPreference = "Stop"
# Maven writes Java runtime warnings to stderr; keep those warnings from aborting this script.
$PSNativeCommandUseErrorActionPreference = $false

$backendRoot = $PSScriptRoot
$databaseDirectory = Join-Path $backendRoot "data\demo"
New-Item -ItemType Directory -Path $databaseDirectory -Force | Out-Null
$databasePath = (Join-Path $databaseDirectory "fams_lms_showcase").Replace("\", "/")

# Use an isolated H2 database so demo fixtures never touch backend/.env's MySQL database.
$demoEnvironment = [ordered]@{
    DB_URL = "jdbc:h2:file:$databasePath;DB_CLOSE_ON_EXIT=FALSE"
    DB_DRIVER = "org.h2.Driver"
    DB_DIALECT = "org.hibernate.dialect.H2Dialect"
    DB_USERNAME = "sa"
    DB_PASSWORD = ""
    DB_DDL_AUTO = "update"
    SERVER_PORT = "8080"
    SPRING_PROFILES_ACTIVE = "milestone-mock"
    WORKSPACE_DEMO_ENABLED = "true"
    APP_SEED_BOARD_ENABLED = "true"
    TEAM_ALLOCATION_DEMO_SEED_ENABLED = "true"
    TASK_ALERT_DEMO_ENABLED = "true"
    MEMBER_REMINDER_DEMO_ENABLED = "true"
    MILESTONE_MOCK_SEED_ENABLED = "true"
    MILESTONE_SUBMISSION_MOCK_SEED_ENABLED = "true"
}

$previousEnvironment = @{}
foreach ($name in $demoEnvironment.Keys) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
    [Environment]::SetEnvironmentVariable($name, $demoEnvironment[$name], "Process")
}

$exitCode = 0
try {
    Set-Location $backendRoot
    Write-Host "Starting the local demo environment on port 8080 with isolated H2 database: $databasePath"
    Write-Host "Demo accounts: admin@example.com, teacher@example.com, student@example.com (password: password123)"
    & .\mvnw.cmd spring-boot:run
    if ($LASTEXITCODE -ne 0) { $exitCode = $LASTEXITCODE }
}
finally {
    foreach ($name in $demoEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], "Process")
    }
}

exit $exitCode
