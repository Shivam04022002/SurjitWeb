import { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Upload, User, Briefcase, FileText, CreditCard } from 'lucide-react';
import './LoanApplication.css';

const LoanApplication = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        // Personal Info
        fullName: '',
        email: '',
        phone: '',
        dob: '',
        gender: '',
        pan: '',
        aadhaar: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        // Loan Details
        loanType: '',
        loanAmount: '',
        loanPurpose: '',
        tenure: '',
        // Employment
        employmentType: '',
        businessName: '',
        businessType: '',
        monthlyIncome: '',
        workExperience: ''
    });
    const [loanFiles, setLoanFiles] = useState({
        aadhaarDoc: null,
        panDoc: null,
        bankStatementDoc: null,
        businessProofDoc: null
    });
    const [submitted, setSubmitted] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleFileChange = (e, fileKey) => {
        setLoanFiles({
            ...loanFiles,
            [fileKey]: e.target.files[0]
        });
    };

    const nextStep = () => {
        setStep(step + 1);
        window.scrollTo(0, 0);
    };

    const prevStep = () => {
        setStep(step - 1);
        window.scrollTo(0, 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const dataToSubmit = new FormData();

            // Append text fields
            Object.keys(formData).forEach(key => {
                dataToSubmit.append(key, formData[key]);
            });

            // Append file fields
            Object.keys(loanFiles).forEach(key => {
                if (loanFiles[key]) {
                    dataToSubmit.append(key, loanFiles[key]);
                }
            });

            const response = await fetch(`${import.meta.env.VITE_API_URL}/loan-application`, {
                method: 'POST',
                // Content-Type is automatically set with standard boundary for FormData
                body: dataToSubmit,
            });
            const data = await response.json();

            if (data.success) {
                setSubmitted(true);
            } else {
                console.error('Validation errors:', data.errors);
                alert('Failed to submit: ' + (data.message || 'Please check your inputs'));
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('Failed to connect to the server. Please try again later.');
        }
    };

    const steps = [
        { number: 1, title: 'Personal Info', icon: User },
        { number: 2, title: 'Loan Details', icon: CreditCard },
        { number: 3, title: 'Employment', icon: Briefcase },
        { number: 4, title: 'Documents', icon: FileText }
    ];

    if (submitted) {
        return (
            <div className="loan-application-page">
                <div className="application-success">
                    <div className="success-icon">
                        <Check size={48} />
                    </div>
                    <h2>Application Submitted Successfully!</h2>
                    <p>Thank you for applying at Surjit Finance. Our team will review your application and contact you within 24-48 hours.</p>
                    <p className="reference">Reference Number: SF{Date.now().toString().slice(-8)}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="loan-application-page">
            {/* Hero */}
            <section className="application-hero">
                <div className="container">
                    <h1>Loan Application</h1>
                    <p>Apply for a loan in just a few simple steps</p>
                </div>
            </section>

            {/* Progress Steps */}
            <section className="progress-section">
                <div className="container">
                    <div className="progress-steps">
                        {steps.map((s, index) => (
                            <div key={index} className={`step ${step >= s.number ? 'active' : ''} ${step > s.number ? 'completed' : ''}`}>
                                <div className="step-circle">
                                    {step > s.number ? <Check size={18} /> : <s.icon size={18} />}
                                </div>
                                <span className="step-title">{s.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Form */}
            <section className="application-form-section">
                <div className="container">
                    <form onSubmit={handleSubmit} className="application-form">
                        {/* Step 1: Personal Info */}
                        {step === 1 && (
                            <div className="form-step">
                                <h2>Personal Information</h2>
                                <p>Please provide your basic details</p>

                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label">Full Name *</label>
                                        <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="form-input" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email Address *</label>
                                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="form-input" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone Number *</label>
                                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="form-input" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Date of Birth *</label>
                                        <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="form-input" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Gender *</label>
                                        <select name="gender" value={formData.gender} onChange={handleChange} className="form-input form-select" required>
                                            <option value="">Select Gender</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">PAN Number *</label>
                                        <input type="text" name="pan" value={formData.pan} onChange={handleChange} className="form-input" maxLength="10" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Aadhaar Number *</label>
                                        <input type="text" name="aadhaar" value={formData.aadhaar} onChange={handleChange} className="form-input" maxLength="12" required />
                                    </div>
                                    <div className="form-group full-width">
                                        <label className="form-label">Address *</label>
                                        <input type="text" name="address" value={formData.address} onChange={handleChange} className="form-input" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">City *</label>
                                        <input type="text" name="city" value={formData.city} onChange={handleChange} className="form-input" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">State *</label>
                                        <select name="state" value={formData.state} onChange={handleChange} className="form-input form-select" required>
                                            <option value="">Select State</option>
                                            <option value="UP">Uttar Pradesh</option>
                                            <option value="MP">Madhya Pradesh</option>
                                            <option value="RJ">Rajasthan</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">PIN Code *</label>
                                        <input type="text" name="pincode" value={formData.pincode} onChange={handleChange} className="form-input" maxLength="6" required />
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button type="button" onClick={nextStep} className="btn btn-primary btn-lg">
                                        Next Step
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Loan Details */}
                        {step === 2 && (
                            <div className="form-step">
                                <h2>Loan Details</h2>
                                <p>Tell us about the loan you need</p>

                                <div className="form-grid">
                                    <div className="form-group full-width">
                                        <label className="form-label">Loan Type *</label>
                                        <div className="loan-type-cards">
                                            {[
                                                { value: 'business', label: 'Business Loan', icon: '💼' },
                                                { value: 'vehicle', label: 'Vehicle Loan', icon: '🛺' },
                                                { value: 'lap', label: 'Micro LAP', icon: '🏠' }
                                            ].map((type) => (
                                                <label key={type.value} className={`loan-type-card ${formData.loanType === type.value ? 'selected' : ''}`}>
                                                    <input type="radio" name="loanType" value={type.value} checked={formData.loanType === type.value} onChange={handleChange} />
                                                    <span className="card-icon">{type.icon}</span>
                                                    <span className="card-label">{type.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Loan Amount Required *</label>
                                        <input type="number" name="loanAmount" value={formData.loanAmount} onChange={handleChange} className="form-input" placeholder="Enter amount" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Preferred Tenure *</label>
                                        <select name="tenure" value={formData.tenure} onChange={handleChange} className="form-input form-select" required>
                                            <option value="">Select Tenure</option>
                                            <option value="12">12 Months</option>
                                            <option value="18">18 Months</option>
                                            <option value="24">24 Months</option>
                                            <option value="36">36 Months</option>
                                            <option value="60">60 Months</option>
                                        </select>
                                    </div>
                                    <div className="form-group full-width">
                                        <label className="form-label">Purpose of Loan *</label>
                                        <textarea name="loanPurpose" value={formData.loanPurpose} onChange={handleChange} className="form-input form-textarea" placeholder="Describe the purpose of this loan..." required></textarea>
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button type="button" onClick={prevStep} className="btn btn-secondary btn-lg">
                                        <ArrowLeft size={18} />
                                        Previous
                                    </button>
                                    <button type="button" onClick={nextStep} className="btn btn-primary btn-lg">
                                        Next Step
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Employment */}
                        {step === 3 && (
                            <div className="form-step">
                                <h2>Employment Details</h2>
                                <p>Tell us about your work and income</p>

                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label">Employment Type *</label>
                                        <select name="employmentType" value={formData.employmentType} onChange={handleChange} className="form-input form-select" required>
                                            <option value="">Select Type</option>
                                            <option value="self-employed">Self Employed</option>
                                            <option value="business-owner">Business Owner</option>
                                            <option value="salaried">Salaried</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Business/Company Name</label>
                                        <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Business Type</label>
                                        <select name="businessType" value={formData.businessType} onChange={handleChange} className="form-input form-select">
                                            <option value="">Select Type</option>
                                            <option value="retail">Retail</option>
                                            <option value="manufacturing">Manufacturing</option>
                                            <option value="services">Services</option>
                                            <option value="trading">Trading</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Monthly Income *</label>
                                        <input type="number" name="monthlyIncome" value={formData.monthlyIncome} onChange={handleChange} className="form-input" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Work Experience *</label>
                                        <select name="workExperience" value={formData.workExperience} onChange={handleChange} className="form-input form-select" required>
                                            <option value="">Select Experience</option>
                                            <option value="0-1">0-1 Years</option>
                                            <option value="1-3">1-3 Years</option>
                                            <option value="3-5">3-5 Years</option>
                                            <option value="5+">5+ Years</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button type="button" onClick={prevStep} className="btn btn-secondary btn-lg">
                                        <ArrowLeft size={18} />
                                        Previous
                                    </button>
                                    <button type="button" onClick={nextStep} className="btn btn-primary btn-lg">
                                        Next Step
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Documents */}
                        {step === 4 && (
                            <div className="form-step">
                                <h2>Document Upload</h2>
                                <p>Upload the required documents</p>

                                <div className="documents-grid">
                                    {[
                                        { label: 'Aadhaar Card', desc: 'Front and back side', id: 'aadhaarDoc' },
                                        { label: 'PAN Card', desc: 'Clear copy', id: 'panDoc' },
                                        { label: 'Bank Statement', desc: 'Last 6 months', id: 'bankStatementDoc' },
                                        { label: 'Business Proof', desc: 'GST/Shop Act/Trade License', id: 'businessProofDoc' }
                                    ].map((doc, index) => (
                                        <div key={index} className="document-upload">
                                            <div className="upload-icon">
                                                <Upload size={24} />
                                            </div>
                                            <h4>{doc.label}</h4>
                                            <p>{loanFiles[doc.id] ? loanFiles[doc.id].name : doc.desc}</p>
                                            <input type="file" id={doc.id} onChange={(e) => handleFileChange(e, doc.id)} hidden />
                                            <label htmlFor={doc.id} className="btn btn-secondary btn-sm">
                                                {loanFiles[doc.id] ? 'Change File' : 'Choose File'}
                                            </label>
                                        </div>
                                    ))}
                                </div>

                                <div className="form-consent">
                                    <label className="consent-check">
                                        <input type="checkbox" required />
                                        <span>I agree to the Terms & Conditions and authorize Surjit Finance to verify my information</span>
                                    </label>
                                </div>

                                <div className="form-actions">
                                    <button type="button" onClick={prevStep} className="btn btn-secondary btn-lg">
                                        <ArrowLeft size={18} />
                                        Previous
                                    </button>
                                    <button type="submit" className="btn btn-accent btn-lg">
                                        Submit Application
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </section>
        </div>
    );
};

export default LoanApplication;
