import { doc, getDoc, runTransaction, type Firestore } from 'firebase/firestore';
import type { CodigoInvitacion } from '../../features/survey/domain/survey.types';

const INVITATIONS_COLLECTION = 'codes';

/** Invitación leída de Firestore, ya validada y con su identificador. */
export type StoredInvitation = CodigoInvitacion & { id: string };

/**
 * Lo que se guarda al votar. La persona ya la identifica el id del documento,
 * así que aquí solo van las respuestas: ni nombre, ni hora, ni nada más.
 */
export interface SurveyResponseRecord {
  invitationId: string;
  answers: Readonly<Record<string, string>>;
}

/**
 * Resultado de guardar la encuesta. Se devuelve como dato y no como excepción
 * porque los tres casos son los esperables, no fallos: el repositorio no
 * decide qué error ve la persona, eso es tarea de la capa de aplicación.
 */
export type SaveSurveyOutcome = 'saved' | 'already-used' | 'not-found';

export interface SurveyStore {
  findInvitation(id: string): Promise<StoredInvitation | null>;
  saveSurvey(response: SurveyResponseRecord): Promise<SaveSurveyOutcome>;
}

function parseInvitation(id: string, data: unknown): StoredInvitation | null {
  if (typeof data !== 'object' || data === null) return null;

  const { voted } = data as { voted?: unknown };
  if (typeof voted !== 'boolean') return null;

  return { id, voted };
}

/**
 * Acceso directo a Firestore desde el navegador.
 *
 * Solo existe una colección, `codes`, con un documento por persona. Su
 * identificador es la palabra secreta y no se guarda ningún otro dato sobre
 * ella. Antes de votar, el documento solo tiene `voted: false`; al votar, se le
 * añade `voted: true` y un campo por pregunta con la opción elegida.
 *
 * La protección de las palabras secretas no está aquí, está en
 * `firestore.rules`: un documento se puede leer solo por identificador (`get`),
 * nunca se puede enumerar la colección (`list` está prohibido). Por eso las
 * reglas permiten estas operaciones y nada más, y por eso este repositorio
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

    return runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(invitationRef);
      if (!snapshot.exists()) return 'not-found';

      const invitation = parseInvitation(response.invitationId, snapshot.data());
      if (!invitation) return 'not-found';
      if (invitation.voted) return 'already-used';

      // Un único `update`: en el documento de la persona se pasa `voted` a
      // true y se escribe un campo por pregunta. No hay una segunda escritura
      // ni un documento aparte, así que no puede quedar medio guardado.
      transaction.update(invitationRef, { voted: true, ...response.answers });

      return 'saved';
    });
  }
}