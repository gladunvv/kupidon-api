import { Injectable } from '@nestjs/common';

@Injectable()
export class ShutdownService {
  private shuttingDown = false;

  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  beginShutdown(): void {
    this.shuttingDown = true;
  }
}
