import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useLogout } from '../utils/auth'; 
import '../man.css'; 

// =================================================================
// 1. GoalApprovalQueue Component
// =================================================================
// In src/components/DashboardManager.js (Revised GoalApprovalQueue component)

function GoalApprovalQueue({ pendingGoals, reports, onApprove, onReview,reviewGoals}) { 
    
    // Filter reports to find those awaiting manager review (status = 'in_progress')
    // We are looking for the 'in_progress' status returned by fn_getappraisalprogress
    const reportsReadyForReview = reports.filter(report => 
        report.appraisal_progress.toLowerCase().includes('in_progress')
    );
    
    return (
        <div className="approval-queue-card">
            
            {/* --- 1. PENDING GOAL APPROVALS (Goals submitted by employee) --- */}
            <h3>⏳ Goal Approval Queue ({pendingGoals.length})</h3>
            
            {pendingGoals.length === 0 ? (
                <p>No goals currently require your approval.</p>
            ) : (
                pendingGoals.map(goal => (
                    <div key={goal.goal_id} className="pending-goal-item pending-approval">
                        <p>Employee: **{goal.employee_name}**</p>
                        <p>Goal: {goal.goal_title} ({goal.goal_weightage}%)</p>
                        
                        <button 
                            className="approve-btn"
                            onClick={() => onApprove(goal)} 
                        >
                            Review & Approve
                        </button>
                    </div>
                ))
            )}

            {/* --- 2. GOALS READY FOR REVIEW (Goals that have been self-appraised) --- */}
            {reviewGoals.length > 0 && ( // Use the specific list of goals ready for review
        <div style={{ marginTop: '25px', borderTop: '1px solid #ecf0f1', paddingTop: '20px' }}>
            <h3 style={{ color: '#2980b9' }}>🔍 Goals Awaiting Review ({reviewGoals.length})</h3>
            
            {reviewGoals.map(goal => ( // Map the specific GOALS list
                <div key={goal.goal_id} className="pending-goal-item review-ready">
                    <p>Employee: **{goal.employee_name}**</p>
                    <p>Goal: **{goal.goal_title}** ({goal.goal_weightage}%)</p>
                    
                    {/* CRITICAL: Pass the entire goal object, which has goal_id */}
                    <button onClick={() => onReview(goal)} className="primary-btn review-btn">
                        Start Review
                    </button>
                </div>
            ))}
        </div>
    )}
    </div>
);
}

