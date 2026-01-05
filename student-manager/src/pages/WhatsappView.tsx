import { useEffect, useState, useRef } from 'react';
import { supabase, type MyRecord, type Student } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { MessageCircle, X } from 'lucide-react';

export default function WhatsappView() {
    const [records, setRecords] = useState<MyRecord[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const [editingRecord, setEditingRecord] = useState<MyRecord | null>(null);
    const [editSessionDate, setEditSessionDate] = useState('');
    const [editDuration, setEditDuration] = useState(0);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!loading && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [records, loading]);

    async function fetchData() {
        try {
            setLoading(true);
            
            // Fetch Students
            const { data: studentsData, error: studentsError } = await supabase
                .from('students')
                .select('*');

            if (studentsError) throw studentsError;

            // Fetch Records - Ordered by day_sent ASC, then time_sent ASC
            const { data: recordsData, error: recordsError } = await supabase
                .from('myrecords')
                .select('*')
                .order('day_sent', { ascending: true })
                .order('time_sent', { ascending: true });

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

    // Helper to get student name
    const getStudentName = (whatsappId: string | null) => {
        if (!whatsappId) return 'Unknown';
        const student = students.find(s => s.whatsapp_id_student === whatsappId);
        return student?.name || whatsappId;
    };

    // Helper to format time
    const formatTime = (timeStr: string | null) => {
        if (!timeStr) return '';
        try {
            if (timeStr.includes('T') || timeStr.includes('-')) {
                return format(parseISO(timeStr), 'HH:mm');
            }
            const parts = timeStr.split(':');
            if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
            return timeStr;
        } catch {
            return timeStr;
        }
    };

    // Generate a consistent color for a name
    const getColorForName = (name: string) => {
        const colors = [
            '#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab', 
            '#1e88e5', '#039be5', '#00acc1', '#00897b', '#43a047', 
            '#7cb342', '#c0ca33', '#fdd835', '#ffb300', '#fb8c00', 
            '#f4511e', '#6d4c41', '#757575', '#546e7a'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    // Handle record click to editb
    const handleRecordClick = (record: MyRecord) => {
        setEditingRecord(record);
        setEditSessionDate(record.session_date || '');
        setEditDuration(record.duration_minutes || 0);
    };

    // Handle save changes
    const handleSaveChanges = async () => {
        if (!editingRecord) return;

        // Derive session_day from session_date
        const sessionDay = editSessionDate ? format(parseISO(editSessionDate), 'EEEE') : null;

        const { error } = await supabase
            .from('myrecords')
            .update({ 
                session_date: editSessionDate,
                session_day: sessionDay,
                duration_minutes: editDuration
            })
            .eq('id', editingRecord.id);

        if (error) {
            alert('Error updating record: ' + error.message);
            return;
        }

        // Close modal first
        setEditingRecord(null);
        
        // Refresh data
        await fetchData();
    };

    // Group records by day_sent
    const groupedRecords: { date: string; records: MyRecord[] }[] = [];
    
    records.forEach(record => {
        // Use day_sent as primary grouping key, fallback to session_date or created_at
        const date = record.day_sent || record.session_date || record.created_at.split('T')[0];
        const existingGroup = groupedRecords.find(g => g.date === date);
        if (existingGroup) {
            existingGroup.records.push(record);
        } else {
            groupedRecords.push({ date, records: [record] });
        }
    });

    // Sort groups by date ascending (oldest first)
    groupedRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Sort records within groups by time ascending
    groupedRecords.forEach(group => {
        group.records.sort((a, b) => {
            const timeA = a.time_sent || '00:00:00';
            const timeB = b.time_sent || '00:00:00';
            return timeA.localeCompare(timeB);
        });
    });

    if (loading) return <div className="Loading">Loading messages...</div>;
    if (error) return <div className="Error">Error: {error}</div>;

    return (
        <div style={{ 
            maxWidth: '800px', 
            margin: '0 auto', 
            display: 'flex', 
            flexDirection: 'column', 
            height: 'calc(100vh - 100px)', // Adjust for navbar
            background: '#e5ddd5', // WhatsApp default bg color
            backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', // Subtle pattern
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
            <div style={{ 
                padding: '16px', 
                background: '#075e54', 
                color: 'white',
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                zIndex: 20
            }}>
                <MessageCircle size={24} />
                <h1 style={{ fontSize: '18px', margin: 0, fontWeight: 500 }}>Class Chat</h1>
            </div>

            <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            }}>
                {groupedRecords.map(group => (
                    <div key={group.date}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            margin: '16px 0',
                            position: 'sticky',
                            top: '0',
                            zIndex: 10
                        }}>
                            <span style={{ 
                                background: '#dcf8c6', 
                                color: '#555',
                                padding: '5px 12px', 
                                borderRadius: '8px', 
                                fontSize: '12px', 
                                fontWeight: 500,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                textTransform: 'uppercase'
                            }}>
                                {format(parseISO(group.date), 'MMMM d, yyyy')}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {group.records.map(record => {
                                const studentName = getStudentName(record.whatsapp_id_student);
                                const nameColor = getColorForName(studentName);
                                const initials = studentName.substring(0, 2).toUpperCase();

                                return (
                                    <div key={record.id} style={{ 
                                        display: 'flex', 
                                        gap: '8px',
                                        maxWidth: '85%',
                                        alignSelf: 'flex-start'
                                    }}>
                                        {/* Avatar */}
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            background: nameColor,
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            flexShrink: 0,
                                            marginTop: '4px'
                                        }}>
                                            {initials}
                                        </div>

                                        {/* Message Bubble */}
                                        <div 
                                            onClick={() => handleRecordClick(record)}
                                            style={{ 
                                                background: 'white',
                                                padding: '6px 8px 6px 10px',
                                                borderRadius: '0 12px 12px 12px',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                                position: 'relative',
                                                minWidth: '180px',
                                                cursor: 'pointer',
                                                transition: 'box-shadow 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)'}
                                            onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)'}
                                        >
                                            {/* Triangle tail */}
                                            <div style={{
                                                position: 'absolute',
                                                top: '0',
                                                left: '-8px',
                                                width: '0',
                                                height: '0',
                                                borderTop: '10px solid white',
                                                borderLeft: '10px solid transparent'
                                            }} />

                                            <div style={{ 
                                                fontSize: '13px', 
                                                fontWeight: 600, 
                                                color: nameColor,
                                                marginBottom: '2px',
                                                cursor: 'pointer'
                                            }}>
                                                {studentName}
                                            </div>
                                            
                                            <div style={{ 
                                                fontSize: '14px', 
                                                lineHeight: '1.4',
                                                whiteSpace: 'pre-wrap',
                                                color: '#111',
                                                marginBottom: '4px'
                                            }}>
                                                {record.message_text || <span style={{ fontStyle: 'italic', color: '#999' }}>No message text</span>}
                                            </div>

                                            <div style={{ 
                                                display: 'flex', 
                                                justifyContent: 'flex-end', 
                                                alignItems: 'center', 
                                                gap: '6px',
                                                fontSize: '11px',
                                                color: '#999',
                                                marginTop: '2px',
                                                flexWrap: 'wrap'
                                            }}>
                                                {record.session_date && (
                                                    <span style={{ 
                                                        background: '#e3f2fd', 
                                                        color: '#1976d2',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontSize: '10px',
                                                        fontWeight: 500
                                                    }}>
                                                        {format(parseISO(record.session_date), 'EEEE, MMM d')}
                                                    </span>
                                                )}
                                                {record.duration_minutes !== null && record.duration_minutes !== undefined && (
                                                    <span style={{ 
                                                        fontWeight: 500,
                                                        color: record.duration_minutes === 0 ? '#ef4444' : '#999',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '2px'
                                                    }}>
                                                        {record.duration_minutes === 0 ? '🚩' : '⏱'} {Math.floor(record.duration_minutes / 60)}h {record.duration_minutes % 60}m
                                                    </span>
                                                )}
                                                <span>{formatTime(record.time_sent)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Edit Modal */}
            {editingRecord && (
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
                    <div className="glass-panel" style={{ 
                        padding: '24px', 
                        width: '100%', 
                        maxWidth: '500px',
                        background: 'white',
                        borderRadius: '16px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, color: '#111' }}>Edit Record</h2>
                            <button
                                onClick={() => setEditingRecord(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                <X size={24} color="#666" />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                                    Student
                                </label>
                                <div style={{ fontWeight: 600, color: '#111' }}>
                                    {getStudentName(editingRecord.whatsapp_id_student)}
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                                    Session Date
                                </label>
                                <input
                                    type="date"
                                    value={editSessionDate}
                                    onChange={(e) => setEditSessionDate(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #ddd',
                                        background: 'white',
                                        color: '#111',
                                        fontSize: '14px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                                    Duration (minutes)
                                </label>
                                <input
                                    type="number"
                                    value={editDuration}
                                    onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #ddd',
                                        background: 'white',
                                        color: '#111',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button
                                    onClick={handleSaveChanges}
                                    style={{
                                        flex: 1,
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#075e54',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 600
                                    }}
                                >
                                    Save Changes
                                </button>
                                <button
                                    onClick={() => setEditingRecord(null)}
                                    style={{
                                        flex: 1,
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: '1px solid #ddd',
                                        background: 'white',
                                        color: '#666',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 600
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
