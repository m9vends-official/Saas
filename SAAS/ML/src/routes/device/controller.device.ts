import express from 'express';
import { getDeviceHandler } from './get.device.js'
import provisionDevice from './provision.device.js'
import wakeUpDevice from './wakeup.device.js'
import { connectDevice } from './connect.device.js'
import { removeDeviceHandler } from './remove.device.js';
import commandDeviceHandler from './command.device.js';
const router = express.Router()
router.use(express.json())

router.use('/provision', provisionDevice)
router.use('/wake-up', wakeUpDevice)
router.get('/connect/:id', connectDevice)
router.get('/:type/:id', getDeviceHandler)
router.delete('/:id', removeDeviceHandler)
router.post('/:id/commands', commandDeviceHandler)

export default router