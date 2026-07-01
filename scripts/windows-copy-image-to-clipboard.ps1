param(
  [Parameter(Mandatory = $true)][string]$ImagePath
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$resolved = Resolve-Path -LiteralPath $ImagePath
$image = [System.Drawing.Image]::FromFile($resolved.Path)
try {
  $bitmap = New-Object System.Drawing.Bitmap($image)
  [System.Windows.Forms.Clipboard]::SetImage($bitmap)
} finally {
  $image.Dispose()
}
