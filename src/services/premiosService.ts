import {
  addDoc,
  collection,
  serverTimestamp,
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

const RESPUESTAS_COLLECTION = 'respuestas';
const PALABRAS_CLAVE_COLLECTION = 'palabrasClave';

export async function guardarRespuestaUsuario(payload: PremioRespuesta): Promise<void> {
  await addDoc(collection(db, RESPUESTAS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function guardarPalabrasClaveUsuario(payload: PalabraClavePayload): Promise<void> {
  await addDoc(collection(db, PALABRAS_CLAVE_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

