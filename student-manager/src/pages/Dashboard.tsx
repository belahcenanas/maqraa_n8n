import { useEffect, useState } from 'react';
import { supabase, type MyRecord, type Student } from '../lib/supabase';
import { startOfWeek, endOfWeek, format, parseISO, addDays, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

import { AlertCircle, Clock, CheckCircle, Calendar, User, ChevronLeft, ChevronRight, X } from 'lucide-react';

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

// Helper to format time from ISO string or time string
function formatTime(timeStr: string | null): string {
    if (!timeStr) return '-';
    try {
        // If it's a full ISO datetime, parse and format
        if (timeStr.includes('T') || timeStr.includes('-')) {
            const date = parseISO(timeStr);
            return format(date, 'HH:mm');
        }
        // If it's already a time string (HH:mm:ss or HH:mm), just return the HH:mm part
        const timeParts = timeStr.split(':');
        if (timeParts.length >= 2) {
            return `${timeParts[0]}:${timeParts[1]}`;
        }
        return timeStr;
    } catch {
        return timeStr;
    }
}

export default function Dashboard() {
    const [records, setRecords] = useState<MyRecord[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [selectedRecord, setSelectedRecord] = useState<MyRecord | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingSessionDate, setEditingSessionDate] = useState(false);
    const [newSessionDate, setNewSessionDate] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'time' | 'duration' | 'status'>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [filterOption, setFilterOption] = useState<'all' | 'sent' | 'missing'>('all');
    const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());

    const ALLOWED_DAYS = ['Monday', 'Tuesday', 'Thursday', 'Friday'];

    useEffect(() => {
        fetchData();
    }, []);

    // Check if a date is an allowed day (Monday, Tuesday, Thursday, Friday)
    const isAllowedDay = (dateStr: string): boolean => {
        const date = parseISO(dateStr);
        const dayName = format(date, 'EEEE');
        return ALLOWED_DAYS.includes(dayName);
    };

    async function fetchData() {
        try {
            setLoading(true);
            setError(null);

            // Fetch Students
            const { data: studentsData, error: studentsError } = await supabase
                .from('students')
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

    // Filter records for the week containing the selected date
    const selectedDateObj = parseISO(selectedDate);
    const weekStart = startOfWeek(selectedDateObj, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDateObj, { weekStartsOn: 1 });

    const currentWeekRecords = records.filter(r => {
        // Use session_date if available, otherwise fall back to created_at
        const dateToUse = r.session_date ? new Date(r.session_date) : new Date(r.created_at);
        return dateToUse >= weekStart && dateToUse <= weekEnd;
    });

    // Filter records for selected date (for daily view)
    const selectedDateRecordsAll = records.filter(r => {
        // Only show records where session_date matches
        return r.session_date === selectedDate;
    });

    // Get only the most recent record per student for the selected date
    const selectedDateRecords = selectedDateRecordsAll.reduce((acc, record) => {
        const existing = acc.find(r => r.whatsapp_id_student === record.whatsapp_id_student);
        if (!existing) {
            acc.push(record);
        } else {
            // Keep the most recent one (by created_at)
            if (new Date(record.created_at) > new Date(existing.created_at)) {
                const index = acc.indexOf(existing);
                acc[index] = record;
            }
        }
        return acc;
    }, [] as MyRecord[]);

    // Create daily student activity list
    const dailyStudentActivity = students.map(student => {
        const studentRecord = selectedDateRecords.find(r => r.whatsapp_id_student === student.whatsapp_id_student);
        const durationMinutes = studentRecord?.duration_minutes || 0;

        return {
            ...student,
            hasRecord: !!studentRecord,
            record: studentRecord || null,
            time: studentRecord?.time_sent || null,
            durationMinutes,
            durationFormatted: formatDuration(durationMinutes)
        };
    });

    // Sort student activity
    const filteredActivity = filterOption === 'all'
        ? dailyStudentActivity
        : filterOption === 'sent'
        ? dailyStudentActivity.filter(s => s.hasRecord)
        : dailyStudentActivity.filter(s => !s.hasRecord);

    const sortedActivity = [...filteredActivity].sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
            case 'name':
                const nameA = (a.name || a.whatsapp_id_student || '').toLowerCase();
                const nameB = (b.name || b.whatsapp_id_student || '').toLowerCase();
                comparison = nameA.localeCompare(nameB);
                break;
            case 'time':
                // Sort by time, missing records go to end
                if (!a.time && !b.time) comparison = 0;
                else if (!a.time) comparison = 1;
                else if (!b.time) comparison = -1;
                else comparison = a.time.localeCompare(b.time);
                break;
            case 'duration':
                comparison = a.durationMinutes - b.durationMinutes;
                break;
            case 'status':
                comparison = (a.hasRecord ? 1 : 0) - (b.hasRecord ? 1 : 0);
                break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
    });

    const handleSort = (column: 'name' | 'time' | 'duration' | 'status') => {
        if (sortBy === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortDirection('asc');
        }
    };

    // Functions for date navigation
    const goToPreviousDay = () => {
        let prevDay = subDays(parseISO(selectedDate), 1);
        // Skip to previous allowed day
        while (!isAllowedDay(format(prevDay, 'yyyy-MM-dd'))) {
            prevDay = subDays(prevDay, 1);
        }
        setSelectedDate(format(prevDay, 'yyyy-MM-dd'));
    };

    const goToNextDay = () => {
        let nextDay = addDays(parseISO(selectedDate), 1);
        // Skip to next allowed day
        while (!isAllowedDay(format(nextDay, 'yyyy-MM-dd'))) {
            nextDay = addDays(nextDay, 1);
        }
        setSelectedDate(format(nextDay, 'yyyy-MM-dd'));
    };

    const handleDateChange = (dateStr: string) => {
        if (isAllowedDay(dateStr)) {
            setSelectedDate(dateStr);
        } else {
            // Find nearest allowed day
            let nearestDay = parseISO(dateStr);
            let attempts = 0;
            while (!isAllowedDay(format(nearestDay, 'yyyy-MM-dd')) && attempts < 7) {
                nearestDay = addDays(nearestDay, 1);
                attempts++;
            }
            if (isAllowedDay(format(nearestDay, 'yyyy-MM-dd'))) {
                setSelectedDate(format(nearestDay, 'yyyy-MM-dd'));
            }
        }
    };

    const handleRecordClick = (record: MyRecord | null) => {
        if (record) {
            setSelectedRecord(record);
            setNewSessionDate(record.session_date || '');
            setEditingSessionDate(false);
            setShowModal(true);
        }
    };

    const handleUpdateSessionDate = async () => {
        if (!selectedRecord || !newSessionDate) return;

        if (!isAllowedDay(newSessionDate)) {
            alert('Please select Monday, Tuesday, Thursday, or Friday only.');
            return;
        }

        const { error } = await supabase
            .from('myrecords')
            .update({ session_date: newSessionDate })
            .eq('id', selectedRecord.id);

        if (error) {
            alert('Error updating session date: ' + error.message);
            return;
        }

        setEditingSessionDate(false);
        fetchData();
        setShowModal(false);
    };

    const isMobile = () => {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    };

    // Calculate Total Duration
    const totalDuration = records.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);

    // Calculate Completion per Student
    const studentStats = students.map(student => {
        const studentRecords = currentWeekRecords.filter(r => r.whatsapp_id_student === student.whatsapp_id_student);
        // Derive session day from session_date instead of using session_day field
        // Only count unique days based on session_date
        const submittedDays = new Set(
            studentRecords
                .filter(r => r.session_date) // Only records with valid session_date
                .map(r => format(parseISO(r.session_date!), 'EEEE'))
        );
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

    // Chart Data: Duration per Student for selected date (Top 7)
    const dailyLeaderboard = students.map(student => {
        const studentDayRecords = selectedDateRecords.filter(r => r.whatsapp_id_student === student.whatsapp_id_student);
        const dayDuration = studentDayRecords.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
        return {
            ...student,
            dayDuration
        };
    }).filter(s => s.dayDuration > 0);

    const chartData = dailyLeaderboard
        .sort((a, b) => b.dayDuration - a.dayDuration)
        .slice(0, 7)
        .map(s => ({
            name: s.name?.split(' ')[0] || s.whatsapp_id_student,
            duration: s.dayDuration,
            hours: Math.floor(s.dayDuration / 60),
            minutes: s.dayDuration % 60,
            displayText: `${Math.floor(s.dayDuration / 60)}h ${s.dayDuration % 60}m`,
            color: s.color || '#6366f1'
        }));

    if (loading) return <div className="Loading">Loading stats...</div>;
    if (error) return <div className="Error" style={{ color: 'var(--danger)', padding: '20px' }}>Error: {error}</div>;

    return (
        <div>
            <h1 style={{ fontSize: '28px', marginBottom: '24px' }}>Dashboard</h1>

            {/* Date Selector */}
            <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Calendar size={20} color="var(--primary)" />
                        <label style={{ fontWeight: 500 }}>Select Date:</label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={goToPreviousDay}
                            style={{
                                padding: '8px',
                                borderRadius: '8px',
                                border: '1px solid var(--card-border)',
                                background: 'var(--card-bg)',
                                color: 'var(--text)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => handleDateChange(e.target.value)}
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
                            onClick={goToNextDay}
                            style={{
                                padding: '8px',
                                borderRadius: '8px',
                                border: '1px solid var(--card-border)',
                                background: 'var(--card-bg)',
                                color: 'var(--text)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            <ChevronRight size={20} />
                        </button>
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
            </div>

            {/* Daily Student Activity */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <User size={20} color="var(--primary)" />
                        Student Activity - {format(parseISO(selectedDate), 'EEEE, MMM d, yyyy')}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                        <label style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Show:</label>
                        <select
                            value={filterOption}
                            onChange={(e) => setFilterOption(e.target.value as 'all' | 'sent' | 'missing')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--card-border)',
                                background: 'var(--card-bg)',
                                color: 'var(--text)',
                                fontSize: '14px',
                                cursor: 'pointer',
                                fontWeight: 500
                            }}
                        >
                            <option value="all">All ({dailyStudentActivity.length})</option>
                            <option value="sent">Sent ({dailyStudentActivity.filter(s => s.hasRecord).length})</option>
                            <option value="missing">Missing ({dailyStudentActivity.filter(s => !s.hasRecord).length})</option>
                        </select>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 500, width: '40px' }}>
                                    <input 
                                        type="checkbox" 
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                const missingIds = sortedActivity.filter(s => !s.hasRecord).map(s => s.id);
                                                setSelectedStudents(new Set(missingIds));
                                            } else {
                                                setSelectedStudents(new Set());
                                            }
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </th>
                                <th
                                    onClick={() => handleSort('name')}
                                    style={{
                                        textAlign: 'left',
                                        padding: '12px 8px',
                                        color: 'var(--text-muted)',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        userSelect: 'none'
                                    }}
                                >
                                    Student {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    onClick={() => handleSort('time')}
                                    style={{
                                        textAlign: 'center',
                                        padding: '12px 8px',
                                        color: 'var(--text-muted)',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        userSelect: 'none'
                                    }}
                                >
                                    Time Sent {sortBy === 'time' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    onClick={() => handleSort('duration')}
                                    style={{
                                        textAlign: 'center',
                                        padding: '12px 8px',
                                        color: 'var(--text-muted)',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        userSelect: 'none'
                                    }}
                                >
                                    Duration {sortBy === 'duration' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    onClick={() => handleSort('status')}
                                    style={{
                                        textAlign: 'center',
                                        padding: '12px 8px',
                                        color: 'var(--text-muted)',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        userSelect: 'none'
                                    }}
                                >
                                    Status {sortBy === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedActivity.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No students found
                                    </td>
                                </tr>
                            ) : (
                                sortedActivity.map(student => (
                                    <tr
                                        key={student.id}
                                        onClick={() => isMobile() && handleRecordClick(student.record)}
                                        onDoubleClick={() => !isMobile() && handleRecordClick(student.record)}
                                        style={{
                                            borderBottom: '1px solid var(--card-border)',
                                            background: !student.hasRecord ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                            cursor: student.hasRecord ? 'pointer' : 'default',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (student.hasRecord) {
                                                e.currentTarget.style.background = !student.hasRecord ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.1)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = !student.hasRecord ? 'rgba(239, 68, 68, 0.1)' : 'transparent';
                                        }}
                                    >
                                        <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                                            {!student.hasRecord && (
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedStudents.has(student.id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        const newSelected = new Set(selectedStudents);
                                                        if (e.target.checked) {
                                                            newSelected.add(student.id);
                                                        } else {
                                                            newSelected.delete(student.id);
                                                        }
                                                        setSelectedStudents(newSelected);
                                                    }}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            )}
                                        </td>
                                        <td style={{
                                            padding: '12px 8px',
                                            fontWeight: 500,
                                            color: !student.hasRecord ? 'var(--danger)' : 'var(--text)'
                                        }}>
                                            {student.name || student.whatsapp_id_student || 'Unknown'}
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

            {/* Chart */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '32px', height: '300px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '20px' }}>Leaderboard - {format(parseISO(selectedDate), 'MMM d')} (Minutes)</h3>
                <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                            <XAxis
                                dataKey="name"
                                stroke="var(--text-muted)"
                                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                            />
                            <Tooltip
                                contentStyle={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '12px' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                formatter={(value: number | undefined) => {
                                    if (value === undefined) return ['0h 0m', 'Duration'];
                                    const hours = Math.floor(value / 60);
                                    const mins = value % 60;
                                    return [`${hours}h ${mins}m`, 'Duration'];
                                }}
                            />
                            <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
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
                    Missing Reports ({format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                    {problematicStudents.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>All good! Everyone reported in.</p>
                    ) : (
                        problematicStudents.map(student => (
                            <div key={student.id} className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{student.name || student.whatsapp_id_student || 'Unknown'}</div>
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

            {/* Record Detail Modal */}
            {showModal && selectedRecord && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    padding: '20px'
                }}>
                    <div className="glass-panel" style={{ padding: '24px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>Record Details</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                <X size={24} color="var(--text-muted)" />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Student</div>
                                <div style={{ fontWeight: 600 }}>
                                    {students.find(s => s.whatsapp_id_student === selectedRecord.whatsapp_id_student)?.name || selectedRecord.whatsapp_id_student || 'Unknown'}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>WhatsApp ID</div>
                                <div style={{ fontWeight: 500 }}>{selectedRecord.whatsapp_id_student || '-'}</div>
                            </div>

                            {selectedRecord.uid_whatsapp && (
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>UID WhatsApp</div>
                                    <div style={{ fontWeight: 500, fontSize: '13px', wordBreak: 'break-all' }}>{selectedRecord.uid_whatsapp}</div>
                                </div>
                            )}

                            {selectedRecord.type_message && (
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Message Type</div>
                                    <div style={{ fontWeight: 500 }}>{selectedRecord.type_message}</div>
                                </div>
                            )}

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Session Date</div>
                                <div style={{ fontWeight: 500 }}>
                                    {selectedRecord.session_date ? format(parseISO(selectedRecord.session_date), 'EEEE, MMM d, yyyy') : '-'}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Session Date</div>
                                {editingSessionDate ? (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <input
                                            type="date"
                                            value={newSessionDate}
                                            onChange={(e) => setNewSessionDate(e.target.value)}
                                            style={{
                                                flex: 1,
                                                minWidth: '150px',
                                                padding: '6px 10px',
                                                borderRadius: '6px',
                                                border: '1px solid var(--card-border)',
                                                background: 'var(--card-bg)',
                                                color: 'var(--text)',
                                                fontSize: '14px',
                                                cursor: 'pointer'
                                            }}
                                        />
                                        <button
                                            onClick={handleUpdateSessionDate}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                background: 'var(--success)',
                                                color: 'white',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: 500
                                            }}
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setEditingSessionDate(false)}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid var(--card-border)',
                                                background: 'var(--card-bg)',
                                                color: 'var(--text)',
                                                cursor: 'pointer',
                                                fontSize: '13px'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <div style={{ fontWeight: 500, flex: 1 }}>
                                            {selectedRecord.session_date ? format(parseISO(selectedRecord.session_date), 'EEEE, MMM d, yyyy') : '-'}
                                        </div>
                                        <button
                                            onClick={() => setEditingSessionDate(true)}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid var(--primary)',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                color: 'var(--primary)',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: 500
                                            }}
                                        >
                                            Edit
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Session Day</div>
                                <div style={{ fontWeight: 500 }}>
                                    {selectedRecord.session_date
                                        ? format(parseISO(selectedRecord.session_date), 'EEEE')
                                        : (selectedRecord.session_day || '-')
                                    }
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Time Sent</div>
                                <div style={{ fontWeight: 500 }}>{formatTime(selectedRecord.time_sent)}</div>
                            </div>

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Duration</div>
                                <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '18px' }}>
                                    {formatDuration(selectedRecord.duration_minutes || 0)}
                                </div>
                            </div>

                            {selectedRecord.message_text && (
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Message</div>
                                    <div style={{
                                        background: 'rgba(99, 102, 241, 0.1)',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        whiteSpace: 'pre-wrap',
                                        fontSize: '14px',
                                        lineHeight: '1.6'
                                    }}>
                                        {selectedRecord.message_text}
                                    </div>
                                </div>
                            )}

                            {selectedRecord.ai_explanation && (
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>AI Explanation</div>
                                    <div style={{
                                        background: 'rgba(34, 197, 94, 0.1)',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        lineHeight: '1.6',
                                        color: 'var(--text-muted)'
                                    }}>
                                        {selectedRecord.ai_explanation}
                                    </div>
                                </div>
                            )}

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Day Sent</div>
                                <div style={{ fontWeight: 500 }}>{selectedRecord.day_sent || '-'}</div>
                            </div>

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Created At</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    {format(parseISO(selectedRecord.created_at), 'MMM d, yyyy HH:mm:ss')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
