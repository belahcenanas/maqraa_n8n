import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Stats from './pages/Stats';
import Records from './pages/Records';
import StudentList from './pages/StudentList';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="stats" element={<Stats />} />
        <Route path="records" element={<Records />} />
        <Route path="students" element={<StudentList />} />
      </Route>
    </Routes>
  );
}

export default App;
