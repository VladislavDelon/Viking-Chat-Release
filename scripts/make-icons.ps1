Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$path, [double]$flakeScale = 0.30) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(88, 182, 255),
    [System.Drawing.Color]::FromArgb(124, 107, 255),
    45
  )
  $g.FillRectangle($brush, $rect)

  $penWidth = [single]($size * 0.045)
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $penWidth)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $cx = $size / 2.0
  $cy = $size / 2.0
  $r = $size * $flakeScale
  for ($i = 0; $i -lt 6; $i++) {
    $a = [math]::PI / 3 * $i - [math]::PI / 2
    $x2 = $cx + $r * [math]::Cos($a)
    $y2 = $cy + $r * [math]::Sin($a)
    $g.DrawLine($pen, [single]$cx, [single]$cy, [single]$x2, [single]$y2)

    foreach ($t in @(0.55, 0.8)) {
      $bx = $cx + $r * $t * [math]::Cos($a)
      $by = $cy + $r * $t * [math]::Sin($a)
      $bl = $r * 0.22
      foreach ($da in @(0.55, -0.55)) {
        $g.DrawLine(
          $pen,
          [single]$bx, [single]$by,
          [single]($bx + $bl * [math]::Cos($a + $da)),
          [single]($by + $bl * [math]::Sin($a + $da))
        )
      }
    }
  }
  $g.FillEllipse(
    (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)),
    [single]($cx - $size * 0.035), [single]($cy - $size * 0.035),
    [single]($size * 0.07), [single]($size * 0.07)
  )

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "wrote $path"
}

New-Item -ItemType Directory -Force -Path "public\icons" | Out-Null
New-Icon 192 "public\icons\icon-192.png"
New-Icon 512 "public\icons\icon-512.png"
New-Icon 512 "public\icons\icon-maskable-512.png" 0.24
New-Icon 180 "public\icons\apple-touch-icon.png"
