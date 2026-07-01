import Carbon
import Foundation

var commandToRun: [String] = []

let keyCodes: [String: UInt32] = [
  "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7,
  "c": 8, "v": 9, "b": 11, "q": 12, "w": 13, "e": 14, "r": 15,
  "y": 16, "t": 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22,
  "5": 23, "=": 24, "9": 25, "7": 26, "-": 27, "8": 28, "0": 29,
  "]": 30, "o": 31, "u": 32, "[": 33, "i": 34, "p": 35, "l": 37,
  "j": 38, "'": 39, "k": 40, ";": 41, "\\": 42, ",": 43, "/": 44,
  "n": 45, "m": 46, ".": 47, "`": 50, "space": 49, "escape": 53,
  "f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97,
  "f7": 98, "f8": 100, "f9": 101, "f10": 109, "f11": 103, "f12": 111
]

func parseHotkey(_ spec: String) -> (UInt32, UInt32)? {
  let parts = spec.lowercased().split(separator: "+").map(String.init)
  guard let key = parts.last, let keyCode = keyCodes[key] else {
    return nil
  }

  var modifiers: UInt32 = 0
  for part in parts.dropLast() {
    switch part {
    case "cmd", "command": modifiers |= UInt32(cmdKey)
    case "ctrl", "control": modifiers |= UInt32(controlKey)
    case "opt", "option", "alt": modifiers |= UInt32(optionKey)
    case "shift": modifiers |= UInt32(shiftKey)
    default: return nil
    }
  }
  return (keyCode, modifiers)
}

func runCommand() {
  guard let executable = commandToRun.first else { return }
  let process = Process()
  process.executableURL = URL(fileURLWithPath: executable)
  process.arguments = Array(commandToRun.dropFirst())
  try? process.run()
}

let handler: EventHandlerUPP = { _, _, _ in
  runCommand()
  return noErr
}

guard let separator = CommandLine.arguments.firstIndex(of: "--"),
      CommandLine.arguments.count > separator + 1,
      CommandLine.arguments.count >= 3 else {
  fputs("usage: hotkey.swift <key> -- <command> [args...]\n", stderr)
  exit(64)
}

let hotkeySpec = CommandLine.arguments[1]
guard let (keyCode, modifiers) = parseHotkey(hotkeySpec) else {
  fputs("unsupported hotkey: \(hotkeySpec)\n", stderr)
  exit(64)
}

commandToRun = Array(CommandLine.arguments[(separator + 1)...])

var eventType = EventTypeSpec(
  eventClass: OSType(kEventClassKeyboard),
  eventKind: UInt32(kEventHotKeyPressed)
)
InstallEventHandler(GetApplicationEventTarget(), handler, 1, &eventType, nil, nil)

var hotKeyRef: EventHotKeyRef?
var hotKeyID = EventHotKeyID(signature: OSType(0x4C435059), id: 1)
let status = RegisterEventHotKey(
  keyCode,
  modifiers,
  hotKeyID,
  GetApplicationEventTarget(),
  0,
  &hotKeyRef
)

if status != noErr {
  fputs("could not register hotkey \(hotkeySpec): \(status)\n", stderr)
  exit(1)
}

print("LazyCopy hotkey listening: \(hotkeySpec)")
fflush(stdout)
RunApplicationEventLoop()
