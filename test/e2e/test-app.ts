import {
  BadRequestException,
  INestApplication,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppController } from '../../src/app.controller';
import { AppService } from '../../src/app.service';
import { AuthController } from '../../src/auth/auth.controller';
import { VerifyOtpDto } from '../../src/auth/dto/verify-otp.dto';
import { AuthService } from '../../src/auth/auth.service';
import { JwtAuthGuard } from '../../src/auth/guards/auth-guard';
import { JwtStrategy } from '../../src/auth/jwt.strategy';
import { HttpExceptionFilter } from '../../src/core/http/http-exception.filter';
import { MulterExceptionFilter } from '../../src/core/http/multer-exception.filter';
import { ResponseInterceptor } from '../../src/core/http/response.interceptor';
import { ERROR_CODES } from '../../src/core/http/error-codes';
import { validationPipe } from '../../src/core/pipes/validation.pipe';
import { DialogController } from '../../src/dialog/dialog.controller';
import { DialogService } from '../../src/dialog/dialog.service';
import { MatchController } from '../../src/match/match.controller';
import { MatchService } from '../../src/match/match.service';
import { ReferenceController } from '../../src/reference/reference.controller';
import { ReferenceService } from '../../src/reference/reference.service';
import { SeedController } from '../../src/seed/seed.controller';
import { SeedOptions, SeedService } from '../../src/seed/seed.service';
import { UploadController } from '../../src/upload/upload.controller';
import { UploadService } from '../../src/upload/upload.service';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';

const JWT_SECRET = 'test-secret';

export const testIds = {
  user: '507f1f77bcf86cd799439011',
  matchedUser: '507f191e810c19729de860ea',
  pendingUser: '507f191e810c19729de860eb',
  missingUser: '507f191e810c19729de860ef',
  match: '507f1f77bcf86cd799439012',
  dialog: '507f1f77bcf86cd799439013',
  missingDialog: '507f1f77bcf86cd799439014',
  category: '507f1f77bcf86cd799439015',
  missingCategory: '507f1f77bcf86cd799439016',
  missingMatch: '507f1f77bcf86cd799439017',
};

export const defaultPhone = '+79990001122';
export const defaultOtp = '1234';

