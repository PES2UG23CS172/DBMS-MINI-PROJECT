import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { Link } from "react-router-dom";

export default function Signup() {
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [message, setMessage] = useState("");

  // ✅ Fetch roles and departments on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolesRes, departmentsRes] = await Promise.all([
          api.get("/api/employee/roles"),
          api.get("/api/employee/departments"),
        ]);
        setRoles(rolesRes.data);
        setDepartments(departmentsRes.data);
      } catch (err) {
        console.error("Error fetching roles/departments:", err);
      }
    };
    fetchData();
  }, []);

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/signup", {
        employee_name: employeeName,
        employee_email: employeeEmail,
        password,
        role_id: roleId,
        department_id: departmentId,
      });
      setMessage("Signup successful! You can now log in.");
    } catch (err) {
      setMessage(err.response?.data?.error || "Signup failed");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>APAS Signup</h1>
        <form onSubmit={handleSignup}>
          <input
            type="text"
            placeholder="Full Name"
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={employeeEmail}
            onChange={(e) => setEmployeeEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* ✅ Roles Dropdown */}
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            required
          >
            <option value="">Select Role</option>
            {roles.map((role) => (
              <option key={role.role_id} value={role.role_id}>
                {role.role_name}
              </option>
            ))}
          </select>

          {/* ✅ Departments Dropdown */}
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            required
          >
            <option value="">Select Department</option>
            {departments.map((dept) => (
              <option key={dept.department_id} value={dept.department_id}>
                {dept.department_name}
              </option>
            ))}
          </select>

          <button type="submit">Sign Up</button>
        </form>

        {message && <p>{message}</p>}
        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
