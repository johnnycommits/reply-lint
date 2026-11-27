import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import Ajv from "ajv/dist/2020";
import bundled from "../signals/signals.json";
import { validateSignals } from "../src/engine/validate";

const schema = JSON.parse(
  readFileSync(resolve(process.cwd(), "signals/signals.schema.json"), "utf8"),
) as object;

const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

describe("signals schema", () => {
  it("accepts the bundled file", () => {
    const ok = validate(bundled);
    expect(validate.errors).toBeNull();
    expect(ok).toBe(true);
    expect(validateSignals(bundled).ok).toBe(true);
  });

  it("rejects a schema version the extension does not know", () => {
    const copy = structuredClone(bundled) as { schemaVersion: number };
    copy.schemaVersion = 2;
    expect(validate(copy)).toBe(false);
    const runtime = validateSignals(copy);
    expect(runtime.ok).toBe(false);
  });
});
