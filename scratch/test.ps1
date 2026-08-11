$file = Get-ChildItem -Filter "*danh.txt" | Select-Object -First 1
$lines = Select-String -Path $file.FullName -Pattern "class_hour_code" | Select-Object -First 1
$line = $lines[0].Line
$idx = $line.IndexOf("data-entity=")
if ($idx -ge 0) {
    $sub = $line.Substring($idx + 13) # skip data-entity="
    # find where closing brace is before data-search-key
    $endIdx = $sub.LastIndexOf('}')
    if ($endIdx -ge 0) {
        $raw = $sub.Substring(0, $endIdx + 1)
        $decoded = [System.Net.WebUtility]::HtmlDecode($raw)
        $obj = $decoded | ConvertFrom-Json
        $obj | ConvertTo-Json -Depth 5
    }
}
