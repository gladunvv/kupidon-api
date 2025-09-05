'use strict';
var __decorate =
  (this && this.__decorate) ||
  function (decorators, target, key, desc) {
    var c = arguments.length,
      r =
        c < 3
          ? target
          : desc === null
            ? (desc = Object.getOwnPropertyDescriptor(target, key))
            : desc,
      d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function')
      r = Reflect.decorate(decorators, target, key, desc);
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if ((d = decorators[i]))
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
var __metadata =
  (this && this.__metadata) ||
  function (k, v) {
    if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function')
      return Reflect.metadata(k, v);
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.DialogMongoModule = exports.Dialog = void 0;
const mongoose_1 = require('mongoose');
const mongoose_2 = require('@nestjs/mongoose');
const common_1 = require('@nestjs/common');
let Dialog = class Dialog {};
exports.Dialog = Dialog;
__decorate(
  [
    (0, mongoose_2.Prop)({ type: mongoose_1.Types.ObjectId, ref: 'Match' }),
    __metadata('design:type', mongoose_1.Types.ObjectId),
  ],
  Dialog.prototype,
  'matchId',
  void 0,
);
__decorate(
  [
    (0, mongoose_2.Prop)({ type: [mongoose_1.Types.ObjectId], ref: 'Message' }),
    __metadata('design:type', Array),
  ],
  Dialog.prototype,
  'messages',
  void 0,
);
__decorate(
  [
    (0, mongoose_2.Prop)({ type: mongoose_1.Types.ObjectId, ref: 'User' }),
    __metadata('design:type', mongoose_1.Types.ObjectId),
  ],
  Dialog.prototype,
  'user1',
  void 0,
);
__decorate(
  [
    (0, mongoose_2.Prop)({ type: mongoose_1.Types.ObjectId, ref: 'User' }),
    __metadata('design:type', mongoose_1.Types.ObjectId),
  ],
  Dialog.prototype,
  'user2',
  void 0,
);
__decorate(
  [
    (0, mongoose_2.Prop)({ type: mongoose_1.Types.ObjectId, ref: 'Message' }),
    __metadata('design:type', mongoose_1.Types.ObjectId),
  ],
  Dialog.prototype,
  'lastMessage',
  void 0,
);
__decorate(
  [
    (0, mongoose_2.Prop)({ type: Boolean, default: true }),
    __metadata('design:type', Boolean),
  ],
  Dialog.prototype,
  'isActive',
  void 0,
);
exports.Dialog = Dialog = __decorate(
  [
    (0, mongoose_2.Schema)({
      collection: 'dialogs',
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    }),
  ],
  Dialog,
);
const DialogSchema = mongoose_2.SchemaFactory.createForClass(Dialog);
let DialogMongoModule = class DialogMongoModule {};
exports.DialogMongoModule = DialogMongoModule;
exports.DialogMongoModule = DialogMongoModule = __decorate(
  [
    (0, common_1.Module)({
      imports: [
        mongoose_2.MongooseModule.forFeature([
          {
            name: Dialog.name,
            schema: DialogSchema,
          },
        ]),
      ],
      exports: [mongoose_2.MongooseModule],
    }),
  ],
  DialogMongoModule,
);
//# sourceMappingURL=dialog.schema.js.map
