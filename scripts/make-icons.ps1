Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$path, [double]$shieldScale = 0.62) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  # gradient background
  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(88, 182, 255),
    [System.Drawing.Color]::FromArgb(124, 107, 255),
    45
  )
  $g.FillRectangle($brush, $rect)

  # viking round shield
  $d = $size * $shieldScale
  $x = ($size - $d) / 2
  $y = ($size - $d) / 2
  $cx = $size / 2.0
  $cy = $size / 2.0

  # outer ring
  $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [single]($size * 0.055))
  $g.DrawEllipse($ringPen, [single]$x, [single]$y, [single]$d, [single]$d)

  # rim inner ring (subtle)
  $inner = $d * 0.86
  $thinPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(140, 255, 255, 255), [single]($size * 0.02))
  $g.DrawEllipse($thinPen, [single](($size - $inner) / 2), [single](($size - $inner) / 2), [single]$inner, [single]$inner)

  # spokes
  $spokePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [single]($size * 0.03))
  $spokePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $spokePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $r1 = $d * 0.14   # from boss edge
  $r2 = $d * 0.40   # to inner ring
  foreach ($ang in @(0, 90, 180, 270)) {
    $a = $ang * [math]::PI / 180 - [math]::PI / 2
    $g.DrawLine(
      $spokePen,
      [single]($cx + $r1 * [math]::Cos($a)), [single]($cy + $r1 * [math]::Sin($a)),
      [single]($cx + $r2 * [math]::Cos($a)), [single]($cy + $r2 * [math]::Sin($a))
    )
  }

  # boss (center dome)
  $boss = $d * 0.2
  $bossBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $g.FillEllipse($bossBrush, [single]($cx - $boss / 2), [single]($cy - $boss / 2), [single]$boss, [single]$boss)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "wrote $path"
}

New-Item -ItemType Directory -Force -Path "public\icons" | Out-Null
New-Icon 192 "public\icons\icon-192.png"
New-Icon 512 "public\icons\icon-512.png"
New-Icon 512 "public\icons\icon-maskable-512.png" 0.52
New-Icon 180 "public\icons\apple-touch-icon.png"
