import type { Multimedia, MultimediaSource } from './survey.types';

export const MULTIMEDIA_ASSET_PATHS = {
  mensaje1: '../../../assets/mensaje-1.jpg',
  mensaje2: '../../../assets/mensaje-2.jpg',
  mensaje3: '../../../assets/mensaje-3.jpg',
  mensaje4: '../../../assets/mensaje-4.jpg',
  foto1: '../../../assets/foto-1.jpg',
  foto2: '../../../assets/foto-2.jpg',
  foto3: '../../../assets/foto-3.jpg',
  foto4: '../../../assets/foto-4.jpg',
  video1: '../../../assets/video-1.mp4',
  video2: '../../../assets/video-2.mp4',
  video3: '../../../assets/video-3.mp4',
  video4: '../../../assets/video-4.mp4',
} as const;

export type MultimediaAssetPath = typeof MULTIMEDIA_ASSET_PATHS[keyof typeof MULTIMEDIA_ASSET_PATHS];

export interface MultimediaAssetEntry {
  tipo: Multimedia['tipo'];
  src: string;
  assetPath: string;
  unavailable: boolean;
  sources: MultimediaSource[];
}

const multimediaAssets = import.meta.glob<string>('../../../assets/{mensaje,foto,video}-*.{jpg,mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function createEntry(path: MultimediaAssetPath, tipo: Multimedia['tipo']): MultimediaAssetEntry {
  if (tipo === 'video') {
    const webmPath = path.replace(/\.mp4$/, '.webm');
    const videoSources = [
      { path, type: 'video/mp4' as const },
      { path: webmPath, type: 'video/webm' as const },
    ].flatMap(({ path: sourcePath, type }) => {
      const sourceUrl = multimediaAssets[sourcePath];
      return typeof sourceUrl === 'string' ? [{ src: sourceUrl, type }] : [];
    });

    if (videoSources.length > 0) {
      const primaryPath = videoSources[0].type === 'video/mp4' ? path : webmPath;
      return {
        tipo,
        src: videoSources[0].src,
        assetPath: primaryPath.replace('../../../', 'src/'),
        unavailable: false,
        sources: videoSources,
      };
    }

    return {
      tipo,
      src: '/media-unavailable.svg',
      assetPath: 'public/media-unavailable.svg',
      unavailable: true,
      sources: [],
    };
  }

  const src = multimediaAssets[path];
  if (typeof src === 'string') {
    return {
      tipo,
      src,
      assetPath: path.replace('../../../', 'src/'),
      unavailable: false,
      sources: [],
    };
  }

  return {
    tipo,
    src: '/media-unavailable.svg',
    assetPath: 'public/media-unavailable.svg',
    unavailable: true,
    sources: [],
  };
}

export const multimediaAssetRegistry: Record<MultimediaAssetPath, MultimediaAssetEntry> = {
  [MULTIMEDIA_ASSET_PATHS.mensaje1]: createEntry(MULTIMEDIA_ASSET_PATHS.mensaje1, 'imagen'),
  [MULTIMEDIA_ASSET_PATHS.mensaje2]: createEntry(MULTIMEDIA_ASSET_PATHS.mensaje2, 'imagen'),
  [MULTIMEDIA_ASSET_PATHS.mensaje3]: createEntry(MULTIMEDIA_ASSET_PATHS.mensaje3, 'imagen'),
  [MULTIMEDIA_ASSET_PATHS.mensaje4]: createEntry(MULTIMEDIA_ASSET_PATHS.mensaje4, 'imagen'),
  [MULTIMEDIA_ASSET_PATHS.foto1]: createEntry(MULTIMEDIA_ASSET_PATHS.foto1, 'imagen'),
  [MULTIMEDIA_ASSET_PATHS.foto2]: createEntry(MULTIMEDIA_ASSET_PATHS.foto2, 'imagen'),
  [MULTIMEDIA_ASSET_PATHS.foto3]: createEntry(MULTIMEDIA_ASSET_PATHS.foto3, 'imagen'),
  [MULTIMEDIA_ASSET_PATHS.foto4]: createEntry(MULTIMEDIA_ASSET_PATHS.foto4, 'imagen'),
  [MULTIMEDIA_ASSET_PATHS.video1]: createEntry(MULTIMEDIA_ASSET_PATHS.video1, 'video'),
  [MULTIMEDIA_ASSET_PATHS.video2]: createEntry(MULTIMEDIA_ASSET_PATHS.video2, 'video'),
  [MULTIMEDIA_ASSET_PATHS.video3]: createEntry(MULTIMEDIA_ASSET_PATHS.video3, 'video'),
  [MULTIMEDIA_ASSET_PATHS.video4]: createEntry(MULTIMEDIA_ASSET_PATHS.video4, 'video'),
};

export function resolveMultimediaAsset(path: MultimediaAssetPath, alt: string): Multimedia {
  return {
    ...multimediaAssetRegistry[path],
    alt: multimediaAssetRegistry[path].unavailable
      ? `${alt} (recurso no disponible)`
      : alt,
  };
}