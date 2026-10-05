import { describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';
import { HttpException } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { normalizeLoginIdentifier } from './login-identifier.js';

describe('Login quota identity', () => {
  it('shares the account quota across invisible characters, case and compatibility forms', async () => {
    const attempts = new Map<string, number>();
    const login = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    const consume = vi.fn(async (action: string, key: string, limit: number) => {
      if (action !== 'LOGIN_IDENTIFIER') return;
      const count = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, count);
      if (count > limit) throw new HttpException('Rate limited', 429);
    });
    const controller = new AuthController({ login } as never, { consume } as never);
    const variants = ['Player', 'P\u200blayer', 'Pla\u200cyer', 'Play\u200der', '\ufeffPLAYER ', 'Ｐｌａｙｅｒ'];
    for (let index = 0; index < variants.length; index++) {
      const request = controller.login({ ip: `192.0.2.${index}`, socket: {} } as never,
        { identifier: variants[index], password: 'incorrect1' }, {} as never);
      if (index < 5) await expect(request).rejects.toThrow('Invalid credentials');
      else await expect(request).rejects.toMatchObject({ status: 429 });
    }
    expect(login).toHaveBeenCalledTimes(5);
    expect([...attempts.keys()]).toEqual(['player']);
    expect(normalizeLoginIdentifier(' P\u200blayer ')).toBe('Player');
  });
});

describe('New password byte limits', () => {
  for (const password of ['a'.repeat(71) + '1', 'é'.repeat(35) + 'a1']) {
    it(`accepts a password exactly 72 bytes long (${password.length} characters)`, async () => {
      const dto = Object.assign(new RegisterDto(), { fullName: 'Test Player', email: 'test@example.com', inGameName: 'Tester', password, confirmPassword: password });
      expect(await validate(dto)).toHaveLength(0);
    });
  }
  for (const password of ['a'.repeat(72) + '1', 'é'.repeat(36) + 'a1']) {
    it(`rejects truncating new passwords (${Buffer.byteLength(password)} bytes)`, async () => {
      const register = Object.assign(new RegisterDto(), { fullName: 'Test Player', email: 'test@example.com', inGameName: 'Tester', password, confirmPassword: password });
      const reset = Object.assign(new ResetPasswordDto(), { email: 'test@example.com', otp: '123456', newPassword: password, confirmPassword: password });
      expect((await validate(register)).some(e => e.constraints?.isByteLength)).toBe(true);
      expect((await validate(reset)).some(e => e.constraints?.isByteLength)).toBe(true);
      // Existing passwords must still be accepted by the legacy login contract.
      expect(await validate(Object.assign(new LoginDto(), { identifier: 'Tester', password }))).toHaveLength(0);
    });
  }
});
