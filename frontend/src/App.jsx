import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import './index.css';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const ProductCategories = lazy(() => import('./pages/ProductCategories'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Contact = lazy(() => import('./pages/Contact'));
const Career = lazy(() => import('./pages/Career'));
const FAQs = lazy(() => import('./pages/FAQs'));
const LoanApplication = lazy(() => import('./pages/LoanApplication'));
const Blogs = lazy(() => import('./pages/Blogs'));
const BlogDetail = lazy(() => import('./pages/BlogDetail'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const NodalOfficer = lazy(() => import('./pages/NodalOfficer'));
const JobApply = lazy(() => import('./pages/JobApply'));
const EventGallery = lazy(() => import('./pages/EventGallery'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <div style={{ width: 40, height: 40, border: '3px solid #f3f3f3', borderTop: '3px solid #CE8112', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/products" element={<ProductCategories />} />
              {/* Category page. Also absorbs legacy /products/:productSlug links and
                  redirects them to the category-scoped URL. */}
              <Route path="/products/:categorySlug" element={<CategoryPage />} />
              <Route path="/products/:categorySlug/:productSlug" element={<ProductDetail />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/career" element={<Career />} />
              <Route path="/faqs" element={<FAQs />} />
              <Route path="/loan-application" element={<LoanApplication />} />
              <Route path="/blogs" element={<Blogs />} />
              <Route path="/blogs/:id" element={<BlogDetail />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
              <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
              <Route path="/nodal-officer" element={<NodalOfficer />} />
              <Route path="/apply-job/:jobTitle" element={<JobApply />} />
              <Route path="/career/gallery/:eventId" element={<EventGallery />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
