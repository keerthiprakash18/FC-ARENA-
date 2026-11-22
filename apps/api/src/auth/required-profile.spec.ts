import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './dto/register.dto.js';
import { normalizeWhatsAppNumber, phoneAliases } from './whatsapp-number.js';
import { AuthService } from './auth.service.js';

describe('required private account details', () => {
  it.each([
    ['98765 43210', '+919876543210'],
    ['+91 (98765) 43210', '+919876543210'],
    ['+44 7700 900123', '+447700900123'],
  ])('normalizes %s without publishing a contact', (input, expected) =>
    expect(normalizeWhatsAppNumber(input)).toBe(expected),
  );
  it.each([
    undefined,
    null,
    '',
    'abc9876543210',
    '123',
    '++919876543210',
    '+01234567890',
    '12345678901234567890',
  ])('rejects missing/invalid contact %s', (input) =>
    expect(() => normalizeWhatsAppNumber(input)).toThrow(),
  );
  it('checks Indian legacy storage aliases as well as E.164', () =>
    expect(phoneAliases('+919876543210')).toEqual([
      '+919876543210',
      '919876543210',
      '9876543210',
    ]));
  it('does not accept omitted birth date or phone at the HTTP DTO boundary', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, {
        fullName: 'Test Player',
        email: 'test@example.invalid',
        inGameName: 'Player',
        password: 'Password123',
        confirmPassword: 'Password123',
      }),
    );
    expect(errors.map((row) => row.property)).toEqual(
      expect.arrayContaining(['dateOfBirth', 'phoneNumber']),
    );
  });
  it('cannot edit another account, publish a WhatsApp contact, or restore deleted profile data', async () => {
    vi.stubEnv('JWT_ACCESS_SECRET', 'test-access');
    vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh');
    const db = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const auth = new AuthService(db as never, {} as never, {} as never);
    await expect(
      auth.completeProfile('disabled', {
        dateOfBirth: '1995-01-01',
        phoneNumber: '9876543210',
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'disabled', status: 'ACTIVE' },
      data: {
        dateOfBirth: new Date('1995-01-01T00:00:00Z'),
        phoneNumber: '+919876543210',
      },
    });
    vi.unstubAllEnvs();
  });
});
