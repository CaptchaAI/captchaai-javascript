import { CaptchaAI, CaptchaAIConstructorOptions } from "./client.js";

export class AsyncCaptchaAI {
  private constructor(private readonly client: CaptchaAI) {}

  public static async create(options: CaptchaAIConstructorOptions): Promise<AsyncCaptchaAI> {
    const client = new CaptchaAI(options);
    await client.threadsInfo();
    return new AsyncCaptchaAI(client);
  }

  public normal(...args: Parameters<CaptchaAI["normal"]>): ReturnType<CaptchaAI["normal"]> {
    return this.client.normal(...args);
  }

  public grid(...args: Parameters<CaptchaAI["grid"]>): ReturnType<CaptchaAI["grid"]> {
    return this.client.grid(...args);
  }

  public bls(...args: Parameters<CaptchaAI["bls"]>): ReturnType<CaptchaAI["bls"]> {
    return this.client.bls(...args);
  }

  public recaptchaV2(
    ...args: Parameters<CaptchaAI["recaptchaV2"]>
  ): ReturnType<CaptchaAI["recaptchaV2"]> {
    return this.client.recaptchaV2(...args);
  }

  public recaptchaV3(
    ...args: Parameters<CaptchaAI["recaptchaV3"]>
  ): ReturnType<CaptchaAI["recaptchaV3"]> {
    return this.client.recaptchaV3(...args);
  }

  public turnstile(
    ...args: Parameters<CaptchaAI["turnstile"]>
  ): ReturnType<CaptchaAI["turnstile"]> {
    return this.client.turnstile(...args);
  }

  public cloudflareChallenge(
    ...args: Parameters<CaptchaAI["cloudflareChallenge"]>
  ): ReturnType<CaptchaAI["cloudflareChallenge"]> {
    return this.client.cloudflareChallenge(...args);
  }

  public geetest(...args: Parameters<CaptchaAI["geetest"]>): ReturnType<CaptchaAI["geetest"]> {
    return this.client.geetest(...args);
  }

  public captchafox(
    ...args: Parameters<CaptchaAI["captchafox"]>
  ): ReturnType<CaptchaAI["captchafox"]> {
    return this.client.captchafox(...args);
  }

  public friendlyCaptcha(
    ...args: Parameters<CaptchaAI["friendlyCaptcha"]>
  ): ReturnType<CaptchaAI["friendlyCaptcha"]> {
    return this.client.friendlyCaptcha(...args);
  }

  public lemin(...args: Parameters<CaptchaAI["lemin"]>): ReturnType<CaptchaAI["lemin"]> {
    return this.client.lemin(...args);
  }

  public threadsInfo(
    ...args: Parameters<CaptchaAI["threadsInfo"]>
  ): ReturnType<CaptchaAI["threadsInfo"]> {
    return this.client.threadsInfo(...args);
  }

  public send(...args: Parameters<CaptchaAI["send"]>): ReturnType<CaptchaAI["send"]> {
    return this.client.send(...args);
  }

  public getResult(
    ...args: Parameters<CaptchaAI["getResult"]>
  ): ReturnType<CaptchaAI["getResult"]> {
    return this.client.getResult(...args);
  }

  public async aclose(): Promise<void> {
    await this.client.close();
  }
}
