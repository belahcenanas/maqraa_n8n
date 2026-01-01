import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, BarChart2 } from 'lucide-react';

export default function Layout() {
    return (
        <div className="container">
            <div className="page-content">
                <Outlet />
            </div>

            <nav className="nav-bar">
                <NavLink
                    to="/"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    end
                >
                    <LayoutDashboard size={24} />
                    <span>Dashboard</span>
                </NavLink>

                <NavLink
                    to="/stats"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <BarChart2 size={24} />
                    <span>Stats</span>
                </NavLink>

                <NavLink
                    to="/students"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <Users size={24} />
                    <span>Students</span>
                </NavLink>

                <NavLink
                    to="/add"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <UserPlus size={24} />
                    <span>Add New</span>
                </NavLink>
            </nav>
        </div>
    );
}
