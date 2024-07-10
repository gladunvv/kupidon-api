import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { DialogService } from './dialog.service';
import { Dialog } from '../../schemas/dialog.schema';

@Controller('dialogs')
export class DialogController {
  constructor(private readonly dialogService: DialogService) {}

  @Get(':id')
  async getDialog(@Param('id') id: string): Promise<Dialog> {
    const dialog = await this.dialogService.getDialog(id);
    if (!dialog) {
      throw new NotFoundException('Dialog not found');
    }
    return dialog;
  }

  @Get(':id/messages')
  async getMessages(@Param('id') id: string) {
    const dialog = await this.dialogService.getDialog(id);
    if (!dialog) {
      throw new NotFoundException('Dialog not found');
    }
    return dialog.messages;
  }
}
