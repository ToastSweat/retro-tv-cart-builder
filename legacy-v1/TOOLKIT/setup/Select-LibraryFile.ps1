param([switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
try {
    # Explorer-style address bar; no path is evaluated as PowerShell code.
    $dialog.AutoUpgradeEnabled = $true
    $dialog.CheckFileExists = $true
    $dialog.CheckPathExists = $true
    $dialog.Multiselect = $false
    $dialog.RestoreDirectory = $true
    $dialog.Title = 'Select an original media file to register in place'
    $dialog.Filter = 'Media files|*.mp4;*.mkv;*.avi;*.mov;*.m4v;*.webm;*.mpg;*.mpeg;*.ts;*.mts;*.m2ts;*.vob;*.wmv;*.mp3;*.wav;*.flac;*.m4a;*.aac;*.ogg|All files|*.*'
    $start = [Environment]::GetEnvironmentVariable('RETROTV_PICKER_START')
    if ($start) {
        if (Test-Path -LiteralPath $start -PathType Container) { $dialog.InitialDirectory = $start }
        elseif (Test-Path -LiteralPath $start -PathType Leaf) { $dialog.InitialDirectory = (Get-Item -LiteralPath $start).DirectoryName }
    }
    if ($ValidateOnly) {
        @{ validated = $true; addressBarDialog = $dialog.AutoUpgradeEnabled; multiselect = $dialog.Multiselect } | ConvertTo-Json -Compress
    }
    elseif ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        @{ cancelled = $false; path = $dialog.FileName } | ConvertTo-Json -Compress
    }
    else { @{ cancelled = $true } | ConvertTo-Json -Compress }
}
finally { $dialog.Dispose() }
