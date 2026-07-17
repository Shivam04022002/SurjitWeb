import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import './ProductCard.css';

const ProductCard = ({
    title,
    description,
    icon,
    features = [],
    link,
    gradient = 'primary',
    highlight = false
}) => {
    const gradients = {
        primary: 'linear-gradient(135deg, var(--primary-500) 0%, var(--primary-700) 100%)',
        secondary: 'linear-gradient(135deg, var(--secondary-500) 0%, var(--secondary-700) 100%)',
        accent: 'linear-gradient(135deg, var(--accent-500) 0%, var(--accent-600) 100%)',
    };

    return (
        <div className={`product-card ${highlight ? 'highlight' : ''}`}>
            <div
                className="product-icon"
                style={{ background: gradients[gradient] }}
            >
                <span>{icon}</span>
            </div>
            <h3 className="product-title">{title}</h3>
            <p className="product-description">{description}</p>

            {features.length > 0 && (
                <ul className="product-features">
                    {features.map((feature, index) => (
                        <li key={index}>
                            <Check size={16} />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
            )}

            <div className="product-actions">
                <Link to={link} className="btn btn-primary">
                    Learn More
                    <ArrowRight size={18} />
                </Link>
                <Link to="/loan-application" className="btn btn-secondary">
                    Apply Now
                </Link>
            </div>
        </div>
    );
};

export default ProductCard;
