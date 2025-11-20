import React, { useState } from "react";
import api from "../api/axios";
import "../styles.css";
import { Link, useNavigate } from "react-router-dom"; // Import useNavigate

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  
  const navigate = useNavigate(); // Initialize useNavigate hook

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/login", { email, password });
      const user = res.data.user;

      // 1. Store User Data
      localStorage.setItem("user", JSON.stringify(user));
      
      // 2. Set Status Message
      setMessage(`Welcome ${user.name} (${user.role})`);
      
      // 3. **Role-Based Redirection**
      if (user.role === 'Employee') {
        navigate('/dashboard/employee');
      } else if (user.role === 'Manager') {
        navigate('/dashboard/manager');
      } else if (user.role === 'HR') {
        // Assuming the role name from your DB is 'hr_administrator'
        navigate('/dashboard/hr');
      } else {
        // Fallback or handle unexpected role
        navigate('/dashboard/default'); 
      }

    } catch (err) {
      setMessage(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">APAS</h1>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-button">
            Login
          </button>
        </form>

        {message && <p className="login-message">{message}</p>}
        <p>
        New user?{" "}
        <Link to="/signup" style={{ color: "#3b82f6", fontWeight: "600" }}>
          Signup here
        </Link>
        </p>

      </div>
    </div>
  );
}