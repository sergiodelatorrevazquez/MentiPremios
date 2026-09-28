import { describe, expect, it } from 'vitest';
import {
  parseInvitationDocument,
  parseStoredSurveyResponse,
  parseSurveyAnswers,
} from '../../functions/src/firestoreSchemas';
import { SURVEY_OPTION_IDS } from '../../functions/src/surveySchema';

const validAnswers = Object.fromEntries(
  Object.entries(SURVEY_OPTION_IDS).map(([questionId, options]) => [questionId, options[0]]),
);
const timestamp = {
  seconds: 1,
  nanoseconds: 0,
  toDate: () => new Date(1000),
  toMillis: () => 1000,
};

describe('Firestore document parsers', () => {
  it('accepts valid invitation documents and optional response IDs', () => {
    expect(parseInvitationDocument({ nombre: 'Sergio', usado: false, responseId: 'opaque-id' }))
      .toEqual({ nombre: 'Sergio', usado: false, responseId: 'opaque-id' });
  });

  it.each([
    undefined,
    { usado: false },
    { nombre: ' ', usado: false },
    { nombre: 'Sergio', usado: 'false' },
    { nombre: 'Sergio', usado: false, responseId: '../bad' },
  ])('rejects malformed invitation data: %j', (value) => {
    expect(parseInvitationDocument(value)).toBeNull();
  });

  it('accepts only complete allowed answer maps', () => {
    expect(parseSurveyAnswers(validAnswers)).toEqual(validAnswers);
    expect(parseSurveyAnswers({ ...validAnswers, tonto: 'casper-1' })).toBeNull();
    expect(parseSurveyAnswers({ ...validAnswers, extra: 'value' })).toBeNull();
  });

  it('parses legacy flat response documents without rewriting their shape', () => {
    expect(parseStoredSurveyResponse(validAnswers)).toEqual({
      schemaVersion: 1,
      answers: validAnswers,
    });
  });

  it('parses valid v2 documents with Firestore timestamps', () => {
    expect(parseStoredSurveyResponse({
      schemaVersion: 2,
      participantName: 'Sergio',
      answers: validAnswers,
      createdAt: timestamp,
      submittedAt: timestamp,
    })).toMatchObject({ schemaVersion: 2, participantName: 'Sergio', answers: validAnswers });
  });

  it.each([
    { schemaVersion: 3, participantName: 'Sergio', answers: validAnswers, createdAt: timestamp, submittedAt: timestamp },
    { schemaVersion: 2, participantName: '', answers: validAnswers, createdAt: timestamp, submittedAt: timestamp },
    { schemaVersion: 2, participantName: 'Sergio', answers: validAnswers, createdAt: 'now', submittedAt: timestamp },
    { schemaVersion: 2, participantName: 'Sergio', answers: validAnswers, createdAt: { ...timestamp, nanoseconds: 1_000_000_000 }, submittedAt: timestamp },
    { schemaVersion: 2, participantName: 'Sergio', answers: validAnswers, createdAt: { ...timestamp, toDate: () => { throw new Error('bad timestamp'); } }, submittedAt: timestamp },
    { schemaVersion: 2, participantName: 'Sergio', answers: validAnswers, createdAt: timestamp, submittedAt: timestamp, secret: 'leak' },
    { schemaVersion: 2, participantName: 'Sergio', answers: { ...validAnswers, tonto: 'invalid' }, createdAt: timestamp, submittedAt: timestamp },
  ])('rejects malformed v2 response documents: %j', (value) => {
    expect(parseStoredSurveyResponse(value)).toBeNull();
  });
});