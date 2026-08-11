import { apiVersion } from "obsidian";

function parseVersion(version: string): number[] {
  return version.split(".").map((part) => parseInt(part, 10) || 0);
}

/** Compare Obsidian app version against a semver string (e.g. "1.13.0"). */
export function isObsidianAtLeast(minVersion: string): boolean {
  const current = parseVersion(apiVersion);
  const minimum = parseVersion(minVersion);
  const length = Math.max(current.length, minimum.length);

  for (let index = 0; index < length; index += 1) {
    const left = current[index] ?? 0;
    const right = minimum[index] ?? 0;
    if (left !== right) {
      return left > right;
    }
  }

  return true;
}
