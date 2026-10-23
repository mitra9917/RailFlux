import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { AboutPage } from './pages/AboutPage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { AvailabilityPage } from './pages/AvailabilityPage';
import { BookPage } from './pages/BookPage';
import { BookingStatusPage } from './pages/BookingStatusPage';
import { ComparePage } from './pages/ComparePage';
import { HomePage } from './pages/HomePage';
import { PayPage } from './pages/PayPage';
import { SearchPage } from './pages/SearchPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="book" element={<BookPage />} />
          <Route path="pay" element={<PayPage />} />
          <Route path="bookings/:bookingId" element={<BookingStatusPage />} />
          <Route path="experiments" element={<ComparePage />} />
          <Route path="compare" element={<Navigate to="/experiments" replace />} />
          <Route path="architecture" element={<ArchitecturePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
