import './TeamMember.css';

const TeamMember = ({
    name,
    title,
    description,
    image = null,
    initials = ''
}) => {
    const getInitials = () => {
        if (initials) return initials;
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className="team-member">
            <div className="member-avatar">
                {image ? (
                    <img src={image} alt={name} />
                ) : (
                    <div className="avatar-placeholder">
                        <span>{getInitials()}</span>
                    </div>
                )}
            </div>
            <div className="member-info">
                <h4 className="member-name">{name}</h4>
                <p className="member-title">{title}</p>
                {description && (
                    <p className="member-description">{description}</p>
                )}
            </div>
        </div>
    );
};

export default TeamMember;
