export class InvalidInvitationError extends Error {
  public readonly code: string;

  constructor(code: string = 'invalid-invitation', message = 'The invitation is invalid.') {
    super(message);
    this.name = 'InvalidInvitationError';
    this.code = code;
  }
}

export class InvitationAlreadyUsedError extends Error {
  public readonly code: string;

  constructor(code: string = 'invitation-already-used', message = 'The invitation has already been used.') {
    super(message);
    this.name = 'InvitationAlreadyUsedError';
    this.code = code;
  }
}

export class InvalidSubmissionError extends Error {
  public readonly code: string;

  constructor(code: string = 'invalid-submission', message = 'The survey submission is invalid.') {
    super(message);
    this.name = 'InvalidSubmissionError';
    this.code = code;
  }
}

export class SubmissionAlreadyCompletedError extends Error {
  public readonly code: string;

  constructor(code: string = 'submission-already-completed', message = 'The survey has already been completed.') {
    super(message);
    this.name = 'SubmissionAlreadyCompletedError';
    this.code = code;
  }
}

export class PersistenceError extends Error {
  public readonly code: string;

  constructor(code: string = 'persistence-error', message = 'A persistence error occurred.') {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
  }
}
