import { useEffect, useState } from 'react';
import { supabase, type MyRecord, type TelName } from '../lib/supabase';
import { 
    startOfDay, endOfDay, 
    startOfWeek, endOfWeek, 
    startOfMonth, endOfMonth, 
    startOfYear, endOfYear,
    format
} from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trophy, AlertTriangle, Clock, Calendar, TrendingUp, Medal } from 'lucide-react';

type TimePeriod = 'day' | 'week' | 'month' | 'year';

const REQUIRED_DAYS = ['Monday', 'Tuesday', 'Thursday', 'Friday'];

// Helper to convert minutes to hours display
function formatDuration(minutes: number): string {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
}

// Get date range based on period
function getDateRange(period: TimePeriod): { start: Date; end: Date } {
    const now = new Date();
    switch (period) {
        case 'day':
            return { start: startOfDay(now), end: endOfDay(now) };
        case 'week':
            return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
        case 'month':
            return { start: startOfMonth(now), end: endOfMonth(now) };
        case 'year':
            return { start: startOfYear(now), end: endOfYear(now) };
    }
}

// Get expected sessions count based on period
function getExpectedSessions(period: TimePeriod): number {
    const now = new Date();
    switch (period) {
        case 'day':
            return REQUIRED_DAYS.includes(format(now, 'EEEE')) ? 1 : 0;
        case 'week':
            return REQUIRED_DAYS.length; // 4 days per week
        case 'month':
            return REQUIRED_DAYS.length * 4; // ~4 weeks per month
        case 'year':
            return REQUIRED_DAYS.length * 52; // ~52 weeks per year
    }
}

