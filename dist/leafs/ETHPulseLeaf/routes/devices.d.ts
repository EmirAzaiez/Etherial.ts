import { Request, Response } from 'etherial/components/http/provider';
import { RegisterDeviceFormType, RevokeDeviceFormType } from '../forms/device_form.js';
export default class ETHPulseDevicesController {
    registerDevice(req: Request & {
        user: any;
        form: RegisterDeviceFormType;
    }, res: Response): Promise<any>;
    revokeDevice(req: Request & {
        user: any;
        form: RevokeDeviceFormType;
    }, res: Response): Promise<any>;
}
