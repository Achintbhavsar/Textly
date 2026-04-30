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
  conversation: any; // Your Contact type
  onCreateGroup?: (data: { conv: any; members: any[] }) => void;
  onClose: () => void;
  onMembersAdded?: (updatedConv: any) => void;
}

const AddMembers: React.FC<Props> = ({ conversation, onClose, onMembersAdded }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [selected, setSelected] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [searched, setSearched] = useState(false);

  // ✅ SAFE: Get existing participant IDs
  const existingIds = React.useMemo(() => {
    const participants = conversation.participants || 
                        conversation.participantIds || 
                        (conversation as any).members || 
                        [];
    
    return participants.map((p: any) => 
      typeof p === 'string' ? p : (p._id || p.id || p)
    );
  }, [conversation]);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 1) { 
      setResults([]); 
      setSearched(false); 
      return; 
    }
    
    try {
      setLoading(true);
      const res = await api.users.search(q);
      if (res.success) { 
        // Filter out existing members
        const filtered = (res.data as SearchUser[]).filter(
          u => !existingIds.includes(u._id)
        );
        setResults(filtered); 
        setSearched(true); 
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [existingIds]);

  const toggleSelect = (user: SearchUser) => {
    setSelected(prev =>
      prev.find(u => u._id === user._id)
        ? prev.filter(u => u._id !== user._id)
        : [...prev, user]
    );
  };

  const isSelected = (user: SearchUser) => selected.some(u => u._id === user._id);

  const handleAdd = async () => {
    if (selected.length === 0) return;

    try {
      setAdding(true);
      
      // Get the conversation ID
      const conversationId = conversation.conversationId || 
                            conversation._id || 
                            conversation.id;
      
      if (!conversationId) {
        alert('❌ Cannot find conversation ID');
        return;
      }

      const res = await api.conversations.addMembers(
        conversationId,
        selected.map(u => u._id)
      );

      if (res.success && res.data) {
        onMembersAdded?.(res.data);
        alert(`✅ Added ${selected.length} member(s)!`);
        onClose();
      }
    } catch (err: any) {
      alert(`❌ ${err.message || 'Failed to add members'}`);
      console.error('Add members error:', err);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 100
    }}>
      <div style={{
        background: 'white', borderRadius: 16,
        width: 440, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              Add Members to {conversation.name || 'Group'}
            </h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
              {selected.length} selected
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', border: 'none', 
              cursor: 'pointer', fontSize: 20, color: '#64748b' 
            }}
          >✕</button>
        </div>

        {/* Search */}
        <div style={{ padding: 16, borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ 
              position: 'absolute', left: 12, top: '50%', 
              transform: 'translateY(-50%)', fontSize: 16 
            }}>🔍</span>
            <input
              autoFocus
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search people to add..."
              style={{
                width: '100%', padding: '10px 12px 10px 36px',
                border: '1px solid #e2e8f0',
                borderRadius: 8, fontSize: 14,
                outline: 'none'
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
                  {u.name[0].toUpperCase()}
                </div>
                {u.name.split(' ')[0]}
                <button
                  onClick={() => toggleSelect(u)}
                  style={{ 
                    background: 'none', border: 'none', 
                    cursor: 'pointer', color: '#93c5fd', 
                    fontSize: 14, padding: 0 
                  }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Results list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {loading && (
            <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
              Searching...
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>😕</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>
                No new users found
              </div>
            </div>
          )}

          {!loading && !searched && (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>
                Search people to add
              </div>
            </div>
          )}

          {!loading && results.map(user => {
            const selected = isSelected(user);
            return (
              <div
                key={user._id}
                onClick={() => toggleSelect(user)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 12, cursor: 'pointer',
                  background: selected ? '#eff6ff' : 'white',
                  borderRadius: 8, marginBottom: 4,
                  transition: 'background 0.15s'
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: '#2563eb', color: 'white',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 700, fontSize: 13
                }}>
                  {user.name[0].toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {user.vibeStatus || user.email}
                  </div>
                </div>

                {/* Checkbox */}
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: selected ? 'none' : '2px solid #e2e8f0',
                  background: selected ? '#2563eb' : 'white',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s'
                }}>
                  {selected && (
                    <span className="material-icons" style={{ fontSize: 14, color: 'white' }}>
                      check
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add button */}
        <div style={{ padding: 16, borderTop: '1px solid #e2e8f0' }}>
          <button
            onClick={handleAdd}
            disabled={selected.length === 0 || adding}
            style={{
              width: '100%', padding: 12,
              background: selected.length > 0 ? '#2563eb' : '#e2e8f0',
              color: selected.length > 0 ? 'white' : '#94a3b8',
              border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 600,
              cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s'
            }}
          >
            {adding ? 'Adding...' : `Add ${selected.length} Member(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMembers;