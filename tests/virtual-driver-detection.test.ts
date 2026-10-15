import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { VirtualDriver } from "../src/main/virtual-driver";
import { cableAvailability, cableEndpointQuery } from "../src/main/audio-endpoints";

const pair = (render: number, capture = render) => JSON.stringify([
  { Flow: "Render", State: render }, { Flow: "Capture", State: capture },
]);

describe("VB-CABLE endpoint states", () => {
  it.each([
    [pair(1), "present"],
    [pair(2), "disabled"],
    [pair(1, 2), "disabled"],
    [pair(2, 1), "disabled"],
    [pair(8), "unavailable"],
    [pair(1, 4), "unavailable"],
    [pair(4, 1), "unavailable"],
    [pair(4), "missing"],
    ["[]", "missing"],
  ])("classifies Core Audio result %s as %s", (raw, expected) => {
    expect(cableAvailability(raw)).toBe(expected);
  });

  it("ignores stale and disabled duplicates when both active endpoints exist", () => {
    const raw = JSON.stringify([
      ...JSON.parse(pair(4)), ...JSON.parse(pair(2)), ...JSON.parse(pair(1)),
    ]);
    expect(cableAvailability(raw)).toBe("present");
  });

  it.each(["", "{}", "null", '[{"Flow":"Other","State":1}]', pair(0x10000001)])(
    "rejects malformed results or raw registry flags instead of claiming availability: %s",
    (raw) => expect(() => cableAvailability(raw)).toThrow(),
  );

  it.each([[1, "installed"], [2, "disabled"], [8, "unavailable"]] as const)(
    "does not run the installer for existing endpoints in state %i",
    async (state, expected) => {
      const execute = vi.fn(async () => pair(state));
      const driver = new VirtualDriver("unused", "unused", vi.fn(), execute);
      expect((await driver.install()).status).toBe(expected);
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );

  it("rediscovers disabled endpoints in a fresh app session without requesting reinstallation", async () => {
    const execute = vi.fn(async () => pair(2));
    for (let launch = 0; launch < 2; launch++) {
      const driver = new VirtualDriver("unused", "unused", vi.fn(), execute);
      expect((await driver.refresh()).status).toBe("disabled");
    }
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("reports a failed query instead of claiming the driver is missing", async () => {
    const driver = new VirtualDriver("unused", "unused", vi.fn(), async () => {
      throw new Error("Windows audio unavailable");
    });
    expect((await driver.refresh()).status).toBe("error");
  });

  it.skipIf(process.platform !== "win32")("executes the actual Core Audio query without administrator rights or capture", async () => {
    const powershell = join(process.env.SystemRoot || "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
    const { stdout } = await promisify(execFile)(powershell, ["-NoProfile", "-NonInteractive", "-Command", cableEndpointQuery], { windowsHide: true, timeout: 20_000 });
    expect(["present", "disabled", "unavailable", "missing"]).toContain(cableAvailability(stdout));
  }, 25_000);
});
