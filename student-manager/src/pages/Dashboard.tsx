import { useEffect, useState } from 'react';
import { supabase, type MyRecord, type TelName } from '../lib/supabase'; // Fix type imports
import { startOfWeek, endOfWeek } from 'date-fns'; // Remove unused
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'; // Remove YAxis

import { AlertCircle, Clock, CheckCircle } from 'lucide-react';

const REQUIRED_DAYS = ['Monday', 'Tuesday', 'Thursday', 'Friday'];

export default function Dashboard() {
    const [records, setRecords] = useState<MyRecord[]>([]);
    const [students, setStudents] = useState<TelName[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            setLoading(true);
            setError(null); // Clear previous errors

            // Fetch Students
            const { data: studentsData, error: studentsError } = await supabase
                .from('tel_name')
                .select('*');

            if (studentsError) throw studentsError;

            // Fetch Records (Last 30 days to be safe for stats, but we'll filter for this week)
            // For simplicity in this demo, fetching all. In prod, use .gte('created_at', ...)
            const { data: recordsData, error: recordsError } = await supabase
                .from('myrecords')
                .select('*')
                .order('created_at', { ascending: false });

            if (recordsError) throw recordsError;

            setStudents(studentsData || []);
            setRecords(recordsData || []);
        } catch (err: any) {
            console.error('Error fetching data:', err);
            // Determine if it's a connection error suitable for mock data fallback 
            // (For this specific user request, I'll allow fail if credentials bad, but show UI)
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }

    // --- Logic ---

    // Filter records for current week
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const currentWeekRecords = records.filter(r => {
        const d = new Date(r.created_at);
        return d >= weekStart && d <= weekEnd;
    });

    // Calculate Total Duration
    const totalDuration = records.reduce((acc, curr) => acc + (parseInt(curr.duration || '0') || 0), 0);

    // Calculate Completion per Student
    const studentStats = students.map(student => {
        const studentRecords = currentWeekRecords.filter(r => r.tel === student.tel);
        // Unique days they submitted
        const submittedDays = new Set(studentRecords.map(r => r.day).filter(Boolean));
        const missingDays = REQUIRED_DAYS.filter(day => !submittedDays.has(day));

        // Total duration this week
        const weekDuration = studentRecords.reduce((acc, curr) => acc + (parseInt(curr.duration || '0') || 0), 0);

        return {
            ...student,
            weekDuration,
            submittedDays,
            missingDays,
            completedCount: submittedDays.size
        };
    });

    // Identify Missing Reports (Filtered by days reasonably passed? 
    // User wants "stats about student that didn't send". I'll list all missing for the week for now.)
    const problematicStudents = studentStats.filter(s => s.missingDays.length > 0);

    // Chart Data: Duration per Student (Top 5)
    const chartData = studentStats
        .sort((a, b) => b.weekDuration - a.weekDuration)
        .slice(0, 7)
        .map(s => ({
            name: s.name?.split(' ')[0] || s.tel, // First name only
            duration: s.weekDuration
        }));

    if (loading) return <div className="Loading">Loading stats...</div>;
    if (error) return <div className="Error" style={{ color: 'var(--danger)', padding: '20px' }}>Error: {error}</div>;

    return (
        <div>
            <h1 style={{ fontSize: '28px', marginBottom: '24px' }}>Dashboard</h1>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                <div className="glass-panel stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                        <Clock size={20} />
                        <span className="stat-label">Total Time</span>
                    </div>
                    <span className="stat-value">{totalDuration}m</span>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
                        <CheckCircle size={20} />
                        <span className="stat-label">Reports</span>
                    </div>
                    <span className="stat-value">{currentWeekRecords.length}</span>
                </div>
            </div>

            {/* Chart */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '32px', height: '300px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '20px' }}>Leaderboard (Minutes)</h3>
                <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <XAxis
                                dataKey="name"
                                stroke="var(--text-muted)"
                                tick={{ fill: 'var(--text-muted)' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '12px' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            />
                            <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
                                {chartData.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--primary)' : 'rgba(99, 102, 241, 0.5)'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Missing Reports */}
            <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle color="var(--danger)" size={20} />
                    Missing Reports (This Week)
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                    {problematicStudents.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>All good! Everyone reported in.</p>
                    ) : (
                        problematicStudents.map(student => (
                            <div key={student.id} className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{student.name || student.tel}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        Missing: {student.missingDays.join(', ')}
                                    </div>
                                </div>
                                {/* Could add a 'Remind' button here later */}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
