# Retro TV Cart Studio v1.8.1 launcher
[CmdletBinding()]
param(
    [string]$CartID = '',
    [string]$SystemRoot = '',
    [int]$Port = 17871
)
$ErrorActionPreference='Stop'
if([string]::IsNullOrWhiteSpace($SystemRoot)){ $SystemRoot = Split-Path -Parent $PSScriptRoot }
$settingsPath=Join-Path (Join-Path $SystemRoot 'STATE') 'settings.json'
if(-not (Test-Path -LiteralPath $settingsPath)){throw "settings.json not found: $settingsPath"}
$node=(Get-Command node -ErrorAction SilentlyContinue)
if(-not $node){throw 'Node.js was not found in PATH. Install Node LTS or add node.exe to PATH.'}
$toolkit=$PSScriptRoot
$server=Join-Path $toolkit 'studio\server.js'
if(-not (Test-Path -LiteralPath $server)){throw "Studio server not found: $server"}
$url="http://127.0.0.1:$Port/"
$nodeArgs=@($server,'--settings',$settingsPath,'--toolkit',$toolkit,'--port',[string]$Port)
if(-not [string]::IsNullOrWhiteSpace($CartID)){$nodeArgs+=@('--cart',$CartID)}
$argLine=($nodeArgs|ForEach-Object{'"'+($_ -replace '"','\"')+'"'}) -join ' '
Write-Host "Retro TV Cart Studio v1.8.1" -ForegroundColor Cyan
Write-Host "Starting local Studio server..."
# PowerShell's Start-Process can misinterpret '[' and ']' in the CURRENT
# working directory as wildcard characters. The Retro TV tree intentionally
# lives under F:\[VIDEOS]\..., so start the child process from a neutral,
# bracket-free directory. All paths passed to the Studio server are absolute.
$launchCwd = if (Test-Path -LiteralPath $env:TEMP) { $env:TEMP } else { $env:WINDIR }
$proc=Start-Process -FilePath $node.Source -ArgumentList $argLine -WorkingDirectory $launchCwd -NoNewWindow -PassThru
try{
    $ready=$false
    for($i=0;$i -lt 40;$i++){
        if($proc.HasExited){throw "Studio server exited early with code $($proc.ExitCode)."}
        try{
            $client=New-Object System.Net.Sockets.TcpClient
            $client.Connect('127.0.0.1',$Port)
            $client.Close();$ready=$true;break
        }catch{Start-Sleep -Milliseconds 150}
    }
    if(-not $ready){throw "Studio server did not open port $Port."}
    Write-Host "Opening $url"
    Write-Host "Leave this PowerShell window open while Studio is running. Ctrl+C stops it."
    # Use the same neutral working directory here for the same bracket-path reason.
    Start-Process -FilePath $url -WorkingDirectory $launchCwd
    Wait-Process -Id $proc.Id
}finally{
    if($proc -and -not $proc.HasExited){Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue}
}
