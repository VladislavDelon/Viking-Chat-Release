Add-Type -AssemblyName System.Drawing

$src = "public\icons\icon-512.png"

function Resize-Icon([int]$size, [string]$path) {
  $img = [System.Drawing.Image]::FromFile((Resolve-Path $src))
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.DrawImage($img, 0, 0, $size, $size)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  Write-Output "$path ($size)"
}

$base = "android\app\src\main\res"
$densities = @{
  "mipmap-mdpi"    = @{ launcher = 48;  foreground = 108 }
  "mipmap-hdpi"    = @{ launcher = 72;  foreground = 162 }
  "mipmap-xhdpi"   = @{ launcher = 96;  foreground = 216 }
  "mipmap-xxhdpi"  = @{ launcher = 144; foreground = 324 }
  "mipmap-xxxhdpi" = @{ launcher = 192; foreground = 432 }
}

foreach ($d in $densities.GetEnumerator()) {
  $dir = Join-Path $base $d.Key
  Resize-Icon $d.Value.launcher   (Join-Path $dir "ic_launcher.png")
  Resize-Icon $d.Value.launcher   (Join-Path $dir "ic_launcher_round.png")
  Resize-Icon $d.Value.foreground (Join-Path $dir "ic_launcher_foreground.png")
}
