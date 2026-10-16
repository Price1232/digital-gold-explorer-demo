/**
 * WAI-ARIA tablist navigation: Left/Right wrap, Home/End jump.
 * Returns the new index, or null for keys the tablist does not handle.
 */
export function nextTabIndex(key, index, count) {
  switch (key) {
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * WAI-ARIA radio group navigation: arrows move (and select) with wrap in
 * either axis; Home/End jump. Returns null for keys the group ignores.
 */
export function nextRadioIndex(key, index, count) {
  if (key === "ArrowDown") return nextTabIndex("ArrowRight", index, count);
  if (key === "ArrowUp") return nextTabIndex("ArrowLeft", index, count);
  return nextTabIndex(key, index, count);
}
