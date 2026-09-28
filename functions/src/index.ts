import { initializeApp, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  createSubmitSurveyHandler,
  SubmissionEndpointError,
  type SubmissionStore,
} from './submitSurveyHandler.js';
import {
  createValidateInvitationHandler,
  InvitationLookupError,
  type InvitationLookupStore,
} from './validateInvitationHandler.js';

if (getApps().length === 0) initializeApp();

const firestore = getFirestore();
const store: SubmissionStore = {
  document: (collection, id) => firestore.doc(`${collection}/${id}`),
  newId: (collection) => firestore.collection(collection).doc().id,
  serverTimestamp: () => FieldValue.serverTimestamp(),
  runTransaction: (operation) => firestore.runTransaction((transaction) => operation({
    get: (reference) => transaction.get(reference as DocumentReference),
    create: (reference, data) => {
      transaction.create(reference as DocumentReference, data);
    },
    update: (reference, data) => {
      transaction.update(reference as DocumentReference, data);
    },
  })),
};

const submitSurveyHandler = createSubmitSurveyHandler(store);
const invitationLookupStore: InvitationLookupStore = {
  document: (id) => firestore.doc(`codigos/${id}`),
  get: (reference) => (reference as DocumentReference).get(),
};

const validateInvitationHandler = createValidateInvitationHandler(invitationLookupStore);

export const submitSurvey = onCall({
  region: 'us-central1',
  enforceAppCheck: true,
}, async (request) => {
  try {
    return await submitSurveyHandler({ data: request.data, auth: request.auth ?? null });
  } catch (error) {
    if (error instanceof SubmissionEndpointError) {
      throw new HttpsError(error.code, error.message);
    }
    console.error('Unexpected submitSurvey failure', error);
    throw new HttpsError('internal', 'Unable to submit the survey.');
  }
});

export const validateInvitation = onCall({
  region: 'us-central1',
  enforceAppCheck: true,
}, async (request) => {
  try {
    return await validateInvitationHandler({ data: request.data, auth: request.auth ?? null });
  } catch (error) {
    if (error instanceof InvitationLookupError) {
      throw new HttpsError(error.code, error.message);
    }
    console.error('Unexpected validateInvitation failure', error);
    throw new HttpsError('internal', 'Unable to validate the invitation.');
  }
});