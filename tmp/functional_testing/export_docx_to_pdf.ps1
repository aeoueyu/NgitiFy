param(
    [Parameter(Mandatory = $true)]
    [string[]]$InputPaths,
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    foreach ($inputPath in $InputPaths) {
        $resolvedInput = [System.IO.Path]::GetFullPath($inputPath)
        if (-not (Test-Path -LiteralPath $resolvedInput -PathType Leaf)) {
            throw "Input document not found: $resolvedInput"
        }
        $stem = [System.IO.Path]::GetFileNameWithoutExtension($resolvedInput)
        $outputPath = Join-Path $resolvedOutput ($stem + '.pdf')
        $document = $word.Documents.Open($resolvedInput, $false, $true)
        try {
            $document.ExportAsFixedFormat($outputPath, 17)
        }
        finally {
            $document.Close($false)
        }
        Write-Output $outputPath
    }
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
