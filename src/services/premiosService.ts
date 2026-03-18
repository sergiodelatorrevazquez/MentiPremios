import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
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

const RESPUESTAS_COLLECTION = 'respuestas';
const PALABRAS_CLAVE_COLLECTION = 'palabrasClave';
const CODIGOS_COLLECTION = 'codigos';

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

export async function obtenerCodigoPorPalabraSecreta(
  palabraSecreta: string,
): Promise<(CodigoInvitacion & { id: string }) | null> {
  const ref = doc(db, CODIGOS_COLLECTION, palabraSecreta);
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
}

export async function marcarCodigoComoUsado(palabraSecreta: string): Promise<void> {
  const ref = doc(db, CODIGOS_COLLECTION, palabraSecreta);
  await updateDoc(ref, {
    usado: true,
    usadoEn: serverTimestamp(),
  });
}


