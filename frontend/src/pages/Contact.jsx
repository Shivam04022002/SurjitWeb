import { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send } from 'lucide-react';
import './Contact.css';

const Contact = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
    });
    const [submitted, setSubmitted] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });
            const data = await response.json();

            if (data.success) {
                setSubmitted(true);
                setTimeout(() => setSubmitted(false), 3000);
                setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
            } else {
                console.error('Validation errors:', data.errors);
                alert('Failed to submit: ' + (data.message || 'Please check your inputs'));
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('Failed to connect to the server. Please try again later.');
        }
    };

    const branches = [
        {
            name: 'Registered Office',
            address: '248-C, Vijay Nagar, Krishna Nagar, Alambagh, Lucknow, Uttar Pradesh 226012'
        },
        {
            name: 'Kanpur Branch',
            address: '34-Chanakyapuri, Shyam Nagar, Near Jagriti Palace, Kanpur, Uttar Pradesh 208015'
        },
        {
            name: 'Agra Branch',
            address: '6/1, Ist floor, Nai Ki Mandi Police Chowki, Subhash Park Crossing, Mahatma Gandhi Rd, Agra, Uttar Pradesh 282010'
        },
        {
            name: 'Varanasi Branch',
            address: 'FF-04, Ist floor Urvashi Complex, Gandhi Nagar, opposite Sigra Petrol Pump, Varanasi, Uttar Pradesh 221001'
        },
        {
            name: 'Indore Branch',
            address: 'IInd floor, Building No. 4, Chandra Lok Colony, Khajrana Main Road, Indore, Madhya Pradesh 452016'
        },
        {
            name: 'Jaipur Branch',
            address: '7 Gopalpura Bypass Road, Vasundhara Colony, Gopal Pura Mode, Jaipur, Rajasthan 302018'
        }
    ];

    return (
        <div className="contact-page">
            {/* Hero */}
            <section className="contact-hero">
                <div className="container">
                    <h1>Contact Us</h1>
                    <p>Get in touch with us today. We're here to help!</p>
                </div>
            </section>

            {/* Contact Info + Form */}
            <section className="contact-main section">
                <div className="container">
                    <div className="contact-grid">
                        {/* Contact Info */}
                        <div className="contact-info">
                            <h2>Get in Touch Today</h2>
                            <p>Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.</p>

                            <div className="contact-details">
                                <div className="contact-item">
                                    <div className="contact-icon">
                                        <Phone size={24} />
                                    </div>
                                    <div>
                                        <h4>Phone</h4>
                                        <a href="tel:1800-3131-265">1800-3131-265 (Toll Free)</a>
                                    </div>
                                </div>

                                <div className="contact-item">
                                    <div className="contact-icon">
                                        <Mail size={24} />
                                    </div>
                                    <div>
                                        <h4>Email</h4>
                                        <a href="mailto:info@surjitfinance.com">info@surjitfinance.com</a>
                                    </div>
                                </div>

                                <div className="contact-item">
                                    <div className="contact-icon">
                                        <MapPin size={24} />
                                    </div>
                                    <div>
                                        <h4>Head Office</h4>
                                        <address>
                                            39-C/2, Krishna Nagar, Alambagh,<br />
                                            Lucknow, Uttar Pradesh - 226023
                                        </address>
                                    </div>
                                </div>

                                <div className="contact-item">
                                    <div className="contact-icon">
                                        <Clock size={24} />
                                    </div>
                                    <div>
                                        <h4>Working Hours</h4>
                                        <p>Mon - Sat: 10:00 AM - 6:00 PM</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contact Form */}
                        <div className="contact-form-wrapper">
                            <form onSubmit={handleSubmit} className="contact-form">
                                <h3>Send us a Message</h3>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Full Name</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="form-input"
                                            placeholder="Enter your name"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone Number</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="form-input"
                                            placeholder="Enter your phone"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Email Address</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="form-input"
                                        placeholder="Enter your email"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Subject</label>
                                    <input
                                        type="text"
                                        name="subject"
                                        value={formData.subject}
                                        onChange={handleChange}
                                        className="form-input"
                                        placeholder="How can we help?"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Message</label>
                                    <textarea
                                        name="message"
                                        value={formData.message}
                                        onChange={handleChange}
                                        className="form-input form-textarea"
                                        placeholder="Write your message here..."
                                        rows="5"
                                        required
                                    ></textarea>
                                </div>

                                <button type="submit" className="btn btn-primary btn-lg w-full">
                                    <Send size={18} />
                                    Send Message
                                </button>

                                {submitted && (
                                    <div className="form-success">
                                        Thank you! Your message has been sent successfully.
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            {/* Branch Locations */}
            <section className="branches-section section">
                <div className="container">
                    <div className="section-header">
                        <h2>Our Branches</h2>
                        <p>Visit us at any of our branch locations across India</p>
                    </div>
                    <div className="branches-grid">
                        {branches.map((branch, index) => (
                            <div key={index} className="branch-card">
                                <div className="branch-icon">
                                    <MapPin size={24} />
                                </div>
                                <h4>{branch.name}</h4>
                                <address>{branch.address}</address>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Contact;