// =================================================================
// 2. TeamProgressTable Component
// =================================================================
function TeamProgressTable({ reports }) {
    return (
        <div className="team-progress-card">
            <h3>📈 Team Appraisal Progress ({reports.length} Reports)</h3>
            
            {reports.length === 0 ? (
                <p>You have no direct reports assigned for the active cycle.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Employee Name</th>
                            <th>Department</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.map(report => (
                            <tr key={report.employee_id}>
                                <td>{report.employee_name}</td>
                                <td>{report.department_name || 'N/A'}</td>
                                {/* Displays output of fn_getappraisalprogress */}
                                <td>**{report.appraisal_progress.toUpperCase()}**</td> 
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

// =================================================================
// 3. ApprovalModal Component
// =================================================================
function ApprovalModal({ goal, managerId, onClose, onApproveSuccess }) {
    const [feedback, setFeedback] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleApproveSubmit = async (e) => {
        e.preventDefault();
        if (feedback.trim() === '') {
            setStatusMessage("Feedback is required before approval.");
            return;
        }

        setIsSubmitting(true);
        setStatusMessage('Submitting...');
        
        try {
            await api.post('/api/manager/approve-goal', {
                managerId: managerId,
                goalId: goal.goal_id,
                feedback: feedback
            });

            setStatusMessage("Goal approved successfully!");
            setTimeout(() => { onApproveSuccess(); }, 500); 

        } catch (error) {
            setStatusMessage(error.response?.data?.error || 'Approval failed: Check terminal.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3>Approve Goal: {goal.goal_title}</h3>
                <p>Employee: **{goal.employee_name}**</p>
                <p>Weightage: {goal.goal_weightage}%</p>
                
                <form onSubmit={handleApproveSubmit}>
                    <div className="form-group">
                        <label>Manager Feedback (Required for Audit):</label>
                        <textarea 
                            value={feedback} 
                            onChange={(e) => setFeedback(e.target.value)} 
                            rows="4" 
                            required 
                            disabled={isSubmitting}
                        />
                    </div>
                    
                    <div className="modal-actions">
                        <button type="submit" className="primary-btn approve-btn" disabled={isSubmitting}>
                            {isSubmitting ? 'Approving...' : 'Confirm Approval'}
                        </button>
                        <button type="button" onClick={onClose} className="secondary-btn" disabled={isSubmitting}>
                            Cancel
                        </button>
                    </div>
                </form>
                {statusMessage && <p className="status-message">{statusMessage}</p>}
            </div>
        </div>
    );
}
// In src/components/DashboardManager.js (ReviewModal component)

// In src/components/DashboardManager.js (The complete ReviewModal component)

function ReviewModal({ reviewGoal, managerId, onClose, onReviewComplete }) {
    const [rating, setRating] = useState(3); // Default rating set to middle (3)
    const [feedback, setFeedback] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // --- NEW STATES FOR 360 INTEGRATION ---
    const [feedback360, setFeedback360] = useState([]); 
    const [is360Loading, setIs360Loading] = useState(true);
    const [activeTab, setActiveTab] = useState('review'); // 'review' or '360'

    // --- NEW: Fetch 360 Feedback when modal opens ---
    useEffect(() => {
        const fetch360 = async () => {
            // Note: reviewGoal.employee_id is the subject employee ID
            try {
                const response = await api.get(`/api/manager/360-feedback/${reviewGoal.employee_id}`); 
                setFeedback360(response.data);
            } catch (error) {
                console.error("360 fetch error:", error);
                setFeedback360([]);
            } finally {
                setIs360Loading(false);
            }
        };
        // Fetch only if the goalToReview is valid
        if (reviewGoal && reviewGoal.employee_id) {
            fetch360();
        }
    }, [reviewGoal.employee_id]); 


    const handleSubmitReview = async (e) => {
        e.preventDefault();
        if (feedback.trim() === '') {
            setStatusMessage("Feedback is required before approval.");
            return;
        }

        setIsSubmitting(true);
        setStatusMessage('Submitting review...');
        
        try {
            // CRITICAL: Call the API route implemented in the backend
            await api.post('/api/manager/submit-review', {
                managerId: managerId,
                goalId: reviewGoal.goal_id,
                rating: parseInt(rating, 10), // Ensure rating is an integer
                feedback: feedback
            });

            setStatusMessage("Review submitted successfully! Status updated.");
            setTimeout(() => { onReviewComplete(); }, 500); 

        } catch (error) {
            setStatusMessage(error.response?.data?.error || 'Review submission failed: Check terminal.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content review-modal-content" onClick={e => e.stopPropagation()}>
                <h3 className="modal-title">Review Goal for: {reviewGoal.employee_name}</h3>
                <p className="goal-detail-status">Goal: **{reviewGoal.goal_title || 'N/A'}** ({reviewGoal.goal_weightage}%)</p>
                
                {/* --- Tab Navigation --- */}
                <div className="modal-tabs" style={{ display: 'flex', borderBottom: '1px solid #ccc', marginBottom: '20px' }}>
                    <button onClick={() => setActiveTab('review')} className={activeTab === 'review' ? 'active' : ''} style={{ padding: '10px 20px', border: 'none', background: activeTab === 'review' ? '#f0f0f0' : 'transparent' }}>1. Manager Review</button>
                    <button onClick={() => setActiveTab('360')} className={activeTab === '360' ? 'active' : ''} style={{ padding: '10px 20px', border: 'none', background: activeTab === '360' ? '#f0f0f0' : 'transparent' }}>2. Peer Feedback ({feedback360.length})</button>
                </div>

                {/* --- Tab Content --- */}
                {activeTab === 'review' && (
                    // ------------------ MANAGER RATING FORM ------------------
                    <form onSubmit={handleSubmitReview}>
                        {/* Placeholder for fetching and displaying Employee Self-Appraisal Comments here */}
                        <div className="self-appraisal-context-box">
                            <p style={{fontWeight: 'bold'}}>Self-Appraisal Context:</p>
                            <p>— *Context needed: Implement API to fetch self-appraisal details using goal_id.*</p>
                        </div>
                        
                        <div className="form-group"><label>Performance Rating (1-5):</label><input type="number" value={rating} onChange={(e) => setRating(e.target.value)} min="1" max="5" required /></div>
                        <div className="form-group"><label>Detailed Feedback:</label><textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows="5" required disabled={isSubmitting} /></div>
                        
                        <div className="modal-actions">
                            <button type="submit" className="primary-btn approve-btn" disabled={isSubmitting}>
                                {isSubmitting ? 'Finalizing...' : 'Finalize Review & Rate'}
                            </button>
                            <button type="button" onClick={onClose} className="secondary-btn" disabled={isSubmitting}>
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === '360' && (
                    // ------------------ PEER FEEDBACK DISPLAY ------------------
                    <div className="feedback-360-container">
                        {is360Loading ? (<p>Loading peer feedback...</p>) : 
                         feedback360.length === 0 ? (<p>No peer feedback has been submitted for this employee in the current cycle.</p>) : (
                            feedback360.map((item, index) => (
                                <div key={index} className="peer-review-card" style={{ border: '1px solid #eee', padding: '10px', borderRadius: '6px', marginBottom: '10px' }}>
                                    <p>Reviewer: **{item.reviewer_name || 'Anonymous Peer'}**</p>
                                    <p>Rating: **{item.rating} / 5**</p>
                                    <p className="feedback-comment">Comments: "{item.comments}"</p>
                                </div>
                            ))
                        )}
                    </div>
                )}
                {statusMessage && <p className="status-message">{statusMessage}</p>}
            </div>
        </div>
    );
}


// =================================================================
// 4. Main DashboardManager Component (FIXED STRUCTURE)
// =================================================================
export default function DashboardManager() {
    const logout = useLogout();
    const [teamData, setTeamData] = useState([]);
    const [pendingGoals, setPendingGoals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [goalToApprove, setGoalToApprove] = useState(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false); // FIX 1
    const [goalToReview, setGoalToReview] = useState(null);
    const [reviewGoals, setReviewGoals] = useState([]);
    
    // --- CRITICAL FIX: Use state for managerId and initialize with null ---
    const [managerId, setManagerId] = useState(null); 

    // Helper to load manager ID on component mount
    useEffect(() => {
        // Retrieve ID from localStorage and set the state
        const user = JSON.parse(localStorage.getItem('user'));
        if (user && user.id) {
            setManagerId(parseInt(user.id, 10));
        }
    }, []); // Runs once on mount

    // Data Fetching Function (Defined BEFORE useEffect)
    const fetchTeamData = async () => {
        if (!managerId) { // Wait until managerId state is set
            setIsLoading(false); 
            return;
        }
        try {
            // Call the route using the STATE variable
            const response = await api.get(`/api/manager/team-overview/${managerId}`);
            const reviewResponse = await api.get(`/api/manager/goals-for-review/${managerId}`);

            setTeamData(response.data.reports);
            setPendingGoals(response.data.pendingGoals);
            setReviewGoals(reviewResponse.data);
        } catch (error) {
            console.error("Failed to load manager data:", error);
            setTeamData([]);
            setPendingGoals([]);
            setReviewGoals([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Data Fetching Hook
    useEffect(() => {
        // Fetch runs whenever the managerId state changes (i.e., when it gets loaded from localStorage)
        fetchTeamData();
    }, [managerId]); // Dependency now ensures fetch runs ONLY when managerId is available.


    // Handler for Goal Approval (remains the same)
    const handleGoalApproval = (goal) => {
        setGoalToApprove(goal); 
        setIsApprovalModalOpen(true);
    };

    

    // Refresher function (remains the same)
    const refreshDashboardData = () => {
        setIsApprovalModalOpen(false);
        fetchTeamData(); 
    };

    const handleGoalReview = (goal) => {
    // NOTE: This assumes the report object contains enough info to proceed.
    setGoalToReview(goal); 
    setIsReviewModalOpen(true);
};

    // --- Render Guards ---
    // Wait until managerId is loaded AND API call is complete
    if (isLoading || managerId === null) return <div className="loading-spinner">Loading Manager Dashboard...</div>;

    // --- RENDER ---
    return (
        <div className="manager-dashboard-layout">
            <header className="app-header">
                <h2>Manager Dashboard ({managerId})</h2>
                <button onClick={logout} className="logout-btn">Logout</button>
            </header>

            <div className="dashboard-content-container">
                
                {/* 1. Goal Approval Queue */}
                <GoalApprovalQueue 
                    pendingGoals={pendingGoals} 
                    reviewGoals={reviewGoals}
                    onApprove={handleGoalApproval} 
                    reports={teamData} // Pass reports for review goal filtering
                    onReview={handleGoalReview}
                />

                <hr/>
                
                {/* 2. Team Progress Table */}
                <TeamProgressTable 
                    reports={teamData} 
                />
                
                {/* 3. Approval Modal Rendering */}
                {isApprovalModalOpen && goalToApprove && (
                    <ApprovalModal
                        goal={goalToApprove}
                        // CRITICAL: Use the state variable for managerId
                        managerId={managerId} 
                        onClose={() => setIsApprovalModalOpen(false)}
                        onApproveSuccess={refreshDashboardData} 
                    />
                )}
                {isReviewModalOpen && goalToReview && (
                <ReviewModal
                    reviewGoal={goalToReview}
                    managerId={managerId}
                    onClose={() => setIsReviewModalOpen(false)}
                    onReviewComplete={refreshDashboardData}
                />
            )}
            </div>
        </div>
    );
}