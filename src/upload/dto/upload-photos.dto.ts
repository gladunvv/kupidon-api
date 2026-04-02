import { ApiProperty } from '@nestjs/swagger';

export class UploadPhotosDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
  })
  photos: any[];
}
