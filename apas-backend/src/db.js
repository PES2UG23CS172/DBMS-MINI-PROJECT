// src/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'apas_user',
  password: process.env.DB_PASSWORD || 'apas123',
  database: process.env.DB_NAME || 'apas_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
