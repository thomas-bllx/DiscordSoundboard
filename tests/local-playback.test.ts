import { describe, expect, it, vi } from "vitest";
import { LocalPlayback } from "../src/main/local-playback";
import { sound } from "./helpers";

describe("lecture locale", () => {
  it("prevents a late ended event from clearing a newer sound", () => {
    const player = new LocalPlayback(vi.fn(), vi.fn());
    player.play(sound(), 1, true);
    const first = player.state.requestId;
    const next = sound();
    player.play(next, 0.4, true);
    player.report(first, "ended");
    expect(player.state.soundId).toBe(next.id);
  });
  it("STOP invalidates any delayed start callback", () => {
    const emit = vi.fn();
    const player = new LocalPlayback(emit, vi.fn());
    player.play(sound(), 1, true);
    const request = player.state.requestId;
    player.stop();
    player.report(request, "playing");
    expect(player.state.status).toBe("idle");
    expect(emit.mock.lastCall?.[0].type).toBe("stop");
  });
  it("rejects overlapping playback when interruption is disabled", () => {
    const player = new LocalPlayback(vi.fn(), vi.fn());
    player.play(sound(), 1, false);
    expect(() => player.play(sound(), 1, false)).toThrow("déjà en cours");
  });
  it("reports decode failure and returns to idle", () => {
    const player = new LocalPlayback(vi.fn(), vi.fn());
    player.play(sound(), 1, true);
    expect(player.report(player.state.requestId, "error")).toBe(true);
    expect(player.state.status).toBe("idle");
  });
});
