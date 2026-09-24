param(
  [string]$Token,
  [string]$Method = "GET",
  [string]$Url,
  [string]$Body = "",
  [string]$OutFile = ""
)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$headers = @{
  Authorization = "token $Token"
  Accept = "application/vnd.github+json"
  "User-Agent" = "viking-chat-setup"
}
try {
  $params = @{ Uri = $Url; Method = $Method; Headers = $headers }
  if ($Body -ne "") { $params.Body = $Body; $params.ContentType = "application/json" }
  if ($OutFile -ne "") { $params.OutFile = $OutFile }
  $r = Invoke-RestMethod @params
  $r | ConvertTo-Json -Depth 6 -Compress
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Output "{ `"error`": $code, `"msg`": `"$($_.Exception.Message)`" }"
  exit 1
}
