"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const ImageComponent = (props) => {
    const { record, property } = props;
    return react_1.default.createElement("img", { src: record.params[property.name], alt: 'Custom Image', style: { maxWidth: '100%' } });
};
exports.default = ImageComponent;
//# sourceMappingURL=ETHS3.js.map