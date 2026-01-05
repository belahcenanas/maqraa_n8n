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
    addDays,
    addWeeks,
    addMonths,
    addYears,
    subWeeks,
    subMonths,
    subYears,
    differenceInDays,
    getDay
} from 'date-fns';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    LineChart, Line, CartesianGrid
} from 'recharts';
import {
    Trophy, AlertTriangle, Clock, TrendingUp,
    Users, Activity, Flame,
    Download, X, Star, Sunrise, Moon, Zap, User, ChevronLeft, ChevronRight
} from 'lucide-react';

type TimePeriod = 'day' | 'week' | 'month' | 'year' | 'all';
type StatsMode = 'group' | 'student';

const REQUIRED_DAYS = ['Monday', 'Tuesday', 'Thursday', 'Friday'];
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7'];

interface Badge {
    id: string;
    name: string;
    icon: any;
    color: string;
    description: string;
}

// Helper to convert minutes to hours display
function formatHours(minutes: number): string {
    if (minutes === 0) return '0h';
    const hours = (minutes / 60).toFixed(1);
    return `${hours}h`;
}

// Helper to convert minutes to hours and minutes display
function formatDuration(minutes: number): string {
    if (minutes === 0) return '0h';
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
            return { start: new Date(2024, 0, 1), end: endOfDay(new Date()) };
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
            return 0;
    }
}

