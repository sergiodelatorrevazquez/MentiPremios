import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  FirestoreError,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface PremioRespuesta {
  usuario: string;
  premios: Record<string, string>;
}

export interface PalabraClavePayload {
  usuario: string;
  palabrasClave: string[];
}

export interface CodigoInvitacion {
  nombre: string;
  usado: boolean;
}

export class FirestoreServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'FirestoreServiceError';
  }
}

const RESPUESTAS_COLLECTION = 'respuestas';
const PALABRAS_CLAVE_COLLECTION = 'palabrasClave';
const CODIGOS_COLLECTION = 'codigos';

function handleFirestoreError(error: unknown): never {
  if (error instanceof FirestoreError) {
    throw new FirestoreServiceError(
      `Firestore error: ${error.message}`,
      error.code,
    );
  }
  if (error instanceof Error) {
    throw new FirestoreServiceError(error.message);
  }
  throw new FirestoreServiceError('An unknown error occurred');
}

export async function saveUserAnswer(payload: PremioRespuesta): Promise<void> {
  try {
    const docRef = doc(db, RESPUESTAS_COLLECTION, payload.usuario);
    await setDoc(docRef, payload.premios);
  } catch (error) {
    handleFirestoreError(error);
  }
}

export async function saveUserKeywords(payload: PalabraClavePayload): Promise<void> {
  try {
    await addDoc(collection(db, PALABRAS_CLAVE_COLLECTION), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error);
  }
}

export async function getCodeBySecretWord(
  secretWord: string,
): Promise<(CodigoInvitacion & { id: string }) | null> {
  try {
    const ref = doc(db, CODIGOS_COLLECTION, secretWord);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return null;
    }

    const data = snap.data() as CodigoInvitacion;

    return {
      id: snap.id,
      nombre: data.nombre,
      usado: Boolean(data.usado),
    };
  } catch (error) {
    handleFirestoreError(error);
  }
}

export async function markCodeAsUsed(secretWord: string): Promise<void> {
  try {
    const ref = doc(db, CODIGOS_COLLECTION, secretWord);
    await updateDoc(ref, {
      usado: true,
    });
  } catch (error) {
    handleFirestoreError(error);
  }
}

export const guardarRespuestaUsuario = saveUserAnswer;
export const guardarPalabrasClaveUsuario = saveUserKeywords;
export const obtenerCodigoPorPalabraSecreta = getCodeBySecretWord;
export const marcarCodigoComoUsado = markCodeAsUsed;
