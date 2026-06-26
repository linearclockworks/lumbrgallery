import React, { useState, useEffect } from 'react';

export default function LumberGallery() {
  const [pieces, setPieces] = useState([]);
  const [missing, setMissing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecies, setFilterSpecies] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [selectedPiece, setSelectedPiece] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/lumber');
        if (!response.ok) throw new Error('Failed to fetch lumber data');
        const data = await response.json();
        setPieces(data.pieces || []);
        setMissing(data.missing || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const uniqueSpecies = [...new Set(pieces.map(p => p.species).filter(Boolean))];
  const uniqueOwners = [...new Set(pieces.map(p => p.owner).filter(Boolean))];
  const uniqueLocations = [...new Set(pieces.map(p => p.location).filter(Boolean))];

  const filtered = pieces.filter(piece => {
    const matchesSearch = 
      piece.serialno.toLowerCase().includes(searchTerm.toLowerCase()) ||
      piece.species.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpecies = !filterSpecies || piece.species === filterSpecies;
    const matchesOwner = !filterOwner || piece.owner === filterOwner;
    const matchesLocation = !filterLocation || piece.location === filterLocation;
    return matchesSearch && matchesSpecies && matchesOwner && matchesLocation;
  });

  return (
    <div style={{ padding: '1rem 0', background: 'transparent' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 500, marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
        Lumber inventory
      </h1>

      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search by serial number or description…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', marginBottom: '1rem' }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <select value={filterSpecies} onChange={(e) => setFilterSpecies(e.target.value)}>
            <option value="">All species</option>
            {uniqueSpecies.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
            <option value="">All owners</option>
            {uniqueOwners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
            <option value="">All locations</option>
            {uniqueLocations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--color-text-danger)' }}>Error: {error}</p>}

      {!loading && !error && filtered.length > 0 && (
        <div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
            {filtered.length} piece{filtered.length !== 1 ? 's' : ''} found
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '12px' }}>
            {filtered.map(piece => (
              <div
                key={piece.fileId}
                onClick={() => setSelectedPiece(piece)}
                style={{
                  background: 'var(--color-background-primary)',
                  border: '0.5px solid var(--color-border-tertiary)',
                  borderRadius: 'var(--border-radius-lg)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-tertiary)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ aspect: '1', overflow: 'hidden', background: 'var(--color-background-secondary)' }}>
                  <img
                    src={piece.photoUrl}
                    alt={`${piece.species} ${piece.serialno}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ padding: '12px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 4px 0', color: 'var(--color-text-primary)' }}>
                    {piece.serialno}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
                    {piece.species || '—'}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                    {piece.owner && <span>{piece.owner}</span>}
                    {piece.owner && piece.location && <span> • </span>}
                    {piece.location && <span>{piece.location}</span>}
                  </p>
                  {piece.comments && (
                    <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                      {piece.comments}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && pieces.length > 0 && (
        <p style={{ color: 'var(--color-text-secondary)' }}>No matches found.</p>
      )}

      {!loading && !error && missing.length > 0 && (
        <div style={{ marginTop: '3rem', padding: '1.5rem', background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-lg)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
            Missing Photos ({missing.length})
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {missing.map(m => (
              <div key={m.serialno} style={{ padding: '8px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{m.serialno}</span>
                {m.species && m.species !== '—' && <span> • {m.species}</span>}
                {m.owner && m.owner !== '—' && <span> • {m.owner}</span>}
                {m.location && m.location !== '—' && <span> • {m.location}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedPiece && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => setSelectedPiece(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-background-primary)',
              borderRadius: 'var(--border-radius-lg)',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
          >
            <div style={{ position: 'relative' }}>
              <img
                src={selectedPiece.photoUrl}
                alt={selectedPiece.species}
                style={{ width: '100%', display: 'block' }}
              />
              <button
                onClick={() => setSelectedPiece(null)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'rgba(0,0,0,0.6)',
                  border: 'none',
                  color: 'white',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
                {selectedPiece.serialno}
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '14px' }}>
                <div>
                  <label style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Description</label>
                  <p style={{ margin: 0, color: 'var(--color-text-primary)' }}>{selectedPiece.species || '—'}</p>
                </div>
                <div>
                  <label style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Owner</label>
                  <p style={{ margin: 0, color: 'var(--color-text-primary)' }}>{selectedPiece.owner || '—'}</p>
                </div>
                <div>
                  <label style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Length</label>
                  <p style={{ margin: 0, color: 'var(--color-text-primary)' }}>{selectedPiece.length ? `${selectedPiece.length}"` : '—'}</p>
                </div>
                <div>
                  <label style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Width</label>
                  <p style={{ margin: 0, color: 'var(--color-text-primary)' }}>{selectedPiece.width ? `${selectedPiece.width}"` : '—'}</p>
                </div>
                <div>
                  <label style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Location</label>
                  <p style={{ margin: 0, color: 'var(--color-text-primary)' }}>{selectedPiece.location || '—'}</p>
                </div>
              </div>

              {selectedPiece.comments && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                  <label style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Comments</label>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-primary)' }}>{selectedPiece.comments}</p>
                </div>
              )}

              <button
                onClick={() => setSelectedPiece(null)}
                style={{
                  marginTop: '1.5rem',
                  width: '100%',
                  padding: '0.5rem 1rem'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
