import { useEffect, useState } from 'react';
import { supabase, type Group } from '../lib/supabase';
import { UsersRound, Edit2, Trash2, Plus, X } from 'lucide-react';

export default function Groups() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [formData, setFormData] = useState({ name: '', description: '' });

    useEffect(() => {
        fetchGroups();
    }, []);

    async function fetchGroups() {
        setLoading(true);
        const { data } = await supabase
            .from('groups')
            .select('*')
            .order('name');

        if (data) setGroups(data);
        setLoading(false);
    }

    async function handleSave() {
        if (!formData.name) {
            alert('Group name is required');
            return;
        }

        const dataToSave = {
            name: formData.name,
            description: formData.description || null
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

        setShowModal(false);
        setEditingGroup(null);
        setFormData({ name: '', description: '' });
        fetchGroups();
    }

    async function handleDelete(id: number) {
        if (!confirm('Are you sure you want to delete this group? Students in this group will have their group_id set to null.')) return;

        const { error } = await supabase
            .from('groups')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Error deleting group: ' + error.message);
            return;
        }

        fetchGroups();
    }

    function openAddModal() {
        setEditingGroup(null);
        setFormData({ name: '', description: '' });
        setShowModal(true);
    }

    function openEditModal(group: Group) {
        setEditingGroup(group);
        setFormData({
            name: group.name,
            description: group.description || ''
        });
        setShowModal(true);
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ marginBottom: 0 }}>Groups</h1>
                <button
                    onClick={openAddModal}
                    className="primary-btn"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                >
                    <Plus size={20} /> Add Group
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => openEditModal(group)}
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
                                            onClick={() => handleDelete(group.id)}
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
                </div>
            )}

            {/* Modal */}
            {showModal && (
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
                                onClick={() => setShowModal(false)}
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
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Morning Class"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                    Description (Optional)
                                </label>
                                <textarea
                                    className="input-field"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Brief description..."
                                    rows={3}
                                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                                />
                            </div>

                            <button
                                onClick={handleSave}
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
