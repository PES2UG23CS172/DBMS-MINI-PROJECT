import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useLogout } from '../utils/auth';
import '../emp.css'; // Assuming the custom CSS file

// --- Helper function to get the current employee's ID ---
const getCurrentEmployeeId = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    return user ? parseInt(user.id, 10) : null; 
};

// =================================================================
// 1. ManagerUpdateForm Component (Profile Setup)
// =================================================================
function ManagerUpdateForm({ employeeId, initialManagerStatus, managerName, onManagerUpdated }) {
    const [managers, setManagers] = useState([]);
    const [selectedManagerId, setSelectedManagerId] = useState(initialManagerStatus || ''); 
    const [statusMessage, setStatusMessage] = useState('');
    
    useEffect(() => { setSelectedManagerId(initialManagerStatus || ''); }, [initialManagerStatus]);

    useEffect(() => {
        const fetchManagers = async () => {
            try {
                const response = await api.get('/api/employee/managers-list');
                setManagers(response.data);
            } catch (error) { console.error("Failed to load managers.", error); }
        };
        fetchManagers();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedManagerId || parseInt(selectedManagerId, 10) === employeeId) {
            setStatusMessage("Invalid manager selection.");
            return;
        }

        try {
            await api.put('/api/employee/update-manager', { employeeId, newManagerId: selectedManagerId });
            setStatusMessage("Manager updated successfully!");
            if (onManagerUpdated) { onManagerUpdated(); } 
        } catch (error) {
            setStatusMessage(error.response?.data?.error || "Update failed.");
        }
    };

    return (
        <div className="manager-selection-card">
            <h3>Update Reporting Manager</h3>
            <p className="manager-status-display">
                Your current manager: **{managerName || 'Not Set'}**
            </p>
            <form onSubmit={handleSubmit}>
                <select value={selectedManagerId} onChange={(e) => setSelectedManagerId(e.target.value)} required>
                    <option value="">-- Select a Manager --</option>
                    {managers.map(manager => (
                        <option key={manager.employee_id} value={String(manager.employee_id)}>{manager.employee_name}</option>
                    ))}
                </select>
                <button type="submit">Save Manager</button>
            </form>
            {statusMessage && <p className="status-message">{statusMessage}</p>}
        </div>
    );
}

// =================================================================
// 2. Goal Creation Form Component (Handles Submission and 100% Client-side Check)
// =================================================================
function GoalCreationForm({ employeeId, currentTotalWeightage, onGoalSubmit }) {
    const [goalData, setGoalData] = useState({ goalTitle: '', goalDescription: '', goalWeightage: '' });
    const [statusMessage, setStatusMessage] = useState('');
    
    const remainingWeight = 100 - currentTotalWeightage;

    const handleChange = (e) => { setGoalData({ ...goalData, [e.target.name]: e.target.value }); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newWeight = parseFloat(goalData.goalWeightage);
        
        if (newWeight > remainingWeight || newWeight <= 0) {
             setStatusMessage(`Error: Weightage must be between 1% and ${remainingWeight}%.`);
             return;
        }

        try {
            await api.post('/api/employee/goal', { employeeId: employeeId, ...goalData });
            setStatusMessage("Goal submitted for manager approval!");
            setGoalData({ goalTitle: '', goalDescription: '', goalWeightage: '' });
            onGoalSubmit(); // Triggers refresh of goals and total weightage
        } catch (error) {
            setStatusMessage(error.response?.data?.error || "Goal submission failed.");
        }
    };

    return (
        <div className="goal-creation-card">
            <h3>Set a New Goal</h3>
            <p className="weight-status">
                Current Total Weight: **{currentTotalWeightage}%** | 
                Remaining: **{remainingWeight}%**
            </p>
            <form onSubmit={handleSubmit}>
                <div className="form-group"><label htmlFor="goalTitle">Title:</label><input type="text" name="goalTitle" value={goalData.goalTitle} onChange={handleChange} required /></div>
                <div className="form-group"><label htmlFor="goalDescription">Description (S.M.A.R.T.):</label><textarea name="goalDescription" value={goalData.goalDescription} onChange={handleChange} rows="3"></textarea></div>
                <div className="form-group">
                    <label htmlFor="goalWeightage">Weightage (%):</label>
                    <input type="number" name="goalWeightage" value={goalData.goalWeightage} onChange={handleChange} min="1" max={remainingWeight > 0 ? remainingWeight : 1} required />
                </div>
                <button type="submit" disabled={remainingWeight <= 0}>Submit Goal</button>
            </form>
            {statusMessage && <p className="status-message">{statusMessage}</p>}
        </div>
    );
}

