// The user actions the public website reports. An allowlist: the beacon
// rejects anything else, so the collection cannot fill with arbitrary names.
//
// These are clicks — intent signals — not outcomes. `loan_application_click`
// is someone pressing an Apply / Loan Application CTA; it says nothing about
// whether an application was submitted, let alone approved.
const EVENT_ACTIONS = {
    loan_application_click: 'Loan Application Click',
    contact_click: 'Contact Us Click',
    phone_click: 'Phone Number Click',
    email_click: 'Email Click',
    whatsapp_click: 'WhatsApp Click',
    map_click: 'Location / Map Click',
    product_click: 'Product Click',
    blog_read_click: 'Blog Read Click',
    career_click: 'Career Click',
    download_click: 'Document Download'
};

// What the "Contact Clicks" figure adds up.
const CONTACT_ACTIONS = ['contact_click', 'phone_click', 'email_click', 'whatsapp_click', 'map_click'];

module.exports = {
    EVENT_ACTIONS,
    EVENT_ACTION_KEYS: Object.keys(EVENT_ACTIONS),
    CONTACT_ACTIONS
};
