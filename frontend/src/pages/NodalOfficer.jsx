import { Mail, Phone, MapPin } from 'lucide-react';
import './NodalOfficer.css';

const NodalOfficer = () => {
    return (
        <div className="nodal-page">
            <section className="nodal-hero">
                <div className="container">
                    <h1>Nodal Officer</h1>
                    <p>Contact our nodal officers for grievance redressal</p>
                </div>
            </section>

            <section className="nodal-content section">
                <div className="container">
                    <div className="nodal-grid">
                        {/* Surjit Finance Nodal Officer */}
                        <div className="nodal-card">
                            <h2>Surjit Finance's Nodal Officer Details</h2>
                            <div className="officer-info">
                                <h3>Mr. Jeetendra Pandey</h3>
                                <p className="officer-title">The Nodal Officer, Surjit Hire Purchase Pvt. Ltd.</p>

                                <div className="contact-details">
                                    <div className="contact-row">
                                        <MapPin size={18} />
                                        <address>
                                            248-C, Vijay Nagar,<br />
                                            Krishna Nagar,<br />
                                            Lucknow-226012
                                        </address>
                                    </div>
                                    <div className="contact-row">
                                        <Mail size={18} />
                                        <a href="mailto:cs.ho@surjitfinance.com">cs.ho@surjitfinance.com</a>
                                    </div>
                                    <div className="contact-row">
                                        <Phone size={18} />
                                        <a href="tel:+917042476577">+91-7042476577</a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Arthmate Nodal Officer */}
                        <div className="nodal-card">
                            <h2>Arthmate's Nodal Officer Details</h2>
                            <div className="officer-info">
                                <h3>Mr. Hitesh Bhansali</h3>
                                <p className="officer-title">The Nodal Officer, Mamta Projects Pvt. Ltd</p>

                                <div className="contact-details">
                                    <div className="contact-row">
                                        <MapPin size={18} />
                                        <address>
                                            Room No. 1528, 15th Floor,<br />
                                            Bengal Intelligent Eco EM-3,<br />
                                            Sector-V, Salt Lake City<br />
                                            Kolkata-700091
                                        </address>
                                    </div>
                                    <div className="contact-row">
                                        <Mail size={18} />
                                        <a href="mailto:statutory.compliance@arthmate.com">statutory.compliance@arthmate.com</a>
                                    </div>
                                    <div className="contact-row">
                                        <Phone size={18} />
                                        <a href="tel:+918336901719">+91-8336901719</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default NodalOfficer;
