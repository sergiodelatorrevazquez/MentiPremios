export type Paso = 'login' | 'welcome' | 'questions' | 'done';

export interface Multimedia {
  tipo: 'imagen' | 'video';
  src: string;
  alt?: string;
}

export interface Opcion {
  id: string;
  texto: string;
  multimedia?: Multimedia;
}

export interface Pregunta {
  id: string;
  titulo: string;
  opciones: Opcion[];
}

export type Respuestas = Record<string, string>;

export interface PremioRespuesta {
  usuario: string;
  premios: Respuestas;
}

export interface PalabraClavePayload {
  usuario: string;
  palabrasClave: string[];
}

export interface CodigoInvitacion {
  nombre: string;
  usado: boolean;
}

export type CodigoInvitacionIdentificado = CodigoInvitacion & { id: string };