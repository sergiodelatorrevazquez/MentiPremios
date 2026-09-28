import { describe, expect, it, vi } from 'vitest';
import { setDoc, doc } from 'firebase/firestore';
import { FirestoreSurveySubmissionRepository } from '../../src/infrastructure/firebase/firestoreSurveySubmissionRepository';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
}));

describe('FirestoreSurveySubmissionRepository', () => {
  it('persists a survey submission', async () => {
    const db = {} as any;
    const repository = new FirestoreSurveySubmissionRepository(db);
    vi.mocked(doc).mockReturnValue('doc-ref' as any);

    await repository.submit({
      invitationId: 'inv-1',
      participantName: 'Sergio',
      answers: {
        tonto: 'tonto-1',
        casper: 'casper-1',
        comefeas: 'comefeas-1',
        soltero: 'soltero-1',
        anecdota: 'anecdota-1',
        meme: 'meme-1',
        mensaje: 'mensaje-1',
        foto: 'foto-1',
        video: 'video-1',
        correa: 'correa-1',
      },
    });

    expect(doc).toHaveBeenCalledWith(db, 'respuestas', 'inv-1');
    expect(setDoc).toHaveBeenCalledWith('doc-ref', {
      tonto: 'tonto-1',
      casper: 'casper-1',
      comefeas: 'comefeas-1',
      soltero: 'soltero-1',
      anecdota: 'anecdota-1',
      meme: 'meme-1',
      mensaje: 'mensaje-1',
      foto: 'foto-1',
      video: 'video-1',
      correa: 'correa-1',
    });
  });
});
