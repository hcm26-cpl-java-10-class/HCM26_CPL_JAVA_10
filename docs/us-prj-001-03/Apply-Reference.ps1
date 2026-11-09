param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$us03Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$us03Prefix = $us03Root.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
$us03Manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json

function Get-NormalizedHash([string]$Text) {
    $normalized = $Text.Replace("`r`n", "`n").TrimEnd() + "`n"
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($normalized)))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

$us03Work = @()
foreach ($entry in $us03Manifest) {
    $target = [System.IO.Path]::GetFullPath((Join-Path $us03Root $entry.path))
    if (!$target.StartsWith($us03Prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Target is outside the project: $target"
    }
    $reference = Join-Path (Join-Path $PSScriptRoot 'reference') $entry.path
    if (!(Test-Path -LiteralPath $reference -PathType Leaf)) { throw "Missing reference: $reference" }
    if ((Get-NormalizedHash ([System.IO.File]::ReadAllText($reference))) -ne $entry.afterSha256) {
        throw "Reference changed; inspect it before applying: $reference"
    }
    if (Test-Path -LiteralPath $target -PathType Leaf) {
        $current = Get-NormalizedHash ([System.IO.File]::ReadAllText($target))
        if ($current -eq $entry.afterSha256) { Write-Output "Already applied: $($entry.path)"; continue }
        if (!$entry.beforeSha256 -or $current -ne $entry.beforeSha256) {
            throw "Source changed since the guide was prepared. Merge this file manually: $target"
        }
    } elseif ($entry.beforeSha256) { throw "Expected existing source is missing: $target" }
    $us03Work += [pscustomobject]@{ Target = $target; Reference = $reference; Path = $entry.path }
}
if (!$Apply) {
    $us03Work | ForEach-Object { Write-Output "Would apply: $($_.Path)" }
    Write-Output "Dry run only. Read IMPLEMENTATION_GUIDE.md, then run this script with -Apply when ready."
    return
}
foreach ($entry in $us03Work) {
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($entry.Target)) | Out-Null
    [System.IO.File]::WriteAllText($entry.Target, [System.IO.File]::ReadAllText($entry.Reference), [System.Text.UTF8Encoding]::new($false))
    Write-Output "Applied: $($entry.Path)"
}
Write-Output "Source copied. Restart/build/test as described in IMPLEMENTATION_GUIDE.md. No git commands were run."
