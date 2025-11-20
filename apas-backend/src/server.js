// src/server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import { pool } from './db.js';
import employeesRouter from './routes/employees.js';
import managerRouter from './routes/manager.js';
import hrRouter from './routes/hr.js';
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS now');
    res.json({ status: 'ok', now: rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.use('/api/employees', employeesRouter);

// LOGIN route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ status: "error", error: "Email and password required" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT e.employee_id, e.employee_name, e.password_hash, r.role_name
       FROM employees e
       JOIN roles r ON e.role_id = r.role_id
       WHERE e.employee_email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ status: "error", error: "Invalid email or password" });
    }

    const user = rows[0];
    //const passwordMatch = await bcrypt.compare(password, user.password_hash);
    let passwordMatch = false;

// TEMPORARY: if your DB has plain passwords
if (user.password_hash === password) {
  passwordMatch = true;
} else {
  // for future: when you start storing hashed passwords
  passwordMatch = await bcrypt.compare(password, user.password_hash);
}


    // For testing only — if passwords are stored in plain text right now:
    // const passwordMatch = password === user.password_hash;

    if (!passwordMatch) {
      return res.status(401).json({ status: "error", error: "Invalid email or password" });
    }

    res.json({
      status: "ok",
      user: {
        id: user.employee_id,
        name: user.employee_name,
        role: user.role_name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", error: "Database error" });
  }
});

app.post("/signup", async (req, res) => {
    console.log("Signup request received:", req.body); 
  const { employee_name, employee_email, password, role_id, department_id } = req.body;

  if (!employee_name || !employee_email || !password || !role_id || !department_id) {
  return res.status(400).json({ status: "error", error: "All required fields must be filled" });
}

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.execute(
      `INSERT INTO employees (employee_name, employee_email, password_hash, role_id, department_id, manager_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [employee_name, employee_email,password, role_id, department_id,null]
    );

    res.json({ status: "ok", message: "User registered successfully" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ status: "error", error: "Database error" });
  }
});


app.use("/api", employeesRouter);
app.use('/api/employee', employeesRouter);
app.use("/api/manager", managerRouter);
app.use("/api/hr", hrRouter);






const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
