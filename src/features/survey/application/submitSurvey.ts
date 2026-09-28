import { validateSurveyAnswers } from '../domain/survey.rules';
import type { Pregunta, SurveySubmission } from '../domain/survey.types';

export interface SubmitSurveyInput {
  invitationId: string;
  participantName: string;
  questions: readonly Pregunta[];
  answers: Readonly<Record<string, string | undefined>>;
  persist: (submission: SurveySubmission) => Promise<void> | void;
  markInvitationUsed: (invitationId: string) => Promise<void> | void;
}

export async function submitSurvey({
  invitationId,
  participantName,
  questions,
  answers,
  persist,
  markInvitationUsed,
}: SubmitSurveyInput): Promise<SurveySubmission> {
  const surveyValidation = validateSurveyAnswers(questions, answers);

  if (!surveyValidation.valid) {
    throw new Error('invalid-submission');
  }

  const submission: SurveySubmission = {
    invitationId,
    participantName,
    answers: Object.fromEntries(
      questions.map((question) => [question.id, answers[question.id] as string]),
    ) as SurveySubmission['answers'],
  };

  await persist(submission);
  await markInvitationUsed(invitationId);

  return submission;
}
