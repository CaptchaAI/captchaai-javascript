export type ProxyType = "HTTP" | "HTTPS" | "SOCKS4" | "SOCKS5";
export type ImageInput = string | Uint8Array;

export interface PerCallProxyOptions {
  proxy?: string;
  proxyType?: ProxyType;
}

export interface BrowserSolveOptions extends PerCallProxyOptions {
  cookies?: string;
  userAgent?: string;
}
