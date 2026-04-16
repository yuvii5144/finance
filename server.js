const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

const app = express();

app.use(cors());
app.use(express.json());

// ================= DATABASE CONNECTION =================
const db = mysql.createConnection({
  host: "sql12.freesqldatabase.com",
  user: "sql12823180",
  password: "GiL7LxLDMl",
  database: "sql12823180"   // ✅ YOUR REAL DB NAME
});

db.connect((err) => {
  if (err) {
    console.log("❌ DB Error:", err);
  } else {
    console.log("✅ MySQL Connected");
  }
});


// ================= CUSTOMER =================

// ➕ Add Customer
app.post("/add-customer", (req, res) => {
  const {
    name,
    phone,
    total_amount,
    start_date,
    daily_pay,
    remaining_amount
  } = req.body;

  const sql = `
    INSERT INTO customers 
    (name, phone, total_amount, start_date, daily_pay, remaining_amount, days_left)
    VALUES (?, ?, ?, ?, ?, ?, 100)
  `;

  db.query(
    sql,
    [
      name,
      phone,
      Number(total_amount),
      start_date,
      Number(daily_pay),
      Number(remaining_amount)
    ],
    (err) => {
      if (err) {
        console.log("❌ Insert Customer Error:", err);
        return res.json({ message: "DB Error ❌", error: err });
      }

      res.json({ message: "Customer Added Successfully ✅" });
    }
  );
});


// 📋 Get Customers
app.get("/customers", (req, res) => {
  db.query("SELECT * FROM customers", (err, result) => {
    if (err) {
      console.log("❌ Fetch Error:", err);
      return res.json({ message: "Fetch Error ❌", error: err });
    }
    res.json(result);
  });
});


// ================= PAYMENT =================

// 💰 PAY API
app.post("/pay", (req, res) => {
  const { customer_id, amount, payment_date } = req.body;

  const finalDate =
    payment_date || new Date().toISOString().split("T")[0];

  db.query(
    "SELECT name, remaining_amount FROM customers WHERE id = ?",
    [customer_id],
    (err, result) => {
      if (err) {
        return res.json({ message: "DB Error ❌", error: err });
      }

      if (!result.length) {
        return res.json({ message: "Customer not found ❌" });
      }

      const name = result[0].name;
      const remaining = Number(result[0].remaining_amount);

      if (remaining <= 0) {
        return res.json({ message: "Loan Already Completed ❌" });
      }

      if (Number(amount) > remaining) {
        return res.json({ message: "Amount exceeds remaining ❌" });
      }

      // Insert payment
      db.query(
        "INSERT INTO payments (customer_id, customer_name, amount, payment_date) VALUES (?, ?, ?, ?)",
        [customer_id, name, Number(amount), finalDate],
        (err2) => {
          if (err2) {
            return res.json({ message: "Insert Error ❌", error: err2 });
          }

          // Update remaining
          db.query(
            "UPDATE customers SET remaining_amount = remaining_amount - ? WHERE id = ?",
            [Number(amount), customer_id],
            (err3) => {
              if (err3) {
                return res.json({ message: "Update Error ❌", error: err3 });
              }

              res.json({
                message: "Payment Done Successfully ✅",
                name,
                amount,
                date: finalDate
              });
            }
          );
        }
      );
    }
  );
});


// ================= DASHBOARD =================

// Total Customers
app.get("/total-customers", (req, res) => {
  db.query("SELECT COUNT(*) AS total FROM customers", (err, result) => {
    res.json(result[0]);
  });
});

// Total Loan
app.get("/total-loans", (req, res) => {
  db.query("SELECT SUM(total_amount) AS total FROM customers", (err, result) => {
    res.json(result[0]);
  });
});

// Total Remaining
app.get("/total-remaining", (req, res) => {
  db.query("SELECT SUM(remaining_amount) AS total FROM customers", (err, result) => {
    res.json(result[0]);
  });
});


// ================= 📊 MONTHLY REPORT (FIXED) =================
app.get("/report", (req, res) => {
  const { month } = req.query;

  if (!month) {
    return res.json({ message: "Month is required ❌" });
  }

  const sql = `
    SELECT 
      customers.id,
      customers.name,
      SUM(payments.amount) AS amount,
      MAX(payments.payment_date) AS payment_date,
      customers.remaining_amount
    FROM payments
    JOIN customers 
      ON payments.customer_id = customers.id
    WHERE DATE_FORMAT(payments.payment_date, '%Y-%m') = ?
    GROUP BY customers.id, customers.name, customers.remaining_amount
    ORDER BY payment_date DESC
  `;

  db.query(sql, [month], (err, result) => {
    if (err) {
      console.log("❌ Report Error:", err);
      return res.json({ message: "DB Error ❌", error: err });
    }

    const total = result.reduce((sum, r) => sum + Number(r.amount), 0);

    res.json({
      data: result,
      total
    });
  });
});


// ================= START SERVER =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
app.get("/", (req, res) => {
  res.send("🚀 Backend is running successfully");
});