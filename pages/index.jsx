import React, { useState, useEffect, useRef } from 'react';

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
  const [favorites, setFavorites] = useState(new Set());
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [highlightedSerial, setHighlightedSerial] = useState('');
  const scrolledHashRef = useRef('');

  // Layout overlay engine states
  const [enableOverlay, setEnableOverlay] = useState(false);
  const [overlayTemplate, setOverlayType] = useState('3ft'); // '3ft' or '5ft'
  const [overlayScale, setOverlayScale] = useState(1.0);
  const [overlayRotation, setOverlayRotation] = useState(0);
  const [overlayX, setOverlayX] = useState(50);
  const [overlayY, setOverlayY] = useState(50);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('show_unavailable') === '1') {
      setShowUnavailable(true);
    }

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

  // Automatically reveal unavailable boards & scroll to #board-<serial> (or #<serial>)
  useEffect(() => {
    if (loading || pieces.length === 0) return;

    const handleHashNavigation = (forceScroll = false) => {
      const rawHash = decodeURIComponent((window.location.hash || '').replace(/^#/, '')).trim();
      if (!rawHash) return;

      const targetSerial = rawHash.replace(/^board-/i, '');
      const matchedPiece = pieces.find(
        (p) => p.serialno.toLowerCase() === targetSerial.toLowerCase()
      );

      if (matchedPiece && matchedPiece.available === false && !showUnavailable) {
        setShowUnavailable(true);
        return; // Will re-run once showUnavailable renders the card
      }

      const el =
        document.getElementById(`board-${targetSerial}`) ||
        document.getElementById(targetSerial) ||
        document.getElementById(rawHash);

      if (el && (forceScroll || scrolledHashRef.current !== rawHash)) {
        scrolledHashRef.current = rawHash;
        setHighlightedSerial(targetSerial.toLowerCase());
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    };

    handleHashNavigation(false);
    const onHashChange = () => handleHashNavigation(true);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [loading, pieces, showUnavailable]);

  // Reset overlay settings whenever a new piece is selected
  useEffect(() => {
    setEnableOverlay(false);
    setOverlayScale(1.0);
    setOverlayRotation(0);
    setOverlayX(50);
    setOverlayY(50);
  }, [selectedPiece]);

  const unavailableCount = pieces.filter((p) => p.available === false).length;
  const visiblePool = pieces.filter((p) => showUnavailable || p.available !== false);

  const uniqueSpecies = [...new Set(visiblePool.map((p) => p.species).filter(Boolean))];
  const uniqueOwners = [...new Set(visiblePool.map((p) => p.owner).filter(Boolean))];
  const uniqueLocations = [...new Set(visiblePool.map((p) => p.location).filter(Boolean))];

  const toggleFavorite = (serialno) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(serialno)) {
      newFavorites.delete(serialno);
    } else {
      newFavorites.add(serialno);
    }
    setFavorites(newFavorites);
  };

  let filtered = visiblePool.filter((piece) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      piece.serialno.toLowerCase().includes(q) ||
      piece.species.toLowerCase().includes(q) ||
      piece.comments.toLowerCase().includes(q) ||
      (piece.orderNumber && piece.orderNumber.toLowerCase().includes(q)) ||
      (piece.orderDate && piece.orderDate.toLowerCase().includes(q)) ||
      (piece.customerName && piece.customerName.toLowerCase().includes(q)) ||
      (piece.clockName && piece.clockName.toLowerCase().includes(q));

    const matchesSpecies = !filterSpecies || piece.species === filterSpecies;
    const matchesOwner = !filterOwner || piece.owner === filterOwner;
    const matchesLocation = !filterLocation || piece.location === filterLocation;
    const matchesFavorite = !showOnlyFavorites || favorites.has(piece.serialno);
    return matchesSearch && matchesSpecies && matchesOwner && matchesLocation && matchesFavorite;
  });

  const renderUnavailableBanner = (piece, isModal = false) => (
    <div
      style={{
        background: '#fee2e2',
        color: '#991b1b',
        borderTop: isModal ? 'none' : '1px solid #fca5a5',
        borderBottom: '1px solid #fca5a5',
        padding: isModal ? '8px 14px' : '7px 12px',
        fontSize: '12px',
        textAlign: 'center',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      <span style={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Unavailable
      </span>

      {piece.orderNumber && (
        <>
          <span>•</span>
          <a
            href={piece.orderAdminUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: '#991b1b',
              fontWeight: 700,
              textDecoration: 'underline'
            }}
          >
            Order #{piece.orderNumber}
          </a>
        </>
      )}

      {piece.orderDate && (
        <>
          <span>•</span>
          <span>{piece.orderDate}</span>
        </>
      )}

      {piece.customerName && (
        <>
          <span>•</span>
          <span style={{ fontWeight: 600 }}>{piece.customerName}</span>
        </>
      )}

      {piece.clockName && (
        <>
          <span>•</span>
          {piece.clockUrl ? (
            <a
              href={piece.clockUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                color: '#991b1b',
                textDecoration: 'underline'
              }}
            >
              {piece.clockName}
            </a>
          ) : (
            <span>{piece.clockName}</span>
          )}
        </>
      )}
    </div>
  );

  return (
    <div style={{ padding: '1rem 0', background: 'transparent' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 500, marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
        Lumber inventory
      </h1>

      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search by serial #, description, comments, order #, date, customer, or product…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', marginBottom: '1rem' }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '1rem' }}>
          <select value={filterSpecies} onChange={(e) => setFilterSpecies(e.target.value)}>
            <option value="">All species</option>
            {uniqueSpecies.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
            <option value="">All owners</option>
            {uniqueOwners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>

          <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
            <option value="">All locations</option>
            {uniqueLocations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={showOnlyFavorites}
              onChange={(e) => setShowOnlyFavorites(e.target.checked)}
            />
            Show favorites only ({favorites.size})
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={showUnavailable}
              onChange={(e) => setShowUnavailable(e.target.checked)}
            />
            Show unavailable boards ({unavailableCount})
          </label>

          {favorites.size > 0 && (
            <button
              onClick={() => setFavorites(new Set())}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                background: 'var(--color-background-secondary)',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 'var(--border-radius-lg)',
                cursor: 'pointer'
              }}
            >
              Clear all favorites
            </button>
          )}
        </div>
      </div>

      {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--color-text-danger)' }}>Error: {error}</p>}

      {!loading && !error && filtered.length > 0 && (
        <div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
            {filtered.length} piece{filtered.length !== 1 ? 's' : ''} found
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(1200px, 1fr))', gap: '12px' }}>
            {filtered.map((piece) => {
              const isUnavailable = piece.available === false;
              const isHighlighted = highlightedSerial === piece.serialno.toLowerCase();

              return (
                <div
                  id={`board-${piece.serialno}`}
                  key={piece.fileId}
                  style={{
                    background: 'var(--color-background-primary)',
                    border: isHighlighted
                      ? '2px solid #0b61d8'
                      : '0.5px solid var(--color-border-tertiary)',
                    borderRadius: 'var(--border-radius-lg)',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    scrollMarginTop: '24px',
                    boxShadow: isHighlighted ? '0 0 0 3px rgba(11, 97, 216, 0.2)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isHighlighted) {
                      e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isHighlighted) {
                      e.currentTarget.style.borderColor = 'var(--color-border-tertiary)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <span id={piece.serialno} />
                  <div style={{ position: 'relative', overflow: 'hidden', background: 'var(--color-background-secondary)' }}>
                    <img
                      src={piece.photoUrl}
                      alt={`${piece.species} ${piece.serialno}`}
                      style={{
                        width: '100%',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block',
                        cursor: 'pointer',
                        opacity: isUnavailable ? 0.85 : 1
                      }}
                      onClick={() => setSelectedPiece(piece)}
                    />
                    <button
                      onClick={() => toggleFavorite(piece.serialno)}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(0,0,0,0.6)',
                        border: 'none',
                        color: favorites.has(piece.serialno) ? '#ff6b6b' : 'white',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {favorites.has(piece.serialno) ? '♥' : '♡'}
                    </button>
                  </div>

                  {isUnavailable && renderUnavailableBanner(piece, false)}

                  <div style={{ padding: '12px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 4px 0', color: 'var(--color-text-primary)' }}>
                      #{piece.serialno}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
                      {piece.species || '—'}
                    </p>

                    <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: '1.4' }}>
                      {piece.owner && <span><strong>Owner:</strong> {piece.owner}</span>}
                      {piece.owner && piece.location && <span> • </span>}
                      {piece.location && <span><strong>Location:</strong> {piece.location}</span>}
                    </p>

                    {piece.comments && (
                      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0', fontStyle: 'italic' }}>
                        {piece.comments}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && visiblePool.length > 0 && (
        <p style={{ color: 'var(--color-text-secondary)' }}>No matches found.</p>
      )}

      {!loading && !error && missing.length > 0 && (
        <div style={{ marginTop: '3rem', padding: '1.5rem', background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-lg)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
            Missing Photos ({missing.length})
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {missing.map((m) => (
              <div key={m.serialno} style={{ padding: '8px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{m.serialno}</span>
                {m.species && m.species !== '—' && <span> • {m.species}</span>}
                {m.owner && m.owner !== '—' && <span> • Owner: {m.owner}</span>}
                {m.location && m.location !== '—' && <span> • Loc: {m.location}</span>}
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
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setSelectedPiece(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-background-primary)',
              borderRadius: 'var(--border-radius-lg)',
              maxWidth: '750px',
              width: '100%',
              maxHeight: '95vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)'
            }}
          >
            {/* Interactive Workspace Area */}
            <div style={{ position: 'relative', background: '#111', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img
                src={selectedPiece.photoUrl}
                alt={selectedPiece.species}
                style={{ width: '100%', display: 'block', maxHeight: '55vh', objectFit: 'contain' }}
              />

              {/* Semi-transparent CNC artwork blueprint layer overlay */}
              {enableOverlay && (
                <img
                  src="/timeline-template.png"
                  alt="CNC Timeline Blueprint Layout"
                  style={{
                    position: 'absolute',
                    top: `${overlayY}%`,
                    left: `${overlayX}%`,
                    transform: `translate(-50%, -50%) scale(${overlayScale}) rotate(${overlayRotation}deg)`,
                    pointerEvents: 'none',
                    userSelect: 'none',
                    maxWidth: 'none',
                    width: overlayTemplate === '5ft' ? '95%' : '60%',
                    mixBlendMode: 'multiply',
                    opacity: 0.9,
                    filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))'
                  }}
                />
              )}

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
                  fontSize: '20px',
                  zIndex: 10
                }}
              >
                ✕
              </button>
            </div>

            {selectedPiece.available === false && renderUnavailableBanner(selectedPiece, true)}

            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', gap: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 500, margin: 0, color: 'var(--color-text-primary)', flexGrow: 1 }}>
                  Piece #{selectedPiece.serialno}
                </h2>

                <button
                  onClick={() => setEnableOverlay(!enableOverlay)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    borderRadius: '6px',
                    backgroundColor: enableOverlay ? 'rgba(0, 255, 242, 0.15)' : 'var(--color-background-secondary)',
                    border: enableOverlay ? '1px solid rgba(0, 255, 242, 0.6)' : '1px solid var(--color-border-tertiary)',
                    color: enableOverlay ? 'rgb(0, 200, 190)' : 'var(--color-text-primary)'
                  }}
                >
                  {enableOverlay ? '✕ Disable Template Placement' : '📐 Blueprint Overlay'}
                </button>
              </div>

              {enableOverlay && (
                <div
                  style={{
                    background: 'var(--color-background-secondary)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    border: '1px solid var(--color-border-tertiary)'
                  }}
                >
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="tmpl"
                        checked={overlayTemplate === '3ft'}
                        onChange={() => setOverlayType('3ft')}
                      />{' '}
                      3-Foot Devangari Layout
                    </label>
                    <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="tmpl"
                        checked={overlayTemplate === '5ft'}
                        onChange={() => setOverlayType('5ft')}
                      />{' '}
                      5-Foot Apple Gothic Layout
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '12px' }}>
                    <div>
                      <label style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                        <span>Scale Factor</span>
                        <span>{overlayScale.toFixed(2)}x</span>
                      </label>
                      <input
                        type="range"
                        min="0.2"
                        max="4.0"
                        step="0.05"
                        value={overlayScale}
                        onChange={(e) => setOverlayScale(parseFloat(e.target.value))}
                        style={{ width: '100%', margin: '4px 0' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                        <span>Twist Rotation</span>
                        <span>{overlayRotation}°</span>
                      </label>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={overlayRotation}
                        onChange={(e) => setOverlayRotation(parseInt(e.target.value))}
                        style={{ width: '100%', margin: '4px 0' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                        <span>Horizontal Center (X)</span>
                        <span>{overlayX}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={overlayX}
                        onChange={(e) => setOverlayX(parseInt(e.target.value))}
                        style={{ width: '100%', margin: '4px 0' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                        <span>Vertical Center (Y)</span>
                        <span>{overlayY}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={overlayY}
                        onChange={(e) => setOverlayY(parseInt(e.target.value))}
                        style={{ width: '100%', margin: '4px 0' }}
                      />
                    </div>
                  </div>
                </div>
              )}

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
                {selectedPiece.orderNumber && (
                  <div>
                    <label style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Shopify Order</label>
                    <p style={{ margin: 0 }}>
                      <a
                        href={selectedPiece.orderAdminUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#0b61d8', fontWeight: 500 }}
                      >
                        #{selectedPiece.orderNumber}
                      </a>
                      {selectedPiece.orderDate ? ` (${selectedPiece.orderDate})` : ''}
                      {selectedPiece.customerName ? ` • ${selectedPiece.customerName}` : ''}
                    </p>
                  </div>
                )}
                {selectedPiece.clockName && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Product</label>
                    <p style={{ margin: 0 }}>
                      {selectedPiece.clockUrl ? (
                        <a
                          href={selectedPiece.clockUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#0b61d8', fontWeight: 500 }}
                        >
                          {selectedPiece.clockName}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--color-text-primary)' }}>{selectedPiece.clockName}</span>
                      )}
                    </p>
                  </div>
                )}
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
                  padding: '0.5rem 1rem',
                  cursor: 'pointer'
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