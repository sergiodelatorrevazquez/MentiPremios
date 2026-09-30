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
  unavailable?: boolean;
  assetPath?: string;
  sources?: MultimediaSource[];
}

export interface MultimediaSource {
  src: string;
  type: 'video/mp4' | 'video/webm';
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
  answers: RespuestasCompletas;
}

export interface PremioRespuesta {
  usuario: string;
  premios: Respuestas;
}

export interface CodigoInvitacion {
  /**
   * Nombre con el que se saluda a la persona. Es opcional en el documento: si
   * no está, la aplicación usa el id, que ya identifica a quienresponding.
   */
  nombre: string;
  haVotado: boolean;
}

export type CodigoInvitacionIdentificado = CodigoInvitacion & { id: string };