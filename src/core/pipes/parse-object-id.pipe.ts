import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';
import { ERROR_CODES } from '../http/error-codes';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException({
        message: 'Invalid MongoDB ObjectId',
        code: ERROR_CODES.INVALID_OBJECT_ID,
      });
    }

    return value;
  }
}
