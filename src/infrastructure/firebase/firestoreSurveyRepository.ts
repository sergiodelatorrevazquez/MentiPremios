import {
  doc,
  getDoc,
  runTransaction,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from 'firebase/firestore';
import type { CodigoInvitacion } from '../../features/survey/domain/survey.types';

const INVITATIONS_COLLECTION = 'codes';
const SUMMARY_COLLECTION = 'resumen';
const SUMMARY_DOCUMENT = 'actual';

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
 * Valor que tendrá el contador de una opción con este voto ya aplicado: el que
 * había más uno.
 *
 * Se calcula en el cliente y se escribe el número final, en vez de usar
 * `increment()`, porque `firestore.rules` solo puede validar el incremento si ve
 * la cantidad en `request.resource.data`. Con `increment()` la regla vería un
 * marcador de operación, no un número, y no podría rechazar un incremento raro.
 */
function nextCount(current: unknown): number {
  const actual = typeof current === 'number' && Number.isFinite(current) && current > 0
    ? Math.floor(current)
    : 0;

  return actual + 1;
}

/**
 * Acceso directo a Firestore desde el navegador.
 *
 * Hay una colección de personas, `codes`, con un documento por invitado cuyo
 * identificador es la palabra secreta, y un documento de totales,
 * `resumen/actual`, con un contador por opción.
 *
 * La protección de las palabras secretas no está aquí, está en
 * `firestore.rules`: un documento se puede leer solo por identificador (`get`),
 * nunca se puede enumerar la colección (`list` está prohibido). Por eso las
 * reglas permiten estas operaciones y nada más, y por eso este repositorio
 * nunca usa consultas: solo `getDoc` y transacciones.
 *
 * El documento de resumen no dice nada de nadie, solo cuánto suma cada opción,
 * y por eso su lectura no necesita la protección que sí necesitan las
 * invitaciones.
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
    const summaryRef = doc(this.db, SUMMARY_COLLECTION, SUMMARY_DOCUMENT);

    return runTransaction(this.db, async (transaction) => {
      // Las dos lecturas van antes que cualquier escritura. En una transacción
      // de Firestore no se puede leer después de escribir: el servidor exige
      // haber leído todo lo que se va a tocar, y si no, la transacción entera
      // falla y el voto no se guarda.
      const [invitationSnapshot, summarySnapshot] = await Promise.all([
        transaction.get(invitationRef),
        transaction.get(summaryRef),
      ]);

      if (!invitationSnapshot.exists()) return 'not-found';

      const invitation = parseInvitation(response.invitationId, invitationSnapshot.data());
      if (!invitation) return 'not-found';
      if (invitation.voted) return 'already-used';

      // Un único `update`: en el documento de la persona se pasa `voted` a
      // true y se escribe un campo por pregunta. No hay una segunda escritura
      // ni un documento aparte, así que no puede quedar medio guardado.
      transaction.update(invitationRef, { voted: true, ...response.answers });

      this.applyAnswerCounts(
        transaction,
        summaryRef,
        summarySnapshot.data() ?? {},
        response.answers,
      );

      return 'saved';
    });
  }

  /**
   * Suma el voto a los contadores de cada pregunta, en la misma transacción
   * que lo guarda.
   *
   * Van juntos a propósito. Si el voto se guardara y el contador no, la gala
   * mostraría un porcentaje que no cuadra con los votos reales, y no habría
   * forma de saber cuál de las dos escrituras se ha perdido. Al compartir
   * transacción el servidor aplica ambas o ninguna, así que no existe el estado
   * en el que el voto está guardado y el total se ha quedado corto.
   *
   * El resumen se ha leído antes de escribir nada, de ahí que llegue como dato
   * y no vuelva a leerse aquí.
   */
  private applyAnswerCounts(
    transaction: Transaction,
    summaryRef: DocumentReference,
    resumen: Readonly<Record<string, unknown>>,
    answers: Readonly<Record<string, string>>,
  ): void {
    const contadores: Record<string, number> = {};

    for (const opcionId of Object.values(answers)) {
      contadores[opcionId] = nextCount(resumen[opcionId]);
    }

    // El documento de resumen lo crea el organizador en la consola, una sola
    // vez. Si faltara, la transacción falla entera y el voto tampoco se guarda:
    // volver a intentarlo es seguro porque la invitación sigue sin votar.
    transaction.update(summaryRef, contadores);
  }
}