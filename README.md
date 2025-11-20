# DBMS-MINI-PROJECT
AUTOMATED PERFORMANCE APPRAISAL SYSTEM

### Clone the repository
```
git clone https://github.com/PES2UG23CS172/DBMS-MINI-PROJECT.git
cd DBMS-MINI-PROJECT
```

### Initialise the database
1. Start your MySQL server.
2. `cd DBMS-MINI-PROJECT/src`
3. Run your MySQL CLI.
4. The `DBMS-MINI-PROJECT/src` directory contains sql files to define the database.
5. Run them using the source command in the MySQL CLI.<br>
    - eg: `source ddl.sql` - do this for the other sql files
6. Run the following queries to initialise the roles and departments:
    - `INSERT INTO roles (role_name) VALUES ('System Admin'),('HR'),('Manager'),('Employee');`
    - `INSERT INTO departments (department_name) VALUES ('Human Resources'),('Engineering'),('Finance'),('Sales'),('Marketing');`
7. Navigate to<br>
`DBMS-MINI-PROJECT/apas-backend/src/db.js`
8. Replace the placeholder information with your actual username, database name (apas_db), host and port information.

### Set up Node
1. ```
   cd DBMS-MINI-PROJECT/apas-frontend
   npm install
   ```
2. ```
   cd DBMS-MINI-PROJECT/apas-backend
   npm install
   ```

### Start the UI
1. ```
   cd DBMS-MINI-PROJECT/apas-backend
   npm run start
   ```
2. ```
   cd DBMS-MINI-PROJECT/apas-frontend
   npm start
   ```

### Viewing logs
1. Audit logging can be observed from the MySQL CLI.
2. ```
   use apas_db;
   select * from audit_logs;
   ```