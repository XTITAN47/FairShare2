const Logo = ({ className = '' }) => (
    <svg
        className={`fairshare-logo ${className}`.trim()}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        role="img"
        aria-label="FairShare"
    >
        <rect width="48" height="48" rx="12" fill="#17232f" />
        <path d="M23 10a14 14 0 0 0 0 28z" fill="#3ddc97" />
        <path d="M25 10a14 14 0 0 1 0 28z" fill="#f5a65b" />
    </svg>
);

export default Logo;
