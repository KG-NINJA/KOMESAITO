param(
  [int]$Port = 8000,
  [string]$Root = (Get-Location).Path
)

# #KGNINJA - Minimal static file server (PowerShell + HttpListener)
Add-Type -AssemblyName System.Net.HttpListener

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Failed to start listener on $prefix. If access is denied, try running PowerShell as Administrator." -ForegroundColor Red
  Write-Host "Or reserve the URL with: netsh http add urlacl url=http://+:$Port/ user=$env:USERNAME" -ForegroundColor Yellow
  exit 1
}

Write-Host "Serving $Root at $prefix (Ctrl+C to stop)" -ForegroundColor Green

$mime = @{
  ".html"="text/html"; ".htm"="text/html";
  ".js"="text/javascript"; ".mjs"="text/javascript";
  ".css"="text/css"; ".json"="application/json";
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg";
  ".gif"="image/gif"; ".svg"="image/svg+xml"; ".ico"="image/x-icon";
  ".txt"="text/plain"; ".map"="application/json"
}

function Send-Bytes($ctx, [byte[]]$bytes, [string]$contentType) {
  $ctx.Response.ContentType = $contentType
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.OutputStream.Close()
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath
    if ([string]::IsNullOrWhiteSpace($path) -or $path -eq "/") { $path = "/index.html" }
    $fsPath = Join-Path $Root $path.TrimStart("/")
    if (Test-Path $fsPath -PathType Leaf) {
      try {
        $bytes = [System.IO.File]::ReadAllBytes($fsPath)
        $ext = [System.IO.Path]::GetExtension($fsPath).ToLower()
        $type = $mime[$ext]; if (-not $type) { $type = "application/octet-stream" }
        Send-Bytes $ctx $bytes $type
      } catch {
        $ctx.Response.StatusCode = 500
        $w = New-Object System.IO.StreamWriter($ctx.Response.OutputStream)
        $w.Write("500 Internal Server Error: " + $_.Exception.Message)
        $w.Flush(); $ctx.Response.OutputStream.Close()
      }
    } else {
      $ctx.Response.StatusCode = 404
      $w = New-Object System.IO.StreamWriter($ctx.Response.OutputStream)
      $w.Write("404 Not Found: $path")
      $w.Flush(); $ctx.Response.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}

