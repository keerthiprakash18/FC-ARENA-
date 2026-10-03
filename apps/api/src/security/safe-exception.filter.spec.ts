import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SafeExceptionFilter } from './safe-exception.filter.js';

describe('Safe API errors', () => {
  it.each([new Error('private-provider-value'), new InternalServerErrorException('private-provider-value')])('masks internal errors', (error) => {
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    new SafeExceptionFilter().catch(error, { switchToHttp: () => ({ getResponse: () => response }) } as never);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('private-provider-value');
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }) }));
  });
  it('preserves actionable DTO validation responses', () => {
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const body = { error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } };
    new SafeExceptionFilter().catch(new BadRequestException(body), { switchToHttp: () => ({ getResponse: () => response }) } as never);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(body);
  });
});
