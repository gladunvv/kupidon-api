import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { FilesInterceptor } from '@nestjs/platform-express';

@Injectable()
export class FlexibleFilesInterceptor implements NestInterceptor {
  private photosInterceptor = new (FilesInterceptor('photos', 5))();
  private photosArrayInterceptor = new (FilesInterceptor('photos[]', 5))();

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    
    // Проверяем, какое поле присутствует в запросе
    const hasPhotos = request.body && 'photos' in request.body;
    const hasPhotosArray = request.headers['content-type']?.includes('photos[]');
    
    try {
      // Сначала пробуем photos[]
      await this.photosArrayInterceptor.intercept(context, next);
    } catch (error) {
      // Если не получилось, пробуем photos
      await this.photosInterceptor.intercept(context, next);
    }
    
    return next.handle();
  }
}