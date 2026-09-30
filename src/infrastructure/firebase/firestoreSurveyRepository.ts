import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { CodigoInvitacion } from '../../features/survey/domain/survey.types';

const INVITATIONS_COLLECTION = 'codigos';
const RESPONSES_COLLECTION = 'respuestas';

/** Invitación leída de Firestore, ya validada y con su identificador. */
export type StoredInvitation = CodigoInvitacion & { id: string };

/** Lo que se guarda en `respuestas`. El `id` del documento es el de la invitación. */
export interface SurveyResponseRecord {
  invitationId: string;
  participantName: string;
  answers: Readonly<Record<string, string>>;
}

/**
 * Resultado de guardar la encuesta. Se devuelve como dato y no como excepción
 * porque los tres casos sonellantos esperables, no fallos: el repositorio no
 * decide qué error ve la persona, eso es tarea de la capa de aplicación.
 */
export type SaveSurveyOutcome = 'saved' | 'already-used' | 'not-found';

export interface SurveyStore {
  findInvitation(id: string): Promise<StoredInvitation | null>;
  saveSurvey(response: SurveyResponseRecord): Promise<SaveSurveyOutcome>;
}

function parseInvitation(id: string, data: unknown): StoredInvitation | null {
  if (typeof data !== 'object' || data === null) return null;

  const { nombre, usado } = data as { nombre?: unknown; usado?: unknown };
  if (typeof nombre !== 'string' || nombre.trim().length === 0) return null;
  if (typeof usado !== 'boolean') return null;

  return { id, nombre, usado };
}

/**
 * Acceso directo a Firestore desde el navegador.
 *
 * La protección de las palabras secretas no está aquí, está en
 * `firestore.rules`: una invitación se puede leer solo por identificador
 * (`get`), nunca se puede enumerar la colección (`list` está prohibido). Por eso
 * las reglas permiten estas operaciones y nada más, y por eso este repositorio
 * nunca usa consultas: solo `getDoc` y transacciones.
 */
export class FirestoreSurveyRepository implements SurveyStore {
  constructor(private readonly db: Firestore) {}

  async findInvitation(id: string): Promise<StoredInvitation | null> {
    const snapshot = await getDoc(doc(this.db, INVITATIONS_COLLECTION, id));
    if (!snapshot.exists()) return null;

    return parseInvitation(id, snapshot.data());
  }

  async saveSurvey(response: SurveyResponseRecord): Promise<SaveSurveyOutcome> {
    const invitationRef = doc(this.db, INVITATIONS_COLLECTION, response.invitationId);
    const responseRef = doc(this.db, RESPONSES_COLLECTION, response.invitationId);

    return runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(invitationRef);
      if (!snapshot.exists()) return 'not-found';

      const invitation = parseInvitation(response.invitationId, snapshot.data());
      if (!invitation) return 'not-found';
      if (invitation.usado) return 'already-used';

      transaction.set(responseRef, {
        schemaVersion: 2,
        participantName: invitation.nombre,
        answers: response.answers,
        createdAt: serverTimestamp(),
        submittedAt: serverTimestamp(),
      });
      transaction.update(invitationRef, { usado: true });

      return 'saved';
    });
  }
}