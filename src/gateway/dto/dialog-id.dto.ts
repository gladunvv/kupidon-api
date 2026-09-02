import { IsMongoId } from 'class-validator';

export class DialogIdDto {
  @IsMongoId()
  dialogId: string;
}