type TestUser = {
  _id: string;
  phone: string;
  name: string;
  age: number;
  gender: string;
  about: string;
  photos: string[];
  city: string | null;
  interests: string[];
  goals: string[];
  lifestyleOptions: string[];
  occupation?: string;
  education?: string;
  height?: number;
  searchPreferences: {
    minAge: number;
    maxAge: number;
    maxDistance: number;
    genders: string[];
  };
  coordinates?: [number, number];
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const createBaseUser = (): TestUser => ({
  _id: testIds.user,
  phone: defaultPhone,
  name: 'Vlad',
  age: 28,
  gender: 'male',
  about: 'Loves clean architecture',
  photos: ['/uploads/photo-1.jpg', '/uploads/photo-2.jpg'],
  city: 'Moscow',
  interests: ['music', 'sport'],
  goals: ['relationship'],
  lifestyleOptions: ['active'],
  occupation: 'Backend developer',
  education: 'Higher',
  height: 182,
  searchPreferences: {
    minAge: 22,
    maxAge: 35,
    maxDistance: 50,
    genders: ['female'],
  },
  coordinates: [37.6173, 55.7558],
});

const createMatchedUser = (): TestUser => ({
  _id: testIds.matchedUser,
  phone: '+79990002233',
  name: 'Anna',
  age: 27,
  gender: 'female',
  about: 'Enjoys travel and coffee',
  photos: ['/uploads/anna-1.jpg'],
  city: 'Moscow',
  interests: ['music'],
  goals: ['relationship'],
  lifestyleOptions: ['active'],
  searchPreferences: {
    minAge: 25,
    maxAge: 35,
    maxDistance: 30,
    genders: ['male'],
  },
  coordinates: [37.62, 55.75],
});

const createPendingUser = (): TestUser => ({
  _id: testIds.pendingUser,
  phone: '+79990003344',
  name: 'Kate',
  age: 25,
  gender: 'female',
  about: 'Reads books',
  photos: ['/uploads/kate-1.jpg'],
  city: 'Saint Petersburg',
  interests: ['books'],
  goals: ['friendship'],
  lifestyleOptions: ['calm'],
  searchPreferences: {
    minAge: 24,
    maxAge: 34,
    maxDistance: 100,
    genders: ['male'],
  },
  coordinates: [30.3141, 59.9386],
});

@Injectable()
export class TestUsersService {
  private users = new Map<string, TestUser>();
  private counter = 32;

  constructor() {
    this.reset();
  }

  reset() {
    this.users = new Map([
      [testIds.user, createBaseUser()],
      [testIds.matchedUser, createMatchedUser()],
      [testIds.pendingUser, createPendingUser()],
    ]);
    this.counter = 32;
  }

  private nextId() {
    const suffix = this.counter.toString(16).padStart(2, '0');
    this.counter += 1;
    return `507f1f77bcf86cd7994390${suffix}`;
  }

  findById(userId: string) {
    return clone(this.users.get(userId) ?? null);
  }

  getOrCreateByPhone(phone: string) {
    const existing = [...this.users.values()].find(
      (user) => user.phone === phone,
    );
    if (existing) {
      return clone(existing);
    }

    const created = {
      ...createBaseUser(),
      _id: this.nextId(),
      phone,
      name: 'New user',
      photos: [],
    };
    this.users.set(created._id, created);
    return clone(created);
  }

  getFullProfile(userId: string) {
    const user = this.users.get(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return clone(user);
  }

  getCompleteProfile(userId: string) {
    return {
      ...this.getFullProfile(userId),
      profileCompleteness: 100,
      missingRequiredFields: [],
    };
  }

  findUsersForMatching(_userId: string, page = 1, limit = 20) {
    const users = [createMatchedUser(), createPendingUser()]
      .slice(0, limit)
      .map((user, index) => ({ ...user, liked: index === 0 }));

    return {
      users,
      total: 2,
      page,
      totalPages: 1,
    };
  }

  updateProfile(userId: string, dto: Record<string, unknown>) {
    const user = this.users.get(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    Object.assign(user, dto);
    return clone(user);
  }

  updateSearchPreferences(userId: string, dto: TestUser['searchPreferences']) {
    const user = this.users.get(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.searchPreferences = { ...user.searchPreferences, ...dto };
    return clone(user);
  }

  findNearbyUsers(
    _userId: string,
    coordinates?: { latitude: number; longitude: number },
    maxDistance = 50,
    page = 1,
    limit = 20,
  ) {
    if (
      coordinates &&
      (!Number.isFinite(coordinates.latitude) ||
        !Number.isFinite(coordinates.longitude))
    ) {
      throw new BadRequestException('Coordinates must be valid numbers');
    }

    return {
      users: [clone(createMatchedUser())].slice(0, limit),
      total: 1,
      page,
      totalPages: 1,
      maxDistance,
    };
  }

  calculateCompatibility(_userId: string, targetUserId: string) {
    if (!this.users.has(targetUserId)) {
      throw new NotFoundException('One or both users not found');
    }

    return {
      totalScore: 86,
      factors: [
        { name: 'Общие интересы', score: 36, details: '2 общих интереса' },
        { name: 'Общие цели', score: 30, details: '1 общая цель' },
      ],
      recommendation: 'Высокая совместимость',
    };
  }
}

@Injectable()
class TestAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: TestUsersService,
  ) {}

  async sendOtp(_phone: string): Promise<void> {
    return;
  }

  async verifyOtp(dto: VerifyOtpDto, res: { cookie: Function }) {
    if (dto.otp !== defaultOtp) {
      throw new UnauthorizedException({
        message: 'Invalid OTP code',
        code: ERROR_CODES.INVALID_OTP,
      });
    }

    const user = this.usersService.getOrCreateByPhone(dto.phone);
    const accessToken = this.jwtService.sign({
      sub: user._id,
      phone: user.phone,
    });
    const refreshToken = this.jwtService.sign(
      { sub: user._id, phone: user.phone },
      { expiresIn: '7d' },
    );

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
    });

    return { access_token: accessToken, user };
  }

  async refreshToken(
    refreshToken: string | undefined,
    res: { clearCookie: Function; cookie: Function },
  ) {
    if (!refreshToken) {
      res.clearCookie('refresh_token');
      throw new UnauthorizedException({
        message: 'Refresh token not found',
        code: ERROR_CODES.INVALID_TOKEN,
      });
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; phone: string }>(
        refreshToken,
      );
      const user = this.usersService.findById(payload.sub);

      if (!user) {
        res.clearCookie('refresh_token');
        throw new UnauthorizedException({
          message: 'User not found',
          code: ERROR_CODES.INVALID_TOKEN,
        });
      }

      const accessToken = this.jwtService.sign({
        sub: user._id,
        phone: user.phone,
      });
      const nextRefreshToken = this.jwtService.sign(
        { sub: user._id, phone: user.phone },
        { expiresIn: '7d' },
      );

      res.cookie('refresh_token', nextRefreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      });

      return { access_token: accessToken, user };
    } catch (error) {
      res.clearCookie('refresh_token');
      throw new UnauthorizedException({
        message: 'Invalid refresh token',
        code: ERROR_CODES.INVALID_TOKEN,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async logout(res: { clearCookie: Function }) {
    res.clearCookie('refresh_token');
  }
}

@Injectable()
class TestMatchService {
  async likeUser(_userId: string, likedUserId: string) {
    if (likedUserId === testIds.missingUser) {
      throw new NotFoundException('User not found');
    }

    if (likedUserId === testIds.matchedUser) {
      return {
        match: { _id: testIds.match, created_at: '2024-01-01T10:00:00.000Z' },
        dialog: { _id: testIds.dialog, matchId: testIds.match, isActive: true },
      };
    }

    return null;
  }

  async getUserMatches() {
    return [
      {
        _id: testIds.match,
        partner: {
          _id: testIds.matchedUser,
          name: 'Anna',
          photos: ['/uploads/anna-1.jpg'],
        },
        hasDialog: true,
      },
    ];
  }

  async getMatchDetails(matchId: string) {
    if (matchId !== testIds.match) {
      throw new NotFoundException('Match not found or access denied');
    }

    return {
      match: { _id: testIds.match, created_at: '2024-01-01T10:00:00.000Z' },
      partner: { _id: testIds.matchedUser, name: 'Anna' },
      dialog: { _id: testIds.dialog, hasMessages: true, isActive: true },
    };
  }
}

@Injectable()
class TestDialogService {
  private messages = [
    {
      _id: '507f1f77bcf86cd799439021',
      text: 'Привет!',
      sender: { _id: testIds.matchedUser, name: 'Anna' },
      created_at: '2024-01-01T10:10:00.000Z',
    },
  ];

  reset() {
    this.messages = [
      {
        _id: '507f1f77bcf86cd799439021',
        text: 'Привет!',
        sender: { _id: testIds.matchedUser, name: 'Anna' },
        created_at: '2024-01-01T10:10:00.000Z',
      },
    ];
  }

  async getUserDialogs() {
    return [
      {
        _id: testIds.dialog,
        partner: {
          _id: testIds.matchedUser,
          name: 'Anna',
          photos: ['/uploads/anna-1.jpg'],
        },
        messagesCount: this.messages.length,
        isActive: true,
      },
    ];
  }

  async createDialog(matchId: string) {
    if (matchId !== testIds.match) {
      throw new NotFoundException('Match not found');
    }

    return {
      _id: testIds.dialog,
      matchId,
      user1: testIds.user,
      user2: testIds.matchedUser,
    };
  }

  async getDialogWithPartner(dialogId: string) {
    if (dialogId !== testIds.dialog) {
      throw new NotFoundException('Dialog not found or access denied');
    }

    return {
      _id: testIds.dialog,
      matchId: testIds.match,
      partner: {
        _id: testIds.matchedUser,
        name: 'Anna',
        photos: ['/uploads/anna-1.jpg'],
      },
      messages: clone(this.messages),
      messagesCount: this.messages.length,
      isActive: true,
    };
  }

  async sendMessage(dialogId: string, userId: string, text: string) {
    if (dialogId !== testIds.dialog) {
      throw new NotFoundException('Dialog not found');
    }

    const message = {
      _id: '507f1f77bcf86cd799439022',
      text,
      sender: { _id: userId, name: userId === testIds.user ? 'Vlad' : 'Anna' },
      created_at: '2024-01-01T10:30:00.000Z',
    };

    this.messages.push(message);
    return clone(message);
  }
}

@Injectable()
class TestReferenceService {
  private readonly cities = [
    { _id: 'city-1', name: 'Moscow', countryCode: 'RU' },
    { _id: 'city-2', name: 'Berlin', countryCode: 'DE' },
  ];

  async getCities(
    options: { countryCode?: string; search?: string; limit?: number } = {},
  ) {
    return this.cities
      .filter((city) => {
        if (options.countryCode && city.countryCode !== options.countryCode) {
          return false;
        }
        if (
          options.search &&
          !city.name.toLowerCase().includes(options.search.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .slice(0, options.limit ?? 50);
  }

  async getPopularCities(limit = 20) {
    return this.cities.slice(0, limit);
  }

  async getCitiesNearby(options: {
    latitude?: number;
    longitude?: number;
    limit?: number;
  }) {
    if (options.latitude === undefined || options.longitude === undefined) {
      throw new BadRequestException('Latitude and longitude are required');
    }
    return this.cities.slice(0, options.limit ?? 10);
  }

  async getInterests(tags?: string[]) {
    const interests = [
      { _id: 'interest-1', label: 'Music', tags: ['music'] },
      { _id: 'interest-2', label: 'Sport', tags: ['sport'] },
    ];
    return tags?.length
      ? interests.filter((item) => tags.some((tag) => item.tags.includes(tag)))
      : interests;
  }

  async getGoals() {
    return [{ _id: 'goal-1', name: 'Relationship' }];
  }

  async getLifestyleCategories() {
    return [{ _id: testIds.category, name: 'Activity' }];
  }

  async getLifestyleOptions(categoryId: string) {
    if (categoryId !== testIds.category) {
      throw new NotFoundException('Category not found');
    }
    return [{ _id: 'option-1', label: 'Active', category: categoryId }];
  }

  async getAllLifestyleOptions() {
    return [{ _id: 'option-1', label: 'Active' }];
  }

  async getAllReferences() {
    return {
      cities: await this.getPopularCities(),
      interests: await this.getInterests(),
      goals: await this.getGoals(),
      lifestyleCategories: await this.getLifestyleCategories(),
      lifestyleOptions: await this.getAllLifestyleOptions(),
    };
  }
}

@Injectable()
class TestUploadService {
  private photosByUser = new Map<string, string[]>();

  constructor() {
    this.reset();
  }

  reset() {
    this.photosByUser = new Map([
      [testIds.user, ['/uploads/photo-1.jpg', '/uploads/photo-2.jpg']],
    ]);
  }

  async uploadPhotos(userId: string, photos: Express.Multer.File[]) {
    const current = this.photosByUser.get(userId);
    if (!current) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }
    if (current.length + photos.length > 5) {
      throw new BadRequestException({
        message: `Maximum 5 photos allowed. You have ${current.length} photos, trying to add ${photos.length}`,
        code: ERROR_CODES.MAX_PHOTOS_EXCEEDED,
      });
    }
    const created = photos.map((photo) => `/uploads/${photo.originalname}`);
    current.push(...created);
    return { photos: created };
  }

  async deletePhoto(userId: string, photoPath: string) {
    const current = this.photosByUser.get(userId);
    if (!current) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }
    if (!current.includes(photoPath)) {
      throw new BadRequestException({
        message: 'Photo not found',
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    this.photosByUser.set(
      userId,
      current.filter((photo) => photo !== photoPath),
    );
    return null;
  }

  async reorderPhotos(userId: string, photoOrder: string[]) {
    const current = this.photosByUser.get(userId);
    if (!current) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }
    if (photoOrder.length !== current.length) {
      throw new BadRequestException({
        message: 'Photo count mismatch',
        code: ERROR_CODES.PHOTO_COUNT_MISMATCH,
      });
    }
    if (photoOrder.some((photo) => !current.includes(photo))) {
      throw new BadRequestException({
        message: 'Some photos do not belong to user',
        code: ERROR_CODES.INVALID_PHOTOS,
      });
    }
    this.photosByUser.set(userId, [...photoOrder]);
    return { photos: [...photoOrder] };
  }

  async getUserPhotos(userId: string) {
    const current = this.photosByUser.get(userId);
    if (!current) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }
    return { photos: [...current] };
  }
}

@Injectable()
class TestSeedService {
  lastOptions: SeedOptions | null = null;

  reset() {
    this.lastOptions = null;
  }

  async run(options: SeedOptions = {}) {
    if (options.models?.includes('broken')) {
      throw new BadRequestException('Unsupported seed model');
    }
    this.lastOptions = options;
  }

  async getStats() {
    return {
      cities: 2,
      goals: 1,
      interests: 2,
      lifestyleCategories: 1,
      lifestyleOptions: 1,
    };
  }
}

export async function createTestApp() {
  process.env.JWT_SECRET = JWT_SECRET;

  const moduleRef = await Test.createTestingModule({
    imports: [
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.register({ secret: JWT_SECRET }),
    ],
    controllers: [
      AppController,
      AuthController,
      UsersController,
      MatchController,
      DialogController,
      ReferenceController,
      UploadController,
      SeedController,
    ],
    providers: [
      AppService,
      JwtAuthGuard,
      JwtStrategy,
      TestUsersService,
      TestDialogService,
      TestUploadService,
      TestSeedService,
      { provide: UsersService, useExisting: TestUsersService },
      { provide: AuthService, useClass: TestAuthService },
      { provide: MatchService, useClass: TestMatchService },
      { provide: DialogService, useExisting: TestDialogService },
      { provide: ReferenceService, useClass: TestReferenceService },
      { provide: UploadService, useExisting: TestUploadService },
      { provide: SeedService, useExisting: TestSeedService },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  const reflector = app.get(Reflector);

  app.use(cookieParser());
  app.useGlobalPipes(validationPipe);
  app.useGlobalFilters(new MulterExceptionFilter(), new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  await app.init();

  const users = app.get(TestUsersService);
  const dialogs = app.get(TestDialogService);
  const uploads = app.get(TestUploadService);
  const seed = app.get(TestSeedService);

  return {
    app,
    resetState() {
      users.reset();
      dialogs.reset();
      uploads.reset();
      seed.reset();
    },
  };
}

export async function createAuthorizedSession(app: INestApplication) {
  const agent = request.agent(app.getHttpServer());

  await agent.post('/auth/request-otp').send({ phone: defaultPhone });
  const verify = await agent
    .post('/auth/verify-otp')
    .send({ phone: defaultPhone, otp: defaultOtp });

  const accessToken = verify.body.data.access_token as string;

  return {
    agent,
    accessToken,
  };
}
