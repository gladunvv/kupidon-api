import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

export function assertObjectId(id: string, message: string): void {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException(message);
  }
}
