import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      if (socket) { socket.disconnect(); setSocket(null); }
      return;
    }

    const s = io('/', {
      auth: { token: localStorage.getItem('findit_token') },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      setConnected(true);
      s.emit('join', user.id);
    });
    s.on('disconnect', () => setConnected(false));

    setSocket(s);
    return () => { s.disconnect(); };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
