export function toSentenceCase(value: string) {
  return value
    .toLocaleLowerCase("en")
    .replace(/(^\s*\p{L})|([.!?]\s+\p{L})/gu, (m) => m.toLocaleUpperCase("en"));
}

export function toBrandCase(value: string) {
  return value.toLocaleUpperCase("en");
}
