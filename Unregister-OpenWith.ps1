$ErrorActionPreference='Stop'
foreach($ext in @('.glb','.gltf','.b3dm')){
 $key='HKCU:\Software\Classes\'+$ext+'\OpenWithProgids'
 if(Test-Path -LiteralPath $key){Remove-ItemProperty -LiteralPath $key -Name '3WA.3DViewer' -ErrorAction SilentlyContinue}
}
# Fixed app-owned registry subtree only; never touches Windows UserChoice.
$root='HKCU:\Software\Classes\3WA.3DViewer'
if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse}
Write-Host 'Removed 3WA candidate registration. Choose another default in Windows Settings if needed.'
