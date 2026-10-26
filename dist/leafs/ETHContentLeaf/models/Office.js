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
import { cleanTexts, orNull, requiredLabel } from '../services/texts.js';
/** An office or a sales center: where it is, when it opens, how to call it. */
let Office = class Office extends Model {
    static fillLabel(office) {
        office.name = cleanTexts(office.name);
        office.address = cleanTexts(office.address);
        office.hours = cleanTexts(office.hours);
        office.label = requiredLabel(office.name, 'Name');
        office.phone = orNull(office.phone);
        office.email = orNull(office.email);
        office.map_url = orNull(office.map_url);
    }
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], Office.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Office.prototype, "name", void 0);
__decorate([
    AllowNull(false),
    Default(''),
    Column(DataType.STRING(200)),
    __metadata("design:type", String)
], Office.prototype, "label", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Office.prototype, "address", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(40)),
    __metadata("design:type", String)
], Office.prototype, "phone", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(200)),
    __metadata("design:type", String)
], Office.prototype, "email", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Office.prototype, "hours", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DOUBLE),
    __metadata("design:type", Number)
], Office.prototype, "latitude", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DOUBLE),
    __metadata("design:type", Number)
], Office.prototype, "longitude", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(500)),
    __metadata("design:type", String)
], Office.prototype, "map_url", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], Office.prototype, "position", void 0);
__decorate([
    AllowNull(false),
    Default(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], Office.prototype, "published", void 0);
__decorate([
    BeforeSave,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Office]),
    __metadata("design:returntype", void 0)
], Office, "fillLabel", null);
Office = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'content_offices',
        freezeTableName: true,
        indexes: [{ fields: ['published', 'position'] }],
    })
], Office);
export { Office };