// =================================================================
// 3. Edit Goal Modal Component (Handles Update Logic)
// =================================================================
function EditGoalModal({ goal, currentTotalWeightage, onClose, onUpdate, employeeId }) {
    const [goalData, setGoalData] = useState({ 
        goalTitle: goal.goal_title, 
        goalDescription: goal.goal_description, 
        goalWeightage: goal.goal_weightage 
    });
    const [statusMessage, setStatusMessage] = useState('');
    
    const initialWeight = parseFloat(goal.goal_weightage);
    const maxAllowedWeight = (100 - currentTotalWeightage) + initialWeight;

    const handleChange = (e) => { setGoalData({ ...goalData, [e.target.name]: e.target.value }); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newWeight = parseFloat(goalData.goalWeightage);

        if (newWeight > maxAllowedWeight || newWeight <= 0) {
            setStatusMessage(`Error: Weightage exceeds max allowed (${maxAllowedWeight.toFixed(2)}%)`);
            return;
        }

        try {
            await api.put(`/api/employee/goal/${goal.goal_id}`, {
                employeeId: employeeId,
                ...goalData
            });
            
            setStatusMessage("Goal updated successfully!");
            setTimeout(() => { onUpdate(); }, 500); 
        } catch (error) {
            setStatusMessage(error.response?.data?.error || "Update failed.");
        }
    };
    
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3>Edit Goal: {goal.goal_title}</h3>
                <p>Max allowed weight for this goal: **{maxAllowedWeight.toFixed(2)}%**</p>
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group"><label>Title:</label><input type="text" name="goalTitle" value={goalData.goalTitle} onChange={handleChange} required /></div>
                    <div className="form-group"><label>Description:</label><textarea name="goalDescription" value={goalData.goalDescription} onChange={handleChange} rows="3" /></div>
                    <div className="form-group">
                        <label>Weightage (%):</label>
                        <input type="number" name="goalWeightage" value={goalData.goalWeightage} onChange={handleChange} min="1" max={maxAllowedWeight} required />
                    </div>
                    <div className="modal-actions">
                        <button type="submit" className="primary-btn">Save Changes</button>
                        <button type="button" onClick={onClose} className="secondary-btn" style={{ marginLeft: '10px' }}>Cancel</button>
                    </div>
                </form>
                {statusMessage && <p className="status-message">{statusMessage}</p>}
            </div>
        </div>
    );
}

