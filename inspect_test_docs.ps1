param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$OutPath
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Convert-DocxToText {
    param([string]$DocxPath)
    $zip = [System.IO.Compression.ZipFile]::OpenRead($DocxPath)
    try {
        $entry = $zip.GetEntry('word/document.xml')
        if (-not $entry) { throw "word/document.xml not found in $DocxPath" }
        $reader = [System.IO.StreamReader]::new($entry.Open())
        try { [xml]$xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
    } finally { $zip.Dispose() }

    $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
    $ns.AddNamespace('w','http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    $sb = [System.Text.StringBuilder]::new()
    $tables = $xml.SelectNodes('//w:body/w:tbl', $ns)
    [void]$sb.AppendLine("TABLE_COUNT=$($tables.Count)")
    for ($ti=0; $ti -lt $tables.Count; $ti++) {
        [void]$sb.AppendLine("`n=== TABLE $($ti + 1) ===")
        $rows = $tables[$ti].SelectNodes('./w:tr', $ns)
        for ($ri=0; $ri -lt $rows.Count; $ri++) {
            $cells = $rows[$ri].SelectNodes('./w:tc', $ns)
            $values = foreach ($cell in $cells) {
                $paras = $cell.SelectNodes('.//w:p', $ns)
                $pt = foreach ($p in $paras) {
                    $nodes = $p.SelectNodes('.//w:t|.//w:tab|.//w:br', $ns)
                    (($nodes | ForEach-Object {
                        if ($_.LocalName -eq 't') { $_.'#text' }
                        elseif ($_.LocalName -eq 'tab') { "`t" }
                        else { ' / ' }
                    }) -join '')
                }
                (($pt | Where-Object { $_ -ne '' }) -join ' // ').Trim()
            }
            [void]$sb.AppendLine(("R{0}: " -f ($ri+1)) + (($values | ForEach-Object { '[' + $_ + ']' }) -join ' | '))
        }
    }

    [System.IO.File]::WriteAllText($OutPath, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
}

Convert-DocxToText -DocxPath $Path -OutPath $OutPath
