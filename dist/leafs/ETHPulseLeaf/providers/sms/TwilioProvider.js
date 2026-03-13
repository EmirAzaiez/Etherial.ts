var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import Twilio from 'twilio';
export class TwilioProvider {
    constructor(config) {
        this.name = 'twilio';
        if (!config.accountSid || !config.authToken || !config.fromNumber) {
            throw new Error('TwilioProvider: accountSid, authToken, and fromNumber are required');
        }
        this.client = Twilio(config.accountSid, config.authToken);
        this.fromNumber = config.fromNumber;
    }
    send(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendWithOptions({ to: params.phone, message: params.message });
        });
    }
    sendBulk(recipients, message) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield Promise.allSettled(recipients.map(recipient => this.send({ phone: recipient, message })));
            return results.map((result, index) => {
                var _a;
                if (result.status === 'fulfilled') {
                    return result.value;
                }
                return {
                    success: false,
                    error: ((_a = result.reason) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error',
                    provider: this.name,
                    timestamp: new Date(),
                };
            });
        });
    }
    sendWithOptions(options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const messageResponse = yield this.client.messages.create({
                    to: options.to,
                    from: options.from || this.fromNumber,
                    body: options.message,
                });
                return {
                    success: true,
                    messageId: messageResponse.sid,
                    provider: this.name,
                    timestamp: new Date(),
                };
            }
            catch (error) {
                console.error(`[TwilioProvider] Failed to send SMS to ${options.to}:`, error.message);
                return {
                    success: false,
                    error: error.message || 'Failed to send SMS',
                    provider: this.name,
                    timestamp: new Date(),
                };
            }
        });
    }
}
