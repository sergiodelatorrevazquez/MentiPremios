import { doc, getDoc, type Firestore } from 'firebase/firestore';
import type { ResumenVotos } from '../../features/results/domain/results.types';

const INVITATIONS_COLLECTION = 'codes';
const SUMMARY_COLLECTION = 'resumen';
const SUMMARY_DOCUMENT = 'actual';
const ADMIN_FIELD = 'admin';

/**
 * Lectura de los datos de la gala. Solo `get`: ni una consulta, ni un `list`.
 * El documento de totales tiene identificador fijo y está en el bundle, así que
 * no hay nada que proteger en el camino, y los contadores no identifican a
 * nadie. La invitación sí se lee por identificador, igual que en el login, y sin
 * ella no se puede saber si la palabra es la de quien organiza los premios.
 */
export class FirestoreResultsRepository {
  constructor(private readonly db: Firestore) {}

  /** `true` si la invitación lleva la marca que pone el organizador. */
  async isAdminInvitation(id: string): Promise<boolean> {
    const snapshot = await getDoc(doc(this.db, INVITATIONS_COLLECTION, id));
    if (!snapshot.exists()) return false;

    const data = snapshot.data();

    return typeof data === 'object' && data !== null && (data as Record<string, unknown>)[ADMIN_FIELD] === true;
  }

  /** Contadores guardados, o `null` si el documento todavía no tiene nada. */
  async findSummary(): Promise<ResumenVotos | null> {
    const snapshot = await getDoc(doc(this.db, SUMMARY_COLLECTION, SUMMARY_DOCUMENT));
    if (!snapshot.exists()) return null;

    return parseSummary(snapshot.data());
  }
}

/**
 * Un contador que no sea un número entero positivo se descarta. El documento
 * solo lo escriben los votos válidos, pero un valor raro no debe convertirse en
 * un `NaN` pintado en la tarta.
 */
function parseSummary(data: unknown): ResumenVotos | null {
  if (typeof data !== 'object' || data === null) return null;

  const resumen: Record<string, number> = {};

  for (const [opcionId, votos] of Object.entries(data as Record<string, unknown>)) {
    if (typeof votos !== 'number' || !Number.isFinite(votos) || votos <= 0) continue;

    resumen[opcionId] = Math.floor(votos);
  }

  return Object.keys(resumen).length > 0 ? resumen : null;
}