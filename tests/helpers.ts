import { randomUUID } from "node:crypto";
import { DEFAULT_PROFILE, type Sound } from "../src/shared/model";
export function sound(overrides: Partial<Sound> = {}): Sound {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    file: `${id}.wav`,
    profileId: DEFAULT_PROFILE,
    name: "Test",
    color: "#66e3c4",
    icon: "♪",
    shortcut: "",
    volume: 1,
    duration: 1,
    favorite: false,
    ...overrides,
  };
}
export function wav(seconds = 0.1): Buffer {
  const samples = Math.floor(48000 * seconds);
  const data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(48000, 24);
  data.writeUInt32LE(96000, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    data.writeInt16LE(
      Math.round(1000 * Math.sin((2 * Math.PI * 440 * i) / 48000)),
      44 + i * 2,
    );
  return data;
}
