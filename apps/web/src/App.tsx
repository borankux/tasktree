import { Routes, Route } from 'react-router-dom';
import ProjectList from './pages/ProjectList';
import Canvas from './pages/Canvas';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectList />} />
      <Route path="/project/:id" element={<Canvas />} />
    </Routes>
  );
}
