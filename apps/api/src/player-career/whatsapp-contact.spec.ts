import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PlayerCareerService } from './player-career.service.js';
import { isOpposingFixtureMember, normalizeWhatsAppNumber, whatsappContactUrl } from './whatsapp-contact.js';

describe('WhatsApp contact privacy', () => {
  it('requires E.164 country codes, never guesses them from account phone numbers', () => {
    expect(normalizeWhatsAppNumber('+91 98765-43210')).toBe('+919876543210');
    expect(normalizeWhatsAppNumber('')).toBeNull();
    expect(normalizeWhatsAppNumber(null)).toBeNull();
    expect(normalizeWhatsAppNumber(undefined)).toBeUndefined();
    for (const number of ['9876543210', '+00919876543210', 'hello', '+1<evil>', '+1234']) {
      expect(() => normalizeWhatsAppNumber(number)).toThrow(BadRequestException);
    }
    expect(whatsappContactUrl('+919876543210')).toBe('https://wa.me/919876543210');
    expect(() => whatsappContactUrl('javascript:alert(1)')).toThrow(BadRequestException);
  });

  it('authorizes only the opposing side, not teammates, viewers or the player themselves', () => {
    expect(isOpposingFixtureMember('home1', 'away1', ['home1', 'home2'], ['away1', 'away2'])).toBe(true);
    expect(isOpposingFixtureMember('away1', 'home2', ['home1', 'home2'], ['away1', 'away2'])).toBe(true);
    expect(isOpposingFixtureMember('home1', 'home2', ['home1', 'home2'], ['away1', 'away2'])).toBe(false);
    expect(isOpposingFixtureMember('home1', 'home1', ['home1', 'home2'], ['away1', 'away2'])).toBe(false);
    expect(isOpposingFixtureMember('outsider', 'away1', ['home1'], ['away1'])).toBe(false);
  });

  function setup(enabled: boolean, targetStatus = 'ACTIVE', viewerStatus = 'ACTIVE') {
    const fixtureRead = vi.fn().mockResolvedValue({
      homeRegistration: { members: [{ userId: 'home1' }, { userId: 'home2' }] },
      awayRegistration: { members: [{ userId: 'away1' }, { userId: 'away2' }] },
    });
    const userRead = vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === 'home1' ? { status: viewerStatus } : {
        status: targetStatus,
        player: { whatsappNumber: '+919876543210', whatsappShareEnabled: enabled },
      }),
    );
    const service = new PlayerCareerService({
      fixture: { findUnique: fixtureRead },
      user: { findUnique: userRead },
    } as never);
    return { service, fixtureRead, userRead };
  }

  it('returns a click-to-chat URL only when consent is on and the viewer is the opponent', async () => {
    const { service } = setup(true);
    await expect(service.getOpponentWhatsApp('home1', 'away1', 'fixture')).resolves.toEqual({
      success: true, data: { available: true, url: 'https://wa.me/919876543210' }, error: null,
    });
  });

  it('fails closed without consent or active accounts', async () => {
    await expect(setup(false).service.getOpponentWhatsApp('home1', 'away1', 'fixture'))
      .resolves.toMatchObject({ data: { available: false, url: null } });
    await expect(setup(true, 'SUSPENDED').service.getOpponentWhatsApp('home1', 'away1', 'fixture'))
      .resolves.toMatchObject({ data: { available: false, url: null } });
    await expect(setup(true, 'ACTIVE', 'SUSPENDED').service.getOpponentWhatsApp('home1', 'away1', 'fixture'))
      .rejects.toThrow(ForbiddenException);
  });

  it('rejects teammates and unrelated players before fetching any contact information', async () => {
    const { service, userRead } = setup(true);
    await expect(service.getOpponentWhatsApp('home1', 'home2', 'fixture'))
      .rejects.toThrow(ForbiddenException);
    await expect(service.getOpponentWhatsApp('stranger', 'away1', 'fixture'))
      .rejects.toThrow(ForbiddenException);
    expect(userRead).not.toHaveBeenCalled();
  });

  it('rejects unknown fixtures without looking up a contact', async () => {
    const { service, fixtureRead, userRead } = setup(true);
    fixtureRead.mockResolvedValue(null);
    await expect(service.getOpponentWhatsApp('home1', 'away1', 'missing'))
      .rejects.toThrow(NotFoundException);
    expect(userRead).not.toHaveBeenCalled();
  });
});
