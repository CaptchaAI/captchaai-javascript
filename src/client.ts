import { ClientOptions, Config, buildConfig } from "./core/config.js";
import { getEntry } from "./core/registry.js";
import { SolveResult } from "./core/result.js";
import * as orchestrator from "./core/orchestrator.js";
import { InvalidKeyError, ThreadLimitError, ValidationError } from "./errors.js";
import { FetchTransport } from "./transport/http.js";
import { BrowserSolveOptions, ImageInput, PerCallProxyOptions, ProxyType } from "./types.js";

export interface CaptchaAIConstructorOptions extends ClientOptions {
  apiKey: string;
}

interface NormalOptions extends PerCallProxyOptions {
  numeric?: number;
  minLen?: number;
  maxLen?: number;
  phrase?: number;
  caseSensitive?: number;
  lang?: string;
  instructions?: string;
}

interface FriendlyCaptchaOptions extends PerCallProxyOptions {
  version?: "v1" | "v2";
}

interface LeminOptions extends PerCallProxyOptions {
  apiServer?: string;
}

function ensureApiKey(apiKey: string): void {
  if (typeof apiKey !== "string" || apiKey.trim().length !== 32) {
    throw new InvalidKeyError("Key must be 32 characters");
  }
}

export class CaptchaAI {
  private readonly config: Config;
  private readonly transport: FetchTransport;
  private threadCap = 0;
  private inFlight = 0;
  private readonly initPromise: Promise<void>;

  public constructor(options: CaptchaAIConstructorOptions) {
    ensureApiKey(options.apiKey);
    if (options.proxy && !options.proxyType) {
      throw new ValidationError("proxyType is required when proxy is set");
    }
    this.config = buildConfig(options.apiKey, options);
    this.transport = new FetchTransport(this.config.networkTimeoutMs);
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    const info = await orchestrator.threadsInfo(this.config, this.transport.requestRaw.bind(this.transport));
    this.threadCap = info.threads;
  }

  private async ready(): Promise<void> {
    await this.initPromise;
  }

  private withProxy(
    params: Record<string, unknown>,
    options?: PerCallProxyOptions
  ): { cfg: Config; requestParams: Record<string, unknown> } {
    if (!options?.proxy) {
      return { cfg: this.config, requestParams: params };
    }
    if (!options.proxyType) {
      throw new ValidationError("proxyType is required when proxy is set");
    }
    const cfg: Config = { ...this.config, proxy: options.proxy, proxyType: options.proxyType };
    return { cfg, requestParams: params };
  }

  private async solveType(
    typeName: string,
    params: Record<string, unknown>,
    options?: PerCallProxyOptions
  ): Promise<SolveResult> {
    await this.ready();
    const entry = getEntry(typeName);
    const { cfg, requestParams } = this.withProxy(params, options);

    if (!cfg.autoRetry) {
      if (this.inFlight >= this.threadCap) {
        throw new ThreadLimitError(`Thread cap reached (${this.threadCap} concurrent solves active)`);
      }
      this.inFlight += 1;
      try {
        return await orchestrator.solveCaptcha(cfg, entry, requestParams, this.transport.requestRaw.bind(this.transport));
      } finally {
        this.inFlight -= 1;
      }
    }

    return orchestrator.solveCaptcha(cfg, entry, requestParams, this.transport.requestRaw.bind(this.transport));
  }

  public async normal(image: ImageInput, options: NormalOptions = {}): Promise<SolveResult> {
    return this.solveType(
      "normal",
      {
        image,
        numeric: options.numeric,
        min_len: options.minLen,
        max_len: options.maxLen,
        phrase: options.phrase,
        caseSensitive: options.caseSensitive,
        lang: options.lang,
        textinstructions: options.instructions
      },
      options
    );
  }

  public async grid(
    image: ImageInput,
    instructions: string,
    gridSize: "3x3" | "4x4",
    options: PerCallProxyOptions = {}
  ): Promise<SolveResult> {
    return this.solveType(
      "grid",
      { image, instructions, grid_size: gridSize, img_type: "recaptcha" },
      options
    );
  }

