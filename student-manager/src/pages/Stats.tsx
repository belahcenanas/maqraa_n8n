import { useEffect, useState, useMemo } from 'react';
import { supabase, type MyRecord, type Student, type Group } from '../lib/supabase';
import {
    startOfDay, endOfDay,
    startOfWeek, endOfWeek,
    startOfMonth, endOfMonth,
    startOfYear, endOfYear,
    format,
    eachDayOfInterval,
    isSameDay,
    parseISO,
    subDays,
    differenceInDays,
    getDay
} from 'date-fns';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    LineChart, Line, CartesianGrid, PieChart, Pie, Legend
} from 'recharts';
import {
    Trophy, AlertTriangle, Clock, Calendar, TrendingUp,
    Users, Activity, PieChart as PieChartIcon, Flame, Filter,
    Download, X, Star, Sunrise, Moon, Zap
} from 'lucide-react';

type TimePeriod = 'day' | 'week' | 'month' | 'year' | 'all';
type TabType = 'overview' | 'trends' | 'groups' | 'consistency';

const REQUIRED_DAYS = ['Monday', 'Tuesday', 'Thursday', 'Friday'];
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

interface Badge {
    id: string;
    name: string;
    icon: any;
    color: string;
    description: string;
}

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
function getDateRange(period: TimePeriod, referenceDate: Date = new Date()): { start: Date; end: Date } {
    const now = referenceDate;
    switch (period) {
        case 'day':
            return { start: startOfDay(now), end: endOfDay(now) };
        case 'week':
            return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
        case 'month':
            return { start: startOfMonth(now), end: endOfMonth(now) };
        case 'year':
            return { start: startOfYear(now), end: endOfYear(now) };
        case 'all':
            return { start: new Date(2024, 0, 1), end: endOfDay(new Date()) }; // 'all' usually means up to *actual* now
    }
}

// Get expected sessions count based on period
function getExpectedSessions(period: TimePeriod): number {
    const now = new Date();
    switch (period) {
        case 'day':
            return REQUIRED_DAYS.includes(format(now, 'EEEE')) ? 1 : 0;
        case 'week':
            return REQUIRED_DAYS.length;
        case 'month':
            return REQUIRED_DAYS.length * 4;
        case 'year':
            return REQUIRED_DAYS.length * 52;
        case 'all':
            return 0; // Not applicable
    }
}

function assignBadges(studentRecords: MyRecord[], _totalDuration: number, completionRate: number, maxStreak: number): Badge[] {
    const badges: Badge[] = [];

    // Consistency Badges
    if (maxStreak >= 30) badges.push({ id: 'legend', name: 'Legend', icon: Trophy, color: '#FFD700', description: '30+ day streak' });
    else if (maxStreak >= 10) badges.push({ id: 'fire', name: 'On Fire', icon: Flame, color: '#ff4d00', description: '10+ day streak' });
    else if (maxStreak >= 3) badges.push({ id: 'warming-up', name: 'Warming Up', icon: Zap, color: '#fbbf24', description: '3+ day streak' });

    // Timing Badges (Early Bird / Night Owl)
    if (studentRecords.length > 5) {
        const morningCount = studentRecords.filter(r => {
            const time = r.time_sent?.split(':') || [];
            return time.length > 0 && parseInt(time[0]) < 9;
        }).length;

        const nightCount = studentRecords.filter(r => {
            const time = r.time_sent?.split(':') || [];
            return time.length > 0 && parseInt(time[0]) >= 20;
        }).length;

        if (morningCount / studentRecords.length > 0.3) {
            badges.push({ id: 'early-bird', name: 'Early Bird', icon: Sunrise, color: '#0ea5e9', description: 'Studies in the morning' });
        }
        if (nightCount / studentRecords.length > 0.3) {
            badges.push({ id: 'night-owl', name: 'Night Owl', icon: Moon, color: '#8b5cf6', description: 'Studies late at night' });
        }
    }

    // Performance
    if (completionRate === 100 && studentRecords.length > 5) {
        badges.push({ id: 'perfectionist', name: 'Perfectionist', icon: Star, color: '#10b981', description: '100% completion rate' });
    }

    return badges;
}

