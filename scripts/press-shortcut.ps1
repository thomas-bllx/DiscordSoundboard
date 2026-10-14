param([int]$Key = 0x39)
# Test driver only: normal Windows key events, never injected into a game process.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SoundboardTestKeys {
  [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
  public static void Send(byte key) {
    keybd_event(0x11, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(key, 0, 0, UIntPtr.Zero);
    keybd_event(key, 0, 2, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    keybd_event(0x11, 0, 2, UIntPtr.Zero);
  }
}
'@
[SoundboardTestKeys]::Send([byte]$Key)
