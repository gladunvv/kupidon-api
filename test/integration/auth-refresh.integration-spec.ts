import { TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { AuthService } from '../../src/auth/auth.service';
import { OtpService } from '../../src/otp/otp.service';
import { User, UserDocument } from '../../src/users/schemas/user.schema';
import { ERROR_CODES } from '../../src/core/http/error-codes';
import {
  createMongoTestingModule,
  clearCollections,
  closeMongoTestingModule,
} from './support/mongo';
import { integrationConfig } from './support/config';

describe('AuthService refresh rotation (real MongoDB)', () => {
  let moduleRef: TestingModule;
  let authService: AuthService;

  const makeRes = () => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

  // JWT `iat` has second-level granularity; wait past a second boundary so
  // consecutive sign() calls produce genuinely different tokens.
  const waitPastJwtSecondBoundary = () =>
    new Promise((resolve) => setTimeout(resolve, 1100));

  beforeAll(async () => {
    moduleRef = await createMongoTestingModule();
    const userModel = moduleRef.get<Model<UserDocument>>(
      getModelToken(User.name),
    );

    const jwtService = new JwtService();
    const configService = {
      getOrThrow: () => integrationConfig.jwt,
    } as unknown as ConfigService;
    const otpService = {
      validateOtp: jest.fn().mockResolvedValue(true),
    } as unknown as OtpService;

    authService = new AuthService(
      userModel,
      jwtService,
      otpService,
      configService,
    );
  });

  afterEach(async () => {
    await clearCollections(moduleRef);
  });

  afterAll(async () => {
    await closeMongoTestingModule(moduleRef);
  });

  it('rotates the refresh token on use and invalidates the previous one', async () => {
    const initialRes = makeRes();
    const { access_token: firstAccess } = await authService.verifyOtp(
      { phone: '+79990009911', otp: '1234' },
      initialRes as never,
    );
    const firstRefreshToken = initialRes.cookie.mock.calls[0][1];
    expect(firstAccess).toEqual(expect.any(String));
    expect(firstRefreshToken).toEqual(expect.any(String));

    await waitPastJwtSecondBoundary();

    const secondRes = makeRes();
    const { access_token: secondAccess } = await authService.refreshToken(
      firstRefreshToken,
      secondRes as never,
    );
    const secondRefreshToken = secondRes.cookie.mock.calls[0][1];

    expect(secondAccess).not.toBe(firstAccess);
    expect(secondRefreshToken).not.toBe(firstRefreshToken);

    const thirdRes = makeRes();
    await expect(
      authService.refreshToken(firstRefreshToken, thirdRes as never),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: ERROR_CODES.INVALID_TOKEN }),
    });

    const fourthRes = makeRes();
    await expect(
      authService.refreshToken(secondRefreshToken, fourthRes as never),
    ).resolves.toMatchObject({ access_token: expect.any(String) });
  }, 10000);

  it('rejects a refresh token after logout clears the stored hash', async () => {
    const verifyRes = makeRes();
    await authService.verifyOtp(
      { phone: '+79990009922', otp: '1234' },
      verifyRes as never,
    );
    const refreshToken = verifyRes.cookie.mock.calls[0][1];
    const payload = new JwtService().decode(refreshToken) as { sub: string };

    await authService.logout(payload.sub, makeRes() as never);

    await expect(
      authService.refreshToken(refreshToken, makeRes() as never),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: ERROR_CODES.INVALID_TOKEN }),
    });
  });
});
