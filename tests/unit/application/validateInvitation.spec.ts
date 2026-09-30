import { describe, expect, it, vi } from 'vitest';
import {
  InvalidInvitationError,
  InvitationAlreadyUsedError,
} from '../../../src/features/survey/application/errors';
import {
  validateInvitation,
  type InvitationRecord,
} from '../../../src/features/survey/application/validateInvitation';

const LIBRE: InvitationRecord = { id: 'abc-123', nombre: 'Sergio', haVotado: false };
const USADA: InvitationRecord = { id: 'abc-123', nombre: 'Sergio', haVotado: true };

describe('invitación inexistente', () => {
  it('lanza InvalidInvitationError cuando elfinder no encuentra nada', async () => {
    await expect(validateInvitation('missing', async () => null)).rejects.toMatchObject({
      name: 'InvalidInvitationError',
      code: 'invitation-not-found',
    });
  });

  it('no intenta leer la invitacion marcada como usada cuando no existe', async () => {
    // El caso `usado` solo aplica a registros existentes; uno inexistente es otro error.
    await expect(validateInvitation('missing', async () => null))
      .rejects.not.toBeInstanceOf(InvitationAlreadyUsedError);
  });
});

describe('invitación utilizada', () => {
  it('lanza InvitationAlreadyUsedError para un registro ya usado', async () => {
    await expect(validateInvitation('used', async () => USADA)).rejects.toMatchObject({
      name: 'InvitationAlreadyUsedError',
      code: 'invitation-already-used',
    });
  });

  it('devuelve el error de invitacion usada aunque el nombre este vacio', async () => {
    const conNombreVacio: InvitationRecord = { id: 'abc-123', nombre: '', haVotado: true };

    await expect(validateInvitation('used', async () => conNombreVacio))
      .rejects.toBeInstanceOf(InvitationAlreadyUsedError);
  });
});

describe('error de repositorio', () => {
  it('propaga sin envolver el fallo del finder', async () => {
    const fallo = new Error('network down');

    await expect(validateInvitation('secret', async () => { throw fallo; }))
      .rejects.toBe(fallo);
  });

  it('no confunde un fallo de red con una invitación inexistente', async () => {
    const finder = async () => { throw new Error('network down'); };

    await expect(validateInvitation('secret', finder))
      .rejects.not.toBeInstanceOf(InvalidInvitationError);
  });
});

describe('invitación válida', () => {
  it('normaliza el secreto antes de consultar el repositorio', async () => {
    const finder = vi.fn(async () => LIBRE);

    await validateInvitation('  SeCrEtO-123  ', finder);

    expect(finder).toHaveBeenCalledWith('secreto-123');
    expect(finder).toHaveBeenCalledOnce();
  });

  it('devuelve el registro sin modificarlo', async () => {
    const resultado = await validateInvitation('secreto', async () => LIBRE);

    expect(resultado).toEqual(LIBRE);
    expect(resultado).toBe(LIBRE);
  });

  it('normaliza acentos solo por mayusculas y espacios, no por contenido', async () => {
    const finder = vi.fn(async () => LIBRE);

    await validateInvitation('  Secreto Con Espacios  ', finder);

    expect(finder).toHaveBeenCalledWith('secreto con espacios');
  });

  it('rechaza un secreto vacío o solo espacios sin consultar el repositorio', async () => {
    const finder = vi.fn(async () => LIBRE);

    for (const secreto of ['', '   ', '\t\n']) {
      await expect(validateInvitation(secreto, finder)).rejects.toMatchObject({
        name: 'InvalidInvitationError',
        code: 'invalid-secret',
      });
    }
    expect(finder).not.toHaveBeenCalled();
  });
});
