const mysql = require('mysql');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',         // 如果你有設定密碼，請填上
  database: 'school'    // ✔️ 跟你建立的資料庫名稱一致
});

db.connect((err) => {
  if (err) {
    console.error('❌ 資料庫連線失敗：', err);
  } else {
    console.log('✅ 已連接到 MySQL 資料庫');
  }
});

module.exports = db;
