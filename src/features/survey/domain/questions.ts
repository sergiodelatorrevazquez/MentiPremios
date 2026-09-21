import type { Pregunta } from './survey.types';

const multimediaAssets = import.meta.glob('../../../assets/{mensaje,foto,video}-*.{jpg,mp4}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function multimediaAsset(path: string): string {
  return multimediaAssets[path] as string;
}

export const preguntas: Pregunta[] = [
  {
    id: 'tonto',
    titulo: 'Tonto del Año',
    opciones: [
      { id: 'tonto-1', texto: 'Miguel' },
      { id: 'tonto-2', texto: 'Pablo' },
      { id: 'tonto-3', texto: 'Dani' },
      { id: 'tonto-4', texto: 'Maroto' },
    ],
  },
  {
    id: 'casper',
    titulo: 'Casper del Año',
    opciones: [
      { id: 'casper-1', texto: 'Raúl' },
      { id: 'casper-2', texto: 'Jorge' },
      { id: 'casper-3', texto: 'Dani' },
      { id: 'casper-4', texto: 'Jose Álvaro' },
      { id: 'casper-5', texto: 'Pablo' },
      { id: 'casper-6', texto: 'Víctor' },
    ],
  },
  {
    id: 'comefeas',
    titulo: 'Comefeas del Año',
    opciones: [
      { id: 'comefeas-1', texto: 'Fran' },
      { id: 'comefeas-2', texto: 'Maroto' },
      { id: 'comefeas-3', texto: 'Dani' },
      { id: 'comefeas-4', texto: 'Enrique' },
    ],
  },
  {
    id: 'soltero',
    titulo: 'Soltero del Año',
    opciones: [
      { id: 'soltero-1', texto: 'Sergio Reyes' },
      { id: 'soltero-2', texto: 'Ale' },
      { id: 'soltero-3', texto: 'Maroto' },
      { id: 'soltero-4', texto: 'Dani' },
    ],
  },
  {
    id: 'anecdota',
    titulo: 'Anécdota del Año',
    opciones: [
      { id: 'anecdota-1', texto: 'La quedada de verano' },
      { id: 'anecdota-2', texto: 'La cena de Navidad' },
      { id: 'anecdota-3', texto: 'El finde en el pueblo' },
      { id: 'anecdota-4', texto: 'El viaje de cumpleaños' },
      { id: 'anecdota-5', texto: 'Las quedadas de平时的' },
      { id: 'anecdota-6', texto: 'Otro momento' },
    ],
  },
  {
    id: 'meme',
    titulo: 'Meme del Año',
    opciones: [
      { id: 'meme-1', texto: 'Cuando apareció el nuevo miembro' },
      { id: 'meme-2', texto: 'La drama de wasap' },
      { id: 'meme-3', texto: 'El cambio de grupo' },
      { id: 'meme-4', texto: 'La nueva normativa' },
      { id: 'meme-5', texto: 'El secreto que se reveló' },
      { id: 'meme-6', texto: 'La sorpresa organizada' },
      { id: 'meme-7', texto: 'El cambio de líder' },
      { id: 'meme-8', texto: 'Otro' },
    ],
  },
  {
    id: 'mensaje',
    titulo: 'Mensaje del Año',
    opciones: [
      { id: 'mensaje-1', texto: '1', multimedia: { tipo: 'imagen', src: multimediaAsset('../../../assets/mensaje-1.jpg'), alt: 'Mensaje 1' } },
      { id: 'mensaje-2', texto: '2', multimedia: { tipo: 'imagen', src: multimediaAsset('../../../assets/mensaje-2.jpg'), alt: 'Mensaje 2' } },
      { id: 'mensaje-3', texto: '3', multimedia: { tipo: 'imagen', src: multimediaAsset('../../../assets/mensaje-3.jpg'), alt: 'Mensaje 3' } },
      { id: 'mensaje-4', texto: '4', multimedia: { tipo: 'imagen', src: multimediaAsset('../../../assets/mensaje-4.jpg'), alt: 'Mensaje 4' } },
    ],
  },
  {
    id: 'foto',
    titulo: 'Foto del Año',
    opciones: [
      { id: 'foto-1', texto: '1', multimedia: { tipo: 'imagen', src: multimediaAsset('../../../assets/foto-1.jpg'), alt: 'Foto 1' } },
      { id: 'foto-2', texto: '2', multimedia: { tipo: 'imagen', src: multimediaAsset('../../../assets/foto-2.jpg'), alt: 'Foto 2' } },
      { id: 'foto-3', texto: '3', multimedia: { tipo: 'imagen', src: multimediaAsset('../../../assets/foto-3.jpg'), alt: 'Foto 3' } },
      { id: 'foto-4', texto: '4', multimedia: { tipo: 'imagen', src: multimediaAsset('../../../assets/foto-4.jpg'), alt: 'Foto 4' } },
    ],
  },
  {
    id: 'video',
    titulo: 'Video del Año',
    opciones: [
      { id: 'video-1', texto: '1', multimedia: { tipo: 'video', src: multimediaAsset('../../../assets/video-1.mp4'), alt: 'Video 1' } },
      { id: 'video-2', texto: '2', multimedia: { tipo: 'video', src: multimediaAsset('../../../assets/video-2.mp4'), alt: 'Video 2' } },
      { id: 'video-3', texto: '3', multimedia: { tipo: 'video', src: multimediaAsset('../../../assets/video-3.mp4'), alt: 'Video 3' } },
      { id: 'video-4', texto: '4', multimedia: { tipo: 'video', src: multimediaAsset('../../../assets/video-4.mp4'), alt: 'Video 4' } },
    ],
  },
  {
    id: 'correa',
    titulo: 'Correa del Año',
    opciones: [
      { id: 'correa-1', texto: 'Miguel' },
      { id: 'correa-2', texto: 'Miguel' },
      { id: 'correa-3', texto: 'Miguel' },
      { id: 'correa-4', texto: 'Miguel' },
    ],
  },
];