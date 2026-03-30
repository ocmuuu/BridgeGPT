const MAX_AGE = 7776000;

export function getCookie(name: string): string {
  const parts = (`; ${document.cookie}`).split(`; ${name}=`);
  if (parts.length < 2) return "";
  return decodeURIComponent(parts.pop()!.split(";").shift() || "");
}

export function setCookie(name: string, val: string): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(val)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
}
