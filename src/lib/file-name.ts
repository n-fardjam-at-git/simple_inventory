/** A name that Windows, macOS, and Linux accept as a file name. */
export function safeFileName(value: string, max = 60) {
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "");
  return cleaned.slice(0, max).trim();
}
