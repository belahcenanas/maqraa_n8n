import { useEffect, useState } from 'react';
import { supabase, type MyRecord, type Student } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { FileText, Search, X } from 'lucide-react';

// Helper to format duration
function formatDuration(minutes: number): string {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
}

export default function Records() {
    const [records, setRecords] = useState<MyRecord[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<MyRecord | null>(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        const [recordsRes, studentsRes] = await Promise.all([
            supabase.from('myrecords').select('*').order('created_at', { ascending: false }),
            supabase.from('students').select('*')
        ]);

        if (recordsRes.data) setRecords(recordsRes.data);
        if (studentsRes.data) setStudents(studentsRes.data);
        setLoading(false);
    }

    const getStudentName = (whatsappId: string | null): string => {
        if (!whatsappId) return 'Unknown';
        const student = students.find(s => s.whatsapp_id_student === whatsappId);
        return student?.name || whatsappId;
    };

    const filteredRecords = records.filter(r => {
        const studentName = getStudentName(r.whatsapp_id_student);
        const searchLower = searchTerm.toLowerCase();
        return (
            studentName.toLowerCase().includes(searchLower) ||
            r.whatsapp_id_student?.toLowerCase().includes(searchLower) ||
            r.session_day?.toLowerCase().includes(searchLower) ||
            r.type_message?.toLowerCase().includes(searchLower)
        );
    });

    const handleRecordClick = (record: MyRecord) => {
        setSelectedRecord(record);
        setShowModal(true);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h1 style={{ marginBottom: 0 }}>Records</h1>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{records.length} total records</span>
            </div>

            <div style={{ position: 'relative', marginBottom: '24px' }}>
                <Search style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} size={20} />
                <input
                    type="text"
                    placeholder="Search by student, WhatsApp ID, day, or type..."
                    className="input-field"
                    style={{ paddingLeft: '40px' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredRecords.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No records found.
                        </div>
                    ) : (
                        filteredRecords.map(record => (
                            <div 
                                key={record.id} 
                                className="glass-panel" 
                                style={{ 
                                    padding: '16px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => handleRecordClick(record)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--card-bg)';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                    <div style={{ background: 'var(--primary-glow)', padding: '12px', borderRadius: '50%', marginTop: '4px' }}>
                                        <FileText size={24} color="var(--primary)" />
                                    </div>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px', gap: '12px' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '16px' }}>
                                                    {getStudentName(record.whatsapp_id_student)}
                                                </div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                                                    {record.whatsapp_id_student || 'No ID'}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '16px' }}>
                                                    {formatDuration(record.duration_minutes || 0)}
                                                </div>
                                                {record.time_sent && (
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                                                        {record.time_sent}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                            {record.session_date && (
                                                <span style={{
                                                    fontSize: '12px',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    background: 'rgba(99, 102, 241, 0.2)',
                                                    color: 'var(--primary)'
                                                }}>
                                                    📅 {format(parseISO(record.session_date), 'MMM d, yyyy')}
                                                </span>
                                            )}
                                            {record.session_day && (
                                                <span style={{
                                                    fontSize: '12px',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    background: 'rgba(34, 197, 94, 0.2)',
                                                    color: 'var(--success)'
                                                }}>
                                                    {record.session_day}
                                                </span>
                                            )}
                                            {record.type_message && (
                                                <span style={{
                                                    fontSize: '12px',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    background: 'rgba(251, 191, 36, 0.2)',
                                                    color: '#fbbf24'
                                                }}>
                                                    {record.type_message}
                                                </span>
                                            )}
                                        </div>
                                        {record.message_text && (
                                            <div style={{
                                                marginTop: '8px',
                                                fontSize: '13px',
                                                color: 'var(--text-muted)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {record.message_text}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Detail Modal */}
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
                    <div className="glass-panel" style={{ padding: '24px', width: '100%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
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
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Record ID</div>
                                <div style={{ fontWeight: 500 }}>#{selectedRecord.id}</div>
                            </div>

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Student</div>
                                <div style={{ fontWeight: 600 }}>
                                    {getStudentName(selectedRecord.whatsapp_id_student)}
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

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Session Date</div>
                                <div style={{ fontWeight: 500 }}>
                                    {selectedRecord.session_date ? format(parseISO(selectedRecord.session_date), 'EEEE, MMM d, yyyy') : '-'}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Session Day</div>
                                <div style={{ fontWeight: 500 }}>{selectedRecord.session_day || '-'}</div>
                            </div>

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Time Sent</div>
                                <div style={{ fontWeight: 500 }}>{selectedRecord.time_sent || '-'}</div>
                            </div>

                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Duration</div>
                                <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '18px' }}>
                                    {formatDuration(selectedRecord.duration_minutes || 0)}
                                </div>
                            </div>

                            {selectedRecord.type_message && (
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Message Type</div>
                                    <div style={{ fontWeight: 500 }}>{selectedRecord.type_message}</div>
                                </div>
                            )}

                            {selectedRecord.message_text && (
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Message Text</div>
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
