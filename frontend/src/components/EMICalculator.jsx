import { useState, useEffect } from 'react';
import { Calculator, TrendingDown, Clock, IndianRupee } from 'lucide-react';
import './EMICalculator.css';

const EMICalculator = ({ loanType = 'Business Loan' }) => {
    const [loanAmount, setLoanAmount] = useState(100000);
    const [interestRate, setInterestRate] = useState(24);
    const [tenure, setTenure] = useState(24);
    const [emi, setEmi] = useState(0);
    const [totalInterest, setTotalInterest] = useState(0);
    const [totalPayment, setTotalPayment] = useState(0);

    useEffect(() => {
        calculateEMI();
    }, [loanAmount, interestRate, tenure]);

    const calculateEMI = () => {
        const principal = loanAmount;
        const rate = interestRate / 12 / 100;
        const time = tenure;

        if (rate === 0) {
            const emiValue = principal / time;
            setEmi(emiValue);
            setTotalPayment(principal);
            setTotalInterest(0);
        } else {
            const emiValue = (principal * rate * Math.pow(1 + rate, time)) / (Math.pow(1 + rate, time) - 1);
            const totalPay = emiValue * time;
            const totalInt = totalPay - principal;

            setEmi(emiValue);
            setTotalPayment(totalPay);
            setTotalInterest(totalInt);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    };

    const principalPercent = (loanAmount / totalPayment) * 100;
    const interestPercent = (totalInterest / totalPayment) * 100;

    return (
        <section className="emi-calculator section" id="emi-calculator">
            <div className="container">
                <div className="section-header">
                    <div className="section-badge">
                        <Calculator size={18} />
                        <span>EMI Calculator</span>
                    </div>
                    <h2>Calculate Your Monthly EMI</h2>
                    <p>Plan your finances better with our easy-to-use EMI calculator</p>
                </div>

                <div className="calculator-wrapper">
                    <div className="calculator-inputs">
                        <div className="input-group">
                            <div className="input-header">
                                <label>Loan Amount</label>
                                <span className="input-value">{formatCurrency(loanAmount)}</span>
                            </div>
                            <input
                                type="range"
                                min="10000"
                                max="500000"
                                step="5000"
                                value={loanAmount}
                                onChange={(e) => setLoanAmount(Number(e.target.value))}
                                className="range-slider"
                            />
                            <div className="range-labels">
                                <span>₹10,000</span>
                                <span>₹5,00,000</span>
                            </div>
                        </div>

                        <div className="input-group">
                            <div className="input-header">
                                <label>Interest Rate (per annum)</label>
                                <span className="input-value">{interestRate}%</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="36"
                                step="0.5"
                                value={interestRate}
                                onChange={(e) => setInterestRate(Number(e.target.value))}
                                className="range-slider"
                            />
                            <div className="range-labels">
                                <span>10%</span>
                                <span>36%</span>
                            </div>
                        </div>

                        <div className="input-group">
                            <div className="input-header">
                                <label>Loan Tenure (months)</label>
                                <span className="input-value">{tenure} Months</span>
                            </div>
                            <input
                                type="range"
                                min="6"
                                max="120"
                                step="6"
                                value={tenure}
                                onChange={(e) => setTenure(Number(e.target.value))}
                                className="range-slider"
                            />
                            <div className="range-labels">
                                <span>6 Months</span>
                                <span>120 Months</span>
                            </div>
                        </div>
                    </div>

                    <div className="calculator-results">
                        <div className="result-card emi-card">
                            <div className="result-icon">
                                <IndianRupee size={24} />
                            </div>
                            <div className="result-content">
                                <span className="result-label">Monthly EMI</span>
                                <span className="result-value">{formatCurrency(emi)}</span>
                            </div>
                        </div>

                        <div className="result-breakdown">
                            <div className="breakdown-chart">
                                <svg viewBox="0 0 200 200" className="donut-chart">
                                    <circle
                                        cx="100"
                                        cy="100"
                                        r="80"
                                        fill="none"
                                        stroke="var(--primary-100)"
                                        strokeWidth="25"
                                    />
                                    <circle
                                        cx="100"
                                        cy="100"
                                        r="80"
                                        fill="none"
                                        stroke="var(--primary-500)"
                                        strokeWidth="25"
                                        strokeDasharray={`${principalPercent * 5.02} ${500.2}`}
                                        strokeLinecap="round"
                                        transform="rotate(-90 100 100)"
                                        className="principal-arc"
                                    />
                                    <circle
                                        cx="100"
                                        cy="100"
                                        r="80"
                                        fill="none"
                                        stroke="var(--accent-500)"
                                        strokeWidth="25"
                                        strokeDasharray={`${interestPercent * 5.02} ${500.2}`}
                                        strokeDashoffset={`-${principalPercent * 5.02}`}
                                        strokeLinecap="round"
                                        transform="rotate(-90 100 100)"
                                        className="interest-arc"
                                    />
                                </svg>
                                <div className="chart-center">
                                    <span className="chart-label">Total</span>
                                    <span className="chart-value">{formatCurrency(totalPayment)}</span>
                                </div>
                            </div>

                            <div className="breakdown-details">
                                <div className="breakdown-item">
                                    <div className="breakdown-color principal"></div>
                                    <div className="breakdown-info">
                                        <span className="breakdown-label">Principal Amount</span>
                                        <span className="breakdown-value">{formatCurrency(loanAmount)}</span>
                                    </div>
                                </div>
                                <div className="breakdown-item">
                                    <div className="breakdown-color interest"></div>
                                    <div className="breakdown-info">
                                        <span className="breakdown-label">Total Interest</span>
                                        <span className="breakdown-value">{formatCurrency(totalInterest)}</span>
                                    </div>
                                </div>
                                <div className="breakdown-item total">
                                    <div className="breakdown-icon">
                                        <TrendingDown size={18} />
                                    </div>
                                    <div className="breakdown-info">
                                        <span className="breakdown-label">Total Payment</span>
                                        <span className="breakdown-value">{formatCurrency(totalPayment)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default EMICalculator;
