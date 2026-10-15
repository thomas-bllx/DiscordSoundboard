import { describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { VirtualDriver, psQuote } from "../src/main/virtual-driver";

const archive = resolve("vendor/vb-cable/VBCABLE_Driver_Pack45.zip");
async function dataDir() {
  await mkdir(".test-data", { recursive: true });
  return mkdtemp(resolve(".test-data/driver-test-"));
}
describe("installation du composant audio", () => {
  it("does not launch the installer if both endpoints already exist", async () => {
    const execute = vi.fn(async () => '[{"Flow":"Render","State":1},{"Flow":"Capture","State":1}]');
    const driver = new VirtualDriver(
      "unused",
      await dataDir(),
      vi.fn(),
      execute,
    );
    expect((await driver.install()).status).toBe("installed");
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it("rejects a modified archive before extraction or elevation", async () => {
    const root = await dataDir();
    const tampered = join(root, "tampered.zip");
    await writeFile(tampered, "untrusted");
    const execute = vi.fn(async () => "[]");
    expect(
      (await new VirtualDriver(tampered, root, vi.fn(), execute).install())
        .status,
    ).toBe("error");
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it("treats UAC cancellation as cancellation and allows a retry", async () => {
    const execute = vi
      .fn<(_: string, timeout?: number) => Promise<string>>()
      .mockResolvedValueOnce("[]")
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce("cancelled")
      .mockResolvedValueOnce("[]");
    const driver = new VirtualDriver(
      archive,
      await dataDir(),
      vi.fn(),
      execute,
    );
    expect((await driver.install()).message).toContain("annulée");
    expect(execute.mock.calls[1]![0]).toContain("Get-AuthenticodeSignature");
    expect(execute.mock.calls[2]![0]).toContain("-Verb RunAs");
    expect((await driver.refresh()).status).toBe("missing");
  });
  it("does not mistake a successful process exit for an active audio driver", async () => {
    const execute = vi
      .fn<(_: string, timeout?: number) => Promise<string>>()
      .mockResolvedValueOnce("[]")
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce("exit:0")
      .mockResolvedValueOnce("[]");
    expect(
      (
        await new VirtualDriver(
          archive,
          await dataDir(),
          vi.fn(),
          execute,
        ).install()
      ).status,
    ).toBe("restart");
  });
  it("reports failure on an installer error with no active endpoints", async () => {
    const execute = vi
      .fn<(_: string, timeout?: number) => Promise<string>>()
      .mockResolvedValueOnce("[]")
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce("exit:42")
      .mockResolvedValueOnce("[]");
    expect(
      (
        await new VirtualDriver(
          archive,
          await dataDir(),
          vi.fn(),
          execute,
        ).install()
      ).status,
    ).toBe("error");
  });
  it("keeps paths containing apostrophes or shell syntax literal in PowerShell", () => {
    expect(psQuote("C:\\D'Angelo\\$(anything)\\file.exe")).toBe(
      "'C:\\D''Angelo\\$(anything)\\file.exe'",
    );
  });
});
