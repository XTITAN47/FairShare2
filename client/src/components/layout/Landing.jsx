import { useContext, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import './Landing.css';

const Landing = () => {
    const { isAuthenticated } = useContext(AuthContext);
    const storyRef = useRef(null);
    const [storyProgress, setStoryProgress] = useState(0);

    useEffect(() => {
        let frameId = 0;
        let progress = 0;
        const updateStoryProgress = () => {
            frameId = 0;
            if (!storyRef.current) return;
            const bounds = storyRef.current.getBoundingClientRect();
            const travel = Math.max(bounds.height - window.innerHeight, 1);
            const nextProgress = Math.min(Math.max(-bounds.top / travel, 0), 1);
            if (Math.abs(nextProgress - progress) < 0.002) return;
            progress = nextProgress;
            setStoryProgress(nextProgress);
        };
        const requestStoryProgress = () => {
            if (!frameId) frameId = window.requestAnimationFrame(updateStoryProgress);
        };

        updateStoryProgress();
        window.addEventListener('scroll', requestStoryProgress, { passive: true });
        window.addEventListener('resize', requestStoryProgress);
        return () => {
            window.removeEventListener('scroll', requestStoryProgress);
            window.removeEventListener('resize', requestStoryProgress);
            if (frameId) window.cancelAnimationFrame(frameId);
        };
    }, []);

    // Add landing class to body when component mounts and remove when unmounts
    useEffect(() => {
        document.body.classList.add('has-landing-page');
        
        return () => {
            document.body.classList.remove('has-landing-page');
        };
    }, []);

    if (isAuthenticated) {
        return <Navigate to="/dashboard" />;
    }

    const members = ['Member 1', 'Member 2', 'Member 3', 'Member 4'];
    const features = [
        ['Split any way', 'Equal, exact or percentage splits for every expense.', 'green'],
        ['QR group invites', 'Add people by scanning a code. No links to chase.', 'amber'],
        ['Expense analysis', 'See who spent what and where the money went.', 'green'],
        ['Easy settlements', 'Know exactly who owes whom and mark payments done.', 'amber']
    ];

    return (
        <section className="landing">
            <section className="landing-hero">
                <p className="landing-eyebrow">Group expense splitting</p>
                <h1>Split every bill fairly.</h1>
                <p className="landing-description">
                    FairShare keeps shared costs clear for trips, flats and teams. Add an expense and every member instantly sees their share.
                </p>
                <div className="landing-actions">
                    <Link to="/register" className="landing-button">Get started</Link>
                    <a href="#story" className="landing-button landing-button-ghost">See how it works</a>
                </div>
            </section>

            <section className="story" ref={storyRef} id="story" aria-label="How FairShare splits expenses">
                <div className="story-sticky">
                    <h2>One bill. Four members. Zero math.</h2>
                    <p className="story-caption">
                        {storyProgress > 0.98 ? 'Everyone pays ₹3,000. Fair and square.' : 'Keep scrolling to split ₹12,000'}
                    </p>
                    <div className="story-pot" style={{ '--story-progress': storyProgress }}>
                        <span className="story-pot-label">Left to split</span>
                        <strong>₹{Math.round(12000 * (1 - storyProgress)).toLocaleString('en-IN')}</strong>
                        <div className="story-progress" aria-hidden="true">
                            <span style={{ width: `${storyProgress * 100}%` }} />
                        </div>
                    </div>
                    <div className="member-cards">
                        {members.map((name, index) => (
                            <div
                                className="member-card"
                                key={name}
                                style={{ '--member-progress': storyProgress }}
                            >
                                <div className="member-card-header">
                                    <span className="member-card-icon">{index + 1}</span>
                                    <span className="member-card-name">{name}</span>
                                </div>
                                <strong>₹{Math.round(3000 * storyProgress).toLocaleString('en-IN')}</strong>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="landing-features" id="features">
                <h2>Everything a group needs</h2>
                <div className="feature-grid">
                    {features.map(([title, description, color]) => (
                        <article className="feature-card" key={title}>
                            <span className={`feature-accent feature-accent-${color}`} />
                            <h3>{title}</h3>
                            <p>{description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="landing-cta">
                <h2>Ready to split the next bill?</h2>
                <Link to="/register" className="landing-button">Create your account</Link>
            </section>
            <footer className="landing-footer">FairShare. Split fairly, settle simply.</footer>
        </section>
    );
};

export default Landing; 