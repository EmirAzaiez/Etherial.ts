"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Create = void 0;
const validator_1 = require("../../../components/http/validator");
let Create = class Create {
};
__decorate([
    (0, validator_1.ShouldBeNotEmpty)(),
    (0, validator_1.ShouldExist)(),
    (0, validator_1.Body)(),
    __metadata("design:type", String)
], Create.prototype, "folder", void 0);
__decorate([
    (0, validator_1.ShouldBeNotEmpty)(),
    (0, validator_1.ShouldExist)(),
    (0, validator_1.Body)(),
    __metadata("design:type", String)
], Create.prototype, "content_type", void 0);
__decorate([
    (0, validator_1.ShouldExist)(),
    (0, validator_1.Body)(),
    __metadata("design:type", Boolean)
], Create.prototype, "private", void 0);
Create = __decorate([
    (0, validator_1.Form)()
], Create);
exports.Create = Create;
//# sourceMappingURL=file_request_form.js.map