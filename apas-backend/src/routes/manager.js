// src/routes/managers.js
import express from 'express';
import { pool } from '../db.js';
const router = express.Router();

// Helper function (Assumed to be accessible via import or defined here)
async function getActiveCycleId(pool) {
    const [rows] = await pool.query("SELECT cycle_id FROM appraisal_cycles WHERE status = 'active' LIMIT 1");
    if (rows.length === 0) {
        throw new Error("No active appraisal cycle found.");
    }
    return rows[0].cycle_id;
}

// GET /api/manager/team-overview/:managerId (READ ROUTE)
router.get('/team-overview/:managerId', async (req, res) => {
    // FIX: Correctly extract and parse the managerId parameter
    const managerId = parseInt(req.params.managerId, 10);
    
    try {
        const cycleId = await getActiveCycleId(pool);

        // SQL Query: Fetch Reports and Appraisal Progress (Remains correct)
        const [reports] = await pool.query(
            `
            SELECT 
                e.employee_id,
                e.employee_name,
                d.department_name,
                fn_getappraisalprogress(e.employee_id, ?) AS appraisal_progress
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.department_id
            WHERE e.manager_id = ?
            ORDER BY e.employee_name
            `,
            [cycleId, managerId]
        );

        // SQL Query: Fetch Pending Goals (Approval Queue)
        const [pendingGoals] = await pool.query(
            `
            SELECT g.goal_id, g.goal_title, e.employee_name, g.goal_weightage 
            FROM goals g
            JOIN employees e ON g.employee_id = e.employee_id
            WHERE e.manager_id = ? 
              AND g.goal_status = 'pending_approval' 
              AND g.cycle_id = ? 
            `,
            [managerId, cycleId]
        );

        res.json({ reports, pendingGoals });

    } catch (err) {
        console.error('Error fetching team overview:', err.message);
        res.status(500).send({ error: err.message || "Failed to load team appraisal data." });
    }
});

// --- NEW ROUTE: Fetch Goals Ready for Manager Rating ---
// GET /api/manager/goals-for-review/:managerId
router.get('/goals-for-review/:managerId', async (req, res) => {
    const managerId = parseInt(req.params.managerId, 10);
    
    try {
        const cycleId = await getActiveCycleId(pool);

        // Fetch goals that are 'in_progress' (Self-Appraisal submitted)
        const [reviewGoals] = await pool.query(
            `
            SELECT 
                g.goal_id, 
                g.goal_title, 
                g.goal_weightage,
                e.employee_id,
                e.employee_name
            FROM goals g
            JOIN employees e ON g.employee_id = e.employee_id
            WHERE e.manager_id = ? 
              AND g.goal_status = 'in_progress'
              AND g.cycle_id = ?
            ORDER BY e.employee_name
            `,
            [managerId, cycleId]
        );

        res.json(reviewGoals);

    } catch (err) {
        console.error('Error fetching goals for review:', err.message);
        res.status(500).send({ error: err.message || "Failed to load goals for review." });
    }
});


// POST /api/manager/approve-goal (Remains Correct)
router.post('/approve-goal', async (req, res) => {
    const { managerId, goalId, feedback } = req.body;
    
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.execute(`SET @app_user_id = ?`, [managerId]); 

        const result = await connection.query(`CALL sp_approvegoal(?, ?, ?)`, [managerId, goalId, feedback]);
        res.send({ message: "Goal approved successfully." });
    } catch (error) {
        console.error('Goal approval failed:', error.message);
        res.status(403).send({ error: error.message || 'Approval failed: Check manager authority.' });
    } finally {
        if (connection) connection.release();
    }
});


// POST /api/manager/submit-review (Remains Correct)
router.post('/submit-review', async (req, res) => {
    const { managerId, goalId, rating, feedback } = req.body;
    
    if (!managerId || !goalId || !rating || !feedback) {
        return res.status(400).send({ error: "Missing required rating or feedback fields." });
    }

    let connection;
    try {
        connection = await pool.getConnection(); 
        await connection.beginTransaction(); 

        const [goalCheck] = await connection.query(
            `
            SELECT g.goal_status 
            FROM goals g
            JOIN employees e ON g.employee_id = e.employee_id
            WHERE g.goal_id = ? AND e.manager_id = ?
            `,
            [goalId, managerId]
        );
        
        if (goalCheck.length === 0 || goalCheck[0].goal_status !== 'in_progress') {
            await connection.rollback();
            return res.status(403).send({ error: "Goal is not in the 'In Progress' state for review or manager is unauthorized." });
        }
        
        await connection.execute(`SET @app_user_id = ?`, [managerId]); 

        const insertReviewQuery = `
            INSERT INTO manager_reviews (goal_id, manager_id, rating, feedback, review_date)
            VALUES (?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
                rating = VALUES(rating),
                feedback = VALUES(feedback),
                review_date = NOW();
        `;
        await connection.execute(insertReviewQuery, [goalId, managerId, rating, feedback]);
        
        await connection.execute(
            `UPDATE goals SET goal_status = 'completed' WHERE goal_id = ?`,
            [goalId]
        );
        
        await connection.commit();

        res.status(201).send({ message: "Goal review submitted successfully." });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Review submission failed:', error.message);
        res.status(500).send({ error: error.message || 'Database error during review submission.' });
    } finally {
        if (connection) connection.release(); 
    }
});

// In src/routes/managers.js (Add this new route)

// GET /api/manager/360-feedback/:employeeId
// Fetches all peer feedback for a single employee in the current cycle.
router.get('/360-feedback/:employeeId', async (req, res) => {
    const employeeId = parseInt(req.params.employeeId, 10);
    
    try {
        const cycleId = await getActiveCycleId(pool);

        // Fetch all feedback data, including the reviewer's name
        const [feedback] = await pool.query(
            `
            SELECT 
                f.rating,
                f.comments,
                e.employee_name AS reviewer_name
            FROM feedback_360 f
            JOIN employees e ON f.reviewer_id = e.employee_id
            WHERE f.employee_id = ? AND f.cycle_id = ?
            ORDER BY f.feedback_date DESC
            `,
            [employeeId, cycleId]
        );

        res.json(feedback);
    } catch (err) {
        console.error('Error fetching 360 feedback:', err.message);
        res.status(500).send({ error: 'Failed to retrieve 360 feedback.' });
    }
});


export default router;