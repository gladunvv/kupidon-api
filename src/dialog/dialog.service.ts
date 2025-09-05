import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Dialog,
  DialogDocument,
  Match,
  Message,
  MessageDocument,
  MatchDocument,
} from '../schemas';

@Injectable()
export class DialogService {
  constructor(
    @InjectModel(Dialog.name)
    private readonly dialogModel: Model<DialogDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Match.name)
    private readonly matchModel: Model<MatchDocument>,
  ) {}

  async getDialog(dialogId: string) {
    const dialog = await this.dialogModel
      .findById(dialogId)
      .populate('messages');
    if (!dialog) {
      throw new NotFoundException('Dialog not found');
    }
    return dialog;
  }

  // Получение диалога с информацией о партнере
  async getDialogWithPartner(dialogId: string, userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const dialogObjectId = new Types.ObjectId(dialogId);

    const dialogs = await this.dialogModel
      .aggregate([
        // Фильтруем конкретный диалог где участвует пользователь
        {
          $match: {
            _id: dialogObjectId,
            $or: [{ user1: userObjectId }, { user2: userObjectId }],
            isActive: true,
          },
        },
        // Определяем партнера
        {
          $addFields: {
            partnerId: {
              $cond: {
                if: { $eq: ['$user1', userObjectId] },
                then: '$user2',
                else: '$user1',
              },
            },
          },
        },
        // Получаем информацию о партнере
        {
          $lookup: {
            from: 'users',
            localField: 'partnerId',
            foreignField: '_id',
            as: 'partner',
            pipeline: [
              {
                $project: {
                  name: 1,
                  age: 1,
                  photos: 1,
                  about: 1,
                },
              },
              {
                $project: {
                  // Исключаем приватную информацию
                  phone: 0,
                  __v: 0,
                },
              },
            ],
          },
        },
        // Получаем сообщения с информацией об отправителях
        {
          $lookup: {
            from: 'messages',
            localField: 'messages',
            foreignField: '_id',
            as: 'messagesData',
            pipeline: [
              {
                $lookup: {
                  from: 'users',
                  localField: 'sender',
                  foreignField: '_id',
                  as: 'senderData',
                  pipeline: [{ $project: { name: 1 } }],
                },
              },
              {
                $addFields: {
                  senderName: { $arrayElemAt: ['$senderData.name', 0] },
                  isFromCurrentUser: { $eq: ['$sender', userObjectId] },
                },
              },
              {
                $project: {
                  text: 1,
                  sender: { _id: '$sender', name: '$senderName' },
                  isFromCurrentUser: 1,
                  created_at: 1,
                },
              },
              {
                $sort: { created_at: 1 }, // Сообщения по порядку
              },
            ],
          },
        },
        // Форматируем результат
        {
          $project: {
            _id: 1,
            matchId: 1,
            partner: { $arrayElemAt: ['$partner', 0] },
            messages: '$messagesData',
            messagesCount: { $size: '$messagesData' },
            isActive: 1,
            created_at: 1,
            updated_at: 1,
          },
        },
      ])
      .exec();

    if (!dialogs.length) {
      throw new NotFoundException('Dialog not found or access denied');
    }

    return dialogs[0];
  }

  async sendMessage(dialogId: string, senderId: string, text: string) {
    const dialog = await this.dialogModel.findById(dialogId);
    if (!dialog) {
      throw new NotFoundException('Dialog not found');
    }

    const message = new this.messageModel({
      sender: new Types.ObjectId(senderId),
      text,
    });
    await message.save();

    (dialog.messages as any).push(message._id);
    (dialog as any).lastMessage = message._id;
    (dialog as any).updated_at = new Date();
    await dialog.save();

    // Возвращаем сообщение с информацией об отправителе
    const messageWithSender = await this.messageModel
      .findById(message._id)
      .populate('sender', 'name')
      .exec();

    return messageWithSender;
  }

  async createDialog(matchId: string) {
    const match = await this.matchModel.findById(matchId);
    if (!match) {
      throw new NotFoundException('Dialog not found');
    }
    const dialog = new this.dialogModel({
      matchId,
      user1: match.user1,
      user2: match.user2,
      messages: [],
    });

    await dialog.save();

    return dialog;
  }

  // Получение списка диалогов пользователя
  async getUserDialogs(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const dialogs = await this.dialogModel
      .aggregate([
        // Фильтруем диалоги где участвует пользователь
        {
          $match: {
            $or: [{ user1: userObjectId }, { user2: userObjectId }],
            isActive: true,
          },
        },
        // Определяем партнера
        {
          $addFields: {
            partnerId: {
              $cond: {
                if: { $eq: ['$user1', userObjectId] },
                then: '$user2',
                else: '$user1',
              },
            },
          },
        },
        // Получаем информацию о партнере
        {
          $lookup: {
            from: 'users',
            localField: 'partnerId',
            foreignField: '_id',
            as: 'partner',
            pipeline: [
              {
                $project: {
                  name: 1,
                  photos: { $arrayElemAt: ['$photos', 0] }, // Первое фото для превью
                },
              },
              {
                $project: {
                  // Исключаем приватную информацию
                  phone: 0,
                  __v: 0,
                },
              },
            ],
          },
        },
        // Получаем последнее сообщение
        {
          $lookup: {
            from: 'messages',
            localField: 'lastMessage',
            foreignField: '_id',
            as: 'lastMessageData',
            pipeline: [
              {
                $lookup: {
                  from: 'users',
                  localField: 'sender',
                  foreignField: '_id',
                  as: 'senderData',
                  pipeline: [{ $project: { name: 1 } }],
                },
              },
              {
                $addFields: {
                  senderName: { $arrayElemAt: ['$senderData.name', 0] },
                },
              },
              {
                $project: {
                  text: 1,
                  sender: { _id: '$sender', name: '$senderName' },
                  created_at: 1,
                },
              },
            ],
          },
        },
        // Подсчитываем количество сообщений
        {
          $addFields: {
            messagesCount: { $size: '$messages' },
          },
        },
        // Форматируем результат
        {
          $project: {
            _id: 1,
            matchId: 1,
            partner: { $arrayElemAt: ['$partner', 0] },
            lastMessage: { $arrayElemAt: ['$lastMessageData', 0] },
            messagesCount: 1,
            updated_at: 1,
            isActive: 1,
          },
        },
        // Сортируем по последнему обновлению
        {
          $sort: { updated_at: -1 },
        },
      ])
      .exec();

    return dialogs;
  }

  // Обновление lastMessage при отправке нового сообщения
  async updateLastMessage(dialogId: string, messageId: string) {
    await this.dialogModel
      .findByIdAndUpdate(dialogId, {
        lastMessage: new Types.ObjectId(messageId),
        updated_at: new Date(),
      })
      .exec();
  }
}
