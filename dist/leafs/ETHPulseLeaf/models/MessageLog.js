var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Column, Model, AllowNull, Default, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Index, } from 'etherial/components/database/provider';
import etherial from 'etherial';
export var MessageType;
(function (MessageType) {
    MessageType["SMS"] = "sms";
    MessageType["EMAIL"] = "email";
    MessageType["PUSH"] = "push";
})(MessageType || (MessageType = {}));
export var MessageStatus;
(function (MessageStatus) {
    MessageStatus["PENDING"] = "pending";
    MessageStatus["SENT"] = "sent";
    MessageStatus["DELIVERED"] = "delivered";
    MessageStatus["FAILED"] = "failed";
    MessageStatus["BOUNCED"] = "bounced";
})(MessageStatus || (MessageStatus = {}));
/**
 * Base MessageLog Model (no @Table - define it in your project)
 */
export class BaseMessageLog extends Model {
    /**
     * Log a message to the database
     * Uses the registered MessageLog model from Sequelize (not the base class)
     */
    static logMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Get the registered MessageLog model from Sequelize
            const sequelize = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize;
            const MessageLogModel = (_b = sequelize === null || sequelize === void 0 ? void 0 : sequelize.models) === null || _b === void 0 ? void 0 : _b.MessageLog;
            if (!MessageLogModel) {
                console.error('[BaseMessageLog] MessageLog model not registered in Sequelize');
                throw new Error('MessageLog model not found');
            }
            return MessageLogModel.create({
                type: data.type,
                provider: data.provider,
                recipient: data.recipient,
                subject: data.subject,
                status: data.status || MessageStatus.PENDING,
                external_id: data.externalId,
                error_message: data.errorMessage,
                metadata: data.metadata,
                user_id: data.userId,
            });
        });
    }
    updateStatus(status, externalId, errorMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.update({
                status,
                external_id: externalId || this.external_id,
                error_message: errorMessage,
            });
        });
    }
    markAsSent(externalId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateStatus(MessageStatus.SENT, externalId);
        });
    }
    markAsFailed(errorMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateStatus(MessageStatus.FAILED, undefined, errorMessage);
        });
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], BaseMessageLog.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column(DataType.ENUM(...Object.values(MessageType))),
    __metadata("design:type", String)
], BaseMessageLog.prototype, "type", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column(DataType.STRING(50)),
    __metadata("design:type", String)
], BaseMessageLog.prototype, "provider", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseMessageLog.prototype, "recipient", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(500)),
    __metadata("design:type", String)
], BaseMessageLog.prototype, "subject", void 0);
__decorate([
    AllowNull(false),
    Default(MessageStatus.PENDING),
    Index,
    Column(DataType.ENUM(...Object.values(MessageStatus))),
    __metadata("design:type", String)
], BaseMessageLog.prototype, "status", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseMessageLog.prototype, "external_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BaseMessageLog.prototype, "error_message", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], BaseMessageLog.prototype, "metadata", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseMessageLog.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date
    /**
     * Log a message to the database
     * Uses the registered MessageLog model from Sequelize (not the base class)
     */
    )
], BaseMessageLog.prototype, "updated_at", void 0);
// Alias for backwards compatibility
export { BaseMessageLog as MessageLog };
