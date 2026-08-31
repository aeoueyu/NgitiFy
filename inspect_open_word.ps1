param(
    [Parameter(Mandatory=$true)][string]$DocumentPath,
    [Parameter(Mandatory=$true)][string]$OutPath
)

$word = $null
$created = $false
try {
    try { $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application') } catch {}
    if (-not $word) {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = 0
        $created = $true
    }

    $doc = $null
    foreach ($candidate in $word.Documents) {
        if ([string]::Equals($candidate.FullName, $DocumentPath, [StringComparison]::OrdinalIgnoreCase)) {
            $doc = $candidate
            break
        }
    }
    $opened = $false
    if (-not $doc) {
        $doc = $word.Documents.Open($DocumentPath, $false, $true, $false)
        $opened = $true
    }

    $sb = [Text.StringBuilder]::new()
    [void]$sb.AppendLine("TABLE_COUNT=$($doc.Tables.Count)")
    for ($ti=1; $ti -le $doc.Tables.Count; $ti++) {
        $table = $doc.Tables.Item($ti)
        [void]$sb.AppendLine("`n=== TABLE $ti ===")
        $rowMap = @{}
        foreach ($cell in $table.Range.Cells) {
            try { $ri = $cell.RowIndex } catch { $ri = 0 }
            try { $ci = $cell.ColumnIndex } catch { $ci = 0 }
            if (-not $rowMap.ContainsKey($ri)) { $rowMap[$ri] = @{} }
            $value = $cell.Range.Text -replace '[\x07\x0D]', ''
            $value = $value -replace '\v', ' / '
            $rowMap[$ri][$ci] = $value.Trim()
        }
        foreach ($ri in ($rowMap.Keys | Sort-Object)) {
            $values = foreach ($ci in ($rowMap[$ri].Keys | Sort-Object)) {
                "C${ci}:[" + $rowMap[$ri][$ci] + ']'
            }
            [void]$sb.AppendLine("R${ri}: " + ($values -join ' | '))
        }
    }
    [IO.File]::WriteAllText($OutPath, $sb.ToString(), [Text.UTF8Encoding]::new($false))
    if ($opened) { $doc.Close($false) }
} finally {
    if ($created -and $word) { $word.Quit() }
    if ($word) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
}
