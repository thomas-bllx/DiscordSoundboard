import { z } from "zod";

const endpointsSchema = z.array(
  z.object({
    Flow: z.enum(["Render", "Capture"]),
    State: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]),
  }),
);

export function cableAvailability(
  raw: string,
): "present" | "disabled" | "unavailable" | "missing" {
  const endpoints = endpointsSchema
    .parse(JSON.parse(raw))
    .filter((endpoint) => endpoint.State !== 4);
  if (
    ["Render", "Capture"].every((flow) =>
      endpoints.some((endpoint) => endpoint.Flow === flow && endpoint.State === 1),
    )
  )
    return "present";
  if (endpoints.some((endpoint) => endpoint.State === 2)) return "disabled";
  return endpoints.length ? "unavailable" : "missing";
}

// Query the documented Core Audio API. MMDevices registry values are not API
// device states: 0x10000001 in that registry can represent a disabled endpoint.
// https://learn.microsoft.com/windows/win32/api/mmdeviceapi/nf-mmdeviceapi-immdevice-getstate
export const cableEndpointQuery = String.raw`$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

namespace Soundboard {
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class DeviceEnumerator {}
  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int flow, uint mask, out IDeviceCollection devices);
  }
  [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IDeviceCollection {
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int Item(uint index, out IDevice device);
  }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IDevice {
    [PreserveSig] int Activate(ref Guid iid, uint context, IntPtr parameters, out IntPtr result);
    [PreserveSig] int OpenPropertyStore(uint access, out IPropertyStore properties);
    [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    [PreserveSig] int GetState(out uint state);
  }
  [StructLayout(LayoutKind.Sequential)] struct PropertyKey {
    public Guid Format;
    public uint Id;
    public PropertyKey(string format, uint id) { Format = new Guid(format); Id = id; }
  }
  // PROPVARIANT is 24 bytes on the supported Windows x64 platform.
  [StructLayout(LayoutKind.Explicit, Size = 24)] struct PropVariant {
    [FieldOffset(0)] public ushort Type;
    [FieldOffset(8)] public IntPtr Pointer;
  }
  [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPropertyStore {
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int GetAt(uint index, out PropertyKey key);
    [PreserveSig] int GetValue(ref PropertyKey key, out PropVariant value);
  }
  public class CableEndpoint {
    public string Flow { get; set; }
    public uint State { get; set; }
  }
  public static class AudioProbe {
    [DllImport("ole32.dll")] static extern int PropVariantClear(ref PropVariant value);
    static string ReadString(IPropertyStore properties, PropertyKey key) {
      PropVariant value;
      Marshal.ThrowExceptionForHR(properties.GetValue(ref key, out value));
      try { return value.Type == 31 ? Marshal.PtrToStringUni(value.Pointer) : ""; }
      finally { PropVariantClear(ref value); }
    }
    public static CableEndpoint[] Read() {
      var result = new List<CableEndpoint>();
      var enumerator = (IDeviceEnumerator)new DeviceEnumerator();
      try {
        for (int flow = 0; flow < 2; flow++) {
          IDeviceCollection devices;
          Marshal.ThrowExceptionForHR(enumerator.EnumAudioEndpoints(flow, 15, out devices));
          try {
            uint count;
            Marshal.ThrowExceptionForHR(devices.GetCount(out count));
            for (uint i = 0; i < count; i++) {
              IDevice device;
              Marshal.ThrowExceptionForHR(devices.Item(i, out device));
              try {
                IPropertyStore properties;
                Marshal.ThrowExceptionForHR(device.OpenPropertyStore(0, out properties));
                try {
                  // Adapter identity is independent of user-renamed endpoint labels.
                  string adapter = ReadString(properties, new PropertyKey("b3f8fa53-0004-438e-9003-51a46e139bfc", 6));
                  if (!Regex.IsMatch(adapter ?? "", @"^(\d+- )?VB-Audio Virtual Cable$", RegexOptions.IgnoreCase)) continue;
                  string description = ReadString(properties, new PropertyKey("a45c254e-df1c-4efd-8020-67d146a850e0", 2));
                  if (description != (flow == 0 ? "CABLE Input" : "CABLE Output")) continue;
                  uint state;
                  Marshal.ThrowExceptionForHR(device.GetState(out state));
                  result.Add(new CableEndpoint { Flow = flow == 0 ? "Render" : "Capture", State = state });
                } finally { Marshal.ReleaseComObject(properties); }
              } finally { Marshal.ReleaseComObject(device); }
            }
          } finally { Marshal.ReleaseComObject(devices); }
        }
      } finally { Marshal.ReleaseComObject(enumerator); }
      return result.ToArray();
    }
  }
}
'@
ConvertTo-Json -InputObject @([Soundboard.AudioProbe]::Read()) -Compress`;
