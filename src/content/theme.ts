interface Rgb {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

export function detectTheme(anchor: HTMLElement): "light" | "dark" {
  let node: HTMLElement | null = anchor;
  for (let depth = 0; depth < 6 && node; depth += 1) {
    const parsed = parseColor(getComputedStyle(node).backgroundColor);
    if (parsed && parsed.alpha > 0.5) {
      const luminance = (0.2126 * parsed.r + 0.7152 * parsed.g + 0.0722 * parsed.b) / 255;
      return luminance > 0.62 ? "light" : "dark";
    }
    node = node.parentElement;
  }
  return "dark";
}

function parseColor(value: string): Rgb | null {
  const match = value.match(
    /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)/,
  );
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    alpha: match[4] === undefined ? 1 : Number(match[4]),
  };
}
