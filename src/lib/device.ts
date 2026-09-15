const DEVICE_KEY = "fb_camia_device_v1";

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function getOrCreateDeviceToken() {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToBase64Url(bytes);
  localStorage.setItem(DEVICE_KEY, token);
  return token;
}

