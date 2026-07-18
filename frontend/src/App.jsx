import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import PageLoader from './components/PageLoader';
import './index.css';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const ProductsRedirect = lazy(() => import('./pages/ProductsRedirect'));
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
const Gallery = lazy(() => import('./pages/Gallery'));

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
              {/* A product page is the only product UI. These two paths render
                  nothing of their own — they resolve a category (or a legacy
                  product slug) to a product URL and redirect. */}
              <Route path="/products" element={<ProductsRedirect />} />
              <Route path="/products/:categorySlug" element={<ProductsRedirect />} />
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
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/gallery/:albumId" element={<EventGallery />} />
              {/* Kept so links and bookmarks made before the gallery moved off
                  the Career page still resolve. */}
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
