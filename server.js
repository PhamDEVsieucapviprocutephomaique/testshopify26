const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const db = new Database("orders.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const FLASH_START = 9;
const FLASH_END = 11;
const MAX_QTY = 40;

// check thời gian flash sale
app.get("/api/flash-time", (req, res) => {
  const h = new Date().getHours();
  const active = h >= FLASH_START && h < FLASH_END;
  res.json({ active });
});

// check còn hàng hay k
app.get("/api/stock", (req, res) => {
  const sold = db.prepare("SELECT COUNT(*) as total FROM orders").get().total;
  const available = sold < MAX_QTY;
  res.json({ available });
});

// check số điện thoại
app.get("/api/check-phone", (req, res) => {
  const { phone } = req.query;
  if (!phone || !phone.trim())
    return res.json({ valid: false, error: "Không được bỏ trống" });
  if (phone.trim().length > 20)
    return res.json({ valid: false, error: "Tối đa 20 ký tự" });
  const existed = db
    .prepare("SELECT id FROM orders WHERE phone = ?")
    .get(phone.trim());
  if (existed) return res.json({ valid: false, error: "SĐT này đã đặt rồi" });
  res.json({ valid: true });
});

//  dùng các api trên , mục đích : code dễ đọc , và mở rộng hơn, nếu thay đổi logic nghiệp vụ : cũng thuận tiện hơn
app.post("/api/order", async (req, res) => {
  const timeRes = await fetch(`http://localhost:3000/api/flash-time`).then(
    (r) => r.json(),
  );
  if (!timeRes.active)
    return res.status(400).json({ error: "Flash sale đã kết thúc." });

  const stockRes = await fetch(`http://localhost:3000/api/stock`).then((r) =>
    r.json(),
  );
  if (!stockRes.available) return res.status(400).json({ error: "Hết hàng." });

  const { phone } = req.body;
  const phoneRes = await fetch(
    `http://localhost:3000/api/check-phone?phone=${phone}`,
  ).then((r) => r.json());
  if (!phoneRes.valid) return res.status(400).json({ error: phoneRes.error });

  db.prepare("INSERT INTO orders (phone) VALUES (?)").run(phone.trim());
  res.json({ success: true });
});

// list sdt
app.get("/api/orders", (req, res) => {
  res.json(db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all());
});

app.listen(3000, () => console.log("http://localhost:3000"));
