import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { ERROR_CODES } from '../core/http/error-codes';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-token'),
  compare: jest.fn(),
}));

const jwtConfig = {
  secret: 'access-secret',
  secret_refresh: 'refresh-secret',
  accessExpiresIn: '15m',
  refreshExpiresIn: '7d',
  refreshCookieMaxAge: 604800000,
};

const makeRes = () => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

const makeConfigService = () => ({
  getOrThrow: jest.fn().mockReturnValue(jwtConfig),
});

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-token');
  });

  describe('verifyOtp', () => {
    it('rejects an invalid OTP without touching the user collection', async () => {
      const otpService = { validateOtp: jest.fn().mockResolvedValue(false) };
      const userModel = jest.fn();
      (userModel as never as { findOne: jest.Mock }).findOne = jest.fn();
      const service = new AuthService(
        userModel as never,
        {} as never,
        otpService as never,
        makeConfigService() as never,
      );

      await expect(
        service.verifyOtp({ phone: '+1', otp: '0000' }, makeRes() as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: ERROR_CODES.INVALID_OTP }),
      });
      expect(
        (userModel as never as { findOne: jest.Mock }).findOne,
      ).not.toHaveBeenCalled();
    });

    it('issues tokens for an existing user and strips the refresh hash from the response', async () => {
      const otpService = { validateOtp: jest.fn().mockResolvedValue(true) };
      const existingUser = {
        _id: { toString: () => 'user-1' },
        phone: '+1',
        refreshTokenHash: 'old-hash',
        save: jest.fn().mockResolvedValue(undefined),
        toObject: jest.fn().mockImplementation(function (this: any) {
          return {
            _id: this._id,
            phone: this.phone,
            refreshTokenHash: this.refreshTokenHash,
          };
        }),
      };
      const userModel = jest.fn() as unknown as { findOne: jest.Mock };
      userModel.findOne = jest.fn().mockResolvedValue(existingUser);
      const jwtService = {
        sign: jest
          .fn()
          .mockImplementation((payload) =>
            payload.type === 'access' ? 'access-token' : 'refresh-token',
          ),
      };
      const res = makeRes();
      const service = new AuthService(
        userModel as never,
        jwtService as never,
        otpService as never,
        makeConfigService() as never,
      );

      const result = await service.verifyOtp(
        { phone: '+1', otp: '1234' },
        res as never,
      );

      expect(result.access_token).toBe('access-token');
      expect(result.user).not.toHaveProperty('refreshTokenHash');
      expect(existingUser.save).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith('refresh-token', 10);
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token',
        expect.objectContaining({ httpOnly: true, path: '/' }),
      );
    });

    it('creates a new user when the phone number is unknown', async () => {
      const otpService = { validateOtp: jest.fn().mockResolvedValue(true) };
      const savedDocs: any[] = [];
      const userModelCtor = jest.fn().mockImplementation(function (
        this: any,
        data: any,
      ) {
        Object.assign(this, data);
        this.save = jest.fn().mockImplementation(async () => {
          savedDocs.push({ ...this });
        });
        this.toObject = () => ({ phone: this.phone });
        this._id = { toString: () => 'new-user' };
      });
      (userModelCtor as unknown as { findOne: jest.Mock }).findOne = jest
        .fn()
        .mockResolvedValue(null);
      const jwtService = {
        sign: jest
          .fn()
          .mockImplementation((payload) =>
            payload.type === 'access' ? 'access-token' : 'refresh-token',
          ),
      };
      const service = new AuthService(
        userModelCtor as never,
        jwtService as never,
        otpService as never,
        makeConfigService() as never,
      );

      await service.verifyOtp(
        { phone: '+7999', otp: '1234' },
        makeRes() as never,
      );

      expect(userModelCtor).toHaveBeenCalledWith({ phone: '+7999' });
      expect(savedDocs.length).toBe(2);
    });
  });

  describe('refreshToken', () => {
    it('rejects a missing token without attempting verification', async () => {
      const jwtService = { verify: jest.fn() };
      const res = makeRes();
      const service = new AuthService(
        {} as never,
        jwtService as never,
        {} as never,
        makeConfigService() as never,
      );

      await expect(
        service.refreshToken('', res as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          message: 'Refresh token not found',
          code: ERROR_CODES.INVALID_TOKEN,
        }),
      });
      expect(jwtService.verify).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
    });

    it('rejects a token that fails signature verification', async () => {
      const jwtService = {
        verify: jest.fn().mockImplementation(() => {
          throw new Error('jwt expired');
        }),
      };
      const res = makeRes();
      const service = new AuthService(
        {} as never,
        jwtService as never,
        {} as never,
        makeConfigService() as never,
      );

      await expect(
        service.refreshToken('stale-token', res as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          message: 'Invalid refresh token',
          code: ERROR_CODES.INVALID_TOKEN,
        }),
      });
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
    });

    it('rejects a token that is not of type refresh', async () => {
      const jwtService = {
        verify: jest
          .fn()
          .mockReturnValue({ sub: 'user-1', phone: '+1', type: 'access' }),
      };
      const userModel = { findById: jest.fn() };
      const service = new AuthService(
        userModel as never,
        jwtService as never,
        {} as never,
        makeConfigService() as never,
      );

      await expect(
        service.refreshToken(
          'access-token-used-as-refresh',
          makeRes() as never,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: ERROR_CODES.INVALID_TOKEN }),
      });
      expect(userModel.findById).not.toHaveBeenCalled();
    });

    it('rejects a refresh token for a user that no longer exists', async () => {
      const jwtService = {
        verify: jest
          .fn()
          .mockReturnValue({ sub: 'user-1', phone: '+1', type: 'refresh' }),
      };
      const userModel = {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(null),
        }),
      };
      const res = makeRes();
      const service = new AuthService(
        userModel as never,
        jwtService as never,
        {} as never,
        makeConfigService() as never,
      );

      await expect(
        service.refreshToken('refresh-token', res as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: ERROR_CODES.INVALID_TOKEN }),
      });
    });

    it('rejects reuse of a refresh token that no longer matches the stored hash', async () => {
      const jwtService = {
        verify: jest
          .fn()
          .mockReturnValue({ sub: 'user-1', phone: '+1', type: 'refresh' }),
      };
      const storedUser = { refreshTokenHash: 'current-hash' };
      const userModel = {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(storedUser),
        }),
      };
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const service = new AuthService(
        userModel as never,
        jwtService as never,
        {} as never,
        makeConfigService() as never,
      );

      await expect(
        service.refreshToken('reused-old-token', makeRes() as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: ERROR_CODES.INVALID_TOKEN }),
      });
    });

    it('rejects a refresh attempt after logout cleared the stored hash', async () => {
      const jwtService = {
        verify: jest
          .fn()
          .mockReturnValue({ sub: 'user-1', phone: '+1', type: 'refresh' }),
      };
      const storedUser = { refreshTokenHash: null };
      const userModel = {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(storedUser),
        }),
      };
      const service = new AuthService(
        userModel as never,
        jwtService as never,
        {} as never,
        makeConfigService() as never,
      );

      await expect(
        service.refreshToken('post-logout-token', makeRes() as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: ERROR_CODES.INVALID_TOKEN }),
      });
    });

    it('rotates the refresh token and returns a new access token on success', async () => {
      const jwtService = {
        verify: jest
          .fn()
          .mockReturnValue({ sub: 'user-1', phone: '+1', type: 'refresh' }),
        sign: jest
          .fn()
          .mockImplementation((payload) =>
            payload.type === 'access'
              ? 'new-access-token'
              : 'new-refresh-token',
          ),
      };
      const storedUser = {
        phone: '+1',
        refreshTokenHash: 'current-hash',
        save: jest.fn().mockResolvedValue(undefined),
        toObject: jest.fn().mockImplementation(function (this: any) {
          return { phone: this.phone, refreshTokenHash: this.refreshTokenHash };
        }),
      };
      const userModel = {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(storedUser),
        }),
      };
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const res = makeRes();
      const service = new AuthService(
        userModel as never,
        jwtService as never,
        {} as never,
        makeConfigService() as never,
      );

      const result = await service.refreshToken('current-token', res as never);

      expect(result.access_token).toBe('new-access-token');
      expect(result.user).not.toHaveProperty('refreshTokenHash');
      expect(storedUser.save).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith('new-refresh-token', 10);
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.clearCookie).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('rejects logout for a user that no longer exists and leaves the cookie untouched', async () => {
      const userModel = {
        findByIdAndUpdate: jest.fn().mockResolvedValue(null),
      };
      const res = makeRes();
      const service = new AuthService(
        userModel as never,
        {} as never,
        {} as never,
        makeConfigService() as never,
      );

      await expect(
        service.logout('user-1', res as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: ERROR_CODES.USER_NOT_FOUND }),
      });
      expect(res.clearCookie).not.toHaveBeenCalled();
    });

    it('clears the refresh cookie on successful logout', async () => {
      const userModel = {
        findByIdAndUpdate: jest.fn().mockResolvedValue({ _id: 'user-1' }),
      };
      const res = makeRes();
      const service = new AuthService(
        userModel as never,
        {} as never,
        {} as never,
        makeConfigService() as never,
      );

      await service.logout('user-1', res as never);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-1',
        { refreshTokenHash: null },
        { new: false },
      );
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
    });
  });
});
