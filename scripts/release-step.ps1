param(
  [Parameter(Mandatory = $true)]
  [string]$Version,
  [Parameter(Mandatory = $true)]
  [string]$Message
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

(Get-Content 'src\appVersion.ts' -Raw) -replace "SOLUTION_VERSION = '[^']+'", "SOLUTION_VERSION = '$Version'" | Set-Content 'src\appVersion.ts' -NoNewline
(Get-Content 'config\package-solution.json' -Raw) -replace '"version": "[^"]+"', "`"version`": `"$Version`"" | Set-Content 'config\package-solution.json' -NoNewline

npx heft clean
if (Test-Path 'sharepoint\solution\debug') { Remove-Item 'sharepoint\solution\debug' -Recurse -Force }
npx heft test --production
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npx heft package-solution --production
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

git add .
git commit -m $Message
git push origin HEAD

Write-Host "Released v$Version"
