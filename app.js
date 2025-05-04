const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const dotenv = require('dotenv');

// 讀取 Settings.env
dotenv.config({ path: './settings.env' });

const app = express();

// 啟用 CORS 並解析 json (放前面不然不能用)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// import routes (之後新功能從這裡導入)
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const loginRouter = require('./routes/login'); // 登入
const profileRouter = require('./routes/profile'); // 個人資料相關
const studyRouter = require('./routes/study'); // 讀書
const roomsRoutes = require('./routes/rooms'); // 自習室
const transcribeRouter = require('./routes/transcribe'); // 語音轉文字
const scheduleRouter = require('./routes/schedule');// 讀書計畫
const aiRoutes = require('./routes/ai'); // AI功能


// 使用routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/login', loginRouter); // 登入route放到 /login
app.use('/profile', profileRouter); // 個人資料route放到 /profile
app.use('/api/study', studyRouter); 
app.use('/api/rooms', roomsRoutes); // 自習室
app.use('/api/transcribe', transcribeRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/ai', aiRoutes); // AI 分析

// 其他 Express 的東西
app.use(logger('dev'));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

module.exports = app;