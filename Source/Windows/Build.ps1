# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Cameron Jago Lis Illustrates.
# Inspiration: WigglyPaint and Decker by John Earnest (Internet Janitor).
# Created by Cameron Jago Lis Illustrates.
param([string]$SdkDirectory)
$ErrorActionPreference = 'Stop'
$suiteRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$sdk = Join-Path $PSScriptRoot '.sdk\WebView2'
if ($SdkDirectory) { $sdk = [IO.Path]::GetFullPath($SdkDirectory) }
$sdkVersion = '1.0.4191.47'
if (-not (Test-Path -LiteralPath (Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.Core.dll'))) {
    $cache = Join-Path $PSScriptRoot '.sdk'
    [IO.Directory]::CreateDirectory($cache) | Out-Null
    $archive = Join-Path $cache 'WebView2.zip'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri ('https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/' + $sdkVersion + '/microsoft.web.webview2.' + $sdkVersion + '.nupkg') -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $sdk -Force
}
$studioOutput = Join-Path $suiteRoot 'Jago-Wobble-Studio.exe'
$html = Join-Path $suiteRoot 'Jago-Wobble-Studio.html'
$compileArguments = @(
 '/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/utf8output',
 ('/out:' + $studioOutput), ('/win32manifest:' + (Join-Path $PSScriptRoot 'app.manifest')),
 ('/win32icon:' + (Join-Path $PSScriptRoot 'studio.ico')),
 '/reference:System.dll', '/reference:System.Core.dll', '/reference:System.Drawing.dll', '/reference:System.Windows.Forms.dll', '/reference:System.Web.Extensions.dll',
 ('/reference:' + (Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.Core.dll')),
 ('/reference:' + (Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.WinForms.dll')),
 ('/resource:' + (Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.Core.dll') + ',Studio.Microsoft.Web.WebView2.Core.dll'),
 ('/resource:' + (Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.WinForms.dll') + ',Studio.Microsoft.Web.WebView2.WinForms.dll'),
 ('/resource:' + (Join-Path $sdk 'runtimes\win-x64\native\WebView2Loader.dll') + ',Studio.WebView2Loader.dll'),
 ('/resource:' + (Join-Path $sdk 'LICENSE.txt') + ',Studio.WebView2-LICENSE.txt'),
 ('/resource:' + (Join-Path $sdk 'NOTICE.txt') + ',Studio.WebView2-NOTICE.txt'),
 ('/resource:' + $html + ',Studio.index.html')
)
# Embed scripts so the EXE still runs without a companion source folder.
foreach ($script in Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'Scripts') -Filter '*.js' | Sort-Object Name) {
    $compileArguments += '/resource:' + $script.FullName + ',Studio.Scripts.' + $script.Name
}
foreach ($source in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.cs' | Sort-Object Name) {
    $compileArguments += $source.FullName
}
if (-not (Test-Path -LiteralPath $html)) { throw 'Build the browser app first: node Source/build-browser.cjs' }
& $compiler @compileArguments
if ($LASTEXITCODE -ne 0) { throw 'Windows build failed.' }
Write-Output 'Windows edition rebuilt successfully.'
