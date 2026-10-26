var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, BeforeSave } from 'etherial/components/database/provider';
import { CONTACT_KINDS, ContentError } from '../services/options.js';
import { cleanTexts } from '../services/texts.js';
/** One way to reach the company: a phone number, a WhatsApp, an email address, a site, a social account. */
let Contact = class Contact extends Model {
    static check(contact) {
        var _a;
        if (!CONTACT_KINDS.includes(contact.kind))
            throw new ContentError(`Kind: one of ${CONTACT_KINDS.join(', ')}.`);
        contact.value = String((_a = contact.value) !== null && _a !== void 0 ? _a : '').trim();
        if (!contact.value)
            throw new ContentError('Value: the number, the address or the link is required.');
        contact.label = cleanTexts(contact.label);
        contact.hours = cleanTexts(contact.hours);
    }
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], Contact.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(20)),
    __metadata("design:type", String)
], Contact.prototype, "kind", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(300)),
    __metadata("design:type", String)
], Contact.prototype, "value", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Contact.prototype, "label", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Contact.prototype, "hours", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], Contact.prototype, "position", void 0);
__decorate([
    AllowNull(false),
    Default(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], Contact.prototype, "published", void 0);
__decorate([
    BeforeSave,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Contact]),
    __metadata("design:returntype", void 0)
], Contact, "check", null);
Contact = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'content_contacts',
        freezeTableName: true,
        indexes: [{ fields: ['published', 'position'] }],
    })
], Contact);
export { Contact };
