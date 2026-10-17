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
import { Controller, Get, Post } from 'etherial/components/http/provider';
import { emailFromLink, unsubscribe, unsubscribePage } from '../services/unsubscribe.js';
function page(res, status, html) {
    res.status(status).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }).send(html);
}
/** The link at the bottom of a campaign email. No account needed: the link is signed for the address. */
let ETHMailPublicController = class ETHMailPublicController {
    /** Asks first: mail scanners open links on their own. */
    unsubscribeForm(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const email = yield emailFromLink(req.query);
                return page(res, email ? 200 : 400, yield unsubscribePage(email ? 'confirm' : 'invalid', req.query, email));
            }
            catch (err) {
                console.error('[ETHMailLeaf] Unsubscribe page failed:', err);
                return res.status(500).send('Something went wrong. Please try again later.');
            }
        });
    }
    /** The page's button, and the inbox's own (RFC 8058, `List-Unsubscribe=One-Click`). */
    unsubscribeConfirm(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const email = yield emailFromLink(req.query);
                if (!email)
                    return page(res, 400, yield unsubscribePage('invalid', req.query, null));
                yield unsubscribe(email, req.query.c);
                return page(res, 200, yield unsubscribePage('done', req.query, email));
            }
            catch (err) {
                console.error('[ETHMailLeaf] Unsubscribe failed:', err);
                return res.status(500).send('Something went wrong. Please try again later.');
            }
        });
    }
};
__decorate([
    Get('/mail/unsubscribe'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailPublicController.prototype, "unsubscribeForm", null);
__decorate([
    Post('/mail/unsubscribe'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHMailPublicController.prototype, "unsubscribeConfirm", null);
ETHMailPublicController = __decorate([
    Controller()
], ETHMailPublicController);
export default ETHMailPublicController;
