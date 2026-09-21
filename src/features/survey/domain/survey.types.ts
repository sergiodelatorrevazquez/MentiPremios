export type Paso = 'login' | 'welcome' | 'questions' | 'done';

export const QUESTION_IDS = {
  tonto: 'tonto',
  casper: 'casper',
  comefeas: 'comefeas',
  soltero: 'soltero',
  anecdota: 'anecdota',
  meme: 'meme',
  mensaje: 'mensaje',
  foto: 'foto',
  video: 'video',
  correa: 'correa',
} as const;

export type QuestionId = typeof QUESTION_IDS[keyof typeof QUESTION_IDS];
export type OptionId = `${QuestionId}-${number}`;

export interface Multimedia {
  tipo: 'imagen' | 'video';
  src: string;
  alt?: string;
}

export interface Opcion {
  id: OptionId;
  texto: string;
  multimedia?: Multimedia;
}

export interface Pregunta {
  id: QuestionId;
  titulo: string;
  opciones: Opcion[];
}

export type Respuestas = Record<string, string>;
export type RespuestasEncuesta = Partial<Record<QuestionId, OptionId>>;
export type RespuestasCompletas = Record<QuestionId, OptionId>;

export interface SurveySubmission {
  invitationId: string;
  participantName: string;
  answers: RespuestasCompletas;
}

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