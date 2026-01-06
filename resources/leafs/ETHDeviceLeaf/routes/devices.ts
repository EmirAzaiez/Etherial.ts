import { Controller, Get, Post, Delete, Request, Response } from 'etherial/components/http/provider'
import { ShouldBeAuthentificate } from 'etherial/components/http.security/provider'
import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'

import { User } from '../../models/User'
// import { DeviceService } from '../services/device.service'
import { RegisterDeviceForm, RegisterDeviceFormType, RevokeDeviceForm, RevokeDeviceFormType } from '../forms/device_form'
import { Device } from '../models/Device'

import etherial from 'etherial'

@Controller()
export default class ETHMobileDevicesController {
    @Post('/devices/register')
    @ShouldValidateYupForm(RegisterDeviceForm)
    public async registerDevice(req: Request & { user: User; form: RegisterDeviceFormType }, res: Response): Promise<any> {
        let user_id = null

        if (req.headers['authorization']) {
            const decoded = etherial.http_auth.decodeJWTToken(req.headers['authorization'].replace('Bearer ', '') as string)
            user_id = decoded.user_id
        }

        await Device.registerOrUpdateDevice({
            user_id: user_id,
            form: req.form,
            user_agent: req.headers['user-agent'] as string,
        })

        res.success({
            status: 200,
            data: {},
        })
    }

    @Post('/devices/revoke')
    @ShouldValidateYupForm(RevokeDeviceForm)
    @ShouldBeAuthentificate()
    public async revokeDevice(req: Request & { user: User; form: RevokeDeviceFormType }, res: Response): Promise<any> {
        const decoded = etherial.http_auth.decodeJWTToken(req.headers['authorization'].replace('Bearer ', '') as string)

        if (req.form.device === decoded.device) {
            await Device.update(
                {
                    user_id: null,
                },
                {
                    where: {
                        device: req.form.device,
                    },
                }
            )

            res.success({
                status: 200,
                data: {},
            })
        } else {
            return res.error({ status: 400, errors: ['api.device.not_match'] })
        }
    }
}
