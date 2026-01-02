import { useEffect, useState } from 'react';
import { supabase, type MyRecord, type TelName } from '../lib/supabase';
import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

import { AlertCircle, Clock, CheckCircle, Calendar, User } from 'lucide-react';

const REQUIRED_DAYS = ['Monday', 'Tuesday', 'Thursday', 'Friday'];

// Helper to convert minutes to hours and minutes display
function formatDuration(minutes: number): string {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
}

// Helper to format time from ISO string
function formatTime(timeStr: string | null): string {
    if (!timeStr) return '-';
    try {
        const date = parseISO(timeStr);
        return format(date, 'HH:mm');
    } catch {
        return timeStr;
    }
}

export default function Dashboard() {
    const [records, setRecords] = useState<MyRecord[]>([]);
    const [students, setStudents] = useState<TelName[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            setLoading(true);
            setError(null);

            // Fetch Students
            const { data: studentsData, error: studentsError } = await supabase
                .from('tel_name')
                .select('*');

            if (studentsError) throw studentsError;

            // Fetch Records
            const { data: recordsData, error: recordsError } = await supabase
                .from('myrecords')
                .select('*')
                .order('created_at', { ascending: false });

            if (recordsError) throw recordsError;

            setStudents(studentsData || []);
            setRecords(recordsData || []);
        } catch (err: unknown) {
            console.error('Error fetching data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }

    // --- Logic ---

    // Filter records for current week
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const currentWeekRecords = records.filter(r => {
        const d = new Date(r.created_at);
        return d >= weekStart && d <= weekEnd;
    });

    // Filter records for selected date (for daily view)
    const selectedDateRecords = records.filter(r => {
        // Use session_date if available, otherwise fall back to created_at
        const recordDate = r.session_date || format(new Date(r.created_at), 'yyyy-MM-dd');
        return recordDate === selectedDate;
    });

    // Create daily student activity list
    const dailyStudentActivity = students.map(student => {
        const studentRecord = selectedDateRecords.find(r => r.telephone === student.tel);
        const durationMinutes = studentRecord?.duration_minutes || 0;
        
        return {
            ...student,
            hasRecord: !!studentRecord,
            time: studentRecord?.time_sent || null,
            durationMinutes,
            durationFormatted: formatDuration(durationMinutes)
        };
    });

    // Calculate Total Duration
    const totalDuration = records.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);

    // Calculate Completion per Student
    const studentStats = students.map(student => {
        const studentRecords = currentWeekRecords.filter(r => r.telephone === student.tel);
        const submittedDays = new Set(studentRecords.map(r => r.session_day || r.day_sent).filter(Boolean));
        const missingDays = REQUIRED_DAYS.filter(day => !submittedDays.has(day));
        const weekDuration = studentRecords.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);

        return {
            ...student,
            weekDuration,
            submittedDays,
            missingDays,
            completedCount: submittedDays.size
        };
    });

    const problematicStudents = studentStats.filter(s => s.missingDays.length > 0);

    // Chart Data: Duration per Student (Top 7)
    const chartData = studentStats
        .sort((a, b) => b.weekDuration - a.weekDuration)
        .slice(0, 7)
        .map(s => ({
            name: s.name?.split(' ')[0] || s.tel,
            duration: s.weekDuration
        }));

    if (loading) return <div className="Loading">Loading stats...</div>;
    if (error) return <div className="Error" style={{ color: 'var(--danger)', padding: '20px' }}>Error: {error}</div>;

    return (
        <div>
            <h1 style={{ fontSize: '28px', marginBottom: '24px' }}>Dashboard</h1>

            {/* Date Selector */}
            <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <Calendar size={20} color="var(--primary)" />
                    <label style={{ fontWeight: 500 }}>Select Date:</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--card-border)',
                            background: 'var(--card-bg)',
                            color: 'var(--text)',
                            fontSize: '14px',
                            cursor: 'pointer'
                        }}
                    />
                    <button
                        onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'var(--primary)' : 'var(--card-bg)',
                            color: selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'white' : 'var(--text)',
                            cursor: 'pointer',
                            fontWeight: 500,
                            transition: 'all 0.2s'
                        }}
                    >
                        Today
                    </button>
                </div>
            </div>

            {/* Daily Student Activity */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '32px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <User size={20} color="var(--primary)" />
                    Student Activity - {format(parseISO(selectedDate), 'EEEE, MMM d, yyyy')}
                </h3>
                
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Student</th>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Time Sent</th>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Duration</th>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dailyStudentActivity.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No students found
                                    </td>
                                </tr>
                            ) : (
                                dailyStudentActivity.map(student => (
                                    <tr
                                        key={student.id}
                                        style={{
                                            borderBottom: '1px solid var(--card-border)',
                                            background: !student.hasRecord ? 'rgba(239, 68, 68, 0.1)' : 'transparent'
                                        }}
                                    >
                                        <td style={{
                                            padding: '12px 8px',
                                            fontWeight: 500,
                                            color: !student.hasRecord ? 'var(--danger)' : 'var(--text)'
                                        }}>
                                            {student.name || student.tel}
                                        </td>
                                        <td style={{
                                            textAlign: 'center',
                                            padding: '12px 8px',
                                            color: !student.hasRecord ? 'var(--danger)' : 'var(--text-muted)'
                                        }}>
                                            {student.hasRecord ? formatTime(student.time) : '-'}
                                        </td>
                                        <td style={{
                                            textAlign: 'center',
                                            padding: '12px 8px',
                                            fontWeight: 600,
                                            color: !student.hasRecord ? 'var(--danger)' : 'var(--primary)'
                                        }}>
                                            {student.hasRecord ? student.durationFormatted : '-'}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                                            {student.hasRecord ? (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '4px 8px',
                                                    borderRadius: '12px',
                                                    background: 'rgba(34, 197, 94, 0.2)',
                                                    color: 'var(--success)',
                                                    fontSize: '12px',
                                                    fontWeight: 500
                                                }}>
                                                    <CheckCircle size={14} /> Sent
                                                </span>
                                            ) : (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '4px 8px',
                                                    borderRadius: '12px',
                                                    background: 'rgba(239, 68, 68, 0.2)',
                                                    color: 'var(--danger)',
                                                    fontSize: '12px',
                                                    fontWeight: 500
                                                }}>
                                                    <AlertCircle size={14} /> Missing
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
