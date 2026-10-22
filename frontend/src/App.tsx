import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { AvailabilityPage } from './pages/AvailabilityPage';
import { BookPage } from './pages/BookPage';
import { BookingStatusPage } from './pages/BookingStatusPage';
import { HomePage } from './pages/HomePage';
import { ComparePage } from './pages/ComparePage';
import { SearchPage } from './pages/SearchPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="book" element={<BookPage />} />
          <Route path="bookings/:bookingId" element={<BookingStatusPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
