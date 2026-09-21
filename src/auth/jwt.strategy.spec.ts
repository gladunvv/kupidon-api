import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';

describe('JwtStrategy', () => {
  const user = { _id: 'user-id' };
  let usersService: { findById: jest.Mock };
  let strategy: JwtStrategy;

  beforeEach(() => {
    usersService = { findById: jest.fn().mockResolvedValue(user) };
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('a'.repeat(32)),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(
      usersService as unknown as UsersService,
      configService,
    );
  });

  it('accepts an access token payload', async () => {
    await expect(
      strategy.validate({ sub: 'user-id', type: 'access' }),
    ).resolves.toBe(user);
  });

  it('rejects a refresh token payload', async () => {
    await expect(
      strategy.validate({ sub: 'user-id', type: 'refresh' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('rejects a payload without a token type', async () => {
    await expect(strategy.validate({ sub: 'user-id' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token for a user that no longer exists', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'user-id', type: 'access' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
