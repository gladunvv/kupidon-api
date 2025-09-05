import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, statSync } from 'fs';
import { join, extname } from 'path';

@Injectable()
export class StaticService {
  private readonly uploadsPath = join(process.cwd(), 'uploads');

  /**
   * Проверяет существование файла
   */
  fileExists(filePath: string): boolean {
    const fullPath = join(this.uploadsPath, filePath);
    return existsSync(fullPath);
  }

  /**
   * Получает информацию о файле
   */
  getFileInfo(filePath: string) {
    const fullPath = join(this.uploadsPath, filePath);

    if (!existsSync(fullPath)) {
      throw new NotFoundException('File not found');
    }

    const stats = statSync(fullPath);
    const ext = extname(filePath).toLowerCase();

    return {
      path: fullPath,
      size: stats.size,
      mimeType: this.getMimeType(ext),
      lastModified: stats.mtime,
    };
  }

  /**
   * Определяет MIME тип по расширению файла
   */
  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Проверяет, является ли файл изображением
   */
  isImage(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
  }

  /**
   * Получает URL для файла
   */
  getFileUrl(filePath: string, baseUrl?: string): string {
    const cleanPath = filePath.startsWith('uploads/')
      ? filePath
      : `uploads/${filePath}`;
    return baseUrl ? `${baseUrl}/${cleanPath}` : `/${cleanPath}`;
  }
}