function assignBadges(studentRecords: MyRecord[], _totalDuration: number, completionRate: number, maxStreak: number): Badge[] {
    const badges: Badge[] = [];

    if (maxStreak >= 30) badges.push({ id: 'legend', name: 'Legend', icon: Trophy, color: '#FFD700', description: '30+ day streak' });
    else if (maxStreak >= 10) badges.push({ id: 'fire', name: 'On Fire', icon: Flame, color: '#ff4d00', description: '10+ day streak' });
    else if (maxStreak >= 3) badges.push({ id: 'warming-up', name: 'Warming Up', icon: Zap, color: '#fbbf24', description: '3+ day streak' });

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
    const [statsMode, setStatsMode] = useState<StatsMode>('group');
    const [selectedGroupId, setSelectedGroupId] = useState<number | 'all'>('all');
    const [selectedStudentId, setSelectedStudentId] = useState<string | 'all'>('all');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
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
            
            if (statsMode === 'student' && selectedStudentId !== 'all') {
                return isInPeriod && r.whatsapp_id_student === selectedStudentId;
            }
            
            const isStudentFiltered = selectedGroupId === 'all' ||
                students.find(s => s.whatsapp_id_student === r.whatsapp_id_student)?.group_id === selectedGroupId;
            return isInPeriod && isStudentFiltered;
        });
    }, [records, start, end, selectedGroupId, students, statsMode, selectedStudentId]);

    const studentStats = useMemo(() => {
        return filteredStudents.map(student => {
            const studentPeriodRecords = periodRecords.filter(r => r.whatsapp_id_student === student.whatsapp_id_student);
            const totalDuration = studentPeriodRecords.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
            const sessionsCount = studentPeriodRecords.length;
            const missedSessions = period !== 'all' ? Math.max(0, expectedSessions - sessionsCount) : 0;
            const completionRate = expectedSessions > 0 ? Math.round((sessionsCount / expectedSessions) * 100) : 100;
            const avgDuration = sessionsCount > 0 ? Math.round(totalDuration / sessionsCount) : 0;

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

    // Group Stats
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
                id: group.id,
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

    // Trend Data (Last 30 days)
    const trendData = useMemo(() => {
        const days = eachDayOfInterval({
            start: subDays(end, 30),
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
                hours: parseFloat((dayRecs.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0) / 60).toFixed(1)),
                count: dayRecs.length
            };
        });
    }, [periodRecords, end]);

    const bestByDuration = [...studentStats].sort((a, b) => b.totalDuration - a.totalDuration);
    const mostConsistent = [...studentStats].sort((a, b) => b.maxStreak - a.maxStreak);

    const totalDuration = studentStats.reduce((acc, s) => acc + s.totalDuration, 0);
    const totalMissed = studentStats.reduce((acc, s) => acc + s.missedSessions, 0);
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
        const headers = ['Name', 'WhatsApp ID', 'Total Hours', 'Sessions', 'Completion %', 'Max Streak', 'Badges'];
        const csvContent = [
            headers.join(','),
            ...studentStats.map(s => [
                `"${s.name || s.whatsapp_id_student}"`,
                `"${s.whatsapp_id_student}"`,
                (s.totalDuration / 60).toFixed(1),
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

    // Get selected student data for student mode
    const currentStudentData = useMemo(() => {
        if (statsMode !== 'student' || selectedStudentId === 'all') return null;
        return studentStats.find(s => s.whatsapp_id_student === selectedStudentId);
    }, [statsMode, selectedStudentId, studentStats]);

    if (loading) return <div className="Loading">Loading stats...</div>;

    return (
        <div className="page-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <h1 style={{ fontSize: '28px', margin: 0 }}>Statistics</h1>
                <button
                    onClick={handleExport}
                    className="glass-panel"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: '1px solid var(--card-border)', cursor: 'pointer', color: 'var(--text)' }}
                >
                    <Download size={18} />
                    Export
                </button>
            </div>

            {/* Mode Selector */}
            <div className="glass-panel" style={{ padding: '4px', marginBottom: '24px', display: 'flex', gap: '4px' }}>
                <button
                    onClick={() => setStatsMode('group')}
                    style={{
                        flex: 1,
                        padding: '14px 24px',
                        borderRadius: '12px',
                        border: 'none',
                        background: statsMode === 'group' ? 'var(--primary)' : 'transparent',
                        color: statsMode === 'group' ? 'white' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        fontWeight: 600,
                        fontSize: '16px',
                        transition: 'all 0.2s'
                    }}
                >
                    <Users size={20} />
                    Group Stats
                </button>
                <button
                    onClick={() => setStatsMode('student')}
                    style={{
                        flex: 1,
                        padding: '14px 24px',
                        borderRadius: '12px',
                        border: 'none',
                        background: statsMode === 'student' ? 'var(--primary)' : 'transparent',
                        color: statsMode === 'student' ? 'white' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        fontWeight: 600,
                        fontSize: '16px',
                        transition: 'all 0.2s'
                    }}
                >
                    <User size={20} />
                    Student Stats
                </button>
            </div>

            {/* Filters */}
            <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                {/* Mode-specific filter */}
                {statsMode === 'group' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={18} color="var(--primary)" />
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
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={18} color="var(--primary)" />
                        <select
                            className="input-field"
                            style={{ width: 'auto', padding: '8px 12px', minWidth: '200px' }}
                            value={selectedStudentId}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                        >
                            <option value="all">All Students</option>
                            {students.map(s => (
                                <option key={s.id} value={s.whatsapp_id_student || ''}>{s.name || s.whatsapp_id_student || 'Unknown'}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Period selector */}
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Navigation buttons for non-all periods */}
                    {period !== 'all' && (
                        <>
                            <button
                                onClick={() => {
                                    let newDate = selectedDate;
                                    if (period === 'day') newDate = subDays(selectedDate, 1);
                                    else if (period === 'week') newDate = subWeeks(selectedDate, 1);
                                    else if (period === 'month') newDate = subMonths(selectedDate, 1);
                                    else if (period === 'year') newDate = subYears(selectedDate, 1);
                                    setSelectedDate(newDate);
                                }}
                                style={{
                                    padding: '6px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--card-border)',
                                    background: 'var(--card-bg)',
                                    color: 'var(--text)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <ChevronLeft size={18} />
                            </button>
                            
                            <div style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                background: 'rgba(99, 102, 241, 0.1)',
                                color: 'var(--primary)',
                                fontSize: '13px',
                                fontWeight: 600,
                                whiteSpace: 'nowrap'
                            }}>
                                {period === 'day' && format(selectedDate, 'MMM d, yyyy')}
                                {period === 'week' && `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`}
                                {period === 'month' && format(selectedDate, 'MMMM yyyy')}
                                {period === 'year' && format(selectedDate, 'yyyy')}
                            </div>

                            <button
                                onClick={() => {
                                    let newDate = selectedDate;
                                    if (period === 'day') newDate = addDays(selectedDate, 1);
                                    else if (period === 'week') newDate = addWeeks(selectedDate, 1);
                                    else if (period === 'month') newDate = addMonths(selectedDate, 1);
                                    else if (period === 'year') newDate = addYears(selectedDate, 1);
                                    setSelectedDate(newDate);
                                }}
                                style={{
                                    padding: '6px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--card-border)',
                                    background: 'var(--card-bg)',
                                    color: 'var(--text)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <ChevronRight size={18} />
                            </button>

                            <button
                                onClick={() => setSelectedDate(new Date())}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--primary)',
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    color: 'var(--primary)',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 600
                                }}
                            >
                                Current
                            </button>

                            <div style={{ width: '1px', height: '24px', background: 'var(--card-border)', margin: '0 8px' }} />
                        </>
                    )}

                    {/* Period type buttons */}
                    {(['day', 'week', 'month', 'year', 'all'] as TimePeriod[]).map(p => (
                        <button
                            key={p}
                            onClick={() => {
                                setPeriod(p);
                                if (p !== period) {
                                    setSelectedDate(new Date());
                                }
                            }}
                            style={{
                                padding: '8px 14px',
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

            {/* ===================== GROUP STATS MODE ===================== */}
            {statsMode === 'group' && (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                        <div className="glass-panel stat-card">
                            <Clock size={20} color="var(--primary)" />
                            <span className="stat-label">Total Study Time</span>
                            <span className="stat-value">{formatHours(totalDuration)}</span>
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
                            <span className="stat-label">Avg Completion</span>
                            <span className="stat-value">{avgCompletion}%</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Average Rate</span>
                        </div>
                    </div>

                    {/* Group Performance Cards */}
                    <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={20} color="var(--primary)" />
                            Group Performance ({format(start, 'MMM d')} - {format(end, 'MMM d, yyyy')})
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                            {groupStats.map((group, i) => (
                                <div 
                                    key={group.id} 
                                    className="glass-panel" 
                                    style={{ 
                                        padding: '20px', 
                                        borderLeft: `4px solid ${COLORS[i % COLORS.length]}`,
                                        cursor: 'pointer',
                                        transition: 'transform 0.2s'
                                    }}
                                    onClick={() => setSelectedGroupId(group.id)}
                                >
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>{group.name}</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Hours</div>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>{formatHours(group.totalDuration)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Students</div>
                                            <div style={{ fontSize: '20px', fontWeight: 700 }}>{group.studentCount}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avg/Session</div>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success)' }}>{formatDuration(group.avgDuration)}</div>
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

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                        {/* Top Performers */}
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                                <Trophy size={20} color="gold" />
                                Top Students (Hours)
                            </h3>
                            <div style={{ height: '300px', marginTop: '16px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={bestByDuration.slice(0, 7)} layout="vertical">
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            contentStyle={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '12px' }}
                                            formatter={(value: number | undefined) => [`${formatHours(value || 0)}`, 'Study Time']}
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
                                            {bestByDuration.slice(0, 7).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Consistency Leaderboard */}
                        <div className="glass-panel" style={{ padding: '20px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                                <Flame size={20} color="#ff4d00" />
                                Consistency Streaks
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                                {mostConsistent.slice(0, 8).map((student, i) => (
                                    <div
                                        key={student.id}
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', cursor: 'pointer' }}
                                        onClick={() => setSelectedStudent(student)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontWeight: 800, color: i < 3 ? '#ff4d00' : 'var(--text-muted)', width: '24px' }}>#{i + 1}</span>
                                            <span style={{ fontWeight: 500 }}>{student.name}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <span style={{ color: '#ff4d00', fontWeight: 700 }}>{student.maxStreak} days</span>
                                            {student.currentStreak > 0 && (
                                                <span style={{ padding: '2px 8px', background: 'rgba(255, 77, 0, 0.15)', borderRadius: '8px', fontSize: '12px', color: '#ff4d00' }}>
                                                    {student.currentStreak} 🔥
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Trends */}
                    <div className="glass-panel" style={{ padding: '24px' }}>
                        <h3 style={{ marginBottom: '24px' }}>Daily Activity Trend (Hours)</h3>
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickFormatter={(val) => `${val}h`} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '12px' }}
                                        formatter={(value: number | undefined, name?: string) => [name === 'hours' ? `${value || 0}h` : (value || 0), name === 'hours' ? 'Study Time' : 'Reports']}
                                    />
                                    <Line type="monotone" dataKey="hours" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--primary)' }} activeDot={{ r: 6 }} name="hours" />
                                    <Line type="monotone" dataKey="count" stroke="var(--success)" strokeWidth={2} strokeDasharray="5 5" name="Reports" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}

            {/* ===================== STUDENT STATS MODE ===================== */}
            {statsMode === 'student' && (
                <>
                    {selectedStudentId === 'all' ? (
                        <>
                            {/* All Students Overview */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                                <div className="glass-panel stat-card">
                                    <Users size={20} color="var(--primary)" />
                                    <span className="stat-label">Total Students</span>
                                    <span className="stat-value">{students.length}</span>
                                </div>
                                <div className="glass-panel stat-card">
                                    <Clock size={20} color="var(--success)" />
                                    <span className="stat-label">Total Hours</span>
                                    <span className="stat-value">{formatHours(totalDuration)}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{periodLabels[period]}</span>
                                </div>
                                <div className="glass-panel stat-card">
                                    <Activity size={20} color="var(--primary)" />
                                    <span className="stat-label">Avg per Student</span>
                                    <span className="stat-value">{formatHours(students.length > 0 ? totalDuration / students.length : 0)}</span>
                                </div>
                            </div>

                            {/* Student List */}
                            <div className="glass-panel" style={{ padding: '24px' }}>
                                <h3 style={{ marginBottom: '20px' }}>All Students</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                                                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>STUDENT</th>
                                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>HOURS</th>
                                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>SESSIONS</th>
                                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>STREAK</th>
                                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>BADGES</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bestByDuration.map((s) => (
                                                <tr
                                                    key={s.id}
                                                    style={{ borderBottom: '1px solid var(--card-border)', cursor: 'pointer' }}
                                                    onClick={() => setSelectedStudentId(s.whatsapp_id_student || '')}
                                                >
                                                    <td style={{ padding: '12px 8px', fontWeight: 500 }}>{s.name}</td>
                                                    <td style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 600, color: 'var(--primary)' }}>{formatHours(s.totalDuration)}</td>
                                                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>{s.sessionsCount}</td>
                                                    <td style={{ textAlign: 'center', padding: '12px 8px', color: '#ff4d00', fontWeight: 600 }}>{s.maxStreak} days</td>
                                                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                            {s.badges.slice(0, 3).map((b: Badge) => (
                                                                <b.icon key={b.id} size={14} color={b.color} />
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : currentStudentData && (
                        <>
                            {/* Individual Student Stats */}
                            <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', background: 'linear-gradient(180deg, rgba(99,102,241,0.15) 0%, rgba(30,30,35,0) 100%)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '28px' }}>{currentStudentData.name}</h2>
                                        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{currentStudentData.whatsapp_id_student}</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {currentStudentData.badges.map((b: Badge) => (
                                            <div key={b.id} title={b.description} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', background: `${b.color}20`, border: `1px solid ${b.color}40`, fontSize: '12px', fontWeight: 600, color: b.color }}>
                                                <b.icon size={14} />
                                                {b.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Student Summary Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                                <div className="glass-panel stat-card">
                                    <Clock size={20} color="var(--primary)" />
                                    <span className="stat-label">Total Study Time</span>
                                    <span className="stat-value">{formatHours(currentStudentData.totalDuration)}</span>
                                </div>
                                <div className="glass-panel stat-card">
                                    <Activity size={20} color="var(--success)" />
                                    <span className="stat-label">Sessions</span>
                                    <span className="stat-value">{currentStudentData.sessionsCount}</span>
                                </div>
                                <div className="glass-panel stat-card">
                                    <TrendingUp size={20} color="var(--primary)" />
                                    <span className="stat-label">Avg/Session</span>
                                    <span className="stat-value">{formatDuration(currentStudentData.avgDuration)}</span>
                                </div>
                                <div className="glass-panel stat-card">
                                    <Flame size={20} color="#ff4d00" />
                                    <span className="stat-label">Max Streak</span>
                                    <span className="stat-value">{currentStudentData.maxStreak} days</span>
                                </div>
                                {currentStudentData.currentStreak > 0 && (
                                    <div className="glass-panel stat-card" style={{ background: 'rgba(255, 77, 0, 0.1)' }}>
                                        <Flame size={20} color="#ff4d00" />
                                        <span className="stat-label">Current Streak</span>
                                        <span className="stat-value" style={{ color: '#ff4d00' }}>{currentStudentData.currentStreak} 🔥</span>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                                {/* Day of Week */}
                                <div className="glass-panel" style={{ padding: '20px' }}>
                                    <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Activity by Weekday</h3>
                                    <div style={{ height: '250px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={dayOfWeekData}>
                                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                                                <YAxis hide />
                                                <Tooltip contentStyle={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '12px' }} />
                                                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Hourly Distribution */}
                                <div className="glass-panel" style={{ padding: '20px' }}>
                                    <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Reporting Time (Hour)</h3>
                                    <div style={{ height: '250px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={hourlyData}>
                                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                                                <YAxis hide />
                                                <Tooltip contentStyle={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '12px' }} />
                                                <Bar dataKey="count" fill="var(--success)" radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className="glass-panel" style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Recent Activity</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {records
                                        .filter(r => r.whatsapp_id_student === selectedStudentId)
                                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                        .slice(0, 10)
                                        .map(record => (
                                            <div key={record.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '8px', borderRadius: '50%' }}>
                                                        <Activity size={16} color="var(--primary)" />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>
                                                            {record.session_date ? format(parseISO(record.session_date), 'EEEE, MMM d, yyyy') : format(parseISO(record.created_at), 'EEEE, MMM d, yyyy')}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                            {record.time_sent ? record.time_sent.substring(0, 5) : '-'} • {record.type_message || 'Text'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                                    {formatHours(record.duration_minutes || 0)}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Student Detail Modal (for group mode clicks) */}
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
                                <button onClick={() => setSelectedStudent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                                    <X size={24} color="var(--text-muted)" />
                                </button>
                            </div>

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
                                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>{formatHours(selectedStudent.totalDuration)}</div>
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
                                    .slice(0, 5)
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
                                            <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                                {formatHours(record.duration_minutes || 0)}
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
