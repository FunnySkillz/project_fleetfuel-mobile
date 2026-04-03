export const REASON_PROMPT_CANCELLED_CODE = 'reason_prompt_cancelled';

type ErrorWithCode = Error & { code: string };

export function createReasonPromptCancelledError(): ErrorWithCode {
  const error = new Error('Reason prompt canceled by user.') as ErrorWithCode;
  error.code = REASON_PROMPT_CANCELLED_CODE;
  return error;
}

export function isReasonPromptCancelledError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: unknown }).code === REASON_PROMPT_CANCELLED_CODE;
}

