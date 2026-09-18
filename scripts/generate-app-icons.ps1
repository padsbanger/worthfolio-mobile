Add-Type -AssemblyName System.Drawing

$assetDirectory = Join-Path $PSScriptRoot '..\\assets'
New-Item -ItemType Directory -Force -Path $assetDirectory | Out-Null

function New-WorthfolioIcon {
  param(
    [string]$Path,
    [bool]$TransparentBackground
  )

  $size = 1024
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

  if ($TransparentBackground) {
    $graphics.Clear([System.Drawing.Color]::Transparent)
  } else {
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#10141D'))
  }

  $scale = 12.5
  $offset = 112
  $primary = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#F0F3FA'), 6 * $scale)
  $accent = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#7297FF'), 3 * $scale)
  foreach ($pen in @($primary, $accent)) {
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  }

  $mark = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($offset + 12 * $scale, $offset + 16 * $scale),
    [System.Drawing.PointF]::new($offset + 24 * $scale, $offset + 50 * $scale),
    [System.Drawing.PointF]::new($offset + 32 * $scale, $offset + 28 * $scale),
    [System.Drawing.PointF]::new($offset + 40 * $scale, $offset + 50 * $scale),
    [System.Drawing.PointF]::new($offset + 52 * $scale, $offset + 16 * $scale)
  )
  $trend = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($offset + 18 * $scale, $offset + 35 * $scale),
    [System.Drawing.PointF]::new($offset + 27 * $scale, $offset + 28 * $scale),
    [System.Drawing.PointF]::new($offset + 37 * $scale, $offset + 34 * $scale),
    [System.Drawing.PointF]::new($offset + 48 * $scale, $offset + 21 * $scale)
  )

  $graphics.DrawLines($primary, $mark)
  $graphics.DrawLines($accent, $trend)
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $accent.Dispose()
  $primary.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-WorthfolioIcon -Path (Join-Path $assetDirectory 'icon.png') -TransparentBackground $false
New-WorthfolioIcon -Path (Join-Path $assetDirectory 'android-icon-foreground.png') -TransparentBackground $true
