import { Buffer } from 'node:buffer';
import { SURVEY_OPTION_IDS } from './surveySchema.js';

export const MAX_SUBMISSION_BYTES = 4096;

export interface ParsedSurveySubmission {
  invitationId: string;
  answers: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseSurveySubmission(value: unknown): ParsedSurveySubmission | null {
  if (!isRecord(value)) return null;

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return null;
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SUBMISSION_BYTES) return null;

  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes('invitationId') || !keys.includes('answers')) return null;

  const { invitationId, answers } = value;
  if (typeof invitationId !== 'string'
    || invitationId.length === 0
    || invitationId.length > 128
    || invitationId !== invitationId.trim()
    || invitationId.includes('/')
    || !isRecord(answers)) {
    return null;
  }

  const questionIds = Object.keys(SURVEY_OPTION_IDS);
  if (Object.keys(answers).length !== questionIds.length) return null;

  const parsedAnswers: Record<string, string> = {};
  for (const questionId of questionIds) {
    const selectedOption = answers[questionId];
    const allowedOptions: readonly string[] = SURVEY_OPTION_IDS[questionId as keyof typeof SURVEY_OPTION_IDS];
    if (typeof selectedOption !== 'string' || !allowedOptions.includes(selectedOption)) return null;
    parsedAnswers[questionId] = selectedOption;
  }

  return { invitationId, answers: parsedAnswers };
}