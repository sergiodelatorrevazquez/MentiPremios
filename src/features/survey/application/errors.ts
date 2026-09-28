export class InvalidInvitationError extends Error {
  constructor(message = 'The invitation is invalid.') {
    super(message);
    this.name = 'InvalidInvitationError';
  }
}

export class InvitationAlreadyUsedError extends Error {
  constructor(message = 'The invitation has already been used.') {
    super(message);
    this.name = 'InvitationAlreadyUsedError';
  }
}

export class InvalidSubmissionError extends Error {
  constructor(message = 'The survey submission is invalid.') {
    super(message);
    this.name = 'InvalidSubmissionError';
  }
}

export class SubmissionAlreadyCompletedError extends Error {
  constructor(message = 'The survey has already been completed.') {
    super(message);
    this.name = 'SubmissionAlreadyCompletedError';
  }
}

export class PersistenceError extends Error {
  constructor(message = 'A persistence error occurred.') {
    super(message);
    this.name = 'PersistenceError';
  }
}