// =================================================================
// 4. Goal List Component (Status Table & Actions)
// =================================================================
function GoalList({ goals, employeeId, onGoalAction }) {

    const handleDelete = async (goalId) => {
        if (!window.confirm("Are you sure you want to delete this goal? This action cannot be undone.")) return;
        
        try {
            await api.delete(`/api/employee/goal/${goalId}?employeeId=${employeeId}`);
            alert('Goal deleted successfully!');
            onGoalAction(); // Refresh the list and weightage
        } catch (error) {
            alert(error.response?.data?.error || "Failed to delete goal.");
        }
    };
    
    return (
        <div className="goals-list-section">
            <h3>Goal Status Table ({goals.length})</h3>
            {goals.length === 0 ? (
                <p className="no-goals-message">No goals set for the current appraisal cycle.</p>
            ) : (
                <div style={{ padding: '10px' }}>
                    {goals.map(goal => (
                        <div key={goal.goal_id} className={`goal-status-item status-${goal.goal_status.replace('_', '-')}`}>
                            <span style={{ fontWeight: 'bold' }}>{goal.goal_title}</span>
                            (Weight: {goal.goal_weightage}%) - Status: <span className="goal-status-badge">{goal.goal_status.toUpperCase()}</span>

                            <div className="goal-actions">
                                {goal.goal_status === 'pending_approval' && (
                                    <>
                                        <button 
                                            onClick={() => onGoalAction({ type: 'edit', goal: goal })} 
                                            style={{ marginRight: '10px' }}
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(goal.goal_id)} 
                                            style={{ color: '#e74c3c' }}
                                        >
                                            Delete
                                        </button>
                                    </>
                                )}
                                {goal.goal_status === 'approved' && (
                                    
                                    // Placeholder for Self-Appraisal Submission (Next Feature)
                                    <button 
                                    onClick={() => onGoalAction({ type: 'selfAppraise', goal: goal })}
                                    style={{ background: '#3498db', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>
                                        Submit Self-Appraisal
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// In src/components/DashboardEmployee.js (Add this component)

function SelfAppraisalModal({ goal, employeeId, onClose, onUpdate }) {
    const [comments, setComments] = useState('');
    const [documentLink, setDocumentLink] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            await api.post('/api/employee/self-appraisal', {
                employeeId: employeeId,
                goalId: goal.goal_id,
                comments: comments,
                documentLink: documentLink
            });
            
            setStatusMessage("Appraisal submitted!");
            // Close modal and refresh dashboard
            setTimeout(() => { onUpdate(); }, 500); 
        } catch (error) {
            setStatusMessage(error.response?.data?.error || "Submission failed.");
        }
    };
    
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3>Self-Appraisal for: {goal.goal_title}</h3>
                <p>Status: **{goal.goal_status.toUpperCase()}**</p>
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Your Comments / Achievements:</label>
                        <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows="5" required />
                    </div>
                    <div className="form-group">
                        <label>Supporting Document Link (Optional):</label>
                        <input type="url" value={documentLink} onChange={(e) => setDocumentLink(e.target.value)} placeholder="e.g., SharePoint, Google Drive link" />
                    </div>
                    <div className="modal-actions">
                        <button type="submit" className="primary-btn">Submit Appraisal</button>
                        <button type="button" onClick={onClose} className="secondary-btn" style={{ marginLeft: '10px' }}>Cancel</button>
                    </div>
                </form>
                {statusMessage && <p className="status-message">{statusMessage}</p>}
            </div>
        </div>
    );
}

// In src/components/DashboardEmployee.js (Add this component)

// In src/components/DashboardEmployee.js (Update the ProgressBanner component)

// You might need to import a react-icon library, e.g., 'react-icons/fa' or 'react-icons/md'
// For this example, I'll use simple text icons or emojis, but a library is recommended for real apps.
// Example: import { FaClock, FaCheckCircle, FaClipboardList } from 'react-icons/fa';

function ProgressBanner({ status }) {
    let progressClass = 'progress-banner-default';
    let icon = 'ℹ️'; // Default info icon
    let displayStatus = status;

    // Clean up status text for better display (e.g., remove the "1. ", "2. ", etc.)
    const cleanStatus = status.split('. ').length > 1 ? status.split('. ')[1] : status;

    if (cleanStatus.includes('not yet approved')) {
        progressClass = 'progress-banner-pending';
        icon = '⏳'; // Clock icon
        displayStatus = 'GOALS PENDING MANAGER APPROVAL';
    } else if (cleanStatus.includes('awaiting self-appraisal')) {
        progressClass = 'progress-banner-action-required'; // Action needed from employee
        icon = '✍️'; // Writing hand icon
        displayStatus = 'YOUR SELF-APPRAISAL IS AWAITING';
    } else if (cleanStatus.includes('manager review in progress')) {
        progressClass = 'progress-banner-in-progress';
        icon = '🔍'; // Magnifying glass or review icon
        displayStatus = 'MANAGER REVIEW IN PROGRESS';
    } else if (cleanStatus.includes('awaiting final feedback')) {
        progressClass = 'progress-banner-awaiting-manager';
        icon = '💬'; // Speech bubble for feedback
        displayStatus = 'AWAITING FINAL MANAGER FEEDBACK';
    } else if (cleanStatus.includes('completed')) {
        progressClass = 'progress-banner-completed';
        icon = '✅'; // Checkmark icon
        displayStatus = 'APPRAISAL CYCLE COMPLETED';
    } else {
        // Fallback for unknown statuses
        displayStatus = cleanStatus.toUpperCase();
    }

    return (
        <div className={`progress-banner ${progressClass}`}>
            <span className="progress-banner-icon">{icon}</span>
            <span className="progress-banner-text">**Appraisal Progress:** {displayStatus}</span>
        </div>
    );
}

// In src/components/DashboardEmployee.js (Add this component)

// In src/components/DashboardEmployee.js (Replacing the FinalReportView component)

function FinalReportView({ employeeId, currentCycleId }) {
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Function to fetch the report data only when the section is opened (remains the same)
    const fetchReport = async () => {
        if (!employeeId || !currentCycleId || reportData) return; 
        
        setIsLoading(true);
        try {
            const response = await api.get(`/api/employee/final-report/${employeeId}`);
            setReportData(response.data);
        } catch (error) {
            setReportData({ error: error.response?.data?.message || "Report data unavailable." });
        } finally {
            setIsLoading(false);
        }
    };

    const toggleOpen = () => {
        if (!isOpen) { fetchReport(); }
        setIsOpen(!isOpen);
    };

    // Determine color class based on final rank (for visual flair)
    const getRankClass = (rank) => {
        if (!rank) return 'rank-default';
        const lowerRank = rank.toLowerCase();
        if (lowerRank.includes('exceeds')) return 'rank-exceeds';
        if (lowerRank.includes('meets')) return 'rank-meets';
        return 'rank-needs';
    };

    // Render logic for the collapsed state
    if (!reportData && !isOpen) {
        return (
            <button className="report-toggle-btn collapsed" onClick={toggleOpen}>
                View Final Performance Report
            </button>
        );
    }
    
    // --- Render Report Content ---
    return (
        <div className="final-report-container">
            <button className="report-toggle-btn open" onClick={toggleOpen}>
                {isOpen ? 'Minimize Report ▲' : 'View Final Performance Report ▼'}
            </button>

            {isOpen && (
                <div className="report-content-wrapper">
                    {isLoading && <p className="loading-message">Loading comprehensive report...</p>}
                    {reportData?.error && <p className="error-message">{reportData.error}</p>}
                    
                    {/* 1. Overall Summary Card */}
                    {reportData?.summary && (
                        <div className={`report-section summary-card ${getRankClass(reportData.summary.final_rank)}`}>
                            <h4>Final Appraisal Summary</h4>
                            <p className="summary-rank">Overall Rating: **{reportData.summary.final_rank || 'N/A'}**</p>
                            <p>Weighted Score: **{reportData.summary.weighted_score || '0.00'}%**</p>
                            <p className="summary-comments">HR/Manager Comments: {reportData.summary.final_comments || 'Pending Finalization.'}</p>
                        </div>
                    )}

                    {/* 2. Goal-by-Goal Breakdown Card */}
                    {reportData?.goalsAndReviews && reportData.goalsAndReviews.length > 0 && (
                        <div className="report-section breakdown-card">
                            <h5>Goal-by-Goal Review</h5>
                            {reportData.goalsAndReviews.map((goal, index) => (
                                <div key={index} className="goal-review-item">
                                    <div className="goal-title-rating">
                                        <p>Goal: **{goal.goal_title}** ({goal.goal_weightage}%)</p>
                                        <span className="rating-badge">Rating: **{goal.rating || 'N/A'} / 5**</span>
                                    </div>
                                    <p className="manager-feedback-text">Feedback: *{goal.feedback || 'No manager feedback.'}*</p>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* 3. 360 Feedback (Placeholder structure) */}
                    {reportData?.feedback360 && reportData.feedback360.length > 0 && (
                        <div className="report-section breakdown-card">
                            <h5>Peer Feedback (360°)</h5>
                            {/* ... map and display 360 feedback here ... */}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// In src/components/DashboardEmployee.js (Add this component)

function Feedback360Modal({ allEmployees, reviewerId, onClose, onFeedbackSuccess }) {
    const [subjectId, setSubjectId] = useState('');
    const [rating, setRating] = useState(3); 
    const [comments, setComments] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatusMessage('Submitting...');
        
        try {
            await api.post('/api/employee/submit-360-feedback', {
                employeeId: subjectId, 
                reviewerId: reviewerId,         
                rating: parseInt(rating, 10),
                comments: comments
            });

            setStatusMessage("Feedback submitted successfully!");
            setTimeout(() => { onFeedbackSuccess(); }, 500);

        } catch (error) {
            setStatusMessage(error.response?.data?.error || 'Submission failed.');
            setIsSubmitting(false);
        }
    };

    // Filter out the reviewer from the subject list
    const selectableEmployees = allEmployees.filter(emp => emp.employee_id !== reviewerId);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3 className="modal-title">360° Peer Feedback</h3>
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Employee to Review:</label>
                        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
                            <option value="">-- Select Colleague --</option>
                            {selectableEmployees.map(emp => (
                                <option key={emp.employee_id} value={emp.employee_id}>
                                    {emp.employee_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Overall Rating (1-5):</label>
                        <input type="number" value={rating} onChange={(e) => setRating(e.target.value)} min="1" max="5" required />
                    </div>
                    <div className="form-group">
                        <label>Comments:</label>
                        <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows="5" required />
                    </div>
                    <div className="modal-actions">
                        <button type="submit" className="primary-btn" disabled={isSubmitting}>Submit Feedback</button>
                        <button type="button" onClick={onClose} className="secondary-btn" disabled={isSubmitting}>Cancel</button>
                    </div>
                </form>
                {statusMessage && <p className="status-message">{statusMessage}</p>}
            </div>
        </div>
    );
}

// ... (In your existing CSS file, add styles for .progress-banner, .progress-completed, etc.)


// =================================================================
// 5. Main DashboardEmployee Component (Integrates all logic)
// =================================================================

export default function DashboardEmployee() {
    const currentEmployeeId = getCurrentEmployeeId();
    const logout = useLogout();
    // const [currentCycleId, setCurrentCycleId] = useState(1); // Mocked ID 1
    
    // Goal Management States
    const [currentManagerId, setCurrentManagerId] = useState(null); 
    const [currentManagerName, setCurrentManagerName] = useState(null);
    const [currentWeightage, setCurrentWeightage] = useState(0); 
    const [goals, setGoals] = useState([]); 
    const [isLoading, setIsLoading] = useState(true);
    
    // --- UI State for Editing ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [goalToEdit, setGoalToEdit] = useState(null); 

    const [isAppraisalModalOpen, setIsAppraisalModalOpen] = useState(false);
    const [goalToAppraise, setGoalToAppraise] = useState(null);

    const [appraisalProgress, setAppraisalProgress] = useState('Checking Status...'); // NEW STATE

    const [allEmployees, setAllEmployees] = useState([]); // NEW STATE for reviewer list
    const [is360ModalOpen, setIs360ModalOpen] = useState(false);
    const [activeCycleId, setActiveCycleId] = useState(null);

    const fetchActiveCycleId = async () => {
        try {
            const response = await api.get(`/api/employee/active-cycle-id`);
            setActiveCycleId(response.data.cycle_id);
        } catch (error) {
            console.error("Active Cycle fetch failed.", error);
            setActiveCycleId(null);
        }
    };

    const fetchAllEmployees = async () => {
        try {
            // NOTE: Need a new backend route GET /api/employee/all-employees
            const response = await api.get('/api/employee/all-employees'); 
            setAllEmployees(response.data);
        } catch (error) {
            console.error("Failed to fetch all employee list:", error);
        }
    };
    

    // --- Data Fetching Logic ---
    const fetchEmployeeProfile = async () => {
        if (!currentEmployeeId) return;
        try {
            const response = await api.get(`/api/employee/profile/${currentEmployeeId}`);
            setCurrentManagerId(response.data.manager_id || null); 
            setCurrentManagerName(response.data.manager_name || null); 
        } catch (error) { setCurrentManagerId(null); setCurrentManagerName(null); }
    };
    
    const fetchCurrentWeightage = async () => {
        if (!currentEmployeeId) return;
        try {
            const response = await api.get(`/api/employee/current-weightage/${currentEmployeeId}`); 
            setCurrentWeightage(parseFloat(response.data.total_weight) || 0);
        } catch (error) { setCurrentWeightage(0); }
    };

    const fetchGoals = async () => {
        if (!currentEmployeeId) return;
        try {
            const response = await api.get(`/api/employee/goals/${currentEmployeeId}`);
            setGoals(response.data);
        } catch (error) { setGoals([]); }
    };

    const fetchAppraisalProgress = async () => {
        if (!currentEmployeeId) return;
        try {
            const response = await api.get(`/api/employee/appraisal-progress/${currentEmployeeId}`);
            setAppraisalProgress(response.data.current_progress);
        } catch (error) { 
            // Handle error (e.g., if no active cycle is found)
            setAppraisalProgress("Error: Cycle not started or connection issue."); 
        }
    };

    const refreshDashboardData = async () => {
        setIsLoading(true);
        await Promise.all([
            fetchEmployeeProfile(), 
            fetchCurrentWeightage(), 
            fetchGoals(),
            fetchAppraisalProgress(),
            fetchAllEmployees(),
            fetchActiveCycleId()
        ]);
        setIsLoading(false);
    };

    useEffect(() => { 
        if (currentEmployeeId) refreshDashboardData();
        else setIsLoading(false);
    }, [currentEmployeeId]);
    
    // --- Action Handler (Correct Placement) ---
    const handleGoalAction = ({ type, goal }) => {
        if (type === 'edit') {
            setGoalToEdit(goal);
            setIsEditModalOpen(true);
        }else if (type === 'selfAppraise') {
            setGoalToAppraise(goal);
            setIsAppraisalModalOpen(true);
        }
        // Delete action is handled directly in the GoalList component
    };


    // --- Render Guards ---
    if (!currentEmployeeId) return <h1>Error: Employee ID not found. Please log in again.</h1>;
    if (isLoading) return <div className="loading-spinner">Loading Employee Dashboard...</div>;

    return (
        <div className="employee-dashboard-layout">
            <header className="app-header">
                <h1>APAS Employee Dashboard</h1>
                <button onClick={logout} className="logout-btn">Logout</button>
            </header>
            
            <div className="dashboard-content-container"> 

                <ProgressBanner status={appraisalProgress} />
                <ManagerUpdateForm 
                    employeeId={currentEmployeeId} 
                    initialManagerStatus={currentManagerId}
                    managerName={currentManagerName}
                    onManagerUpdated={refreshDashboardData} 
                />

                <hr />
                <h2>🎯 Goal Management</h2>
                
                <GoalCreationForm 
                    employeeId={currentEmployeeId}
                    currentTotalWeightage={currentWeightage}
                    onGoalSubmit={refreshDashboardData} 
                />
                
                {/* Goal List Display - Passing necessary props */}
                <GoalList 
                    goals={goals} 
                    employeeId={currentEmployeeId} 
                    onGoalAction={handleGoalAction} 
                />

                <h2>🤝 Peer Feedback (360°)</h2>
                <button 
                    onClick={() => setIs360ModalOpen(true)} 
                    className="primary-btn"
                    style={{ marginBottom: '20px' }}
                >
                    Give Feedback to a Colleague
                </button>




                <h2>📈 Final Performance Review</h2>
                <FinalReportView 
            employeeId={currentEmployeeId} 
            // NOTE: You must replace '1' with the actual fetched active cycle ID later.
            currentCycleId={activeCycleId} 
        />


            </div>

            {/* --- EDIT MODAL RENDERING --- */}
            {isEditModalOpen && goalToEdit && (
                <EditGoalModal
                    goal={goalToEdit}
                    currentTotalWeightage={currentWeightage}
                    employeeId={currentEmployeeId}
                    onClose={() => setIsEditModalOpen(false)}
                    onUpdate={() => {
                        setIsEditModalOpen(false);
                        refreshDashboardData(); // Refresh data after update
                    }}
                />
            )}

            {is360ModalOpen && allEmployees.length > 0 && (
                <Feedback360Modal
                    allEmployees={allEmployees}
                    reviewerId={currentEmployeeId}
                    onClose={() => setIs360ModalOpen(false)}
                    onFeedbackSuccess={() => {
                        setIs360ModalOpen(false);
                        // No need to fully refresh dashboard, just show success
                    }}
                />
            )}
            {isAppraisalModalOpen && goalToAppraise && (
                <SelfAppraisalModal
                    goal={goalToAppraise}
                    employeeId={currentEmployeeId}
                    onClose={() => setIsAppraisalModalOpen(false)}
                    onUpdate={() => {
                        setIsAppraisalModalOpen(false);
                        refreshDashboardData(); // Refresh to show status changed to 'in_progress'
                    }}
                />
            )}


        </div>
    );
}