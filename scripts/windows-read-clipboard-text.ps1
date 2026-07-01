$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$text = [System.Windows.Forms.Clipboard]::GetText()
if ([string]::IsNullOrEmpty($text)) {
  throw "Clipboard text is empty."
}

[Console]::Write($text)
