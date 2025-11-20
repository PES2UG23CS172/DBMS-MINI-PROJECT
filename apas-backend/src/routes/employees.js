// src/routes/employees.js
import express from 'express';
import { pool } from '../db.js';
const router = express.Router();

const MANAGER_ROLE_ID = 3; // Based on your database image

// --- Helper Function (Required for all Goal/Cycle routes) ---
async function getActiveCycleId(pool) {
    const [rows] = await pool.query("SELECT cycle_id FROM appraisal_cycles WHERE status = 'active' LIMIT 1");
    if (rows.length === 0) {
        throw new Error("No active appraisal cycle found.");
    }
    return rows[0].cycle_id;
}

// In src/routes/employees.js (Add this new route)

// GET /api/employee/active-cycle-id
// Returns the ID of the cycle that is currently marked 'active'.
router.get('/active-cycle-id', async (req, res) => {
    try {
        const cycleId = await getActiveCycleId(pool);
        // Returns object like: { cycle_id: 2 }
        res.json({ cycle_id: cycleId }); 
    } catch (err) {
        // If no active cycle exists, return a clear error
        res.status(404).send({ error: 'No active appraisal cycle found.' });
    }
});

// --- EXISTING ROUTES (omitted for brevity) ---
// ... (Your existing routes like list employees, create employee, departments, roles are here) ...


// --- NEW/CUSTOM ROUTES ---

// Get all roles
router.get("/roles", async (req, res) => {
    try {
        // [rows] extracts the data array correctly
        const [rows] = await pool.query("SELECT role_id, role_name FROM roles");
        res.json(rows); // Returns the array of role objects
    } catch (err) {
        // Critical: Log the error on the server
        console.error("Error fetching roles:", err); 
        res.status(500).json({ error: err.message });
    }
});