  public async bls(images: ImageInput[], instructions: string, options: PerCallProxyOptions = {}): Promise<SolveResult> {
    return this.solveType("bls", { images, instructions }, options);
  }

  public async recaptchaV2(
    sitekey: string,
    url: string,
    options: BrowserSolveOptions & { invisible?: boolean; enterprise?: boolean; action?: string } = {}
  ): Promise<SolveResult> {
    const typeName = options.enterprise
      ? "recaptcha_v2_enterprise"
      : options.invisible
        ? "recaptcha_v2_invisible"
        : "recaptcha_v2";
    return this.solveType(
      typeName,
      {
        googlekey: sitekey,
        pageurl: url,
        invisible: options.invisible ? 1 : undefined,
        enterprise: options.enterprise ? 1 : undefined,
        action: options.action,
        cookies: options.cookies,
        user_agent: options.userAgent
      },
      options
    );
  }

  public async recaptchaV3(
    sitekey: string,
    url: string,
    options: BrowserSolveOptions & { action?: string; enterprise?: boolean; minScore?: number } = {}
  ): Promise<SolveResult> {
    return this.solveType(
      options.enterprise ? "recaptcha_v3_enterprise" : "recaptcha_v3",
      {
        googlekey: sitekey,
        pageurl: url,
        version: "v3",
        action: options.action,
        enterprise: options.enterprise ? 1 : undefined,
        min_score: options.minScore,
        cookies: options.cookies,
        user_agent: options.userAgent
      },
      options
    );
  }

  public async turnstile(sitekey: string, url: string, options: BrowserSolveOptions = {}): Promise<SolveResult> {
    return this.solveType(
      "turnstile",
      { sitekey, pageurl: url, cookies: options.cookies, user_agent: options.userAgent },
      options
    );
  }

  public async cloudflareChallenge(url: string, options: BrowserSolveOptions = {}): Promise<SolveResult> {
    return this.solveType(
      "cloudflare_challenge",
      { pageurl: url, cookies: options.cookies, user_agent: options.userAgent },
      options
    );
  }

  public async geetest(
    gt: string,
    challenge: string,
    url: string,
    options: BrowserSolveOptions = {}
  ): Promise<SolveResult> {
    return this.solveType(
      "geetest",
      { gt, challenge, pageurl: url, cookies: options.cookies, user_agent: options.userAgent },
      options
    );
  }

  public async captchafox(sitekey: string, url: string, options: BrowserSolveOptions = {}): Promise<SolveResult> {
    return this.solveType(
      "captchafox",
      { sitekey, pageurl: url, cookies: options.cookies, user_agent: options.userAgent },
      options
    );
  }

  public async friendlyCaptcha(
    sitekey: string,
    url: string,
    options: FriendlyCaptchaOptions = {}
  ): Promise<SolveResult> {
    return this.solveType("friendly_captcha", { sitekey, pageurl: url, version: options.version }, options);
  }

  public async lemin(
    captchaId: string,
    divId: string,
    url: string,
    options: LeminOptions = {}
  ): Promise<SolveResult> {
    return this.solveType(
      "lemin",
      { captcha_id: captchaId, div_id: divId, pageurl: url, api_server: options.apiServer },
      options
    );
  }

  public async threadsInfo(): Promise<{ threads: number; workingThreads: number }> {
    await this.ready();
    return orchestrator.threadsInfo(this.config, this.transport.requestRaw.bind(this.transport));
  }

  public async send(captchaType: string, params: Record<string, unknown>): Promise<string> {
    await this.ready();
    const entry = getEntry(captchaType);
    return orchestrator.submitTask(this.config, entry, params, this.transport.requestRaw.bind(this.transport));
  }

  public async getResult(captchaType: string, taskId: string): Promise<SolveResult> {
    await this.ready();
    const entry = getEntry(captchaType);
    return orchestrator.fetchResult(this.config, entry, taskId, this.transport.requestRaw.bind(this.transport));
  }

  public async close(): Promise<void> {
    await this.transport.close();
  }
}

export type { ProxyType };
