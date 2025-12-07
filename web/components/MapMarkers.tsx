import React from 'react';
import { Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { User } from '../types';

// Fix for default Leaflet icon not finding images.
// In a browser ESM environment, we cannot import .png files directly.
// We must point to the CDN for the default marker assets.
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper to generate consistent colors based on string (User ID)
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

interface MapMarkersProps {
  users: User[];
  myId: string | null;
  partnerId: string | null;
  onUserClick: (user: User) => void;
}

export const MapMarkers: React.FC<MapMarkersProps> = ({ users, myId, partnerId, onUserClick }) => {
  const map = useMap();

  // Find partner for line drawing
  const me = users.find(u => u.id === myId);
  const partner = users.find(u => u.id === partnerId);

  return (
    <>
      {/* Draw Radius Circle around Me */}
      {me && (
        <Circle 
          center={[me.lat, me.lon]}
          pathOptions={{
            color: '#0891b2', // Cyan-600
            fillColor: '#06b6d4', // Cyan-500
            fillOpacity: 0.1,
            weight: 1,
            dashArray: '5, 5'
          }}
          radius={500} // 500 meters radius visual
        />
      )}

      {users.map((user) => {
        const isMe = user.id === myId;
        const isPartner = user.id === partnerId;
        const baseColor = isMe ? '#22d3ee' : isPartner ? '#f472b6' : stringToColor(user.id);
        
        // Custom HTML Icon for Neon Effect
        const iconHtml = `
          <div class="relative flex items-center justify-center w-6 h-6">
            ${user.status === 'requesting' || user.status === 'chatting' ? 
              `<span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background-color: ${baseColor}"></span>` 
              : ''}
            <span class="relative inline-flex rounded-full h-4 w-4 border-2 border-white shadow-lg" style="background-color: ${baseColor}"></span>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-div-icon',
          html: iconHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        return (
          <Marker 
            key={user.id} 
            position={[user.lat, user.lon]} 
            icon={customIcon}
            eventHandlers={{
              click: () => {
                if (!isMe) onUserClick(user);
              }
            }}
          >
            <Popup className="futuristic-popup" closeButton={false}>
              <div className="font-sans text-sm">
                <div className="font-bold mb-1" style={{ color: baseColor }}>{isMe ? 'YOU' : user.name}</div>
                <div className="text-xs text-slate-400 font-mono">{user.id.slice(0, 8)}...</div>
                <div className="mt-1">
                  <span className={`text-[10px] uppercase px-1 rounded ${
                    user.status === 'chatting' ? 'bg-red-500 text-white' : 
                    user.status === 'requesting' ? 'bg-yellow-500 text-black' : 
                    'bg-green-500 text-black'
                  }`}>
                    {user.status}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Connection Line */}
      {me && partner && (
        <Polyline 
          positions={[
            [me.lat, me.lon],
            [partner.lat, partner.lon]
          ]}
          pathOptions={{
            color: '#f472b6',
            weight: 3,
            dashArray: '10, 10',
            opacity: 0.8,
            className: 'animate-pulse' // Tailwind class via leaflet not direct, but we can try CSS or keep simple
          }}
        />
      )}
    </>
  );
};