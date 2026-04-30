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
  onStartChat: (user: SearchUser) => void;
  onClose: () => void;
}

const UserSearch: React.FC<Props> = ({ onStartChat, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 1) {
      setResults([]);
      setSearched(false);
      return;
    }
    try {
      setLoading(true);
      const res = await (api as any).users.search(q);
      if (res.success) {
        setResults(res.data);
        setSearched(true);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 100
    }}>
      <div style={{
        background: 'white', borderRadius: 16,
        width: 440, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        overflow: 'hidden'
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: '#0f172a',
            fontFamily: 'Inter, sans-serif'
          }}>
            Find People
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 20,
            color: '#94a3b8', padding: 4
          }}>✕</button>
        </div>

        {/* Search input */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8', fontSize: 16
            }}>🔍</span>
            <input
              autoFocus
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by name or email…"
              style={{
                width: '100%', padding: '10px 12px 10px 36px',
                borderRadius: 8, border: '1px solid #e2e8f0',
                background: '#f8fafc', fontSize: 13.5,
                fontFamily: 'Inter, sans-serif', outline: 'none',
                color: '#1e293b'
              }}
            />
          </div>
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Loading */}
          {loading && (
            <div style={{
              padding: 32, textAlign: 'center',
              color: '#94a3b8', fontFamily: 'Inter, sans-serif'
            }}>
              Searching...
            </div>
          )}

          {/* No results */}
          {!loading && searched && results.length === 0 && (
            <div style={{
              padding: 32, textAlign: 'center',
              fontFamily: 'Inter, sans-serif'
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>😕</div>
              <div style={{
                fontSize: 14, fontWeight: 600, color: '#475569'
              }}>
                No users found
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                Try a different name or email
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !searched && (
            <div style={{
              padding: 32, textAlign: 'center',
              fontFamily: 'Inter, sans-serif'
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <div style={{
                fontSize: 14, fontWeight: 600, color: '#475569'
              }}>
                Search for people
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                Find friends by their name or email
              </div>
            </div>
          )}

          {/* User results */}
          {!loading && results.map(u => (
            <div
              key={u._id}
              onClick={() => onStartChat(u)}
              style={{
                display: 'flex', alignItems: 'center',
                gap: 12, padding: '12px 20px',
                cursor: 'pointer', transition: 'background 0.1s',
                borderBottom: '1px solid #f8fafc'
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement)
                  .style.background = '#f8fafc';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement)
                  .style.background = 'white';
              }}
            >
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {u.avatar && u.avatar.startsWith('http') ? (
                  <img
                    src={u.avatar}
                    style={{
                      width: 46, height: 46,
                      borderRadius: '50%', objectFit: 'cover'
                    }}
                  />
                ) : (
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%',
                    background: '#3b82f6', color: 'white',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 700,
                    fontSize: 14
                  }}>
                    {u.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                )}
                {/* Online dot */}
                <span style={{
                  position: 'absolute', bottom: 1, right: 1,
                  width: 11, height: 11, borderRadius: '50%',
                  background: u.isOnline ? '#22c55e' : '#94a3b8',
                  border: '2px solid white'
                }} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: 600,
                  color: '#0f172a', fontFamily: 'Inter, sans-serif'
                }}>
                  {u.name}
                </div>
                <div style={{
                  fontSize: 12, color: '#64748b',
                  fontFamily: 'Inter, sans-serif',
                  marginTop: 1, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {u.vibeStatus || u.email}
                </div>
              </div>

              {/* Chat button */}
              <button style={{
                background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 8, color: '#2563eb',
                padding: '6px 14px', fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif'
              }}>
                Message
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserSearch;