// src/utils/auth.js
import { useNavigate } from 'react-router-dom';

export const useLogout = () => {
    const navigate = useNavigate();

    const logout = () => {
        // 1. Clear the user data from browser storage (CRITICAL STEP)
        localStorage.removeItem('user');
        
        // 2. Clear any session tokens (if you were using JWTs)
        // localStorage.removeItem('authToken'); 

        // 3. Redirect the user to the login page
        navigate('/login');
    };

    return logout;
};