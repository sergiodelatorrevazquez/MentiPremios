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
const resultsRepositorySource = readFileSync(
  resolve(__dirname, '../../../src/infrastructure/firebase/firestoreResultsRepository.ts'),
  'utf8',
);

/**
 * El código sin comentarios. Los contratos miran lo que se ejecuta, no lo que
 * se explica: mentioning `increment()` en un comentario sobre por qué no se usa
 * `increment()` no es usar `increment()`.
 */
function sinComentarios(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

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
    // `firestore.rules` prohíbe `list` sobre `codes`. Un `getDocs` o un
    // `query` aquí devolvería un error en producción, así que el contrato lo
    // fija en el código: la palabra secreta solo se puede conocer, no listar.
    expect(repositorySource).not.toMatch(/\bgetDocs\b/);
    expect(repositorySource).not.toMatch(/\bquery\s*\(/);
    expect(repositorySource).not.toMatch(/\bwhere\s*\(/);
    expect(repositorySource).not.toMatch(/\bcollection\s*\(\s*db\b/);
  });

  it('escribe los votes en el propio documento de la persona', () => {
    // Solo hay una colección: un `update` con `voted` y las respuestas, sin
    // documento aparte y sin una segunda escritura que pueda quedar a medias.
    expect(repositorySource).toContain('transaction.update(invitationRef, { voted: true, ...response.answers })');
    expect(repositorySource).not.toMatch(/\btransaction\.set\b/);
    expect(repositorySource).not.toMatch(/\bserverTimestamp\b/);
  });

  it('suma los contadores de la gala dentro de la misma transacción que el voto', () => {
    // Los contadores y el voto se escriben juntos o no se escriben. Si el total
    // fuera aparte, la galería podría enseñar un reparto que no cuadra con los
    // votos guardados y no habría forma de saber cuál de las dos escrituras
    // se perdió.
    expect(repositorySource).toContain('runTransaction');
    expect(repositorySource).toContain('this.applyAnswerCounts(');
    expect(repositorySource).not.toMatch(/\bcountAnswers\b/);
  });

  it('lee los dos documentos antes de escribir ninguno', () => {
    // Firestore rechaza una transacción que lee después de escribir, así que el
    // orden importa tanto como el contenido: invitaciones y totales se leen
    // primero y luego se escriben. Este test existe porque ese orden se hizo
    // mal una vez y el fallo solo aparecería alprimer voto real.
    const codigo = sinComentarios(repositorySource);

    const leeLaInvitacion = codigo.indexOf('transaction.get(invitationRef)');
    const leeElResumen = codigo.indexOf('transaction.get(summaryRef)');
    const guardaElVoto = codigo.indexOf('transaction.update(invitationRef');
    const guardaElTotal = codigo.indexOf('transaction.update(summaryRef');

    expect(leeLaInvitacion).toBeGreaterThan(-1);
    expect(leeElResumen).toBeGreaterThan(-1);
    expect(leeElResumen).toBeLessThan(guardaElVoto);
    expect(leeElResumen).toBeLessThan(guardaElTotal);
    expect(guardaElVoto).toBeLessThan(guardaElTotal);
  });

  it('no vuelve a leer dentro de la aplicación de contadores', () => {
    // El resumen llega como dato: releerlo aquí dejaría una lectura después de
    // las escrituras y la transacción no se aplicaría.
    const aplicar = sinComentarios(repositorySource).split('private applyAnswerCounts')[1] ?? '';

    expect(aplicar).not.toMatch(/transaction\.get\(/);
  });

  it('escribe los contadores como el valor anterior más uno, no como un incremento opaco', () => {
    // `firestore.rules` solo puede comprobar que un contador sube de uno en uno
    // si ve el número final en `request.resource.data`. Con `increment()` la
    // regla vería un marcador y no podría rechazar un incremento raro.
    expect(sinComentarios(repositorySource)).not.toMatch(/\bincrement\s*\(/);
    expect(repositorySource).toContain('return actual + 1;');
  });

  it('no guarda ningún dato de la persona más allá de sus respuestas', () => {
    // Ni nombre, ni hora, ni versión: el documento solo lleva `voted` y las
    // respuestas. La persona la identifica el identificador del documento.
    expect(repositorySource).not.toContain('participantName');
    expect(repositorySource).not.toMatch(/createdAt|submittedAt|schemaVersion/);
    expect(repositorySource).not.toMatch(/nombre\s*[:?]/);
  });

  it('no escribe en ninguna colección que no sea la de las invitaciones o la de totales', () => {
    const colecciones = (repositorySource.match(/_COLLECTION = '([^']+)'/g) ?? [])
      .map((consta) => consta.match(/'([^']+)'/)?.[1]);

    expect(colecciones).toEqual(['codes', 'votes']);
  });
});

describe('adaptador de los resultados', () => {
  it('solo lee por identificador: los totales no se enumeran', () => {
    // La gala no necesita `list` para nada: el documento de totales tiene
    // identificador fijo y solo se lee la invitación del propio visitante.
    expect(resultsRepositorySource).not.toMatch(/\bgetDocs\b/);
    expect(resultsRepositorySource).not.toMatch(/\bquery\s*\(/);
    expect(resultsRepositorySource).not.toMatch(/\bwhere\s*\(/);
    expect(resultsRepositorySource).not.toMatch(/\bcollection\s*\(\s*db\b/);
  });

  it('decide por la marca del organizador, no comparando códigos en el código', () => {
    // Si el código del organizador estuviera escrito en el bundle, cualquiera
    // que lo leyera vería la gala. Se lee del documento de la invitación, que
    // solo se abre con la palabra.
    expect(resultsRepositorySource).toContain("const ADMIN_FIELD = 'admin'");
    expect(resultsRepositorySource).not.toMatch(/admindltv/);
  });

  it('no escribe nada: los contadores los lleva el repositorio de la encuesta', () => {
    expect(resultsRepositorySource).not.toMatch(/\bsetDoc\b|\bupdateDoc\b|\baddDoc\b/);
    expect(resultsRepositorySource).not.toMatch(/\brunTransaction\b/);
  });

  it('descarta los contadores que no son un número positivo', () => {
    // Un valor raro no puede convertirse en un `NaN` pintado en la tarta.
    expect(resultsRepositorySource).toMatch(/typeof votos !== 'number'/);
    expect(resultsRepositorySource).toMatch(/!Number\.isFinite\(votos\)/);
    expect(resultsRepositorySource).toMatch(/votos <= 0/);
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