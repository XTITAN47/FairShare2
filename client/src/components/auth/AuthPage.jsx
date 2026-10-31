import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import Logo from '../layout/Logo';
import './AuthPage.css';

const AuthPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [mode, setMode] = useState(location.pathname === '/register' ? 'register' : 'login');

    useEffect(() => {
        setMode(location.pathname === '/register' ? 'register' : 'login');
    }, [location.pathname]);

    const switchMode = (nextMode) => {
        setMode(nextMode);
        navigate(nextMode === 'register' ? '/register' : '/login', { replace: true });
    };

    return (
        <main className="auth-page">
            <div className="auth-shell">
                <aside className="auth-brand">
                    <a href="/" className="auth-brand-logo">
                        <Logo />
                        <span>Fair<span>Share</span></span>
                    </a>
                    <div>
                        <h1>Split fairly.<br />Settle simply.</h1>
                        <p>Track shared expenses with your groups in one place.</p>
                    </div>
                </aside>
                <div className="auth-form">
                    <div className={`auth-track auth-track-${mode}`}>
                        <div className="auth-pane auth-pane-login">
                            <Login onSwitchMode={() => switchMode('register')} />
                        </div>
                        <div className="auth-pane auth-pane-register">
                            <Register onSwitchMode={() => switchMode('login')} />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default AuthPage;
