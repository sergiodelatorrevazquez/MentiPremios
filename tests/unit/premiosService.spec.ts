import { vi } from 'vitest';
import { doc, setDoc, getDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/firebase';
import {
  guardarRespuestaUsuario,
  obtenerCodigoPorPalabraSecreta,
  marcarCodigoComoUsado,
} from '../../src/services/premiosService';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock('../../src/firebase', () => ({
  db: {},
}));

describe('premiosService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('guarda respuestas usando setDoc con el usuario como ID', async () => {
    (setDoc as unknown as vi.Mock).mockResolvedValueOnce({});

    await guardarRespuestaUsuario({
      usuario: 'SERGIO2024',
      premios: { pregunta1: 'opcionA', pregunta2: 'opcionB' },
    });

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'respuestas', 'SERGIO2024');
    expect(setDoc).toHaveBeenCalled();
  });

  it('obtiene código por palabra secreta', async () => {
    (getDoc as unknown as vi.Mock).mockResolvedValueOnce({
      exists: () => true,
      id: 'secreta123',
      data: () => ({ nombre: 'Sergio', usado: false }),
    });

    const result = await obtenerCodigoPorPalabraSecreta('secreta123');

    expect(result).toEqual({
      id: 'secreta123',
      nombre: 'Sergio',
      usado: false,
    });
  });

  it('marca código como usado', async () => {
    (updateDoc as unknown as vi.Mock).mockResolvedValueOnce({});

    await marcarCodigoComoUsado('secreta123');

    expect(updateDoc).toHaveBeenCalled();
  });
});