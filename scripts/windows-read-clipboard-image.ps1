param(
  [Parameter(Mandatory = $true)][string]$TargetPath
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$image = [System.Windows.Forms.Clipboard]::GetImage()
if ($null -eq $image) {
  throw "No clipboard image is available."
}

$parent = Split-Path -Parent $TargetPath
if ($parent) {
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
}

$image.Save($TargetPath, [System.Drawing.Imaging.ImageFormat]::Png)