export default function Stats() {
    const [records, setRecords] = useState<MyRecord[]>([]);
    const [students, setStudents] = useState<TelName[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<TimePeriod>('week');

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            setLoading(true);
            setError(null);

            const { data: studentsData, error: studentsError } = await supabase
                .from('tel_name')
                .select('*');

            if (studentsError) throw studentsError;

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

    // --- Calculate Stats ---
    const { start, end } = getDateRange(period);
    const expectedSessions = getExpectedSessions(period);

    // Filter records for selected period
    const periodRecords = records.filter(r => {
        const d = new Date(r.created_at);
        return d >= start && d <= end;
    });

    // Calculate stats per student
    const studentStats = students.map(student => {
        const studentRecords = periodRecords.filter(r => r.telephone === student.tel);
        const totalDuration = studentRecords.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
        const sessionsCount = studentRecords.length;
        const missedSessions = Math.max(0, expectedSessions - sessionsCount);
        const completionRate = expectedSessions > 0 ? Math.round((sessionsCount / expectedSessions) * 100) : 100;
        const avgDuration = sessionsCount > 0 ? Math.round(totalDuration / sessionsCount) : 0;

        return {
            ...student,
            totalDuration,
            sessionsCount,
            missedSessions,
            completionRate,
            avgDuration
        };
    });

    // Sort by different criteria
    const bestByDuration = [...studentStats].sort((a, b) => b.totalDuration - a.totalDuration);
    const mostMissed = [...studentStats].sort((a, b) => b.missedSessions - a.missedSessions);

    // Overall stats
    const totalMissed = studentStats.reduce((acc, s) => acc + s.missedSessions, 0);
    const totalDuration = studentStats.reduce((acc, s) => acc + s.totalDuration, 0);
    const avgCompletion = studentStats.length > 0 
        ? Math.round(studentStats.reduce((acc, s) => acc + s.completionRate, 0) / studentStats.length) 
        : 0;

    // Chart data for top performers
    const chartData = bestByDuration.slice(0, 5).map((s, index) => ({
        name: s.name?.split(' ')[0] || s.tel || 'Unknown',
        duration: s.totalDuration,
        rank: index + 1
    }));

    const periodLabels: Record<TimePeriod, string> = {
        day: 'Today',
        week: 'This Week',
        month: 'This Month',
        year: 'This Year'
    };

    if (loading) return <div className="Loading">Loading stats...</div>;
    if (error) return <div className="Error" style={{ color: 'var(--danger)', padding: '20px' }}>Error: {error}</div>;

    return (
        <div>
            <h1 style={{ fontSize: '28px', marginBottom: '24px' }}>Statistics</h1>

            {/* Period Selector */}
            <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <Calendar size={20} color="var(--primary)" />
                    <span style={{ fontWeight: 500 }}>Time Period:</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {(['day', 'week', 'month', 'year'] as TimePeriod[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: period === p ? 'var(--primary)' : 'var(--card-bg)',
                                    color: period === p ? 'white' : 'var(--text)',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    transition: 'all 0.2s',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div className="glass-panel stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                        <Clock size={20} />
                        <span className="stat-label">Total Time</span>
                    </div>
                    <span className="stat-value">{formatDuration(totalDuration)}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{periodLabels[period]}</span>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                        <AlertTriangle size={20} />
                        <span className="stat-label">Missed Sessions</span>
                    </div>
                    <span className="stat-value" style={{ color: totalMissed > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {totalMissed}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{periodLabels[period]}</span>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
                        <TrendingUp size={20} />
                        <span className="stat-label">Avg Completion</span>
                    </div>
                    <span className="stat-value">{avgCompletion}%</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{periodLabels[period]}</span>
                </div>
            </div>

            {/* Leaderboard Chart */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '32px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <Trophy size={20} color="gold" />
                    Top Performers - {periodLabels[period]}
                </h3>
                {chartData.length > 0 ? (
                    <div style={{ height: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical">
                                <XAxis type="number" stroke="var(--text-muted)" />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    stroke="var(--text-muted)"
                                    width={80}
                                />
                                <Tooltip
                                    contentStyle={{ 
                                        background: 'var(--card-bg)', 
                                        borderColor: 'var(--card-border)', 
                                        borderRadius: '12px' 
                                    }}
                                    formatter={(value) => [formatDuration(Number(value)), 'Duration']}
                                />
                                <Bar dataKey="duration" radius={[0, 4, 4, 0]}>
                                    {chartData.map((_, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : 'var(--primary)'} 
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                        No data for this period
                    </p>
                )}
            </div>

            {/* Two Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Best Students by Duration */}
                <div className="glass-panel" style={{ padding: '20px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Medal size={20} color="var(--primary)" />
                        Best by Duration
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {bestByDuration.slice(0, 5).map((student, index) => (
                            <div 
                                key={student.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px',
                                    background: index === 0 ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255,255,255,0.02)',
                                    borderRadius: '8px',
                                    border: index === 0 ? '1px solid gold' : '1px solid transparent'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ 
                                        fontWeight: 700, 
                                        color: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : 'var(--text-muted)',
                                        width: '24px'
                                    }}>
                                        #{index + 1}
                                    </span>
                                    <span style={{ fontWeight: 500 }}>{student.name || student.tel}</span>
                                </div>
                                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                    {formatDuration(student.totalDuration)}
                                </span>
                            </div>
                        ))}
                        {bestByDuration.length === 0 && (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                                No data available
                            </p>
                        )}
                    </div>
                </div>

                {/* Most Missed Sessions */}
                <div className="glass-panel" style={{ padding: '20px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <AlertTriangle size={20} color="var(--danger)" />
                        Most Missed Sessions
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {mostMissed.filter(s => s.missedSessions > 0).slice(0, 5).map((student) => (
                            <div 
                                key={student.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    borderRadius: '8px'
                                }}
                            >
                                <span style={{ fontWeight: 500, color: 'var(--danger)' }}>
                                    {student.name || student.tel}
                                </span>
                                <span style={{ 
                                    fontWeight: 600, 
                                    color: 'var(--danger)',
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    padding: '4px 12px',
                                    borderRadius: '12px',
                                    fontSize: '14px'
                                }}>
                                    {student.missedSessions} missed
                                </span>
                            </div>
                        ))}
                        {mostMissed.filter(s => s.missedSessions > 0).length === 0 && (
                            <p style={{ color: 'var(--success)', textAlign: 'center', padding: '20px' }}>
                                🎉 No missed sessions!
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Full Student Stats Table */}
            <div className="glass-panel" style={{ padding: '20px', marginTop: '24px' }}>
                <h3 style={{ marginBottom: '16px' }}>All Student Statistics - {periodLabels[period]}</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Rank</th>
                                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Student</th>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Sessions</th>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Missed</th>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Total Time</th>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Avg/Session</th>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Completion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bestByDuration.map((student, index) => (
                                <tr 
                                    key={student.id}
                                    style={{ 
                                        borderBottom: '1px solid var(--card-border)',
                                        background: student.missedSessions > 0 ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                                    }}
                                >
                                    <td style={{ padding: '12px 8px', fontWeight: 700, color: index < 3 ? ['gold', 'silver', '#cd7f32'][index] : 'var(--text-muted)' }}>
                                        #{index + 1}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontWeight: 500 }}>
                                        {student.name || student.tel}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)' }}>
                                        {student.sessionsCount}
                                    </td>
                                    <td style={{ 
                                        textAlign: 'center', 
                                        padding: '12px 8px',
                                        color: student.missedSessions > 0 ? 'var(--danger)' : 'var(--success)',
                                        fontWeight: student.missedSessions > 0 ? 600 : 400
                                    }}>
                                        {student.missedSessions}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 600, color: 'var(--primary)' }}>
                                        {formatDuration(student.totalDuration)}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)' }}>
                                        {formatDuration(student.avgDuration)}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            background: student.completionRate >= 80 
                                                ? 'rgba(34, 197, 94, 0.2)' 
                                                : student.completionRate >= 50 
                                                    ? 'rgba(251, 191, 36, 0.2)' 
                                                    : 'rgba(239, 68, 68, 0.2)',
                                            color: student.completionRate >= 80 
                                                ? 'var(--success)' 
                                                : student.completionRate >= 50 
                                                    ? '#fbbf24' 
                                                    : 'var(--danger)'
                                        }}>
                                            {student.completionRate}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
