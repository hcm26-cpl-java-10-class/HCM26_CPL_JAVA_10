param(
    [ValidateSet('AC08-AC12', 'AC10', 'AC12')]
    [string]$Ac = 'AC08-AC12',
    [switch]$ReportOnly
)
$ErrorActionPreference = 'Stop'
$workspaceRepo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workspaceBackend = Join-Path $workspaceRepo 'backend'
$workspaceOutput = Join-Path $PSScriptRoot 'evidence'
$workspaceReport = Join-Path $workspaceBackend 'target\surefire-reports\TEST-com.example.starter_project_2025.system.project.WorkspaceAcceptanceIntegrationTest.xml'
$workspaceStamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$workspaceLog = Join-Path $workspaceBackend ("target\workspace-evidence-" + $workspaceStamp + '.log')
$workspaceSelector = switch ($Ac) {
    'AC10' { 'WorkspaceAcceptanceIntegrationTest#ac10*' }
    'AC12' { 'WorkspaceAcceptanceIntegrationTest#ac12*' }
    default { 'WorkspaceAcceptanceIntegrationTest#ac08*+ac09*+ac10*+ac11*+ac12*' }
}

if (-not $ReportOnly) {
    $workspaceJava = 'C:\Program Files\Java\jdk-21'
    if (Test-Path -LiteralPath $workspaceJava) {
        $env:JAVA_HOME = $workspaceJava
        $env:Path = "$workspaceJava\bin;$env:Path"
    }
    $workspaceMavenCommand = Get-Command 'mvn.cmd' -ErrorAction SilentlyContinue
    $workspaceMaven = if ($workspaceMavenCommand) { $workspaceMavenCommand.Source } else { 'C:\Program Files\apache-maven-3.9.16\bin\mvn.cmd' }
    if (-not (Test-Path -LiteralPath $workspaceMaven)) { throw 'Maven was not found. Add mvn.cmd to PATH or update the fallback path in this script.' }
    Push-Location $workspaceBackend
    try {
        New-Item -ItemType Directory -Path 'target' -Force | Out-Null
        & $workspaceMaven -o ("-Dtest=" + $workspaceSelector) test *> $workspaceLog
        $workspaceMavenExit = $LASTEXITCODE
        Get-Content -LiteralPath $workspaceLog -Tail 18
        if ($workspaceMavenExit -ne 0) { throw "Test run failed. Inspect $workspaceLog and the Surefire report. No passing evidence was exported." }
    }
    finally { Pop-Location }
}

