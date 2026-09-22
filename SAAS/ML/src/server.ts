import app from './app.js'
import 'dotenv/config'
import { startSimulator } from './simulator.js'
const PORT = process.env.PORT as string | 5000

app.listen(PORT, () => {
    // startSimulator(); // Disabled simulator for real-time hardware tracking
    // console.log(`server started @ http://localhost:${PORT}`)
    if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production") {
        console.log('\x1b[42m%s\x1b[0m', `\n<--- M9Vends IoT Backend Service Started Successfully --->`)
    }
})