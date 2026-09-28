import { SURVEY_OPTION_IDS } from './surveySchema.js';

export interface StoredInvitation {
  nombre: string;
  usado: boolean;
  responseId?: string;
}

export interface FirestoreTimestampLike {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

export type StoredSurveyResponse =
  | { schemaVersion: 1; answers: Record<string, string> }
  | {
    schemaVersion: 2;
    participantName: string;
    answers: Record<string, string>;
    createdAt: FirestoreTimestampLike;
    submittedAt: FirestoreTimestampLike;
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && expectedKeys.every((key) => Object.hasOwn(value, key));
}

function isFirestoreTimestamp(value: unknown): value is FirestoreTimestampLike {
  if (!isRecord(value)) return false;
  if (!Number.isInteger(value.seconds)
    || !Number.isInteger(value.nanoseconds)
    || typeof value.toDate !== 'function'
    || typeof value.toMillis !== 'function') {
    return false;
  }

  const toMillis = value.toMillis as () => number;
  const toDate = value.toDate as () => unknown;
  try {
    const date = toDate();
    return Number(value.seconds) >= -62_135_596_800
      && Number(value.seconds) <= 253_402_300_799
      && Number(value.nanoseconds) >= 0
      && Number(value.nanoseconds) < 1_000_000_000
      && Number.isFinite(toMillis())
      && date instanceof Date
      && Number.isFinite(date.getTime());
  } catch {
    return false;
  }
}

export function parseInvitationDocument(value: unknown): StoredInvitation | null {
  if (!isRecord(value)
    || typeof value.nombre !== 'string'
    || value.nombre.trim().length === 0
    || typeof value.usado !== 'boolean') {
    return null;
  }

  if (value.responseId !== undefined
    && (typeof value.responseId !== 'string'
      || value.responseId.length === 0
      || value.responseId.length > 150
      || value.responseId.includes('/'))) {
    return null;
  }

  return {
    nombre: value.nombre,
    usado: value.usado,
    ...(typeof value.responseId === 'string' ? { responseId: value.responseId } : {}),
  };
}

export function parseSurveyAnswers(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;

  const questionIds = Object.keys(SURVEY_OPTION_IDS);
  if (Object.keys(value).length !== questionIds.length) return null;

  const answers: Record<string, string> = {};
  for (const questionId of questionIds) {
    const selectedOption = value[questionId];
    const allowedOptions: readonly string[] = SURVEY_OPTION_IDS[questionId as keyof typeof SURVEY_OPTION_IDS];
    if (typeof selectedOption !== 'string' || !allowedOptions.includes(selectedOption)) return null;
    answers[questionId] = selectedOption;
  }

  return answers;
}

export function parseStoredSurveyResponse(value: unknown): StoredSurveyResponse | null {
  if (!isRecord(value)) return null;

  if (value.schemaVersion === undefined) {
    const answers = parseSurveyAnswers(value);
    return answers ? { schemaVersion: 1, answers } : null;
  }

  const expectedKeys = ['schemaVersion', 'participantName', 'answers', 'createdAt', 'submittedAt'];
  if (value.schemaVersion !== 2 || !hasExactKeys(value, expectedKeys)) return null;

  const answers = parseSurveyAnswers(value.answers);
  if (!answers
    || typeof value.participantName !== 'string'
    || value.participantName.trim().length === 0
    || !isFirestoreTimestamp(value.createdAt)
    || !isFirestoreTimestamp(value.submittedAt)) {
    return null;
  }

  return {
    schemaVersion: 2,
    participantName: value.participantName,
    answers,
    createdAt: value.createdAt,
    submittedAt: value.submittedAt,
  };
}