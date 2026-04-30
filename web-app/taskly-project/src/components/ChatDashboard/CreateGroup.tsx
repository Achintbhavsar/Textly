// src/components/ChatDashboard/CreateGroup.tsx

import React, { useState, useCallback } from 'react';
import api from '../../services/api';

interface SearchUser {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  isOnline: boolean;
  vibeStatus: string;
}

interface Props {
  onCreateGroup: (data: { conv: any; members: any[] }) => void;
  onClose: () => void;
}

const CreateGroup: React.FC<Props> = ({ onCreateGroup, onClose }) => {
  const [step, setStep] = useState<'search' | 'name'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [selected, setSelected] = useState<SearchUser[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 1) { setResults([]); setSearched(false); return; }
    try {
      setLoading(true);
      const res = await api.users.search(q);
      if (res.success) { setResults(res.data as any); setSearched(true); }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSelect = (user: SearchUser) => {
    setSelected(prev =>
      prev.find(u => u._id === user._id)
        ? prev.filter(u => u._id !== user._id)
        : [...prev, user]
    );
  };

  const isSelected = (user: SearchUser) => selected.some(u => u._id === user._id);

  const handleCreate = async () => {
    if (!groupName.trim() || selected.length === 0) return;
    try {
      setCreating(true);
      const res = await (api as any).conversations.createGroup(
        groupName.trim(),
        selected.map(u => u._id)
      );
      if (res.success && res.data) {
        onCreateGroup({ conv: res.data, members: selected });
      }
    } catch (err) {
      alert('❌ Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const groupColors = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2'];
  const groupColor = groupColors[groupName.length % groupColors.length];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 100
    }}>
      <div style={{
        background: 'white', borderRadius: 18,
        width: 460, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        overflow: 'hidden'
      }}>

        {/* ── Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step === 'name' && (
              <button
                onClick={() => setStep('search')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
              >
                <span className="material-icons" style={{ fontSize: 20 }}>arrow_back</span>
              </button>
            )}
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                {step === 'search' ? 'New Group' : 'Name Your Group'}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                {step === 'search'
                  ? `${selected.length} member${selected.length !== 1 ? 's' : ''} selected`
                  : `${selected.length + 1} members (including you)`
                }
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8', padding: 4 }}>✕</button>
        </div>

        {/* ── STEP 1: Search & Select Members */}
        {step === 'search' && (
          <>
            {/* Search input */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 16 }}>🔍</span>
                <input
                  autoFocus
                  value={query}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search people to add…"
                  style={{
                    width: '100%', padding: '9px 12px 9px 36px',
                    borderRadius: 8, border: '1px solid #e2e8f0',
                    background: '#f8fafc', fontSize: 13.5,
                    fontFamily: 'Inter, sans-serif', outline: 'none', color: '#1e293b'
                  }}
                />
              </div>
            </div>

            {/* Selected chips */}
            {selected.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 6,
                padding: '10px 20px',
                borderBottom: '1px solid #f1f5f9'
              }}>
                {selected.map(u => (
                  <div key={u._id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#eff6ff', border: '1px solid #bfdbfe',
                    borderRadius: 20, padding: '4px 10px 4px 6px',
                    fontSize: 12, color: '#2563eb', fontWeight: 500
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: '#2563eb', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700
                    }}>
                      {u.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    {u.name.split(' ')[0]}
                    <button
                      onClick={() => toggleSelect(u)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: 14, padding: 0, lineHeight: 1 }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Results list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading && (
                <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
                  Searching...
                </div>
              )}

              {!loading && searched && results.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>😕</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>No users found</div>
                </div>
              )}

              {!loading && !searched && (
                <div style={{ padding: 32, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>Add group members</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Search for people to add</div>
                </div>
              )}

              {!loading && results.map(u => (
                <div
                  key={u._id}
                  onClick={() => toggleSelect(u)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 20px', cursor: 'pointer',
                    transition: 'background 0.1s',
                    borderBottom: '1px solid #f8fafc',
                    background: isSelected(u) ? '#eff6ff' : 'white'
                  }}
                >
                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: '#3b82f6', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 13
                    }}>
                      {u.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <span style={{
                      position: 'absolute', bottom: 1, right: 1,
                      width: 10, height: 10, borderRadius: '50%',
                      background: u.isOnline ? '#22c55e' : '#94a3b8',
                      border: '2px solid white'
                    }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                      {u.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'Inter, sans-serif', marginTop: 1 }}>
                      {u.vibeStatus || u.email}
                    </div>
                  </div>

                  {/* Checkbox */}
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: isSelected(u) ? 'none' : '2px solid #e2e8f0',
                    background: isSelected(u) ? '#2563eb' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.15s'
                  }}>
                    {isSelected(u) && (
                      <span className="material-icons" style={{ fontSize: 14, color: 'white' }}>check</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Next button */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
              <button
                onClick={() => selected.length > 0 && setStep('name')}
                disabled={selected.length === 0}
                style={{
                  width: '100%', padding: '12px',
                  background: selected.length > 0 ? '#2563eb' : '#e2e8f0',
                  color: selected.length > 0 ? 'white' : '#94a3b8',
                  border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s'
                }}
              >
                Next → ({selected.length} selected)
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Name the Group */}
        {step === 'name' && (
          <>
            <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Group avatar preview */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${groupColor}, ${groupColor}aa)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, fontWeight: 800, color: 'white',
                  boxShadow: `0 4px 20px ${groupColor}40`
                }}>
                  {groupName ? groupName[0].toUpperCase() : '👥'}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Group icon (auto-generated)</div>
              </div>

              {/* Group name input */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  GROUP NAME
                </div>
                <input
                  autoFocus
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="e.g. Squad, Project Team, Family..."
                  maxLength={50}
                  style={{
                    width: '100%', padding: '11px 14px',
                    borderRadius: 10, border: '1px solid #e2e8f0',
                    fontSize: 14, fontFamily: 'Inter, sans-serif',
                    outline: 'none', color: '#0f172a',
                    background: '#f8fafc'
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, textAlign: 'right' }}>
                  {groupName.length}/50
                </div>
              </div>

              {/* Members preview */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  MEMBERS ({selected.length + 1})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {/* You */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: 12, fontWeight: 700,
                      border: '2px solid #bfdbfe'
                    }}>
                      You
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>You</div>
                  </div>
                  {selected.map(u => (
                    <div key={u._id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: '#3b82f6', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700
                      }}>
                        {u.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b', maxWidth: 40, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.name.split(' ')[0]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Create button */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
              <button
                onClick={handleCreate}
                disabled={!groupName.trim() || creating}
                style={{
                  width: '100%', padding: '12px',
                  background: groupName.trim() ? '#2563eb' : '#e2e8f0',
                  color: groupName.trim() ? 'white' : '#94a3b8',
                  border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  cursor: groupName.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8
                }}
              >
                <span className="material-icons" style={{ fontSize: 18 }}>group_add</span>
                {creating ? 'Creating...' : `Create "${groupName || 'Group'}"`}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default CreateGroup;