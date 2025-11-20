import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useLogout } from '../utils/auth'; // CRITICAL: Import the logout hook
import '../hr.css'; 

// --- Helper function to get the current employee's ID ---
const getCurrentEmployeeId = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    return user ? parseInt(user.id, 10) : null; 
};

// =================================================================
// 1. CycleCreationForm Component (Remains the same)
// =================================================================
function CycleCreationForm({ hrId, onCycleCreated }) {
    const [cycleData, setCycleData] = useState({
        cycleName: '',
        startDate: '',
        endDate: '',
    });
    const [statusMessage, setStatusMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        setCycleData({ ...cycleData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatusMessage('Creating cycle...');

        try {
            await api.post('/api/hr/cycles', {
                hrId: hrId,
                ...cycleData,
            });

            setStatusMessage('Cycle created successfully!');
            setCycleData({ cycleName: '', startDate: '', endDate: '' }); 
            onCycleCreated(); // Triggers refresh!
        } catch (error) {
            setStatusMessage(error.response?.data?.error || 'Failed to create cycle.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="cycle-creation-card">
            <h3>➕ Create New Appraisal Cycle</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-row">
                    <div className="form-group"><label htmlFor="cycleName">Cycle Name:</label><input type="text" name="cycleName" value={cycleData.cycleName} onChange={handleChange} required /></div>
                    <div className="form-group"><label htmlFor="startDate">Start Date:</label><input type="date" name="startDate" value={cycleData.startDate} onChange={handleChange} required /></div>
                    <div className="form-group"><label htmlFor="endDate">End Date:</label><input type="date" name="endDate" value={cycleData.endDate} onChange={handleChange} required /></div>
                    <button type="submit" disabled={isSubmitting} className="primary-btn cycle-submit-btn">
                        {isSubmitting ? 'Creating...' : 'Save Cycle'}
                    </button>
                </div>
            </form>
            {statusMessage && <p className="status-message">{statusMessage}</p>}
        </div>
    );
}

// In src/components/DashboardHR.js (Add this component definition)

function FinalizationPanel({ hrId, activeCycleId, onCalculationComplete }) {
    const [statusMessage, setStatusMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleCalculate = async () => {
        if (!activeCycleId) {
            setStatusMessage("Error: Please activate a cycle before calculating ratings.");
            return;
        }

        if (!window.confirm(`WARNING: This will finalize scores for Cycle ID ${activeCycleId}. Proceed?`)) return;
        
        setIsProcessing(true);
        setStatusMessage('Processing... Calculating final scores.');

        try {
            // Call the batch job route
            await api.post('/api/hr/calculate-ratings', {
                hrId: hrId,
                cycleId: activeCycleId
            });

            setStatusMessage(`Calculation complete for Cycle ID ${activeCycleId}! You can now review results.`);
            onCalculationComplete(); // Trigger refresh if needed
        } catch (error) {
            setStatusMessage(error.response?.data?.error || 'Calculation failed.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="finalization-card">
            <h3>📈 Final Ratings & Score Calculation</h3>
            <p><strong>Current Cycle:</strong> {activeCycleId ? `ID ${activeCycleId}` : 'No Active Cycle Found'}</p>
            
            <button 
                onClick={handleCalculate}
                className="primary-btn"
                disabled={isProcessing || !activeCycleId}
                style={{ backgroundColor: isProcessing ? '#f39c12' : '#2980b9' }}
            >
                {isProcessing ? 'CALCULATING SCORES...' : 'Run Final Score Calculation'}
            </button>

            {statusMessage && <p className="status-message" style={{ marginTop: '10px' }}>{statusMessage}</p>}
        </div>
    );
}

// In src/components/DashboardHR.js (Add this component)

// In src/components/DashboardHR.js (RankingTable component)

function RankingTable({ ratings, hrId, onRankUpdate ,onClose}) {
    const [data, setData] = useState(ratings);

    // Handler to save the rank/comments change (called when button is clicked)
    const handleSave = async (ratingId) => {
        // Find the current edited item from the local state
        const itemToSave = data.find(item => item.rating_id === ratingId);
        
        if (!itemToSave || !itemToSave.final_rank) {
            alert("Error: Final Rank cannot be empty.");
            return;
        }
        
        try {
            await api.put(`/api/hr/final-ratings/${ratingId}`, {
                hrId: hrId,
                // CRITICAL FIX: Pass the state values for saving
                finalRank: itemToSave.final_rank,
                finalComments: itemToSave.final_comments || null
            });
            alert("Rank updated!");
            onRankUpdate(); // Refresh table to show update confirmation
        } catch (error) {
            alert(error.response?.data?.error || "Error saving rank.");
        }
    };

    // Handle input changes in the table fields (remains correct)
    const handleInputChange = (ratingId, field, value) => {
        setData(prev => prev.map(item => 
            item.rating_id === ratingId ? { ...item, [field]: value } : item
        ));
    };

    if (data.length === 0) return <p>No employees were found with calculated scores in this cycle.</p>;

    return (
        <div className="ranking-table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Final Score Review & Ranking</h3>
                <button 
                    onClick={onClose} 
                    className="secondary-btn"
                    style={{ backgroundColor: '#ccc', color: '#333' }}
                >
                    Close Review
                </button>
            </div>
            <p>Scores are weighted aggregates of all manager reviews.</p>
            <table className="cycle-list-table">
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Weighted Score (%)</th>
                        <th>Final Rank (Editable)</th>
                        <th>HR Comments (Editable)</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map(item => (
                        <tr key={item.rating_id}>
                            <td>{item.employee_name}</td>
                            <td>
                                {/* FIX 1: Ensure value is a float before fixing */}
                                <strong>{parseFloat(item.weighted_score).toFixed(2)}</strong>
                            </td>
                            <td>
                                <input 
                                    type="text" 
                                    value={item.final_rank || ''} 
                                    onChange={(e) => handleInputChange(item.rating_id, 'final_rank', e.target.value)} 
                                    placeholder="Exceeds, Meets, etc."
                                />
                            </td>
                            <td>
                                <textarea 
                                    value={item.final_comments || ''} 
                                    onChange={(e) => handleInputChange(item.rating_id, 'final_comments', e.target.value)}
                                    rows="1" 
                                />
                            </td>
                            <td>
                                <button 
                                    // FIX 2: Pass only the ID to the save handler
                                    onClick={() => handleSave(item.rating_id)}
                                    className="primary-btn"
                                >
                                    Save
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// =================================================================
// 2. Main DashboardHR Component (The exported function)
// =================================================================
export default function DashboardHR() {
    const logout = useLogout(); // Initialize the logout hook
    const [cycles, setCycles] = useState([]);
    const [hrId, setHrId] = useState(null); 
    const [isLoading, setIsLoading] = useState(true);
    const [activeCycleId, setActiveCycleId] = useState(null);
    const [finalRatings, setFinalRatings] = useState([]);
    const [showRankingTable, setShowRankingTable] = useState(false);

    const fetchFinalRatings = async () => {
        if (!activeCycleId) return;
        try {
            const response = await api.get(`/api/hr/final-ratings/${activeCycleId}`);
            setFinalRatings(response.data);
            setShowRankingTable(true); // Open the table after fetching
        } catch (error) {
            console.error("Failed to fetch final ratings:", error);
            setFinalRatings([]);
            setShowRankingTable(true);
        }
    };


    // Function to fetch data (defined inside component to access setState)
    const fetchCycles = async (currentHrId) => {
        if (!currentHrId) {
             setIsLoading(false);
             return;
        }
        try {
            const response = await api.get('/api/hr/cycles');
            const cycleData = response.data;
            const activeCycle = cycleData.find(cycle => cycle.status === 'active');
            setCycles(cycleData);
            setActiveCycleId(activeCycle ? activeCycle.cycle_id : null);
            
        } catch (error) {
            console.error("Failed to fetch cycles:", error);
        } finally {
            setIsLoading(false);
        }
    };
    // In DashboardHR.js (Define this function inside the main component body)
const handleCalculationComplete = () => {
    // 1. Refresh the cycle list (in case cycle status changed or data needs update)
    fetchCycles(hrId); 
    fetchFinalRatings();
    
    // 2. Optionally: Set a state to automatically open the ranking/review table 
    //    (which we will build next)
    // setIsRankingTableOpen(true); 
};

    // Initial load and ID retrieval
    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user'));
        const currentHrId = user?.id;

        if (currentHrId) {
            setHrId(currentHrId);
            fetchCycles(currentHrId);
        } else {
             setIsLoading(false);
        }
    }, []); 

    // Handler to change a cycle's status
    const handleChangeStatus = async (cycleId, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'closed' : 'active';
        if (!window.confirm(`Are you sure you want to set cycle ${cycleId} to ${newStatus}? This will deactivate all other active cycles.`)) return;

        try {
            await api.put(`/api/hr/cycles/${cycleId}/status`, { hrId, newStatus });
            await fetchCycles(hrId); 
        } catch (error) {
            alert(error.response?.data?.error || "Failed to change status.");
        }
    };
    
    // Handler to pass to the creation form (triggers a refresh)
    const handleCycleCreated = () => {
        fetchCycles(hrId);
    };

    const handleCloseRanking = () => {
        // Hides the ranking table
        setShowRankingTable(false);
        // Optionally, clear the finalRatings data to save memory
        // setFinalRatings([]); 
    };


    if (isLoading) return <div>Loading HR Dashboard...</div>;

    // --- RENDER ---
    return (
        <div className="hr-dashboard-layout">
            {/* --- ADDED LOGOUT HEADER --- */}
            <header className="app-header">
                <h2>👑 Appraisal Cycle Management</h2>
                <button onClick={logout} className="logout-btn">
                    Logout
                </button>
            </header>
            
            <div className="dashboard-content-container">
                <h3 style={{ marginBottom: '15px' }}>
                    Active Cycle ID: {activeCycleId || 'None Active'}
                </h3>
                <FinalizationPanel 
                hrId={hrId} 
                activeCycleId={activeCycleId} // Pass the fetched active cycle ID
                onCalculationComplete={handleCalculationComplete}
            />

                {/* RENDER THE RANKING TABLE (CONDITIONAL) */}
            {activeCycleId && showRankingTable && (
                <RankingTable 
                    ratings={finalRatings} 
                    hrId={hrId} 
                    onRankUpdate={fetchFinalRatings} 
                    onClose={handleCloseRanking}
                />
            )}
                
                <CycleCreationForm hrId={hrId} onCycleCreated={handleCycleCreated} />
                
                <div className="cycle-list-card">
                    <h3>Current and Historical Cycles</h3>
                    <table className="cycle-list-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Cycle Name</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cycles.map(cycle => (
                                <tr key={cycle.cycle_id}>
                                    <td>{cycle.cycle_id}</td>
                                    <td>{cycle.cycle_name}</td>
                                    <td>{cycle.start_date.split('T')[0]}</td>
                                    <td>{cycle.end_date.split('T')[0]}</td>
                                    <td className={`status-${cycle.status}`}>{cycle.status.toUpperCase()}</td>
                                    <td>
                                        {cycle.status !== 'closed' && (
                                            <button 
                                                onClick={() => handleChangeStatus(cycle.cycle_id, cycle.status)}
                                                style={{ backgroundColor: cycle.status === 'active' ? '#e74c3c' : '#2ecc71' }}
                                            >
                                                {cycle.status === 'active' ? 'Close Cycle' : 'Activate Cycle'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}