import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Stats from './pages/Stats';
import StudentList from './pages/StudentList';
import AddStudent from './pages/AddStudent';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="stats" element={<Stats />} />
        <Route path="students" element={<StudentList />} />
        <Route path="add" element={<AddStudent />} />
      </Route>
    </Routes>
  );
}

export default App;
