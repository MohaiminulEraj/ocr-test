import * as path from 'path'
import express from 'express';
import dotenv from 'dotenv';
import colors from 'colors';
// import connectDB from './config/db.js';
import cors from 'cors';
import {
    main,
    // detectTextFromImageUsingVision,
    detectTextFromImageUsingTesseract
} from './ocrController.js';
// parsing .env file
dotenv.config()

// creating server instance
const app = express();

//connect to database
// connectDB();

app.use(express.json()); // parsing body
app.use('/', cors()); // Enabling CORS for all / routes
// app.use(require('./router'));    // Registering all app-routers here
app.use('/api', main);
// app.use('/ocr', ocrRes);
// app.use(
//     '/ocr', detectTextFromImageUsingVision
// )
app.use(
    '/ocr', detectTextFromImageUsingTesseract
)

// app.use('/api/file', fileRoutes);
const __dirname = path.resolve()

app.use(express.static(path.join(__dirname, 'pdf'))); 

app.get('/', (req, res) => {
    res.send('API is running....')
})

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
app.listen(PORT, () => console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`.yellow.bold));