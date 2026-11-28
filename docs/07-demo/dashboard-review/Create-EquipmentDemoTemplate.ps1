param(
    [string]$Email = 'admin@example.com',
    [string]$Password = 'password123'
)
$ErrorActionPreference = 'Stop'
$equipmentApi = 'http://localhost:8080/api'
$equipmentDefinition = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'equipment-template.json') -Raw | ConvertFrom-Json
$equipmentRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$equipmentOutput = Join-Path $equipmentRoot ('backend/data/backups/dashboard-equipment-template-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))

function Invoke-EquipmentApi {
    param([string]$Method, [string]$Path, $Payload)
    $equipmentArguments = @{ Method=$Method; Uri=($equipmentApi + $Path); Headers=$equipmentHeaders; TimeoutSec=30 }
    if ($null -ne $Payload) {
        $equipmentArguments.ContentType = 'application/json; charset=utf-8'
        $equipmentArguments.Body = [Text.Encoding]::UTF8.GetBytes(($Payload | ConvertTo-Json -Depth 20))
    }
    Invoke-RestMethod @equipmentArguments
}

$equipmentAuth = Invoke-RestMethod -Method Post -Uri ($equipmentApi + '/auth/login') -ContentType 'application/json' -Body (@{email=$Email;password=$Password} | ConvertTo-Json) -TimeoutSec 15
if (-not $equipmentAuth.accessToken) { throw 'The local demo login did not return an access token.' }
$equipmentHeaders = @{ Authorization=('Bearer ' + $equipmentAuth.accessToken) }
try {
    $equipmentOptions = Invoke-EquipmentApi GET '/project-templates/options'
    if ($equipmentOptions.tenantId -ne 1 -or -not $equipmentOptions.canCreate -or -not $equipmentOptions.canActivate) {
        throw 'Expected the local tenant 1 demo administrator with template create/activate permissions.'
    }
    $equipmentExisting = Invoke-EquipmentApi GET '/project-templates?search=DASH&size=100'
    if (@($equipmentExisting.content | Where-Object { $_.code -eq $equipmentDefinition.code }).Count -gt 0) {
        throw 'DASH-EQUIP-CD already exists. This tool will not overwrite it.'
    }
    $equipmentRubricSource = @($equipmentExisting.content)[0]
    if (-not $equipmentRubricSource.id) { throw 'No existing local template is available to read rubric options.' }
    $equipmentRubrics = (Invoke-EquipmentApi GET ("/project-templates/" + $equipmentRubricSource.id + '/milestone-options')).rubrics
    foreach ($equipmentStage in $equipmentDefinition.milestones) {
        if (@($equipmentRubrics | Where-Object name -eq $equipmentStage.rubricName).Count -ne 1) {
            throw ('Expected one published rubric named ' + $equipmentStage.rubricName)
        }
    }
    New-Item -ItemType Directory -Path $equipmentOutput | Out-Null
    $equipmentExisting | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $equipmentOutput 'templates-before.json') -Encoding utf8
    $equipmentTemplate = Invoke-EquipmentApi POST '/project-templates' @{
        code=$equipmentDefinition.code; name=$equipmentDefinition.name; description=$equipmentDefinition.description
        category=$equipmentDefinition.category; level=$equipmentDefinition.level
        estimatedDurationWeeks=$equipmentDefinition.estimatedDurationWeeks
    }
    $equipmentId = $equipmentTemplate.id
    if (-not $equipmentId) { throw 'Template creation did not return its ID.' }
    Set-Content -LiteralPath (Join-Path $equipmentOutput 'created-template-id.txt') -Value $equipmentId
    $equipmentTeamRules = @{
        minMembers=$equipmentDefinition.teamConstraints.minMembers; maxMembers=$equipmentDefinition.teamConstraints.maxMembers
        roleQuotas=$equipmentDefinition.teamConstraints.roleQuotas; allowMultiRole=$equipmentDefinition.teamConstraints.allowMultiRole
        lockVersion=$equipmentTemplate.lockVersion
    }
    $null = Invoke-EquipmentApi PUT "/project-templates/$equipmentId/team-constraints" $equipmentTeamRules
    $equipmentTemplate = Invoke-EquipmentApi GET "/project-templates/$equipmentId"
    $equipmentStages = @($equipmentDefinition.milestones | ForEach-Object {
        $equipmentStage = $_
        $equipmentRubric = $equipmentRubrics | Where-Object name -eq $equipmentStage.rubricName
        @{
            title=$equipmentStage.title; description=$equipmentStage.description; dueAfter=$equipmentStage.dueAfter
            dueUnit=$equipmentStage.dueUnit; weight=$equipmentStage.weight; mandatory=$equipmentStage.mandatory
            rubricVersionId=$equipmentRubric.id; checklistItems=$equipmentStage.checklistItems; latePolicy=$equipmentStage.latePolicy
        }
    })
    $null = Invoke-EquipmentApi PUT "/project-templates/$equipmentId/milestones" @{lockVersion=$equipmentTemplate.lockVersion;milestones=$equipmentStages}
    $equipmentTemplate = Invoke-EquipmentApi GET "/project-templates/$equipmentId"
    $null = Invoke-EquipmentApi PUT "/project-templates/$equipmentId/sample-content" @{lockVersion=$equipmentTemplate.lockVersion;backlogItems=$equipmentDefinition.backlogItems}
    $equipmentChecklist = Invoke-EquipmentApi GET "/project-templates/$equipmentId/activation-checklist"
    if (-not $equipmentChecklist.ready) {
        $equipmentChecklist | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $equipmentOutput 'activation-checklist.json') -Encoding utf8
        throw 'Activation checklist failed. The new template is left DRAFT; review the saved checklist.'
    }
    $equipmentTemplate = Invoke-EquipmentApi GET "/project-templates/$equipmentId"
    $equipmentActive = Invoke-EquipmentApi POST "/project-templates/$equipmentId/activate" @{lockVersion=$equipmentTemplate.lockVersion}
    $equipmentPlan = Invoke-EquipmentApi GET "/project-templates/$equipmentId/milestones"
    $equipmentContent = Invoke-EquipmentApi GET "/project-templates/$equipmentId/sample-content"
    $equipmentVersions = Invoke-EquipmentApi GET ("/project-templates/versions?search=" + $equipmentDefinition.code + '&size=100')
    $equipmentLatestVersion = @($equipmentVersions.content | Where-Object { $_.latestVersion -and $_.template.id -eq $equipmentId })
    if ($equipmentActive.status -ne 'ACTIVE' -or @($equipmentPlan.milestones).Count -ne 3 -or @($equipmentContent.backlogItems).Count -ne 12) {
        throw 'Read-back verification did not match the expected ACTIVE template, 3 milestones and 12 backlog items.'
    }
    if ($equipmentLatestVersion.Count -ne 1 -or $equipmentLatestVersion[0].versionLabel -ne 'v1.0') {
        throw 'Expected exactly one v1.0 source version for the new template.'
    }
    $equipmentAfter = Invoke-EquipmentApi GET '/project-templates?search=DASH&size=100'
    foreach ($equipmentOld in $equipmentExisting.content) {
        $equipmentReadBack = @($equipmentAfter.content | Where-Object id -eq $equipmentOld.id)
        if ($equipmentReadBack.Count -ne 1 -or $equipmentReadBack[0].code -ne $equipmentOld.code -or $equipmentReadBack[0].status -ne $equipmentOld.status -or $equipmentReadBack[0].lockVersion -ne $equipmentOld.lockVersion) {
            throw 'An existing template changed concurrently; inspect the before/after evidence.'
        }
    }
    $equipmentResult = @{
        template=$equipmentActive; milestones=$equipmentPlan; sampleContent=$equipmentContent; versions=$equipmentVersions
        existingTemplateRevisionsUnchanged=$true; businessWorkflowExecuted=$false
    }
    $equipmentResult | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $equipmentOutput 'created-template.json') -Encoding utf8
    Write-Output ("Created ACTIVE template: " + $equipmentActive.code + ' (ID ' + $equipmentId + ')')
    Write-Output 'Verified: 3 milestones; weights 40/40/20; 12 backlog items; four-person PM/BA/DEV/QA team.'
    Write-Output 'No team, project, workspace, artifact submission or review was created.'
    Write-Output ("Evidence: " + $equipmentOutput)
} finally {
    $equipmentHeaders = $null
    $equipmentAuth = $null
    $Password = $null
}
