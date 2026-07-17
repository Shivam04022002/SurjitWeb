import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, User, Mail, Phone, MapPin, Briefcase, Check, ArrowLeft, Send } from 'lucide-react';
import './JobApply.css';
import { submitJobApplication } from '../services/api';

const JobApply = () => {
    const { jobTitle } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const jobId = searchParams.get('jobId');
    const [formData, setFormData] = useState({
        jobTitle: decodeURIComponent(jobTitle || ''),
        name: '',
        email: '',
        phone: '',
        experience: '',
        location: ''
    });
    const [resume, setResume] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleFileChange = (e) => {
        setResume(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const dataToSubmit = new FormData();
            dataToSubmit.append('applicantName', formData.name);
            dataToSubmit.append('email', formData.email);
            dataToSubmit.append('phone', formData.phone);
            dataToSubmit.append('experience', formData.experience);
            dataToSubmit.append('preferredLocation', formData.location);
            dataToSubmit.append('jobTitle', formData.jobTitle);
            if (jobId) dataToSubmit.append('jobId', jobId);
            if (resume) dataToSubmit.append('resume', resume);

            const response = await submitJobApplication(dataToSubmit);

            if (response.data.success) {
                setSubmitted(true);
            } else {
                alert('Failed to submit: ' + (response.data.message || 'Please check your inputs'));
            }
        } catch (error) {
            console.error('Error submitting application:', error);
            alert(error?.response?.data?.message || 'Failed to connect to the server. Please try again later.');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="job-apply-page">
                <div className="container">
                    <div className="apply-success-card">
                        <div className="success-icon">
                            <Check size={48} />
                        </div>
                        <h2>Application Submitted!</h2>
                        <p>Thank you for applying for the <strong>{formData.jobTitle}</strong> position. Our HR team will review your profile and get back to you soon.</p>
                        <button onClick={() => navigate('/career')} className="btn btn-primary">
                            Back to Careers
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="job-apply-page">
            <section className="apply-hero">
                <div className="container">
                    <button onClick={() => navigate('/career')} className="back-btn">
                        <ArrowLeft size={20} />
                        Back to Careers
                    </button>
                    <h1>Apply for Position</h1>
                    <p className="job-badge">{formData.jobTitle}</p>
                </div>
            </section>

            <section className="apply-form-section section">
                <div className="container">
                    <div className="form-container">
                        <form onSubmit={handleSubmit} className="apply-form">
                            <div className="form-section-title">
                                <User size={20} />
                                <h3>Personal Information</h3>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Full Name *</label>
                                    <div className="input-with-icon">
                                        <User size={18} className="input-icon" />
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="form-input"
                                            placeholder="John Doe"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Email Address *</label>
                                    <div className="input-with-icon">
                                        <Mail size={18} className="input-icon" />
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="form-input"
                                            placeholder="john@example.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Phone Number *</label>
                                    <div className="input-with-icon">
                                        <Phone size={18} className="input-icon" />
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="form-input"
                                            placeholder="Enter phone number"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Preferred Location *</label>
                                    <div className="input-with-icon">
                                        <MapPin size={18} className="input-icon" />
                                        <input
                                            type="text"
                                            name="location"
                                            value={formData.location}
                                            onChange={handleChange}
                                            className="form-input"
                                            placeholder="e.g. Lucknow, Kanpur"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-section-title mt-8">
                                <Briefcase size={20} />
                                <h3>Professional Details</h3>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Total Experience *</label>
                                    <select
                                        name="experience"
                                        value={formData.experience}
                                        onChange={handleChange}
                                        className="form-input form-select"
                                        required
                                    >
                                        <option value="">Select Experience</option>
                                        <option value="Fresher">Fresher (0 years)</option>
                                        <option value="1-2 Years">1-2 Years</option>
                                        <option value="3-5 Years">3-5 Years</option>
                                        <option value="5-10 Years">5-10 Years</option>
                                        <option value="10+ Years">10+ Years</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Resume / CV *</label>
                                    <div className="file-upload-container">
                                        <input
                                            type="file"
                                            id="resume"
                                            onChange={handleFileChange}
                                            accept=".pdf,.doc,.docx"
                                            hidden
                                            required
                                        />
                                        <label htmlFor="resume" className="file-upload-label">
                                            <Upload size={24} />
                                            <span>{resume ? resume.name : 'Upload your resume (PDF/DOC)'}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="form-actions mt-8">
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-lg w-full"
                                    disabled={submitting}
                                >
                                    {submitting ? 'Submitting...' : (
                                        <>
                                            Submit Application
                                            <Send size={18} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default JobApply;
