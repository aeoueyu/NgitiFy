param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$OutPath
)

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($Path, $false, $true, $false)
    try {
        [IO.File]::WriteAllText($OutPath, $doc.Content.Text, [Text.UTF8Encoding]::new($false))
    } finally {
        $doc.Close($false)
    }
} finally {
    $word.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
