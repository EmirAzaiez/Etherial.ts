var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from 'etherial/components/database/provider';
/**
 * Blocks saved from the back-office's editor to start another page from:
 * a layout the team likes (a hero, the hours, the contact) kept with its
 * words and images. Read as drafts: a template may hold an unfinished block.
 */
let PageTemplate = class PageTemplate extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], PageTemplate.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(120)),
    __metadata("design:type", String)
], PageTemplate.prototype, "name", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], PageTemplate.prototype, "blocks", void 0);
PageTemplate = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'content_page_templates',
        freezeTableName: true,
    })
], PageTemplate);
export { PageTemplate };
