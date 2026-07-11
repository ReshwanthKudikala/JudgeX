export type AiAssistAction =
  | 'ask'
  | 'explain_code'
  | 'explain_verdict'
  | 'why_failed'
  | 'optimize'
  | 'suggest_optimizations'
  | 'complexity'
  | 'analyze_complexity'
  | 'hint'
  | 'generate_hint'
  | 'reveal_solution';

export interface AiLearningReply {
  action?: string;
  submissionId?: string;
  problemId?: string;
  reply: string;
  summary: string;
  timeComplexity: string | null;
  spaceComplexity: string | null;
  hintLevel: number | null;
  wasBlocked: boolean;
}

export interface AiLearningAssistInput {
  action: AiAssistAction;
  problemId?: string;
  submissionId?: string;
  language?: 'python' | 'cpp';
  sourceCode?: string;
  message?: string;
  hintLevel?: 1 | 2 | 3 | 4;
  revealSolution?: boolean;
}

export interface AiConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  summary?: string;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  hintLevel?: number | null;
  wasBlocked?: boolean;
  createdAt: string;
}
