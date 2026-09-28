import { beforeEach, describe, expect, it, vi } from 'vitest';
import { doc, getDoc, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { createAppServices } from '../../src/app/bootstrap';
import { preguntas } from '../../src/features/survey/domain/questions';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

describe('createAppServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doc).mockReturnValue('document-reference' as never);
  });

  it('normalizes invitation secrets before looking them up', async () => {
    const db = {} as Firestore;
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: 'inv-1',
      data: () => ({ nombre: 'Sergio', usado: false }),
    } as never);

    const services = createAppServices(db);
    await expect(services.validateInvitation('  SECRET-1  ')).resolves.toEqual({
      id: 'inv-1',
      nombre: 'Sergio',
      usado: false,
    });

    expect(doc).toHaveBeenCalledWith(db, 'codigos', 'secret-1');
  });

  it('connects survey persistence and invitation usage', async () => {
    const db = {} as Firestore;
    const answers = Object.fromEntries(
      preguntas.map((question) => [question.id, question.opciones[0].id]),
    );
    const services = createAppServices(db);

    await services.submitSurvey({
      invitationId: 'inv-1',
      participantName: 'Sergio',
      questions: preguntas,
      answers,
    });

    expect(doc).toHaveBeenNthCalledWith(1, db, 'respuestas', 'inv-1');
    expect(setDoc).toHaveBeenCalledWith('document-reference', answers);
    expect(doc).toHaveBeenNthCalledWith(2, db, 'codigos', 'inv-1');
    expect(updateDoc).toHaveBeenCalledWith('document-reference', { usado: true });
  });
});