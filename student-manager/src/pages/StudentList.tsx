import { useEffect, useState } from 'react';
import { supabase, type TelName } from '../lib/supabase';
import { Search, User } from 'lucide-react';

export default function StudentList() {
    const [students, setStudents] = useState<TelName[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchStudents();
    }, []);

    async function fetchStudents() {
        setLoading(true);
        const { data, error } = await supabase
            .from('tel_name')
            .select('*')
            .order('name');

        if (error) { console.error(error); } // Handle error to avoid unused var

        if (data) {
            setStudents(data);
        }
        setLoading(false);
    }

    const filteredStudents = students.filter(s =>
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.tel?.includes(searchTerm)
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ marginBottom: 0 }}>Students</h1>
                <span style={{ color: 'var(--text-muted)' }}>{students.length} Total</span>
            </div>

            <div style={{ position: 'relative', marginBottom: '24px' }}>
                <Search style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} size={20} />
                <input
                    type="text"
                    placeholder="Search by name or phone..."
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
                    {filteredStudents.map(student => (
                        <div key={student.id} className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ background: 'var(--primary-glow)', padding: '12px', borderRadius: '50%' }}>
                                <User size={24} color="var(--primary)" />
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>{student.name || 'Unknown Name'}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{student.tel || 'No Phone'}</div>
                            </div>
                        </div>
                    ))}

                    {filteredStudents.length === 0 && !loading && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            No students found.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
