import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import Logo from './Logo';

const Navbar = () => {
    const { user, isAuthenticated, setUser, setIsAuthenticated } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [isLandingPage, setIsLandingPage] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [scrollDirection, setScrollDirection] = useState('up');
    const [profileOpen, setProfileOpen] = useState(false);
    const profileMenuRef = useRef(null);
    
    useEffect(() => {
        setIsLandingPage(location.pathname === '/');
    }, [location]);

    useEffect(() => {
        let previousScroll = window.scrollY;
        let frameId = 0;
        let nextScroll = previousScroll;
        const handleScroll = () => {
            frameId = 0;
            const currentScroll = nextScroll;
            setIsScrolled(currentScroll > 12);
            if (Math.abs(currentScroll - previousScroll) > 4) {
                setScrollDirection(currentScroll > previousScroll ? 'down' : 'up');
                previousScroll = currentScroll;
            }
        };
        const requestScrollUpdate = () => {
            nextScroll = window.scrollY;
            if (!frameId) frameId = window.requestAnimationFrame(handleScroll);
        };

        handleScroll();
        window.addEventListener('scroll', requestScrollUpdate, { passive: true });
        return () => {
            window.removeEventListener('scroll', requestScrollUpdate);
            if (frameId) window.cancelAnimationFrame(frameId);
        };
    }, []);

    useEffect(() => {
        const closeProfileMenu = (event) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setProfileOpen(false);
            }
        };
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setProfileOpen(false);
        };

        document.addEventListener('mousedown', closeProfileMenu);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('mousedown', closeProfileMenu);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, []);

    const handleLogout = () => {
        // Clear user data and token
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);

        // Redirect to login
        navigate('/login');
    };
    
    // Get user's first initial for profile avatar
    const getUserInitial = () => {
        if (user && user.name) {
            return user.name.charAt(0).toUpperCase();
        }
        return 'U';
    };

    const authLinks = (
        <ul>
            <li>
                <Link to="/dashboard">
                    <i className="fas fa-th-large"></i> Dashboard
                </Link>
            </li>
            <li className="profile-menu-item" ref={profileMenuRef}>
                <button
                    type="button"
                    className="profile-link profile-trigger"
                    aria-expanded={profileOpen}
                    aria-haspopup="menu"
                    onClick={() => setProfileOpen((open) => !open)}
                >
                    <div className="profile-avatar">
                        {getUserInitial()}
                    </div>
                    <span>Profile</span>
                    <i className="fas fa-chevron-down profile-chevron"></i>
                </button>
                {profileOpen && (
                    <div className="profile-dropdown" role="menu">
                        <div className="profile-dropdown-heading">
                            <strong>{user?.name || 'Your account'}</strong>
                            <span>{user?.email}</span>
                        </div>
                        <Link to="/profile" role="menuitem" onClick={() => setProfileOpen(false)}>
                            <i className="fas fa-user"></i> Profile
                        </Link>
                        <button type="button" role="menuitem" onClick={handleLogout}>
                            <i className="fas fa-sign-out-alt"></i> Logout
                        </button>
                    </div>
                )}
            </li>
        </ul>
    );

    const guestLinks = (
        <ul>
            {isLandingPage ? (
                <>
                    <li><a href="#story">How it works</a></li>
                    <li><a href="#features">Features</a></li>
                    <li>
                        <Link to="/login" className="login-btn">
                            Log in
                        </Link>
                    </li>
                    <li><Link to="/register" className="signup-btn">Get started</Link></li>
                </>
            ) : (
                <>
                    <li>
                        <Link to="/login" className="login-btn">
                            Log in
                        </Link>
                    </li>
                    <li>
                        <Link to="/register" className="signup-btn">
                            <i className="fas fa-user-plus"></i> Sign up
                        </Link>
                    </li>
                </>
            )}
        </ul>
    );

    return (
        <nav className={`navbar ${isLandingPage ? 'navbar-landing' : ''} ${isScrolled ? 'navbar-scrolled' : ''} navbar-scroll-${scrollDirection}`}>
            <div className="container navbar-container">
                <h1>
                    <Link to="/" className="brand">
                        <Logo className="navbar-logo" />
                        <span className="brand-text">
                            <span className="brand-highlight">Fair</span>
                            <span>Share</span>
                        </span>
                    </Link>
                </h1>
                <div className="navbar-links">
                    {isAuthenticated ? authLinks : guestLinks}
                </div>
            </div>
        </nav>
    );
};

export default Navbar; 