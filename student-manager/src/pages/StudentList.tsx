import { useEffect, useState } from 'react';
import { supabase, type Student, type Group } from '../lib/supabase';
import { Search, User, Edit2, Trash2, Plus, X, UsersRound } from 'lucide-react';

type ModalType = 'student' | 'group' | null;

export default function StudentList() {
    const [students, setStudents] = useState<Student[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalType, setModalType] = useState<ModalType>(null);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [studentForm, setStudentForm] = useState({ name: '', whatsapp_id_student: '', group_id: '', color: '#6366f1' });
    const [groupForm, setGroupForm] = useState({ name: '', description: '' });
    const [showGroups, setShowGroups] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        const [studentsRes, groupsRes] = await Promise.all([
            supabase.from('students').select('*').order('name'),
            supabase.from('groups').select('*').order('name')
        ]);

        if (studentsRes.data) setStudents(studentsRes.data);
        if (groupsRes.data) setGroups(groupsRes.data);
        setLoading(false);
    }

    async function handleSaveStudent() {
        if (!studentForm.name || !studentForm.whatsapp_id_student) {
            alert('Name and WhatsApp ID are required');
            return;
        }

        const dataToSave = {
            name: studentForm.name,
            whatsapp_id_student: studentForm.whatsapp_id_student,
            group_id: studentForm.group_id ? parseInt(studentForm.group_id) : null,
            color: studentForm.color || '#6366f1'
        };

        if (editingStudent) {
            const { error } = await supabase
                .from('students')
                .update(dataToSave)
                .eq('id', editingStudent.id);
            
            if (error) {
                alert('Error updating student: ' + error.message);
                return;
            }
        } else {
            const { error } = await supabase
                .from('students')
                .insert([dataToSave]);
            
            if (error) {
                alert('Error adding student: ' + error.message);
                return;
            }
        }

        setModalType(null);
        setEditingStudent(null);
        setStudentForm({ name: '', whatsapp_id_student: '', group_id: '', color: '#6366f1' });
        fetchData();
    }

    async function handleSaveGroup() {
        if (!groupForm.name) {
            alert('Group name is required');
            return;
        }

        const dataToSave = {
            name: groupForm.name,
            description: groupForm.description || null
        };

        if (editingGroup) {
            const { error } = await supabase
                .from('groups')
                .update(dataToSave)
                .eq('id', editingGroup.id);
            
            if (error) {
                alert('Error updating group: ' + error.message);
                return;
            }
        } else {
            const { error } = await supabase
                .from('groups')
                .insert([dataToSave]);
            
            if (error) {
                alert('Error adding group: ' + error.message);
                return;
            }
        }

        setModalType(null);
        setEditingGroup(null);
        setGroupForm({ name: '', description: '' });
        fetchData();
    }

    async function handleDeleteStudent(id: number) {
        if (!confirm('Are you sure you want to delete this student?')) return;

        const { error } = await supabase
            .from('students')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Error deleting student: ' + error.message);
            return;
        }

        fetchData();
    }

    async function handleDeleteGroup(id: number) {
        if (!confirm('Are you sure you want to delete this group? Students in this group will have their group_id set to null.')) return;

        const { error } = await supabase
            .from('groups')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Error deleting group: ' + error.message);
            return;
        }

        fetchData();
    }

    function openAddStudentModal() {
        setEditingStudent(null);
        setStudentForm({ name: '', whatsapp_id_student: '', group_id: '', color: '#6366f1' });
        setModalType('student');
    }

    function openEditStudentModal(student: Student) {
        setEditingStudent(student);
        setStudentForm({
            name: student.name || '',
            whatsapp_id_student: student.whatsapp_id_student || '',
            group_id: student.group_id?.toString() || '',
            color: student.color || '#6366f1'
        });
        setModalType('student');
    }

    function openAddGroupModal() {
        setEditingGroup(null);
        setGroupForm({ name: '', description: '' });
        setModalType('group');
    }

    function openEditGroupModal(group: Group) {
        setEditingGroup(group);
        setGroupForm({
            name: group.name,
            description: group.description || ''
        });
        setModalType('group');
    }

    const filteredStudents = students.filter(s =>
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.whatsapp_id_student?.includes(searchTerm)
    );

    const getGroupName = (groupId: number | null) => {
        if (!groupId) return '-';
        const group = groups.find(g => g.id === groupId);
        return group?.name || '-';
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h1 style={{ marginBottom: 0 }}>Students & Groups</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setShowGroups(!showGroups)}
                        style={{
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: '1px solid var(--card-border)',
                            background: showGroups ? 'var(--primary)' : 'var(--card-bg)',
                            color: showGroups ? 'white' : 'var(--text)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 500,
                            transition: 'all 0.2s'
                        }}
                    >
                        <UsersRound size={18} />
                        {showGroups ? 'Show Students' : 'Show Groups'}
                    </button>
                    <button
                        onClick={showGroups ? openAddGroupModal : openAddStudentModal}
                        className="primary-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                    >
                        <Plus size={20} /> Add {showGroups ? 'Group' : 'Student'}
                    </button>
                </div>
            </div>

            {!showGroups && (
                <div style={{ position: 'relative', marginBottom: '24px' }}>
                    <Search style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} size={20} />
                    <input
                        type="text"
                        placeholder="Search by name or WhatsApp ID..."
                        className="input-field"
                        style={{ paddingLeft: '40px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {!showGroups ? (
                        // Students View
                        <>
                            {filteredStudents.map(student => (
                                <div key={student.id} className="glass-panel" style={{ padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ background: 'var(--primary-glow)', padding: '12px', borderRadius: '50%' }}>
                                            <User size={24} color="var(--primary)" />
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>
                                                {student.name || 'Unknown Name'}
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                                                {student.whatsapp_id_student || 'No WhatsApp ID'}
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                                                Group: {getGroupName(student.group_id)}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => openEditStudentModal(student)}
                                                style={{
                                                    background: 'rgba(99, 102, 241, 0.2)',
                                                    border: 'none',
                                                    padding: '8px',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Edit2 size={18} color="var(--primary)" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteStudent(student.id)}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.2)',
                                                    border: 'none',
                                                    padding: '8px',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Trash2 size={18} color="var(--danger)" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {filteredStudents.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    No students found.
                                </div>
                            )}
                        </>
                    ) : (
                        // Groups View
                        <>
                            {groups.length === 0 ? (
                                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No groups yet. Create your first group!
                                </div>
                            ) : (
                                groups.map(group => (
                                    <div key={group.id} className="glass-panel" style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                            <div style={{ background: 'var(--primary-glow)', padding: '12px', borderRadius: '50%', marginTop: '4px' }}>
                                                <UsersRound size={24} color="var(--primary)" />
                                            </div>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>
                                                    {group.name}
                                                </div>
                                                {group.description && (
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                                                        {group.description}
                                                    </div>
                                                )}
                                                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                                                    {students.filter(s => s.group_id === group.id).length} students
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => openEditGroupModal(group)}
                                                    style={{
                                                        background: 'rgba(99, 102, 241, 0.2)',
                                                        border: 'none',
                                                        padding: '8px',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <Edit2 size={18} color="var(--primary)" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteGroup(group.id)}
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.2)',
                                                        border: 'none',
                                                        padding: '8px',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <Trash2 size={18} color="var(--danger)" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Student Modal */}
            {modalType === 'student' && (
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
                    <div className="glass-panel" style={{ padding: '24px', width: '100%', maxWidth: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>{editingStudent ? 'Edit Student' : 'Add Student'}</h2>
                            <button
                                onClick={() => setModalType(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                <X size={24} color="var(--text-muted)" />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={studentForm.name}
                                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                                    placeholder="Student name"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                    WhatsApp ID *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={studentForm.whatsapp_id_student}
                                    onChange={(e) => setStudentForm({ ...studentForm, whatsapp_id_student: e.target.value })}
                                    placeholder="WhatsApp ID"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                    Group
                                </label>
                                <select
                                    className="input-field"
                                    value={studentForm.group_id}
                                    onChange={(e) => setStudentForm({ ...studentForm, group_id: e.target.value })}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <option value="">No Group</option>
                                    {groups.map(group => (
                                        <option key={group.id} value={group.id}>
                                            {group.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                    Chart Color
                                </label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="color"
                                        value={studentForm.color}
                                        onChange={(e) => setStudentForm({ ...studentForm, color: e.target.value })}
                                        style={{ 
                                            width: '60px', 
                                            height: '40px', 
                                            border: '1px solid var(--card-border)', 
                                            borderRadius: '8px',
                                            cursor: 'pointer'
                                        }}
                                    />
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={studentForm.color}
                                        onChange={(e) => setStudentForm({ ...studentForm, color: e.target.value })}
                                        placeholder="#6366f1"
                                        style={{ flex: 1 }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSaveStudent}
                                className="primary-btn"
                                style={{ width: '100%', marginTop: '8px' }}
                            >
                                {editingStudent ? 'Update' : 'Add'} Student
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Group Modal */}
            {modalType === 'group' && (
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
                    <div className="glass-panel" style={{ padding: '24px', width: '100%', maxWidth: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>{editingGroup ? 'Edit Group' : 'Add Group'}</h2>
                            <button
                                onClick={() => setModalType(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                <X size={24} color="var(--text-muted)" />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                    Group Name *
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={groupForm.name}
                                    onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                                    placeholder="e.g., Morning Class"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                    Description (Optional)
                                </label>
                                <textarea
                                    className="input-field"
                                    value={groupForm.description}
                                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                                    placeholder="Brief description..."
                                    rows={3}
                                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                                />
                            </div>

                            <button
                                onClick={handleSaveGroup}
                                className="primary-btn"
                                style={{ width: '100%', marginTop: '8px' }}
                            >
                                {editingGroup ? 'Update' : 'Create'} Group
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
