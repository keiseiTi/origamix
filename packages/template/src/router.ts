import { createBrowserRouter } from 'react-router';
import Home from './pages/home';

export default createBrowserRouter([
  {
    path: '/',
    Component: Home,
  },
]);
