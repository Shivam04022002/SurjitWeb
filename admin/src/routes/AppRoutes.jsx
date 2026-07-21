import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Loading from '../components/Loading'
import LoginPage from '../pages/LoginPage'
import DashboardPage from '../pages/DashboardPage'
import ProfilePage from '../pages/ProfilePage'
import DashboardLayout from '../layouts/DashboardLayout'
import CompanyInfoPage from '../pages/about/CompanyInfoPage'
import DirectorsPage from '../pages/about/DirectorsPage'
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
        <Route path="about/company" element={<CompanyInfoPage />} />
        <Route path="about/directors" element={<DirectorsPage />} />
        <Route path="about/leadership" element={<LeadershipPage />} />
        <Route path="products/categories" element={<ProductCategoriesPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id/edit" element={<ProductEditorPage />} />
        <Route path="career/settings" element={<CareerSettingsPage />} />
        <Route path="career/jobs" element={<JobOpeningsPage />} />
        <Route path="career/jobs/:id/edit" element={<JobEditorPage />} />
        <Route path="career/applications" element={<ApplicationsPage />} />
        <Route path="gallery/albums" element={<AlbumsPage />} />
        <Route path="gallery/albums/:id/edit" element={<AlbumEditorPage />} />
        {/* "categories" and "new" are declared before :id so they are not read as ids. */}
        <Route path="blogs" element={<BlogsPage />} />
        <Route path="blogs/categories" element={<BlogCategoriesPage />} />
        <Route path="blogs/new" element={<BlogEditorPage />} />
        <Route path="blogs/:id/edit" element={<BlogEditorPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
