import AppKit
import Foundation

guard CommandLine.arguments.count == 2 else {
  fputs("usage: read-clipboard-image.swift <output.png>\n", stderr)
  exit(64)
}

let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let pasteboard = NSPasteboard.general

if let png = pasteboard.data(forType: .png) {
  try png.write(to: outputURL)
  print("png")
  exit(0)
}

if let tiff = pasteboard.data(forType: .tiff),
   let bitmap = NSBitmapImageRep(data: tiff),
   let png = bitmap.representation(using: .png, properties: [:]) {
  try png.write(to: outputURL)
  print("tiff")
  exit(0)
}

fputs("clipboard does not contain an image\n", stderr)
exit(2)
