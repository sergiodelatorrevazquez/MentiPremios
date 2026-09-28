export const SURVEY_OPTION_IDS = {
  tonto: ['tonto-1', 'tonto-2', 'tonto-3', 'tonto-4'],
  casper: ['casper-1', 'casper-2', 'casper-3', 'casper-4', 'casper-5', 'casper-6'],
  comefeas: ['comefeas-1', 'comefeas-2', 'comefeas-3', 'comefeas-4'],
  soltero: ['soltero-1', 'soltero-2', 'soltero-3', 'soltero-4'],
  anecdota: ['anecdota-1', 'anecdota-2', 'anecdota-3', 'anecdota-4', 'anecdota-5', 'anecdota-6'],
  meme: ['meme-1', 'meme-2', 'meme-3', 'meme-4', 'meme-5', 'meme-6', 'meme-7', 'meme-8'],
  mensaje: ['mensaje-1', 'mensaje-2', 'mensaje-3', 'mensaje-4'],
  foto: ['foto-1', 'foto-2', 'foto-3', 'foto-4'],
  video: ['video-1', 'video-2', 'video-3', 'video-4'],
  correa: ['correa-1', 'correa-2', 'correa-3', 'correa-4'],
} as const satisfies Record<string, readonly string[]>;