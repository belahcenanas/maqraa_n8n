import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Save, Loader2 } from 'lucide-react';

export default function AddStudent() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [tel, setTel] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (!name || !tel) {
            setError('Please fill in both fields');
            return;
        }

        setLoading(true);

        const { error: supabaseError } = await supabase
            .from('tel_name')
            .insert([{ name, tel }]);

        setLoading(false);

        if (supabaseError) {
            setError(supabaseError.message);
        } else {
            navigate('/students');
        }
    }

    return (
        <div>
            <h1 style={{ marginBottom: '24px' }}>Add Student</h1>

            <div className="glass-panel" style={{ padding: '24px' }}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {error && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--danger)', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>
                            {error}
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '14px' }}>Full Name</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '14px' }}>Telephone</label>
                        <input
                            type="tel"
                            className="input-field"
                            placeholder="e.g. +1234567890"
                            value={tel}
                            onChange={(e) => setTel(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="primary-btn"
                        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '12px' }}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                        {loading ? 'Saving...' : 'Save Student'}
                    </button>
                </form>
            </div>
        </div>
    );
}
