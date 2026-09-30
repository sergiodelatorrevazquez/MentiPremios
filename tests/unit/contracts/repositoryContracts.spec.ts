import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  FirestoreKeywordsRepository,
  type KeywordsRepository,
} from '../../../src/infrastructure/firebase/firestoreKeywordsRepository';
import {
  FirestoreSurveyRepository,
  type SurveyStore,
} from '../../../src/infrastructure/firebase/firestoreSurveyRepository';
import type { KeywordSubmission } from '../../../src/features/keywords/domain/keywords.types';

const repositorySource = readFileSync(
  resolve(__dirname, '../../../src/infrastructure/firebase/firestoreSurveyRepository.ts'),
  'utf8',
);

describe('adaptador de palabras clave', () => {
  it('cumple la interfaz de repositorio de la aplicación', () => {
    const db = {} as Firestore;
    const repository: KeywordsRepository = new FirestoreKeywordsRepository(db);

    expect(typeof repository.save).toBe('function');
    expect(repository.save.length).toBe(1);
  });

  it('recibe el tipo de envío del dominio, no un DTO propio', () => {
    // Si el adaptador declarara su propia forma, esta asignación no compilaría.
    const submission: KeywordSubmission = { usuario: 'Sergio', palabrasClave: ['leal'] };
    const guardar: (s: KeywordSubmission) => Promise<void> = new FirestoreKeywordsRepository(
      {} as Firestore,
    ).save.bind(new FirestoreKeywordsRepository({} as Firestore));

    expect(typeof guardar).toBe('function');
    expect(submission).toEqual({ usuario: 'Sergio', palabrasClave: ['leal'] });
  });
});

describe('adaptador de la encuesta', () => {
  it('cumple la interfaz que espera el composition root', () => {
    const store: SurveyStore = new FirestoreSurveyRepository({} as Firestore);

    expect(typeof store.findInvitation).toBe('function');
    expect(typeof store.saveSurvey).toBe('function');
  });

  it('solo lee por identificador: ninguna consulta que pueda enumerar invitaciones', () => {
    // `firestore.rules` prohíbe `list` sobre `codigos`. Un `getDocs` o un
    // `query` aquí devolvería un error en producción, así que el contrato lo
    // fija en el código: la palabra secreta solo se puede conocer, no listar.
    expect(repositorySource).not.toMatch(/\bgetDocs\b/);
    expect(repositorySource).not.toMatch(/\bquery\s*\(/);
    expect(repositorySource).not.toMatch(/\bwhere\s*\(/);
    expect(repositorySource).not.toMatch(/\bcollection\s*\(\s*db\b/);
  });

  it('guarda la respuesta con el identificador de la invitación', () => {
    // Clave del modelo de un solo uso: documento y invitación comparten id, de
    // modo que el segundo envío choca con la prohibición de `update`.
    expect(repositorySource).toContain('RESPONSES_COLLECTION, response.invitationId');
  });

  it('marca la invitación como usada en la misma transacción', () => {
    expect(repositorySource).toContain('runTransaction');
    expect(repositorySource).toMatch(/transaction\.update\(\s*invitationRef,\s*\{\s*usado:\s*true/);
  });
});

describe('ubicación de las reglas', () => {
  it('las reglas declaradas son las que se despliegan', () => {
    const firebaseConfig = readFileSync(
      join(resolve(__dirname, '../../../'), 'firebase.json'),
      'utf8',
    );

    expect(firebaseConfig).toContain('firestore.rules');
  });
});