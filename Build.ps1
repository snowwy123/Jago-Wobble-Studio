$ErrorActionPreference='Stop'
& node (Join-Path $PSScriptRoot 'Source\build-browser.cjs')
if($LASTEXITCODE -ne 0){throw 'Browser build failed'}
& (Join-Path $PSScriptRoot 'Source\Windows\Build.ps1') -SdkDirectory (Join-Path $PSScriptRoot 'Dependencies\WebView2')
