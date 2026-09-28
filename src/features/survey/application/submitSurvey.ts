import { validateSurveyAnswers } from '../domain/survey.rules';
import type { Pregunta, SurveySubmission } from '../domain/survey.types';
import {
  InvalidSubmissionError,
  PersistenceError,
} from './errors';

export interface SubmitSurveyInput {
  invitationId: string;
  participantName: string;
  questions: readonly Pregunta[];
  answers: Readonly<Record<string, string | undefined>>;
  persist: (submission: SurveySubmission) => Promise<void> | void;
}

export async function submitSurvey({
  invitationId,
  participantName,
  questions,
  answers,
  persist,
}: SubmitSurveyInput): Promise<SurveySubmission> {
  const surveyValidation = validateSurveyAnswers(questions, answers);

  if (!surveyValidation.valid) {
    throw new InvalidSubmissionError('invalid-submission', 'invalid-submission');
  }

  const submission: SurveySubmission = {
    invitationId,
    participantName,
    answers: Object.fromEntries(
      questions.map((question) => [question.id, answers[question.id] as string]),
    ) as SurveySubmission['answers'],
  };

  try {
    await persist(submission);
  } catch (error) {
    // Se guarda la causa original para que `classifyNetworkError` pueda ver el
    // código real de Firebase a través del envoltorio.
    throw new PersistenceError(
      'persistence-error',
      error instanceof Error ? error.message : 'Unknown persistence error',
      { cause: error },
    );
  }

  return submission;
}
