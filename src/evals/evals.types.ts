export type GoldenCase = {
  readonly question: string;
  readonly expectedTopics: string[];
  readonly expectedSourceTag: string | null;
};

export type EvalJudgeInput = {
  readonly question: string;
  readonly answer: string;
  readonly expectedTopics: string[];
  readonly contextChunks: string[];
};

export type EvalJudgeResult = {
  readonly relevance: number;
  readonly faithfulness: number;
  readonly reasoning: string;
};
