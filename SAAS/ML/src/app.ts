import express from 'express';
import cors from 'cors'
import controller from './routes/controller.js'
import 'dotenv/config'
import { Mongo_Connect } from './config/DB.config.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';
import cookie from 'cookie-parser'
import mqtt from './config/mqttBroker.config.js';
import { captureService, handleImageCapture } from './services/capture.service.js';

if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production") {
    console.log('\x1b[42m%s\x1b[0m', `\n<--- Env: ${process.env.NODE_ENV} --->\n`)
}

await Mongo_Connect();
const app = express()

app.use(cors())
app.use(express.static('public'))
app.use(express.json())
app.use(cookie())

app.get('/', (req, res) => {
    res.status(200).send(`M9Vends IoT Backend Service Running...`)
})

app.get('/capture', captureService)
app.post('/capture', express.raw({ type: 'image/jpeg', limit: '10mb' }), handleImageCapture)
app.use('/api', controller)
app.use(errorHandler)
export default app