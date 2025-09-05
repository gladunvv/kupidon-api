import { Module } from '@nestjs/common';
import { UserMongoModule } from '../schemas';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { jwtSecret } from './../jwtSecret';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from 'src/users/users.module';
import { PassportModule } from '@nestjs/passport';
import { OtpModule } from 'src/otp/otp.module';

@Module({
  imports: [
    JwtModule.register({
      secret: jwtSecret.secret,
      signOptions: { expiresIn: '1h' },
    }),
    UserMongoModule,
    UsersModule,
    PassportModule,
    OtpModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
