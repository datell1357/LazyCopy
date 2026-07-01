import AppKit
import CoreGraphics
import Foundation

guard let frontApp = NSWorkspace.shared.frontmostApplication else {
  fputs("no frontmost application\n", stderr)
  exit(2)
}

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
  fputs("could not list windows\n", stderr)
  exit(2)
}

for window in windows {
  let ownerPid = window[kCGWindowOwnerPID as String] as? pid_t
  let layer = window[kCGWindowLayer as String] as? Int
  let windowId = window[kCGWindowNumber as String] as? Int
  let bounds = window[kCGWindowBounds as String] as? [String: Any]
  let width = bounds?["Width"] as? Double ?? 0
  let height = bounds?["Height"] as? Double ?? 0

  if ownerPid == frontApp.processIdentifier,
     layer == 0,
     let windowId,
     width > 1,
     height > 1 {
    print(windowId)
    exit(0)
  }
}

fputs("frontmost app has no capturable window\n", stderr)
exit(2)
