import { Expo } from 'expo-server-sdk'
import { Device } from '../models/Device'
import { DeviceNotificationLog } from '../models/DeviceNotificationLog'

let expo = new Expo()

export const push = async (devices: Device[], data: { message: string; arguments?: {}; data: {} }) => {
    let messages = devices.map((device) => {
        return {
            to: device.push_token,
            sound: 'default',
            title: 'SAQ',
            body: data.message,
            data: data.data,
        }
    })

    let promises = expo.chunkPushNotifications(messages).map((chunk) => {
        return expo.sendPushNotificationsAsync(chunk)
    })

    messages.forEach((message) => {})

    Promise.all(promises).then((data) => {
        // console.log(data)

        data[0].forEach((ticket, index: number) => {
            console.log('ticket', ticket)
            if (ticket.status === 'error') {
                // @ts-ignore
                // devices[index].destroy()
            } else {
                DeviceNotificationLog.create({
                    device_id: devices[index].id,
                    device_token: messages[index].to,
                    message: messages[index].body,
                    status: ticket.status,
                    push_token: devices[index].push_token,
                    //@ts-ignore
                    receipt_id: ticket.id,
                    // error_message: status === 'error' ? id : null,
                })
            }
        })
    })
}
