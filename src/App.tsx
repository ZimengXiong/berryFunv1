import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './lib/ProtectedRoute'

// Pages
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Profile } from './pages/Profile'
import { Sessions } from './pages/Sessions'
import { MyLedger } from './pages/MyLedger'
import { Checkout } from './pages/Checkout'

// Admin Pages
import { AdminDashboard } from './pages/admin/Dashboard'
import { AdminUsers } from './pages/admin/Users'
import { AdminSessions } from './pages/admin/Sessions'
import { AdminReceipts } from './pages/admin/Receipts'
import { AdminCoupons } from './pages/admin/Coupons'
import { AdminOrders } from './pages/admin/Orders'

// Layout components
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'

function App() {
  return (
    <Routes>
      {/* Public routes with layout */}
      <Route path="/" element={
        <>
          <Header />
          <Home />
          <Footer />
        </>
      } />

      <Route path="/sessions" element={<Sessions />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected user routes */}
      <Route path="/profile" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />

      <Route path="/my-ledger" element={
        <ProtectedRoute>
          <MyLedger />
        </ProtectedRoute>
      } />

      <Route path="/checkout" element={
        <ProtectedRoute>
          <Checkout />
        </ProtectedRoute>
      } />

      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute requireAdmin>
          <AdminDashboard />
        </ProtectedRoute>
      } />

      <Route path="/admin/users" element={
        <ProtectedRoute requireAdmin>
          <AdminUsers />
        </ProtectedRoute>
      } />

      <Route path="/admin/users/:userId" element={
        <ProtectedRoute requireAdmin>
          <AdminUsers />
        </ProtectedRoute>
      } />

      <Route path="/admin/sessions" element={
        <ProtectedRoute requireAdmin>
          <AdminSessions />
        </ProtectedRoute>
      } />

      <Route path="/admin/sessions/:sessionId" element={
        <ProtectedRoute requireAdmin>
          <AdminSessions />
        </ProtectedRoute>
      } />

      <Route path="/admin/receipts" element={
        <ProtectedRoute requireAdmin>
          <AdminReceipts />
        </ProtectedRoute>
      } />

      <Route path="/admin/receipts/:receiptId" element={
        <ProtectedRoute requireAdmin>
          <AdminReceipts />
        </ProtectedRoute>
      } />

      <Route path="/admin/coupons" element={
        <ProtectedRoute requireAdmin>
          <AdminCoupons />
        </ProtectedRoute>
      } />

      <Route path="/admin/coupons/:couponId" element={
        <ProtectedRoute requireAdmin>
          <AdminCoupons />
        </ProtectedRoute>
      } />

      <Route path="/admin/orders" element={
        <ProtectedRoute requireAdmin>
          <AdminOrders />
        </ProtectedRoute>
      } />
    </Routes>
  )
}

export default App
