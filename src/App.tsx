import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Eye,
  Swords,
  Map,
  PlusCircle,
  XCircle,
  ArrowRightCircle,
  Settings,
  Shield,
  Heart,
  Bolt,
  Scroll,
  Upload,
} from 'lucide-react';

// Use this for a consistent look. It assumes Tailwind is available in the environment.
export default function App() {
  const canvasRef = useRef(null);
  const [viewMode, setViewMode] = useState('player'); // 'player' or 'umpire'
  const [units, setUnits] = useState([]); // Start with an empty array to be populated by the user
  const [terrain, setTerrain] = useState({}); // { 'A1': 'hill', 'B2': 'forest' }
  const [ordersInput, setOrdersInput] = useState('');
  const [selectedHex, setSelectedHex] = useState(null);
  const [turnLog, setTurnLog] = useState([]);
  const [showSetup, setShowSetup] = useState(true);
  const [mapImage, setMapImage] = useState(null);

  const hexSize = 30; // Radius of the hexagon
  const boardSize = { width: 20, height: 15 };

  // Hex grid utility functions
  const toHexCoord = (x, y) => {
    const q = (x * 2 / 3) / hexSize;
    const r = (-x / 3 + Math.sqrt(3) / 3 * y) / hexSize;
    const hex = hexRound(q, r);
    const col = String.fromCharCode(65 + hex.q);
    const row = hex.s + 1;
    return `${col}${row}`;
  };

  const toPixelCoord = (q, r) => {
    const x = hexSize * (3 / 2 * q);
    const y = hexSize * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
    return { x, y };
  };

  const hexRound = (q, r) => {
    let s = -q - r;
    let rx = Math.round(q);
    let ry = Math.round(r);
    let rz = Math.round(s);

    const x_diff = Math.abs(rx - q);
    const y_diff = Math.abs(ry - r);
    const z_diff = Math.abs(rz - s);

    if (x_diff > y_diff && x_diff > z_diff) {
      rx = -ry - rz;
    } else if (y_diff > z_diff) {
      ry = -rx - rz;
    } else {
      rz = -rx - ry;
    }
    return { q: rx, r: ry, s: rz };
  };

  const drawHex = (ctx, q, r, color, opacity = 1, borderColor = '#ccc') => {
    const { x, y } = toPixelCoord(q, r);
    const originX = canvasRef.current.width / 2;
    const originY = canvasRef.current.height / 2;
    
    // Check if this hex is selected
    const col = String.fromCharCode(65 + q);
    const row = -q - r + 1;
    const hexCoord = `${col}${row}`;
    const isSelected = selectedHex === hexCoord;
    
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const pointX = originX + x + hexSize * Math.cos(angle);
      const pointY = originY + y + hexSize * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(pointX, pointY);
      } else {
        ctx.lineTo(pointX, pointY);
      }
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = isSelected ? '#60A5FA' : borderColor;
    ctx.lineWidth = isSelected ? 4 : 1;
    ctx.stroke();

    // Add glow effect for selected hex
    if (isSelected) {
      ctx.shadowColor = '#3B82F6';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw coordinate text
    ctx.fillStyle = isSelected ? '#60A5FA' : '#666';
    ctx.font = isSelected ? 'bold 11px Inter' : '10px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hexCoord, originX + x, originY + y);
  };

  const drawUnit = (ctx, unit, playerSide) => {
    const col = unit.position.charCodeAt(0) - 65;
    const row = parseInt(unit.position.substring(1), 10) - 1;
    const r = -col - row;
    const { x, y } = toPixelCoord(col, r);
    const originX = canvasRef.current.width / 2;
    const originY = canvasRef.current.height / 2;
    const unitX = originX + x;
    const unitY = originY + y;

    // Check visibility for player view
    const isVisible = viewMode === 'umpire' || unit.side === playerSide || unit.spotted;
    if (!isVisible) return;

    // Draw unit circle
    ctx.beginPath();
    ctx.arc(unitX, unitY, hexSize / 2, 0, 2 * Math.PI);
    ctx.fillStyle = unit.side === 'Blue' ? '#3B82F6' : '#EF4444';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Add subtle glow for units
    ctx.shadowColor = unit.side === 'Blue' ? '#3B82F6' : '#EF4444';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw unit ID
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unit.id, unitX, unitY);
  };

  const drawTerrain = (ctx) => {
    const originX = canvasRef.current.width / 2;
    const originY = canvasRef.current.height / 2;
    for (const hexCoord in terrain) {
      const col = hexCoord.charCodeAt(0) - 65;
      const row = parseInt(hexCoord.substring(1), 10) - 1;
      const r = -col - row;
      const { x, y } = toPixelCoord(col, r);
      let terrainColor = '';
      switch (terrain[hexCoord]) {
        case 'hill':
          terrainColor = '#A16207';
          break;
        case 'forest':
          terrainColor = '#15803D';
          break;
        case 'river':
          terrainColor = '#3B82F6';
          break;
        case 'town':
          terrainColor = '#6B7280';
          break;
        default:
          terrainColor = '#22C55E'; // Default plain terrain
          break;
      }
      drawHex(ctx, col, r, terrainColor, 0.6, '#E5E7EB');
    }
  };

  const calculateDistance = (pos1, pos2) => {
    const q1 = pos1.charCodeAt(0) - 65;
    const s1 = parseInt(pos1.substring(1), 10) - 1;
    const r1 = -q1 - s1;
    const q2 = pos2.charCodeAt(0) - 65;
    const s2 = parseInt(pos2.substring(1), 10) - 1;
    const r2 = -q2 - s2;
    return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(s1 - s2)) / 2;
  };

  const runSpottingChecks = () => {
    const updatedUnits = units.map(unit => ({ ...unit, spotted: false }));
    const playerSide = 'Blue'; // Hardcoded for this prototype
    const spottingRange = 3;

    updatedUnits.forEach(unit => {
      if (unit.side === playerSide) {
        // Find nearby enemy units
        const enemies = updatedUnits.filter(e => e.side !== playerSide);
        enemies.forEach(enemy => {
          if (!enemy.spotted) {
            const distance = calculateDistance(unit.position, enemy.position);
            if (distance <= spottingRange) {
              enemy.spotted = true;
            }
          }
        });
      }
    });
    setUnits(updatedUnits);
    logEvent('Spotting checks completed. Enemy units have been revealed based on proximity.');
  };

  const resolveOrders = () => {
    logEvent('Resolving player orders...');
    const updatedUnits = units.map(unit => {
      if (unit.orders) {
        // A very simplified movement parser. "advance north to C5" -> moves unit to C5
        const newPositionMatch = unit.orders.match(/to\s+([A-Z]\d+)/i);
        if (newPositionMatch) {
          const newPos = newPositionMatch[1].toUpperCase();
          return { ...unit, position: newPos, orders: null };
        }
      }
      return { ...unit, orders: null };
    });
    setUnits(updatedUnits);
    logEvent('Units moved according to orders.');
  };

  const logEvent = (message) => {
    setTurnLog(prev => [`Turn ${prev.length + 1}: ${message}`, ...prev]);
  };

  const handleTurnResolution = () => {
    resolveOrders();
    runSpottingChecks();
    logEvent('Turn resolution complete. Check the map for updated positions.');
  };

  const handleCanvasClick = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - canvas.width / 2;
    const y = event.clientY - rect.top - canvas.height / 2;

    const q = (x * 2 / 3) / hexSize;
    const r = (-x / 3 + Math.sqrt(3) / 3 * y) / hexSize;
    const hex = hexRound(q, r);
    const col = String.fromCharCode(65 + hex.q);
    const row = -hex.q - hex.r + 1;
    const hexCoord = `${col}${row}`;
    setSelectedHex(hexCoord);
  };

  const handleAssignTerrain = (type) => {
    if (selectedHex) {
      setTerrain(prev => ({ ...prev, [selectedHex]: type }));
    }
  };

  const handlePlaceUnit = () => {
    if (selectedHex) {
      const newUnit = {
        id: `New Unit ${units.length + 1}`,
        side: viewMode === 'umpire' ? 'Red' : 'Blue',
        position: selectedHex,
        strength: 500,
        morale: 3,
        cohesion: 'steady',
        orders: null,
      };
      setUnits([...units, newUnit]);
    }
  };

  const handleMapUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const imageUrl = URL.createObjectURL(file);
      setMapImage(imageUrl);
    }
  };

  const handleUnitsUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const newUnits = JSON.parse(e.target.result);
          if (Array.isArray(newUnits)) {
            setUnits(newUnits);
            alert('Units loaded successfully!');
          } else {
            alert('Error: JSON file must contain an array of units.');
          }
        } catch (err) {
          alert('Error parsing JSON file. Please check the file format.');
        }
      };
      reader.readAsText(file);
    } else {
      alert('Please upload a valid JSON file.');
    }
  };

  // Canvas drawing effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.6;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const originX = canvas.width / 2;
      const originY = canvas.height / 2;

      // Draw map image if it exists
      if (mapImage) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          drawGameElements();
        };
        img.src = mapImage;
      } else {
        drawGameElements();
      }

      function drawGameElements() {
        // Draw grid
        for (let q = -boardSize.width / 2; q < boardSize.width / 2; q++) {
          for (let r = -boardSize.height / 2; r < boardSize.height / 2; r++) {
            drawHex(ctx, q, r, '#fff', 0.1, '#ccc');
          }
        }
        // Draw terrain on top of grid
        drawTerrain(ctx);
        // Draw units
        const playerSide = 'Blue';
        units.forEach(unit => drawUnit(ctx, unit, playerSide));
      }
    };

    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, [units, terrain, viewMode, mapImage]);

  return (
    <div className="min-h-screen bg-gray-850 text-gray-100 font-sans p-4 flex flex-col items-center transition-all duration-300">
      <div className="w-full max-w-7xl flex flex-col md:flex-row gap-4 mb-6">
        {/* Game Title and Controls */}
        <div className="flex-1 bg-gray-800 rounded-xl shadow-elevated p-6 space-y-4 border border-gray-700">
          <h1 className="text-3xl font-bold text-center text-blue-400">Kriegsspiel Web App</h1>
          <div className="flex justify-center gap-3 flex-wrap">
            <button
              onClick={() => setShowSetup(true)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                showSetup ? 'bg-purple-600 text-white ring-2 ring-purple-400' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              <Settings size={16} /> Setup
            </button>
            <button
              onClick={() => setViewMode('player')}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                viewMode === 'player' ? 'bg-blue-600 text-white ring-2 ring-blue-400 border-b-2 border-blue-300' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              <Users size={16} /> Player View
            </button>
            <button
              onClick={() => setViewMode('umpire')}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                viewMode === 'umpire' ? 'bg-blue-600 text-white ring-2 ring-blue-400 border-b-2 border-blue-300' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              <Eye size={16} /> Umpire View
            </button>
            <button
              onClick={handleTurnResolution}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              <Swords size={16} /> Resolve Turn
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-6">
        {showSetup ? (
          <div className="flex-1 bg-gray-800 rounded-xl shadow-elevated p-8 flex flex-col items-center justify-center space-y-8 border border-gray-700 transition-all duration-300">
            <h2 className="text-2xl font-bold text-blue-400">Battle Setup</h2>
            <p className="text-gray-400 text-center max-w-md">As the Umpire, upload your map and force list to begin the battle.</p>
            
            {/* Map Upload Section */}
            <div className="bg-gray-750 rounded-xl p-6 w-full max-w-lg flex flex-col items-center space-y-4 border border-gray-600">
              <h3 className="text-xl font-semibold text-blue-300">1. Upload Map</h3>
              <p className="text-gray-300 text-sm text-center">Your custom map will be displayed as the background for the hex grid.</p>
              <label htmlFor="map-upload" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-600 hover:bg-gray-500 text-white transition-all duration-300 cursor-pointer transform hover:scale-105 shadow-md">
                <Upload size={20} /> Select Map Image
              </label>
              <input
                id="map-upload"
                type="file"
                accept="image/*"
                onChange={handleMapUpload}
                className="hidden"
              />
              {mapImage && <p className="text-sm text-green-400 bg-green-900/30 px-3 py-1 rounded-lg border border-green-600">✓ Map uploaded successfully!</p>}
            </div>
            <hr className="w-full border-gray-600" />

            {/* Units Upload Section */}
            <div className="bg-gray-700 rounded-xl p-6 w-full max-w-lg flex flex-col items-center space-y-4 border border-gray-600">
              <h3 className="text-xl font-semibold text-blue-300">2. Upload Force List (JSON)</h3>
              <p className="text-gray-300 text-sm text-center">Provide a JSON file with your unit data. <br />Example: <code className="bg-gray-800 px-2 py-1 rounded">[{`"id": "1st Blue Infantry", "side": "Blue", "position": "C4"`}]</code></p>
              <label htmlFor="units-upload" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-600 hover:bg-gray-500 text-white transition-all duration-300 cursor-pointer transform hover:scale-105 shadow-md">
                <Upload size={20} /> Select Units JSON
              </label>
              <input
                id="units-upload"
                type="file"
                accept=".json"
                onChange={handleUnitsUpload}
                className="hidden"
              />
              {units.length > 0 && <p className="text-sm text-green-400 bg-green-900/30 px-3 py-1 rounded-lg border border-green-600">✓ {units.length} units loaded successfully!</p>}
            </div>

            <button
              onClick={() => setShowSetup(false)}
              className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white text-lg font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg ring-2 ring-green-400/50"
            >
              <Swords size={20} className="inline-block mr-2" /> Go to Battle
            </button>
          </div>
        ) : (
          <>
            {/* Left Panel - Map & Player Input */}
            <div className="flex-1 bg-gray-800 rounded-xl shadow-elevated p-6 flex flex-col items-center border border-gray-700 transition-all duration-300">
              <h2 className="text-xl font-semibold mb-4 text-center text-blue-300">Battle Map</h2>
              <div className="bg-gray-700 rounded-xl w-full p-3 border border-gray-600">
                <canvas ref={canvasRef} onClick={handleCanvasClick} className="w-full h-auto rounded-lg cursor-crosshair" />
              </div>
              {viewMode === 'umpire' && (
                <div className="mt-6 w-full bg-gray-750 rounded-xl p-5 space-y-4 border border-gray-600 transition-all duration-300">
                  <h3 className="text-lg font-semibold text-center text-purple-300">Umpire Tools</h3>
                  {selectedHex && (
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="bg-gray-800 px-4 py-2 rounded-lg border border-blue-500">
                        <p className="text-gray-300">Selected Hex: <span className="font-bold text-blue-400 text-lg">{selectedHex}</span></p>
                      </div>
                      <div className="terrain-grid w-full max-w-md">
                        <button onClick={() => handleAssignTerrain('plain')} className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-all duration-300 transform hover:scale-105 text-sm">🌾 Plain</button>
                        <button onClick={() => handleAssignTerrain('hill')} className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-all duration-300 transform hover:scale-105 text-sm">⛰️ Hill</button>
                        <button onClick={() => handleAssignTerrain('forest')} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all duration-300 transform hover:scale-105 text-sm">🌲 Forest</button>
                        <button onClick={() => handleAssignTerrain('river')} className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all duration-300 transform hover:scale-105 text-sm">🌊 River</button>
                        <button onClick={() => handleAssignTerrain('town')} className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-all duration-300 transform hover:scale-105 text-sm">🏘️ Town</button>
                        <button onClick={handlePlaceUnit} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all duration-300 transform hover:scale-105 text-sm col-span-1"><PlusCircle size={14} className="inline-block mr-1" />Unit</button>
                      </div>
                    </div>
                  )}
                  {!selectedHex && (
                    <p className="text-gray-500 text-center text-sm">Click on a hex to select it and assign terrain or place units</p>
                  )}
                </div>
              )}
              {viewMode === 'player' && (
                <div className="mt-6 w-full bg-gray-750 rounded-xl p-5 space-y-4 border border-gray-600 transition-all duration-300">
                  <h3 className="text-lg font-semibold text-center text-blue-300">Player Orders</h3>
                  <p className="text-sm text-gray-400">
                    Submit orders for your units. For example: "1st Blue Infantry advance to C5."
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={ordersInput}
                      onChange={(e) => setOrdersInput(e.target.value)}
                      placeholder="Enter orders..."
                      className="flex-1 p-3 rounded-xl bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 border border-gray-600"
                    />
                    <button
                      onClick={() => {
                        // This is a simple prototype, so we'll apply the same order to all units for now.
                        setUnits(units.map(u => ({ ...u, orders: ordersInput })));
                        setOrdersInput('');
                        logEvent('Orders received. Awaiting turn resolution.');
                      }}
                      className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all duration-300 transform hover:scale-105 shadow-md"
                    >
                      <ArrowRightCircle size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Unit and Turn Log */}
            <div className="flex-1 bg-gray-800 rounded-xl shadow-elevated p-6 space-y-6 border border-gray-700 transition-all duration-300">
              <div className="bg-gray-750 rounded-xl p-5 space-y-3 border border-gray-600">
                <h2 className="text-xl font-semibold text-center mb-3 text-blue-300">Unit Status</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 max-h-80 overflow-y-auto">
                  {units.map(unit => {
                    const isVisible = viewMode === 'umpire' || unit.side === 'Blue' || unit.spotted;
                    if (!isVisible) return null;
                    return (
                      <div key={unit.id} className={`bg-gray-900 rounded-xl p-4 shadow-inner border border-gray-600 transition-all duration-300 hover:shadow-lg ${unit.side === 'Blue' ? 'unit-card-blue' : 'unit-card-red'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-3 h-3 rounded-full ${unit.side === 'Blue' ? 'bg-blue-500' : 'bg-red-500'}`} />
                          <h3 className="font-semibold text-base">{unit.id}</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                          <div className="flex items-center gap-1"><Map size={14} /> Pos: <span className="text-white">{unit.position}</span></div>
                          <div className="flex items-center gap-1"><Shield size={14} /> Str: <span className="text-white">{unit.strength}</span></div>
                          <div className="flex items-center gap-1"><Heart size={14} /> Morale: <span className="text-white">{unit.morale}</span></div>
                          <div className="flex items-center gap-1"><Bolt size={14} /> Cohesion: <span className="text-white">{unit.cohesion}</span></div>
                          <div className="flex items-center gap-1 col-span-2"><Scroll size={14} /> Orders: <span className={`truncate ${unit.orders ? 'text-yellow-400' : 'text-gray-500'}`}>{unit.orders || 'None'}</span></div>
                        </div>
                      </div>
                    );
                  })}
                  {units.filter(unit => viewMode === 'umpire' || unit.side === 'Blue' || unit.spotted).length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <Users size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No units visible</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-750 rounded-xl p-5 space-y-3 border border-gray-600">
                <h2 className="text-xl font-semibold text-center mb-3 text-blue-300">Turn Log</h2>
                <div className="h-48 overflow-y-auto bg-gray-900 rounded-lg p-4 border border-gray-600">
                  {turnLog.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <Scroll size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No events yet</p>
                    </div>
                  ) : (
                    <ul className="space-y-2 text-sm text-gray-300">
                      {turnLog.map((log, index) => (
                        <li key={index} className="bg-gray-800 rounded-lg p-2 border-l-2 border-blue-500">{log}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}