import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Loading from '../components/Loading'
import LoginPage from '../pages/LoginPage'
import DashboardPage from '../pages/DashboardPage'
import ProfilePage from '../pages/ProfilePage'
import DashboardLayout from '../layouts/DashboardLayout'
import CompanyInfoPage from '../pages/about/CompanyInfoPage'
import DirectorsPage from '../pages/about/DirectorsPage'
import LoanApplicationsPage from '../pages/loanApplications/LoanApplicationsPage'
import AnalyticsPage from '../pages/analytics/AnalyticsPage'
import LeadershipPage from '../pages/about/LeadershipPage'
import ProductCategoriesPage from '../pages/products/ProductCategoriesPage'
import ProductsPage from '../pages/products/ProductsPage'
import ProductEditorPage from '../pages/products/editor/ProductEditorPage'
import CareerSettingsPage from '../pages/career/CareerSettingsPage'
import JobOpeningsPage from '../pages/career/JobOpeningsPage'
import JobEditorPage from '../pages/career/editor/JobEditorPage'
import ApplicationsPage from '../pages/career/ApplicationsPage'
import AlbumsPage from '../pages/gallery/AlbumsPage'
import AlbumEditorPage from '../pages/gallery/editor/AlbumEditorPage'
import SettingsPage from '../pages/settings/SettingsPage'
import BlogsPage from '../pages/blog/BlogsPage'
import BlogEditorPage from '../pages/blog/BlogEditorPage'
import BlogCategoriesPage from '../pages/blog/BlogCategoriesPage'
import ReviewsPage from '../pages/reviews/ReviewsPage'
import ReportsPage from '../pages/reports/ReportsPage'
import UsersPage from '../pages/users/UsersPage'
import BranchesPage from '../pages/branches/BranchesPage'
import HomepageStatsPage from '../pages/homepageStats/HomepageStatsPage'
import LegalPagesPage from '../pages/legal/LegalPagesPage'
import NodalOfficersPage from '../pages/nodalOfficers/NodalOfficersPage'
import ApiSettingsPage from '../pages/integrations/ApiSettingsPage'
import GeminiBlogsPage from '../pages/gemini/GeminiBlogsPage'
import AdvertisementsPage from '../pages/advertisements/AdvertisementsPage'
import RolesPage from '../pages/roles/RolesPage'
import RequirePagePermission from '../components/RequirePagePermission'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <Loading />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <Loading />
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}

const AppRoutes = () => {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="about/company" element={<RequirePagePermission page="company"><CompanyInfoPage /></RequirePagePermission>} />
        <Route path="about/directors" element={<RequirePagePermission page="directors"><DirectorsPage /></RequirePagePermission>} />
        <Route path="loan-applications" element={<RequirePagePermission page="loanApplications"><LoanApplicationsPage /></RequirePagePermission>} />
        <Route path="analytics" element={<RequirePagePermission page="analytics"><AnalyticsPage /></RequirePagePermission>} />
        <Route path="about/leadership" element={<RequirePagePermission page="leadership"><LeadershipPage /></RequirePagePermission>} />
        <Route path="products/categories" element={<RequirePagePermission page="productCategories"><ProductCategoriesPage /></RequirePagePermission>} />
        <Route path="products" element={<RequirePagePermission page="products"><ProductsPage /></RequirePagePermission>} />
        <Route path="products/:id/edit" element={<RequirePagePermission page="products"><ProductEditorPage /></RequirePagePermission>} />
        <Route path="career/settings" element={<RequirePagePermission page="careerSettings"><CareerSettingsPage /></RequirePagePermission>} />
        <Route path="career/jobs" element={<RequirePagePermission page="jobs"><JobOpeningsPage /></RequirePagePermission>} />
        <Route path="career/jobs/:id/edit" element={<RequirePagePermission page="jobs"><JobEditorPage /></RequirePagePermission>} />
        <Route path="career/applications" element={<RequirePagePermission page="jobApplications"><ApplicationsPage /></RequirePagePermission>} />
        <Route path="gallery/albums" element={<RequirePagePermission page="gallery"><AlbumsPage /></RequirePagePermission>} />
        <Route path="gallery/albums/:id/edit" element={<RequirePagePermission page="gallery"><AlbumEditorPage /></RequirePagePermission>} />
        {/* "categories" and "new" are declared before :id so they are not read as ids. */}
        <Route path="blogs" element={<RequirePagePermission page="blogs"><BlogsPage /></RequirePagePermission>} />
        <Route path="blogs/categories" element={<RequirePagePermission page="blogCategories"><BlogCategoriesPage /></RequirePagePermission>} />
        <Route path="blogs/new" element={<RequirePagePermission page="blogs"><BlogEditorPage /></RequirePagePermission>} />
        <Route path="blogs/:id/edit" element={<RequirePagePermission page="blogs"><BlogEditorPage /></RequirePagePermission>} />
        <Route path="reviews" element={<RequirePagePermission page="reviews"><ReviewsPage /></RequirePagePermission>} />
        <Route path="reports" element={<RequirePagePermission page="reports"><ReportsPage /></RequirePagePermission>} />
        <Route path="branches" element={<RequirePagePermission page="branches"><BranchesPage /></RequirePagePermission>} />
        <Route path="homepage-stats" element={<RequirePagePermission page="homepageStats"><HomepageStatsPage /></RequirePagePermission>} />
        <Route path="legal-pages" element={<RequirePagePermission page="legalPages"><LegalPagesPage /></RequirePagePermission>} />
        <Route path="nodal-officers" element={<RequirePagePermission page="nodalOfficers"><NodalOfficersPage /></RequirePagePermission>} />
        <Route path="users" element={<RequirePagePermission page="users"><UsersPage /></RequirePagePermission>} />
        <Route path="settings" element={<RequirePagePermission page="settings"><SettingsPage /></RequirePagePermission>} />
        <Route path="integrations/api" element={<RequirePagePermission page="integrations"><ApiSettingsPage /></RequirePagePermission>} />
        <Route path="gemini-blogs" element={<RequirePagePermission page="geminiBlogs"><GeminiBlogsPage /></RequirePagePermission>} />
        <Route path="advertisements" element={<RequirePagePermission page="advertisements"><AdvertisementsPage /></RequirePagePermission>} />
        <Route path="roles" element={<RequirePagePermission page="roles"><RolesPage /></RequirePagePermission>} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
