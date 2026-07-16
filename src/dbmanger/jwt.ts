import type { AuthPayload } from "../interfaces/AuthPayload";

const base64UrlDecode = (input: string): string => {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
};

export const decodeJwtPayload = (token: string): AuthPayload | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    return JSON.parse(base64UrlDecode(parts[1])) as AuthPayload;
  } catch (error) {
    console.error(`decodeJwtPayload(): Failed to decode token: ${error}`);
    return null;
  }
};
