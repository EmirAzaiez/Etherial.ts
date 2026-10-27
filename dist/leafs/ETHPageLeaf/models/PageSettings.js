var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, DataType, Default } from 'etherial/components/database/provider';
/**
 * What the back-office sets for every page at once: their fonts. One row,
 * id 1; a font left out is the theme's.
 */
let PageSettings = class PageSettings extends Model {
};
__decorate([
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], PageSettings.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], PageSettings.prototype, "fonts", void 0);
PageSettings = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'content_page_settings',
        freezeTableName: true,
    })
], PageSettings);
export { PageSettings };
