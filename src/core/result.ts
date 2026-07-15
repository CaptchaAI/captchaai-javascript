export type SolveSolution = string | string[] | Record<string, unknown>;

export interface SolveResultInit {
  taskId: string;
  solution: SolveSolution;
  userAgent: string | undefined;
  raw: Record<string, unknown> | undefined;
  rawText: string | undefined;
}

export class SolveResult {
  public readonly taskId: string;
  public readonly solution: SolveSolution;
  public readonly userAgent: string | undefined;
  public readonly raw: Record<string, unknown> | undefined;
  public readonly rawText: string | undefined;

  public constructor(init: SolveResultInit) {
    this.taskId = init.taskId;
    this.solution = init.solution;
    this.userAgent = init.userAgent;
    this.raw = init.raw;
    this.rawText = init.rawText;
  }

  public toString(): string {
    if (Array.isArray(this.solution) || typeof this.solution === "object") {
      return JSON.stringify(this.solution);
    }
    return this.solution;
  }
}