if (-not (Test-Path -LiteralPath $workspaceReport)) { throw 'No Surefire report found. Run the tests first.' }
[xml]$workspaceXml = Get-Content -LiteralPath $workspaceReport -Raw
$workspaceCases = @(
    foreach ($workspaceCase in $workspaceXml.testsuite.SelectNodes('./testcase')) {
        $workspaceName = $workspaceCase.GetAttribute('name')
        if ($workspaceName -notmatch '^ac(08|09|10|11|12)') { continue }
        $workspaceCaseAc = $workspaceName.Substring(0, 4).ToUpperInvariant()
        if ($Ac -ne 'AC08-AC12' -and $workspaceCaseAc -ne $Ac) { continue }
        $workspaceCaseStatus = if ($workspaceCase.SelectNodes('failure|error').Count -gt 0) { 'FAIL' } elseif ($workspaceCase.SelectNodes('skipped').Count -gt 0) { 'SKIPPED' } else { 'PASS' }
        [pscustomobject]@{
            ac = $workspaceCaseAc
            test = $workspaceName
            result = $workspaceCaseStatus
            seconds = $workspaceCase.GetAttribute('time')
        }
    }
)
if ($workspaceCases.Count -eq 0) { throw "The current report contains no $Ac cases. Run without -ReportOnly." }
$workspaceRequired = if ($Ac -eq 'AC08-AC12') { @('AC08', 'AC09', 'AC10', 'AC11', 'AC12') } else { @($Ac) }
foreach ($workspaceRequiredAc in $workspaceRequired) {
    if (@($workspaceCases | Where-Object ac -EQ $workspaceRequiredAc).Count -eq 0) { throw "The report is missing $workspaceRequiredAc. Run without -ReportOnly." }
}
$workspacePassed = @($workspaceCases | Where-Object result -EQ 'PASS').Count
$workspaceResult = [pscustomobject]@{
    scope = $Ac
    exportedAt = (Get-Date).ToString('o')
    sourceReportModifiedAt = (Get-Item -LiteralPath $workspaceReport).LastWriteTime.ToString('o')
    sourceReport = 'backend/target/surefire-reports/TEST-com.example.starter_project_2025.system.project.WorkspaceAcceptanceIntegrationTest.xml'
    layer = 'Spring Boot + MockMvc integration tests; these are not Postman network captures.'
    database = 'Unique in-memory H2 test database. Fresh tenant/project/team/member per case; workspace records cleaned after each case.'
    total = $workspaceCases.Count
    passed = $workspacePassed
    failedOrSkipped = $workspaceCases.Count - $workspacePassed
    cases = $workspaceCases
}
New-Item -ItemType Directory -Path $workspaceOutput -Force | Out-Null
$workspaceJson = Join-Path $workspaceOutput ($Ac + '-results.json')
$workspaceMarkdown = Join-Path $workspaceOutput ($Ac + '-results.md')
$workspaceResult | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $workspaceJson -Encoding UTF8
$workspaceLines = @(
    "# $Ac integration-test evidence",
    '',
    ("Result: **" + $workspacePassed + '/' + $workspaceCases.Count + " passed**."),
    '',
    ("Report timestamp: " + $workspaceResult.sourceReportModifiedAt + '.'),
    '',
    $workspaceResult.layer,
    '',
    $workspaceResult.database,
    '',
    '| AC | Result | Test case | Seconds |',
    '| --- | --- | --- | --- |'
)
foreach ($workspaceCase in $workspaceCases) {
    $workspaceLines += '| ' + $workspaceCase.ac + ' | ' + $workspaceCase.result + ' | ' + $workspaceCase.test + ' | ' + $workspaceCase.seconds + ' |'
}
$workspaceLines += @(
    '',
    '## Assertions exercised',
    '',
    '- AC08: different key on an existing pair returns 409 with the readable workspace ID; record counts stay unchanged; the database also rejects a duplicate row.',
    '- AC09: same key/body returns the identical saved 201 response; changed body returns 409; workspace/audit/outbox/activity/request counts do not increase.',
    '- AC10: a ready latch and shared start latch release two requests. Different keys yield exactly 201/409; the additional same-key case yields 201/201 with identical responses. The database has one workspace, one request, one audit, one event and one activity.',
    '- AC11: a signed expired token yields 401; revocation after confirmation yields 403; missing targets yield 404; invalid relationship yields 422; terminal/ineligible project states yield 409. Failed attempts leave workspace records unchanged.',
    '- AC12: failures at WORKSPACE, SECTIONS, AUDIT, OUTBOX, ACTIVITY and IDEMPOTENCY saves return 500 and restore all six table counts, with project still PLANNING. Removing the fault allows same-key retry. Audit fields are checked and repeated delivery retains one activity.',
    '',
    'The executed cases in the table define the scope of this report. AC10-only or AC12-only runs do not execute the other AC assertions.',
    '',
    'Source: backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceAcceptanceIntegrationTest.java',
    '',
    'This summary exports test names and outcomes only; application logs, credentials and JWTs are not copied.'
)
$workspaceLines | Set-Content -LiteralPath $workspaceMarkdown -Encoding UTF8
Write-Output ("Evidence: " + $workspaceMarkdown)
Write-Output ("JSON: " + $workspaceJson)
if ($workspacePassed -ne $workspaceCases.Count) { throw 'The existing report contains failed or skipped cases; inspect the exported outcomes.' }

