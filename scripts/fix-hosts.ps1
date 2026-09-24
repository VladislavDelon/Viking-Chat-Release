# Removes bogus GitHub entries from hosts file (api.github.com, codeload.github.com -> 8.8.4.4)
$hosts = "$env:WINDIR\System32\drivers\etc\hosts"
$lines = Get-Content $hosts
$clean = $lines | Where-Object { $_ -notmatch 'github\.com' }
Set-Content -Path $hosts -Value $clean -Encoding ASCII
Write-Output "hosts cleaned:"
Get-Content $hosts | Where-Object { $_ -match '\S' }
ipconfig /flushdns | Out-Null
Write-Output "DNS cache flushed"
