import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './FAQAccordion.css';

const FAQAccordion = ({ faqs = [] }) => {
    const [openIndex, setOpenIndex] = useState(0);

    const toggleFAQ = (index) => {
        setOpenIndex(openIndex === index ? -1 : index);
    };

    return (
        <div className="faq-accordion">
            {faqs.map((faq, index) => (
                <div
                    key={index}
                    className={`faq-item ${openIndex === index ? 'active' : ''}`}
                >
                    <button
                        className="faq-question"
                        onClick={() => toggleFAQ(index)}
                        aria-expanded={openIndex === index}
                    >
                        <span>{faq.question}</span>
                        <ChevronDown size={20} className="faq-icon" />
                    </button>
                    <div className="faq-answer">
                        <div className="faq-answer-content">
                            <p>{faq.answer}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default FAQAccordion;
