// src/routes/hr.js
import express from 'express';
import { pool } from '../db.js';
const router = express.Router();

// NOTE: Remember to mount this router in server.js: app.use('/api/hr', hrRoutes); 

// Helper: Ensure managerId is retrieved from body/session for auditing HR actions
const getHrId = (req) => req.body.hrId || req.query.hrId;

// GET /api/hr/cycles
router.get('/cycles', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM appraisal_cycles ORDER BY start_date DESC");
        res.json(rows);
    } catch (err) {
        console.error('Error fetching cycles:', err.message);
        res.status(500).send({ error: 'Failed to retrieve appraisal cycles.' });
    }
});

// POST /api/hr/cycles
router.post('/cycles', async (req, res) => {
    const { hrId, cycleName, startDate, endDate } = req.body; // hrId passed in body for audit
    
    if (!hrId || !cycleName || !startDate || !endDate) {
        return res.status(400).send({ error: "Missing cycle details." });
    }
    
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Set audit user ID
        await connection.execute(`SET @app_user_id = ?`, [hrId]); 

        const [result] = await connection.execute(
            `INSERT INTO appraisal_cycles (cycle_name, start_date, end_date, status) VALUES (?, ?, ?, 'inactive')`,
            [cycleName, startDate, endDate]
        );

        await connection.commit();
        res.status(201).send({ message: "Cycle created successfully.", cycleId: result.insertId });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error creating cycle:', err.message);
        res.status(500).send({ error: 'Failed to create cycle.' });
    } finally {
        if (connection) connection.release();
    }
});

// PUT /api/hr/cycles/:cycleId/status
router.put('/cycles/:cycleId/status', async (req, res) => {
    const { cycleId } = req.params;
    const { hrId, newStatus } = req.body; 

    if (!['inactive', 'active', 'closed'].includes(newStatus)) {
        return res.status(400).send({ error: "Invalid status value." });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        // 1. If setting to 'active', deactivate all others first (Workflow integrity)
        if (newStatus === 'active') {
            await connection.execute(`UPDATE appraisal_cycles SET status = 'inactive' WHERE status = 'active'`);
        }
        
        // 2. Set audit user ID
        await connection.execute(`SET @app_user_id = ?`, [hrId]); 

        // 3. Update the target cycle's status
        const [result] = await connection.execute(
            `UPDATE appraisal_cycles SET status = ? WHERE cycle_id = ?`,
            [newStatus, cycleId]
        );

        await connection.commit();

        if (result.affectedRows === 0) {
            return res.status(404).send({ message: "Cycle not found." });
        }
        res.send({ message: `Cycle ${cycleId} status updated to ${newStatus}.` });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error updating cycle status:', err.message);
        res.status(500).send({ error: 'Failed to update cycle status.' });
    } finally {
        if (connection) connection.release();
    }
});

// In src/routes/hr.js (Add this new route)

// POST /api/hr/calculate-ratings
// Runs the batch process to calculate final weighted scores for a cycle.
// In src/routes/hr.js (Final Fix for POST /calculate-ratings)

router.post('/calculate-ratings', async (req, res) => {
    const { hrId, cycleId } = req.body; 

    if (!hrId || !cycleId) {
        return res.status(400).send({ error: "Missing HR ID or Cycle ID." });
    }

    let connection;
    try {
        // 1. Get a single connection and START TRANSACTION (CRITICAL)
        connection = await pool.getConnection(); 
        await connection.beginTransaction(); 
        
        // 2. Set the audit user ID
        await connection.execute(`SET @app_user_id = ?`, [hrId]); 

        // 3. Call the stored procedure (Now guaranteed to run on the same thread/session)
        await connection.query(`CALL sp_calculatefinalratings(?, ?)`, 
            [cycleId, hrId]
        );

        await connection.commit(); // Commit the transaction to finalize the scores

        res.send({ message: `Final ratings calculation completed successfully for Cycle ID ${cycleId}.` });

    } catch (err) {
        if (connection) {
            // Rollback only necessary if a transaction was started and failed
            await connection.rollback(); 
        }
        // Log the exact error from the database
        console.error('Database Error during calculation:', err.message);
        res.status(500).send({ error: err.message || 'Failed to execute final ratings calculation.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});
// In src/routes/hr.js (Add this new route)

// GET /api/hr/final-ratings/:cycleId
// Fetches all final calculated scores for a specific appraisal cycle.
router.get('/final-ratings/:cycleId', async (req, res) => {
    const cycleId = parseInt(req.params.cycleId, 10);
    
    try {
        // Join final_ratings with employees to get the name and order by score (ranking)
        const [ratings] = await pool.query(
            `
            SELECT 
                fr.rating_id,
                fr.employee_id,
                e.employee_name,
                fr.weighted_score,
                fr.final_rank,
                fr.final_comments
            FROM final_ratings fr
            JOIN employees e ON fr.employee_id = e.employee_id
            WHERE fr.cycle_id = ?
            ORDER BY fr.weighted_score DESC
            `,
            [cycleId]
        );

        res.json(ratings);

    } catch (err) {
        console.error('Error fetching final ratings:', err.message);
        res.status(500).send({ error: err.message || "Failed to retrieve final ratings list." });
    }
});
// PUT /api/hr/final-ratings/:ratingId
// Updates the final rank and comments after normalization.
router.put('/final-ratings/:ratingId', async (req, res) => {
    const { ratingId } = req.params;
    const { hrId, finalRank, finalComments } = req.body; 

    if (!hrId || !finalRank) {
        return res.status(400).send({ error: "Missing HR ID or Final Rank." });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.execute(`SET @app_user_id = ?`, [hrId]); // Set audit user ID

        // This update will trigger trg_final_ratings_after_update for auditing
        const [result] = await connection.execute(
            `UPDATE final_ratings SET final_rank = ?, final_comments = ? WHERE rating_id = ?`,
            [finalRank, finalComments, ratingId]
        );

        await connection.release();
        if (result.affectedRows === 0) {
            return res.status(404).send({ message: "Rating record not found." });
        }
        res.send({ message: "Final rank and comments saved successfully." });

    } catch (err) {
        if (connection) connection.release();
        console.error('Error updating final rank:', err.message);
        res.status(500).send({ error: 'Failed to update final rating.' });
    }
});

export default router;