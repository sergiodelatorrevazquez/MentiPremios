import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../src/firebase';
import {
  guardarPalabrasClaveUsuario,
  guardarRespuestaUsuario,
} from '../../src/services/premiosService';

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock('../../src/firebase', () => ({
  db: {},
}));

describe('premiosService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('guarda una respuesta de usuario en la colección correspondiente', async () => {
    (addDoc as unknown as vi.Mock).mockResolvedValueOnce({});

    await guardarRespuestaUsuario({
      usuario: 'Sergio',
      premios: { test: 'valor' },
    });

    expect(collection).toHaveBeenCalledWith(db, 'respuestas');
    expect(addDoc).toHaveBeenCalled();
  });

  it('guarda palabras clave en la colección correspondiente', async () => {
    (addDoc as unknown as vi.Mock).mockResolvedValueOnce({});

    await guardarPalabrasClaveUsuario({
      usuario: 'Sergio',
      palabrasClave: ['memes', 'after'],
    });

    expect(collection).toHaveBeenCalledWith(db, 'palabrasClave');
    expect(addDoc).toHaveBeenCalled();
  });
});

