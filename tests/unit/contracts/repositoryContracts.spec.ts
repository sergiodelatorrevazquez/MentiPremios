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

  it('escribe los votes en el propio documento de la persona', () => {
    // Solo hay una colección: un `update` con `haVotado` y las respuestas, sin
    // documento aparte y sin una segunda escritura que pueda quedar a medias.
    expect(repositorySource).toContain('transaction.update(invitationRef, { haVotado: true, ...response.answers })');
    expect(repositorySource).not.toMatch(/\btransaction\.set\b/);
    expect(repositorySource).not.toMatch(/\bserverTimestamp\b/);
  });

  it('no guarda ni el nombre ni la hora, solo las respuestas', () => {
    // La persona ya la identifica el id del documento: no hace falta duplicar
    // su nombre ni anotar cuándo votó.
    expect(repositorySource).not.toContain('participantName');
    expect(repositorySource).not.toMatch(/createdAt|submittedAt|schemaVersion/);
  });

  it('no escribe en ninguna colección que no sea la de las invitaciones', () => {
    const colecciones = (repositorySource.match(/_COLLECTION = '([^']+)'/g) ?? [])
      .map((consta) => consta.match(/'([^']+)'/)?.[1]);

    expect(colecciones).toEqual(['codigos']);
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