// Get all departments
router.get("/departments", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT department_id, department_name FROM departments");
        res.json(rows); // Returns the array of department objects
    } catch (err) {
        // Critical: Log the error on the server
        console.error("Error fetching departments:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/employee/profile/:employeeId (CRITICAL FIX FOR NAME DISPLAY)
router.get('/profile/:employeeId', async (req, res) => {
    const { employeeId } = req.params;
    
    if (!employeeId) {
        return res.status(400).send({ error: "Missing employee ID parameter." });
    }
    
    try {
        const [rows] = await pool.query(
            `
            SELECT 
                e.manager_id, 
                m.employee_name AS manager_name
            FROM employees e
            LEFT JOIN employees m ON e.manager_id = m.employee_id
            WHERE e.employee_id = ?
            `,
            [employeeId]
        );
        
        if (rows.length === 0) {
            return res.status(404).send({ error: "Employee profile not found." });
        }
        
        // Returns object like: { manager_id: 5, manager_name: "Jane Smith" }
        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching employee profile:', err.message);
        res.status(500).send({ error: 'Database error while fetching profile.' });
    }
});


// GET /api/employee/managers-list
router.get('/managers-list', async (req, res) => {
    try {
        const [managers] = await pool.query(
            `SELECT employee_id, employee_name FROM employees WHERE role_id = ?`,
            [MANAGER_ROLE_ID]
        );
        res.json(managers);
    } catch (error) {
        console.error('Error fetching managers list:', error.message);
        res.status(500).send({ message: 'Could not retrieve manager list.' });
    }
});

// PUT /api/employee/update-manager (Simple Update)
router.put('/update-manager', async (req, res) => {
    const { employeeId, newManagerId } = req.body;
    
    if (!employeeId || !newManagerId) {
        return res.status(400).send({ error: "Missing employee or manager ID." });
    }

    try {
        const updateQuery = `
            UPDATE employees
            SET manager_id = ?
            WHERE employee_id = ?;
        `;
        
        await pool.execute(updateQuery, [newManagerId, employeeId]);
        
        res.send({ 
            message: `Reporting manager successfully updated.` 
        });
    } catch (error) {
        console.error('Error updating manager ID:', error.message);
        res.status(500).send({ error: 'Database error during manager update.' });
    }
});

// In src/routes/employees.js (or an imported helper file)

// GET /api/employee/current-weightage/:employeeId
router.get('/current-weightage/:employeeId', async (req, res) => {
    const { employeeId } = req.params;
    
    try {
        const cycleId = await getActiveCycleId(pool);
        const [rows] = await pool.query(
            `
            SELECT COALESCE(SUM(goal_weightage), 0) AS total_weight 
            FROM goals 
            WHERE employee_id = ? AND cycle_id = ?
            `,
            [employeeId, cycleId]
        );
        
        res.json(rows[0]); // Returns { total_weight: X }

    } catch (err) {
        res.status(500).send({ error: "Failed to calculate current weightage." });
    }
});

// POST /api/employee/goal
// In src/routes/employees.js (Refactor the router.post('/goal') route)

router.post('/goal', async (req, res) => {
    const { employeeId, goalTitle, goalDescription, goalWeightage } = req.body;
    const newWeightage = parseFloat(goalWeightage);
    
    if (newWeightage <= 0 || newWeightage > 100) {
        return res.status(400).send({ error: "Invalid goal weightage value." });
    }

    let connection; // Declare connection outside try block
    try {
        // 1. Get a single connection and start transaction
        connection = await pool.getConnection(); 
        await connection.beginTransaction(); 
        
        const cycleId = await getActiveCycleId(pool); // Assume getActiveCycleId works globally/is imported

        // 2. Check the 100% weightage constraint (using the dedicated connection)
        const [weightRows] = await connection.query(
            "SELECT COALESCE(SUM(goal_weightage), 0) AS current_total FROM goals WHERE employee_id = ? AND cycle_id = ?",
            [employeeId, cycleId]
        );
        const currentTotal = parseFloat(weightRows[0].current_total);
        const newTotal = currentTotal + newWeightage;

        if (newTotal > 100.00) {
            await connection.rollback(); // Rollback constraint failure
            return res.status(400).send({ 
                error: `Goal submission failed: Total weightage exceeds 100%. Remaining available weight is ${(100 - currentTotal).toFixed(2)}%.` 
            });
        }
        
        // 3. Set the audit variable on THIS specific connection
        await connection.execute(`SET @app_user_id = ?`, [employeeId]); 

        // 4. Execute the INSERT query on the same connection
        const insertQuery = `
            INSERT INTO goals 
            (employee_id, cycle_id, goal_title, goal_description, goal_weightage, goal_status)
            VALUES (?, ?, ?, ?, ?, 'pending_approval');
        `;
        
        const [result] = await connection.execute(insertQuery, [
            employeeId, cycleId, goalTitle, goalDescription, newWeightage
        ]);
        
        await connection.commit(); // Commit the transaction (INSERT and AUDIT log are finalized)

        res.status(201).send({ message: "Goal submitted for manager approval.", goalId: result.insertId });

    } catch (error) {
        if (connection) {
            await connection.rollback(); // Rollback on error
        }
        res.status(500).send({ error: error.message || "Database error during goal creation." });
    } finally {
        if (connection) {
            connection.release(); // Release the connection back to the pool
        }
    }
});

// In src/routes/employees.js (Add this route)

// GET /api/employee/goals/:employeeId
// Fetches all goals for the employee in the current active cycle.
router.get('/goals/:employeeId', async (req, res) => {
    const { employeeId } = req.params;
    
    // We already have the getActiveCycleId helper defined above
    try {
        const cycleId = await getActiveCycleId(pool);
        
        // This query fetches all goals regardless of status (pending, approved, etc.)
        const [goals] = await pool.query(
            `
            SELECT goal_id, goal_title, goal_weightage, goal_status
            FROM goals 
            WHERE employee_id = ? AND cycle_id = ?
            ORDER BY goal_id ASC
            `,
            [employeeId, cycleId]
        );
        
        res.json(goals); // Sends the list of goals to the frontend
    } catch (err) {
        console.error('Error fetching employee goals:', err.message);
        res.status(500).send({ error: err.message || "Failed to retrieve goals list." });
    }
});
// --- GOAL MANAGEMENT ROUTES (omitted for brevity, but they remain here) ---
// In src/routes/employees.js (Add this route)

// DELETE /api/employee/goal/:goalId
// In src/routes/employees.js (Refactor the router.delete('/goal/:goalId') route)

router.delete('/goal/:goalId', async (req, res) => {
    const { goalId } = req.params;
    const { employeeId } = req.query; // Assuming employeeId is sent via query parameters

    if (!employeeId) {
        return res.status(400).send({ error: "Missing employee ID for verification." });
    }

    let connection; // Declare connection outside try block
    try {
        // 1. Get a single connection and start transaction
        connection = await pool.getConnection(); 
        await connection.beginTransaction(); 

        // 2. Pre-check: Ensure goal is pending_approval and belongs to this employee
        const [checkRows] = await connection.query( // Use connection for query
            `SELECT goal_status FROM goals WHERE goal_id = ? AND employee_id = ?`,
            [goalId, employeeId]
        );

        if (checkRows.length === 0 || checkRows[0].goal_status !== 'pending_approval') {
            await connection.rollback();
            return res.status(403).send({ error: "Goal cannot be deleted. It is either approved or does not exist." });
        }
        
        // 3. Set the audit variable on THIS specific connection
        await connection.execute(`SET @app_user_id = ?`, [employeeId]); 

        // 4. Execute the DELETE query on the same connection
        await connection.execute(`DELETE FROM goals WHERE goal_id = ?`, [goalId]);
        
        await connection.commit(); // Commit the transaction (DELETE and AUDIT log are finalized)

        res.send({ message: "Goal deleted successfully and audited." });
    } catch (err) {
        if (connection) {
            await connection.rollback(); // Rollback on error
        }
        console.error('Error deleting goal:', err.message);
        res.status(500).send({ error: 'Database error during goal deletion.' });
    } finally {
        if (connection) {
            connection.release(); // Release the connection back to the pool
        }
    }
});

// In src/routes/employees.js (Add this route)

// PUT /api/employee/goal/:goalId
router.put('/goal/:goalId', async (req, res) => {
    const { goalId } = req.params;
    const { employeeId, goalTitle, goalDescription, goalWeightage } = req.body;
    
    // Basic validation
    if (!employeeId || !goalTitle || !goalWeightage) {
        return res.status(400).send({ error: "Missing required fields for update." });
    }
    
    let connection; // Declare connection variable outside of try block
    try {
        // 1. Get a single connection from the pool
        connection = await pool.getConnection(); 
        await connection.beginTransaction(); // Start transaction

        // 2. Pre-check: Ensure goal status is pending_approval and belongs to this employee.
        const [checkRows] = await connection.query(
            `SELECT goal_status FROM goals WHERE goal_id = ? AND employee_id = ?`,
            [goalId, employeeId]
        );

        if (checkRows.length === 0 || checkRows[0].goal_status !== 'pending_approval') {
            await connection.rollback(); // Rollback transaction
            return res.status(403).send({ error: "Goal can only be edited if status is pending approval." });
        }
        
        // 3. Set the audit variable on THIS specific connection
        await connection.execute(`SET @app_user_id = ?`, [employeeId]); 

        // 4. Execute the UPDATE query
        await connection.execute(
            `UPDATE goals 
             SET goal_title = ?, goal_description = ?, goal_weightage = ?, updated_at = NOW() 
             WHERE goal_id = ?`, 
            [goalTitle, goalDescription, goalWeightage, goalId]
        );
        
        await connection.commit(); // Commit the transaction (UPDATE and AUDIT log are finalized)

        res.send({ message: "Goal updated successfully and audited." });
    } catch (err) {
        if (connection) {
            await connection.rollback(); // Rollback on error
        }
        console.error('Error updating goal:', err.message);
        res.status(500).send({ error: 'Database error during goal update.' });
    } finally {
        if (connection) {
            connection.release(); // Release the connection back to the pool
        }
    }
});

// In src/routes/employees.js (Add this new route)

// POST /api/employee/self-appraisal
// Submits the employee's self-assessment for a specific approved goal.
router.post('/self-appraisal', async (req, res) => {
    // Data received from the frontend
    const { employeeId, goalId, comments, documentLink } = req.body;
    
    // Basic validation
    if (!employeeId || !goalId || !comments) {
        return res.status(400).send({ error: "Missing required fields (Goal ID and Comments)." });
    }

    let connection;
    try {
        // 1. Get a single connection and start transaction
        connection = await pool.getConnection(); 
        await connection.beginTransaction(); 

        // 2. Pre-check: Ensure the goal is 'approved' and belongs to this employee
        const [checkRows] = await connection.query(
            `SELECT goal_status FROM goals WHERE goal_id = ? AND employee_id = ?`,
            [goalId, employeeId]
        );

        if (checkRows.length === 0 || checkRows[0].goal_status !== 'approved') {
            await connection.rollback();
            return res.status(403).send({ error: "Self-appraisal can only be submitted for approved goals." });
        }

        // 3. Set the audit variable
        await connection.execute(`SET @app_user_id = ?`, [employeeId]); 

        // 4. Execute the INSERT into self_appraisals
        const insertQuery = `
            INSERT INTO self_appraisals 
            (goal_id, employee_id, comments, document_link, submission_date)
            VALUES (?, ?, ?, ?, NOW());
        `;
        
        await connection.execute(insertQuery, [
            goalId, 
            employeeId, 
            comments, 
            documentLink || null // Use NULL if documentLink is empty
        ]);
        
        // 5. Optionally, update the goal status to 'in_progress' or 'completed' 
        // We'll update the goal_status to 'in_progress' to show the self-appraisal step is done.
        await connection.execute(
            `UPDATE goals SET goal_status = 'in_progress' WHERE goal_id = ?`,
            [goalId]
        );
        
        await connection.commit(); // Commit the transaction
        
        res.status(201).send({ message: "Self-appraisal submitted successfully." });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Self-Appraisal submission failed:', error.message);
        res.status(500).send({ error: 'Database error during submission.' });
    } finally {
        if (connection) connection.release(); 
    }
});

// In src/routes/employees.js (Add this new route)

// GET /api/employee/appraisal-progress/:employeeId
// Returns the employee's current step in the appraisal process using the DB function.
router.get('/appraisal-progress/:employeeId', async (req, res) => {
    const { employeeId } = req.params;
    
    try {
        const cycleId = await getActiveCycleId(pool); // Get the current active cycle
        
        // CRITICAL: Call the stored function fn_getappraisalprogress
        const [rows] = await pool.query(
            `
            SELECT fn_getappraisalprogress(?, ?) AS current_progress
            `,
            [employeeId, cycleId]
        );
        
        // The result will be a single row like: { current_progress: '3. awaiting self-appraisal' }
        res.json(rows[0]);

    } catch (err) {
        console.error('Error fetching appraisal progress:', err.message);
        // If no active cycle is found, it will throw an error, which the frontend should handle.
        res.status(500).send({ error: err.message || "Failed to retrieve appraisal progress." });
    }
});

// In src/routes/employees.js (Add this new route)

// GET /api/employee/final-report/:employeeId
// Calls the stored procedure and returns four result sets in one object.
router.get('/final-report/:employeeId', async (req, res) => {
    const { employeeId } = req.params;
    
    // NOTE: In a real app, the accessor ID would be retrieved from the session/JWT.
    // For now, we assume the employee is accessing their own report.
    const accessorId = employeeId; 

    try {
        const cycleId = await getActiveCycleId(pool); // Get the current active cycle ID

        // CRITICAL: Call the stored procedure
        // The results array will contain multiple arrays (the result sets).
        const [results] = await pool.query(
            `CALL sp_getemployeeperformancereport(?, ?, ?)`,
            [employeeId, cycleId, accessorId]
        );
        
        // The results structure (results[0]) contains all 4 sets:
        const reportData = {
            summary: results[0][0], // 1. Final Summary (first item in first array)
            goalsAndReviews: results[1], // 2. Goals & Manager Reviews
            selfAppraisals: results[2], // 3. Self-Appraisal Comments
            feedback360: results[3] // 4. 360-Degree Feedback
        };

        res.json(reportData);

    } catch (err) {
        console.error('Error fetching final report:', err.message);
        res.status(500).send({ error: err.message || "Failed to retrieve final report." });
    }
});

// In src/routes/employees.js (Add this new route)

// POST /api/employee/submit-360-feedback
// Submits peer feedback to the feedback_360 table.
router.post('/submit-360-feedback', async (req, res) => {
    // Data received: employeeId (being reviewed), reviewerId (logged-in user), rating, comments
    const { employeeId, reviewerId, rating, comments } = req.body;
    
    if (!employeeId || !reviewerId || !rating || !comments) {
        return res.status(400).send({ error: "Missing required fields." });
    }

    let connection;
    try {
        connection = await pool.getConnection(); 
        await connection.beginTransaction(); 
        
        // Assume getActiveCycleId is accessible here or defined locally.
        const cycleId = await getActiveCycleId(pool); 

        // 1. Security/Self-Review Check
        if (parseInt(employeeId, 10) === parseInt(reviewerId, 10)) {
            await connection.rollback();
            return res.status(403).send({ error: "Cannot submit 360 feedback on yourself." });
        }
        
        // 2. Set the audit variable (tracks the reviewer)
        await connection.execute(`SET @app_user_id = ?`, [reviewerId]); 

        // 3. Insert the 360 Feedback (Relies on DB unique constraint for duplicate prevention)
        const insertQuery = `
            INSERT INTO feedback_360 
            (employee_id, reviewer_id, cycle_id, rating, comments)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        await connection.execute(insertQuery, [
            employeeId, 
            reviewerId, 
            cycleId, 
            rating, 
            comments
        ]);
        
        await connection.commit();

        res.status(201).send({ message: "360 feedback submitted successfully." });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            // Handle the duplicate entry error (ER_DUP_ENTRY is MySQL error code 1062)
            if (error.code === 'ER_DUP_ENTRY') {
                 return res.status(409).send({ error: "You have already submitted feedback for this employee in the current cycle." });
            }
        }
        console.error('360 Feedback submission failed:', error.message);
        res.status(500).send({ error: 'Database error during 360 submission.' });
    } finally {
        if (connection) connection.release(); 
    }
});
// In src/routes/employees.js (Revised router.get('/all-employees'))

// GET /api/employee/all-employees
// Fetches the list of all *peer* employees for the 360 review selector.
router.get('/all-employees', async (req, res) => {
    // Role IDs to EXCLUDE: 1 (System Admin), 2 (HR), 3 (Manager)
    const ROLES_TO_EXCLUDE = [1, 2, 3]; 

    try {
        // Fetch all employees whose role_id is NOT in the excluded list
        const [rows] = await pool.query(
            `
            SELECT employee_id, employee_name, department_id 
            FROM employees 
            WHERE role_id NOT IN (?)
            ORDER BY employee_name
            `,
            [ROLES_TO_EXCLUDE] // SQL automatically handles the array mapping here
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching peer employee list:', err.message);
        res.status(500).send({ error: 'Failed to retrieve employee list for 360 review.' });
    }
});

export default router;