export default function Stats() {
    const [records, setRecords] = useState<MyRecord[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<TimePeriod>('month');
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [selectedGroupId, setSelectedGroupId] = useState<number | 'all'>('all');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    // Modal State
    const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            setLoading(true);

            const [studentsRes, recordsRes, groupsRes] = await Promise.all([
                supabase.from('students').select('*'),
                supabase.from('myrecords').select('*').order('created_at', { ascending: false }),
                supabase.from('groups').select('*')
            ]);

            if (studentsRes.error) throw studentsRes.error;
            if (recordsRes.error) throw recordsRes.error;
            if (groupsRes.error) throw groupsRes.error;

            setStudents(studentsRes.data || []);
            setRecords(recordsRes.data || []);
            setGroups(groupsRes.data || []);
        } catch (err: unknown) {
            console.error('Error fetching data:', err);
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    }

    // --- Derived Data & Memoized Calculations ---

    const filteredStudents = useMemo(() => {
        if (selectedGroupId === 'all') return students;
        return students.filter(s => s.group_id === selectedGroupId);
    }, [students, selectedGroupId]);

    const { start, end } = useMemo(() => getDateRange(period, selectedDate), [period, selectedDate]);
    const expectedSessions = useMemo(() => getExpectedSessions(period), [period]);

    const periodRecords = useMemo(() => {
        return records.filter(r => {
            const dateToUse = r.session_date ? parseISO(r.session_date) : parseISO(r.created_at);
            const isInPeriod = dateToUse >= start && dateToUse <= end;
            const isStudentFiltered = selectedGroupId === 'all' ||
                students.find(s => s.whatsapp_id_student === r.whatsapp_id_student)?.group_id === selectedGroupId;
            return isInPeriod && isStudentFiltered;
        });
    }, [records, start, end, selectedGroupId, students]);

    const studentStats = useMemo(() => {
        return filteredStudents.map(student => {
            const studentPeriodRecords = periodRecords.filter(r => r.whatsapp_id_student === student.whatsapp_id_student);
            const totalDuration = studentPeriodRecords.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
            const sessionsCount = studentPeriodRecords.length;
            const missedSessions = period !== 'all' ? Math.max(0, expectedSessions - sessionsCount) : 0;
            const completionRate = expectedSessions > 0 ? Math.round((sessionsCount / expectedSessions) * 100) : 100;
            const avgDuration = sessionsCount > 0 ? Math.round(totalDuration / sessionsCount) : 0;

            // Consistency & Badges (Based on ALL records)
            const allStudentRecords = records
                .filter(r => r.whatsapp_id_student === student.whatsapp_id_student)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            const uniqueDates = Array.from(new Set(allStudentRecords.map(r => r.session_date || r.created_at.split('T')[0]))).sort();

            let currentStreak = 0;
            let maxStreak = 0;
            if (uniqueDates.length > 0) {
                let tempStreak = 1;
                for (let i = 1; i < uniqueDates.length; i++) {
                    const prev = parseISO(uniqueDates[i - 1]);
                    const curr = parseISO(uniqueDates[i]);
                    // Check if consecutive days (ignoring weekends if logic requires, but here pure days)
                    // For pure academic days, we might want to skip Sat/Sun? 
                    // Let's stick to pure date diff for now.
                    if (differenceInDays(curr, prev) === 1) {
                        tempStreak++;
                    } else if (differenceInDays(curr, prev) > 1) {
                        maxStreak = Math.max(maxStreak, tempStreak);
                        tempStreak = 1;
                    }
                }
                maxStreak = Math.max(maxStreak, tempStreak);

                const lastDate = parseISO(uniqueDates[uniqueDates.length - 1]);
                const today = startOfDay(new Date());
                // If last record was today or yesterday, streak is active
                if (differenceInDays(today, lastDate) <= 1) {
                    currentStreak = tempStreak;
                }
            }

            const badges = assignBadges(allStudentRecords, totalDuration, completionRate, maxStreak);

            return {
                ...student,
                totalDuration,
                sessionsCount,
                missedSessions,
                completionRate,
                avgDuration,
                maxStreak,
                currentStreak,
                badges,
                lastSession: allStudentRecords[allStudentRecords.length - 1]
            };
        });
    }, [filteredStudents, periodRecords, expectedSessions, period, records]);

    // Group Distribution
    const groupStats = useMemo(() => {
        return groups.map(group => {
            const groupStudents = students.filter(s => s.group_id === group.id);
            const groupRecords = records.filter(r =>
                groupStudents.some(s => s.whatsapp_id_student === r.whatsapp_id_student) &&
                (r.session_date ? parseISO(r.session_date) : parseISO(r.created_at)) >= start &&
                (r.session_date ? parseISO(r.session_date) : parseISO(r.created_at)) <= end
            );

            const totalDuration = groupRecords.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
            const sessionsCount = groupRecords.length;
            const avgDuration = sessionsCount > 0 ? Math.round(totalDuration / sessionsCount) : 0;

            return {
                name: group.name,
                totalDuration,
                sessionsCount,
                avgDuration,
                studentCount: groupStudents.length
            };
        });
    }, [groups, students, records, start, end]);

    // Hourly Distribution
    const hourlyData = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
        periodRecords.forEach(r => {
            const time = r.time_sent || (r.created_at ? r.created_at.split('T')[1]?.split('.')[0] : null);
            if (time) {
                const hour = parseInt(time.split(':')[0]);
                if (!isNaN(hour) && hour >= 0 && hour < 24) hours[hour].count++;
            }
        });
        return hours.map(h => ({ ...h, label: `${h.hour}h` }));
    }, [periodRecords]);

    // Day of Week Distribution
    const dayOfWeekData = useMemo(() => {
        const days = DAYS_OF_WEEK.map((name, i) => ({ name, count: 0, index: i }));
        periodRecords.forEach(r => {
            const date = r.session_date ? parseISO(r.session_date) : parseISO(r.created_at);
            const dayIndex = getDay(date);
            days[dayIndex].count++;
        });
        return days;
    }, [periodRecords]);

    // Report Type Distribution
    const typeData = useMemo(() => {
        const types: Record<string, number> = {};
        periodRecords.forEach(r => {
            const type = r.type_message || 'unknown';
            types[type] = (types[type] || 0) + 1;
        });
        return Object.entries(types).map(([name, value]) => ({ name, value }));
    }, [periodRecords]);

    // Trend Data (Last 14 days or current period)
    const trendData = useMemo(() => {
        // If period is 'all', show last 30 days, otherwise show relevant range limited to say 30 data points
        const days = eachDayOfInterval({
            start: subDays(end, 30), // Show max 30 days for clarity
            end
        });
        return days.map(day => {
            const dayRecs = periodRecords.filter(r => {
                const rDate = r.session_date ? parseISO(r.session_date) : parseISO(r.created_at);
                return isSameDay(rDate, day);
            });
            return {
                date: format(day, 'MMM dd'),
                duration: dayRecs.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0),
                count: dayRecs.length
            };
        });
    }, [periodRecords, end]);

    const bestByDuration = [...studentStats].sort((a, b) => b.totalDuration - a.totalDuration);
    const mostConsistent = [...studentStats].sort((a, b) => b.maxStreak - a.maxStreak);

    // Overall stats
    const totalMissed = studentStats.reduce((acc, s) => acc + s.missedSessions, 0);
    const totalDuration = studentStats.reduce((acc, s) => acc + s.totalDuration, 0);
    const avgCompletion = studentStats.length > 0
        ? Math.round(studentStats.reduce((acc, s) => acc + s.completionRate, 0) / studentStats.length)
        : 0;

    const periodLabels: Record<TimePeriod, string> = {
        day: 'Today',
        week: 'This Week',
        month: 'This Month',
        year: 'This Year',
        all: 'All Time'
    };

    // CSV Export
    const handleExport = () => {
        const headers = ['Name', 'WhatsApp ID', 'Total Duration (min)', 'Sessions', 'Completion %', 'Max Streak', 'Badges'];
        const csvContent = [
            headers.join(','),
            ...studentStats.map(s => [
                `"${s.name || s.whatsapp_id_student}"`,
                `"${s.whatsapp_id_student}"`,
                s.totalDuration,
                s.sessionsCount,
                s.completionRate,
                s.maxStreak,
                `"${s.badges.map(b => b.name).join(', ')}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `student_stats_${period}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
    };

    if (loading) return <div className="Loading">Loading advanced stats...</div>;

    return (
        <div className="page-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <h1 style={{ fontSize: '28px', margin: 0 }}>Statistics Engine</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                        className="input-field"
                        style={{ width: 'auto', padding: '8px 12px' }}
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    >
                        <option value="all">All Groups</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleExport}
                        className="glass-panel"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: '1px solid var(--card-border)', cursor: 'pointer', color: 'var(--text)' }}
                    >
                        <Download size={18} />
                        Export
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="glass-panel" style={{ padding: '4px', marginBottom: '24px', display: 'flex', gap: '4px', overflowX: 'auto' }}>
                {[
                    { id: 'overview', icon: Activity, label: 'Overview' },
                    { id: 'trends', icon: TrendingUp, label: 'Trends' },
                    { id: 'groups', icon: Users, label: 'Groups' },
                    { id: 'consistency', icon: Flame, label: 'Consistency' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        style={{
                            flex: 1,
                            minWidth: '100px',
                            padding: '12px',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                            color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            fontWeight: 600,
                            transition: 'all 0.2s'
                        }}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Period Selector (Universal) */}
            <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', overflowX: 'auto' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Calendar
                        size={18}
                        color="var(--primary)"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                            const dateInput = document.getElementById('date-picker-trigger');
                            if (dateInput) (dateInput as HTMLInputElement).showPicker();
                        }}
                    />
                    <input
                        id="date-picker-trigger"
                        type="date"
                        style={{
                            position: 'absolute',
                            opacity: 0,
                            left: 0,
                            top: 0,
                            width: '100%',
                            height: '100%',
                            cursor: 'pointer'
                        }}
                        onChange={(e) => {
                            if (e.target.value) {
                                setSelectedDate(parseISO(e.target.value));
                                setPeriod('day');
                            }
                        }}
                    />
                    {period === 'day' && !isSameDay(selectedDate, new Date()) && (
                        <span style={{ fontSize: '12px', color: 'var(--primary)', marginLeft: '8px', fontWeight: 600 }}>
                            {format(selectedDate, 'MMM dd')}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {(['day', 'week', 'month', 'year', 'all'] as TimePeriod[]).map(p => (
                        <button
                            key={p}
                            onClick={() => {
                                setPeriod(p);
                                setSelectedDate(new Date()); // Reset to today when changing period type manually
                            }}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                background: period === p ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                color: period === p ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '14px',
                                textTransform: 'capitalize'
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'overview' && (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                        <div className="glass-panel stat-card">
                            <Clock size={20} color="var(--primary)" />
                            <span className="stat-label">Study Duration</span>
                            <span className="stat-value">{formatDuration(totalDuration)}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{periodLabels[period]}</span>
                        </div>
                        <div className="glass-panel stat-card">
                            <Activity size={20} color="var(--success)" />
                            <span className="stat-label">Reports Filed</span>
                            <span className="stat-value">{periodRecords.length}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{periodLabels[period]}</span>
                        </div>
                        {period !== 'all' && (
                            <div className="glass-panel stat-card">
                                <AlertTriangle size={20} color="var(--danger)" />
                                <span className="stat-label">Missed</span>
                                <span className="stat-value">{totalMissed}</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{periodLabels[period]}</span>
                            </div>
                        )}
                        <div className="glass-panel stat-card">
                            <TrendingUp size={20} color="var(--primary)" />
                            <span className="stat-label">Completion</span>
                            <span className="stat-value">{avgCompletion}%</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Average Rate</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        {/* Top Performers Chart */}
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                                <Trophy size={20} color="gold" />
                                Top Students (Duration)
                            </h3>
                            <div style={{ height: '300px', marginTop: '16px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={bestByDuration.slice(0, 7)}
                                        layout="vertical"
                                    >
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            contentStyle={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '12px' }}
                                        />
                                        <Bar
                                            dataKey="totalDuration"
                                            radius={[0, 4, 4, 0]}
                                            onClick={(data) => {
                                                const student = bestByDuration.find(s => s.name === data.name);
                                                if (student) setSelectedStudent(student);
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {bestByDuration.slice(0, 7).map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                Click on a bar to see student details
                            </p>
                        </div>

                        {/* Type Distribution */}
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                                <PieChartIcon size={20} color="var(--primary)" />
                                Report Method Breakdown
                            </h3>
                            <div style={{ height: '300px', marginTop: '16px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={typeData}
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {typeData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '12px' }}
                                        />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'trends' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Growth Chart */}
                    <div className="glass-panel" style={{ padding: '24px' }}>
                        <h3 style={{ marginBottom: '24px' }}>Daily Activity (Last 30 Days)</h3>
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickFormatter={(val) => `${val}m`} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '12px' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="duration"
                                        stroke="var(--primary)"
                                        strokeWidth={3}
                                        dot={{ r: 4, fill: 'var(--primary)' }}
                                        activeDot={{ r: 6 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="count"
                                        stroke="var(--success)"
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                        name="Reports"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        {/* Day of Week */}
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <h3 style={{ fontSize: '18px' }}>Intensity by Weekday</h3>
                            <div style={{ height: '250px', marginTop: '16px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dayOfWeekData}>
                                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                                        <YAxis hide />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '12px' }}
                                        />
                                        <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Hourly Heatmap */}
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <h3 style={{ fontSize: '18px' }}>Reporting Time (Hour)</h3>
                            <div style={{ height: '250px', marginTop: '16px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={hourlyData}>
                                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                                        <YAxis hide />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '12px' }}
                                        />
                                        <Bar dataKey="count" fill="var(--success)" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'groups' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="glass-panel" style={{ padding: '24px' }}>
                        <h3 style={{ marginBottom: '24px' }}>Group Performance Comparison</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                            {groupStats.map((group, i) => (
                                <div key={i} className="glass-panel" style={{ padding: '20px', borderLeft: `4px solid ${COLORS[i % COLORS.length]}` }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>{group.name}</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Time</div>
                                            <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatDuration(group.totalDuration)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Students</div>
                                            <div style={{ fontSize: '20px', fontWeight: 700 }}>{group.studentCount}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avg/Session</div>
                                            <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatDuration(group.avgDuration)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Reports</div>
                                            <div style={{ fontSize: '20px', fontWeight: 700 }}>{group.sessionsCount}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '24px' }}>
                        <h3>Group Market Share (Study Time)</h3>
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={groupStats.map(g => ({ name: g.name, value: g.totalDuration }))}
                                        innerRadius={60}
                                        outerRadius={100}
                                        dataKey="value"
                                        label
                                    >
                                        {groupStats.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'consistency' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                    <div className="glass-panel" style={{ padding: '24px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Flame size={20} color="#ff4d00" />
                            Reporting Streaks
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                            Consecutive days of reporting study sessions.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {mostConsistent.slice(0, 10).map((student, i) => (
                                <div
                                    key={student.id}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', cursor: 'pointer' }}
                                    onClick={() => setSelectedStudent(student)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontWeight: 800, color: i < 3 ? '#ff4d00' : 'var(--text-muted)', width: '20px' }}>#{i + 1}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 600 }}>{student.name}</span>
                                            {student.badges.map((b: Badge) => (
                                                <b.icon key={b.id} size={14} color={b.color} fill={b.id === 'star' ? b.color : 'none'} />
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Max Streak</div>
                                            <div style={{ color: '#ff4d00', fontWeight: 800 }}>{student.maxStreak} days</div>
                                        </div>
                                        {student.currentStreak > 0 && (
                                            <div style={{ textAlign: 'right', padding: '4px 8px', background: 'rgba(255, 77, 0, 0.1)', borderRadius: '8px' }}>
                                                <div style={{ fontSize: '10px', color: '#ff4d00', textTransform: 'uppercase' }}>Current</div>
                                                <div style={{ color: '#ff4d00', fontWeight: 800 }}>{student.currentStreak} 🔥</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '24px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Filter size={20} color="var(--primary)" />
                            Consistency Leaderboard
                        </h3>
                        <div style={{ marginTop: '20px', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>STUDENT</th>
                                        <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>SESSIONS</th>
                                        <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>COMPLETION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bestByDuration.map((s) => (
                                        <tr
                                            key={s.id}
                                            style={{ borderBottom: '1px solid var(--card-border)', cursor: 'pointer' }}
                                            onClick={() => setSelectedStudent(s)}
                                        >
                                            <td style={{ padding: '12px 8px', fontWeight: 500 }}>{s.name}</td>
                                            <td style={{ textAlign: 'center', padding: '12px 8px' }}>{s.sessionsCount}</td>
                                            <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                                                <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', position: 'relative' }}>
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: 0,
                                                        height: '100%',
                                                        width: `${Math.min(100, s.completionRate)}%`,
                                                        background: s.completionRate > 80 ? 'var(--success)' : s.completionRate > 50 ? 'var(--primary)' : 'var(--danger)',
                                                        borderRadius: '3px'
                                                    }} />
                                                </div>
                                                <div style={{ fontSize: '10px', marginTop: '4px', color: 'var(--text-muted)' }}>{s.completionRate}%</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Student Detail Modal */}
            {selectedStudent && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    padding: '20px'
                }}>
                    <div className="glass-panel" style={{ padding: '0', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--card-border)' }}>
                        <div style={{ padding: '24px', background: 'linear-gradient(180deg, rgba(99,102,241,0.2) 0%, rgba(30,30,35,0) 100%)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '24px' }}>{selectedStudent.name}</h2>
                                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{selectedStudent.whatsapp_id_student}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedStudent(null)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                >
                                    <X size={24} color="var(--text-muted)" />
                                </button>
                            </div>

                            {/* Badges */}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                                {selectedStudent.badges.length > 0 ? (
                                    selectedStudent.badges.map((b: Badge) => (
                                        <div key={b.id} title={b.description} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', background: `${b.color}20`, border: `1px solid ${b.color}40`, fontSize: '12px', fontWeight: 600, color: b.color }}>
                                            <b.icon size={14} />
                                            {b.name}
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No badges earned yet</p>
                                )}
                            </div>
                        </div>

                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Total Study Time</div>
                                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>{formatDuration(selectedStudent.totalDuration)}</div>
                                </div>
                                <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Avg Session</div>
                                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)', marginTop: '4px' }}>{formatDuration(selectedStudent.avgDuration)}</div>
                                </div>
                                <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Current Streak</div>
                                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#ff4d00', marginTop: '4px' }}>{selectedStudent.currentStreak} 🔥</div>
                                </div>
                                <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Reports</div>
                                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>{selectedStudent.sessionsCount}</div>
                                </div>
                            </div>

                            <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Recent Activity</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {records
                                    .filter(r => r.whatsapp_id_student === selectedStudent.whatsapp_id_student)
                                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                    .slice(0, 5) // Last 5 records
                                    .map(record => (
                                        <div key={record.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '8px', borderRadius: '50%' }}>
                                                    <Activity size={16} color="var(--primary)" />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 500 }}>
                                                        {record.session_date ? format(parseISO(record.session_date), 'MMM d, yyyy') : format(parseISO(record.created_at), 'MMM d, yyyy')}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        {record.time_sent ? record.time_sent.substring(0, 5) : '-'} • {record.type_message || 'Text'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ fontWeight: 600 }}>
                                                {formatDuration(record.duration_minutes || 0)}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
