import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, BarChart2, Moon, Sun, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Layout() {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    return (
        <div className="container">
            <button className="theme-toggle" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={24} color="var(--primary)" /> : <Moon size={24} color="var(--primary)" />}
            </button>
            
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
                    to="/records"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <FileText size={24} />
                    <span>Records</span>
                </NavLink>

                <NavLink
                    to="/students"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <Users size={24} />
                    <span>Students</span>
                </NavLink>
            </nav>
        </div>
    );
}
