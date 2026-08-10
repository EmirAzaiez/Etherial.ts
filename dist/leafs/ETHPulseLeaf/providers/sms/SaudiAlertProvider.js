var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * Saudi Alert SMS provider (saudialert.com).
 *
 * Simple HTTP GET gateway, KSA numbers only: the recipient is normalised to
 * the 12-digit `966XXXXXXXXX` form before being sent.
 */
export class SaudiAlertProvider {
    constructor(config) {
        this.name = 'saudialert';
        this.baseUrl = 'http://saudialert.com/pushsms.php';
        if (!config.username || !config.apiPassword || !config.sender) {
            throw new Error('SaudiAlertProvider: username, apiPassword, and sender are required');
        }
        this.username = config.username;
        this.apiPassword = config.apiPassword;
        this.sender = config.sender;
        this.priority = config.priority || '8';
    }
    formatNumber(number) {
        const numberStr = number.replace(/[^0-9]/g, '');
        if (numberStr.startsWith('966') && numberStr.length === 12) {
            return numberStr;
        }
        if (numberStr.length === 9) {
            return '966' + numberStr;
        }
        throw new Error('Invalid number format: expected 9 digits or 12 digits starting with 966');
    }
    send(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendWithOptions({ to: params.phone, message: params.message });
        });
    }
    sendBulk(recipients, message) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield Promise.allSettled(recipients.map((recipient) => this.send({ phone: recipient, message })));
            return results.map((result) => {
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
                const formattedNumber = this.formatNumber(options.to);
                const query = new URLSearchParams({
                    username: this.username,
                    api_password: this.apiPassword,
                    sender: options.from || this.sender,
                    to: formattedNumber,
                    message: options.message,
                    priority: this.priority,
                });
                const response = yield fetch(`${this.baseUrl}?${query}`);
                const body = (yield response.text()).trim();
                // The gateway answers 200 with a plain-text body: an id on success,
                // an error label otherwise. Anything non-2xx is a hard failure.
                if (!response.ok) {
                    return {
                        success: false,
                        error: `HTTP ${response.status}: ${body || response.statusText}`,
                        provider: this.name,
                        timestamp: new Date(),
                    };
                }
                return {
                    success: true,
                    messageId: body || undefined,
                    provider: this.name,
                    timestamp: new Date(),
                };
            }
            catch (error) {
                console.error(`[SaudiAlertProvider] Failed to send SMS to ${options.to}:`, error.message);
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
