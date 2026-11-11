$ErrorActionPreference='Stop'
$exe=Join-Path $PSScriptRoot '3wa_3dviewer.exe'
if(-not(Test-Path -LiteralPath $exe)){throw 'Run this script from the portable release directory.'}
# Only registers an Open With candidate for .glb. Never changes UserChoice/default.
$root='HKCU:\Software\Classes\3WA.3DViewer'
New-Item "$root\shell\open\command" -Force | Out-Null
Set-Item -LiteralPath $root -Value '3D model - 3WA 3D Viewer'
Set-Item -LiteralPath "$root\shell\open\command" -Value ('"'+$exe+'" "%1"')
New-Item "$root\DefaultIcon" -Force | Out-Null
Set-Item -LiteralPath "$root\DefaultIcon" -Value ('"'+$exe+'",0')
foreach($ext in @('.glb','.gltf','.b3dm')){
 $key='HKCU:\Software\Classes\'+$ext+'\OpenWithProgids'
 New-Item $key -Force | Out-Null
 New-ItemProperty -LiteralPath $key -Name '3WA.3DViewer' -PropertyType String -Value '' -Force | Out-Null
}
Write-Host 'Registered Open With candidates only. Choose the default app yourself in Windows. Existing defaults were not changed.'
