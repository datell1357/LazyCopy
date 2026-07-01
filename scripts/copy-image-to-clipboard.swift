import AppKit
import Foundation

guard CommandLine.arguments.count == 2 else {
  fputs("usage: copy-image-to-clipboard.swift <image.png>\n", stderr)
  exit(64)
}

let imagePath = CommandLine.arguments[1]
guard let image = NSImage(contentsOfFile: imagePath) else {
  fputs("could not read image\n", stderr)
  exit(66)
}

let pasteboard = NSPasteboard.general
pasteboard.clearContents()
if pasteboard.writeObjects([image]) {
  print("copied")
  exit(0)
}

fputs("could not write image to clipboard\n", stderr)
exit(1)
